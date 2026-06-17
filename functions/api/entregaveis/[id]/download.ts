import type { Env, UserContext } from '../../../types';
import { jsonResponse, errorResponse } from '../../../types';

/**
 * GET /api/entregaveis/:id/download — Serve entregável file from R2.
 *
 * Verifies access control before serving.
 * Logs download in access_log.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { userEmail, isAdmin } = data;
  const entregavelId = params.id as string;

  try {
    // Fetch entregável with project and client info
    const entregavel = await env.DB.prepare(
      `SELECT e.*, c.email AS cliente_email
       FROM entregaveis e
       JOIN projetos p ON e.projeto_id = p.id
       JOIN clientes c ON p.cliente_id = c.id
       WHERE e.id = ?`
    )
      .bind(entregavelId)
      .first<{
        id: string;
        r2_key: string;
        mime_type: string;
        titulo: string;
        tamanho: number;
        publicado: number;
        cliente_email: string;
      }>();

    if (!entregavel) {
      return errorResponse('Entregável não encontrado.', 404);
    }

    // Access control
    if (!isAdmin) {
      const emailMatch = entregavel.cliente_email?.toLowerCase() === userEmail.toLowerCase();
      if (!emailMatch || entregavel.publicado !== 1) {
        return errorResponse('Acesso negado a este entregável.', 403);
      }
    }

    // Fetch from R2
    const r2Object = await env.BUCKET.get(entregavel.r2_key);

    if (!r2Object) {
      return errorResponse('Arquivo não encontrado no storage.', 404);
    }

    // Log download (non-blocking)
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO access_log (id, email, acao, recurso, ip, user_agent, created_at)
         VALUES (?, ?, 'download', ?, ?, ?, datetime('now'))`
      )
        .bind(
          crypto.randomUUID(),
          userEmail,
          `entregavel:${entregavelId}:${entregavel.r2_key}`,
          context.request.headers.get('CF-Connecting-IP') || 'unknown',
          context.request.headers.get('User-Agent') || ''
        )
        .run()
        .catch(() => {})
    );

    // Determine content disposition
    const isInline = ['text/html', 'application/pdf', 'image/jpeg', 'image/png', 'image/gif'].includes(
      entregavel.mime_type
    );
    const disposition = isInline ? 'inline' : `attachment; filename="${entregavel.titulo}"`;

    // Serve the file
    return new Response(r2Object.body, {
      status: 200,
      headers: {
        'Content-Type': entregavel.mime_type || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
        ...(entregavel.tamanho ? { 'Content-Length': String(entregavel.tamanho) } : {}),
      },
    });
  } catch (err) {
    return errorResponse(`Erro ao baixar entregável: ${(err as Error).message}`, 500);
  }
};
