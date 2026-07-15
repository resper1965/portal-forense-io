import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/uploads/:id — Download an uploaded file (serve from R2).
 *
 * Verifies access: admin can download any upload, clients can only download
 * uploads from their own projects.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { userEmail, isAdmin } = data;
  const uploadId = params.id as string;

  try {
    // Fetch upload with project and client info
    const upload = await env.DB.prepare(
      `SELECT u.*, p.cliente_id
       FROM uploads u
       JOIN projetos p ON u.projeto_id = p.id
       WHERE u.id = ?`
    )
      .bind(uploadId)
      .first<{
        id: string;
        r2_key: string;
        nome_original: string;
        mime_type: string;
        tamanho: number;
        cliente_id: string;
      }>();

    if (!upload) {
      return errorResponse('Upload não encontrado.', 404);
    }

    // Access control: admin or project client active contact
    if (!isAdmin) {
      const hasAccess = await env.DB.prepare(
        `SELECT 1 FROM contatos_cliente cc
         JOIN clientes c ON cc.cliente_id = c.id
         WHERE cc.cliente_id = ? AND cc.email = ? AND cc.ativo = 1 AND c.ativo = 1`
      )
        .bind(upload.cliente_id, userEmail)
        .first();

      if (!hasAccess) {
        return errorResponse('Acesso negado a este upload.', 403);
      }
    }

    // Fetch from R2
    const r2Object = await env.BUCKET.get(upload.r2_key);

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
          `upload:${uploadId}:${upload.r2_key}`,
          context.request.headers.get('CF-Connecting-IP') || 'unknown',
          context.request.headers.get('User-Agent') || ''
        )
        .run()
        .catch(() => {})
    );

    return new Response(r2Object.body, {
      status: 200,
      headers: {
        'Content-Type': upload.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${upload.nome_original}"`,
        'Cache-Control': 'private, max-age=3600',
        ...(upload.tamanho ? { 'Content-Length': String(upload.tamanho) } : {}),
      },
    });
  } catch (err) {
    return errorResponse(`Erro ao baixar upload: ${(err as Error).message}`, 500);
  }
};

/**
 * DELETE /api/uploads/:id — Delete upload + R2 object (admin only).
 */
export const onRequestDelete: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { isAdmin } = data;
  const uploadId = params.id as string;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    const upload = await env.DB.prepare(
      'SELECT id, r2_key, nome_original FROM uploads WHERE id = ?'
    )
      .bind(uploadId)
      .first<{ id: string; r2_key: string; nome_original: string }>();

    if (!upload) {
      return errorResponse('Upload não encontrado.', 404);
    }

    // Delete from D1
    await env.DB.prepare('DELETE FROM uploads WHERE id = ?')
      .bind(uploadId)
      .run();

    // Delete from R2 (non-blocking)
    if (upload.r2_key) {
      context.waitUntil(
        env.BUCKET.delete(upload.r2_key).catch(() => {})
      );
    }

    return jsonResponse({ deleted: true, nome_original: upload.nome_original });
  } catch (err) {
    return errorResponse(`Erro ao excluir upload: ${(err as Error).message}`, 500);
  }
};
