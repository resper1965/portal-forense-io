import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * POST /api/uploads/confirm — Confirm that a client upload completed.
 *
 * Body: { upload_id }
 *
 * Flow:
 * 1. Verify the upload belongs to the authenticated user
 * 2. Update upload status to 'recebido'
 * 3. Add timeline entry: "Arquivo recebido: {filename}"
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail, isAdmin } = data;

  try {
    const body = await request.json<{ upload_id: string }>();

    if (!body.upload_id) {
      return errorResponse('Campo obrigatório: upload_id.', 400);
    }

    // Fetch the upload record
    const upload = await env.DB.prepare(
      `SELECT u.*, p.codigo_proposta AS projeto_codigo
       FROM uploads u
       JOIN projetos p ON u.projeto_id = p.id
       WHERE u.id = ?`
    )
      .bind(body.upload_id)
      .first<{
        id: string;
        projeto_id: string;
        cliente_email: string;
        nome_original: string;
        r2_key: string;
        status: string;
        projeto_codigo: string;
      }>();

    if (!upload) {
      return errorResponse('Upload não encontrado.', 404);
    }

    // Verify ownership (unless admin)
    if (!isAdmin && upload.cliente_email.toLowerCase() !== userEmail.toLowerCase()) {
      return errorResponse('Este upload não pertence a você.', 403);
    }

    // Already confirmed?
    if (upload.status !== 'pendente') {
      return jsonResponse({
        upload_id: upload.id,
        status: upload.status,
        message: 'Upload já foi confirmado anteriormente.',
      });
    }

    // Update status to 'recebido'
    await env.DB.prepare(
      "UPDATE uploads SET status = 'recebido' WHERE id = ?"
    )
      .bind(body.upload_id)
      .run();

    // Add timeline entry (non-blocking)
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
         VALUES (?, ?, 'upload', ?, ?, 1, ?, datetime('now'))`
      )
        .bind(
          crypto.randomUUID(),
          upload.projeto_id,
          `Arquivo recebido: ${upload.nome_original}`,
          `O cliente enviou o arquivo "${upload.nome_original}" para o projeto ${upload.projeto_codigo}.`,
          userEmail
        )
        .run()
        .catch(() => {})
    );

    return jsonResponse({
      upload_id: upload.id,
      status: 'recebido',
      nome_original: upload.nome_original,
      message: 'Upload confirmado com sucesso.',
    });
  } catch (err) {
    return errorResponse(`Erro ao confirmar upload: ${(err as Error).message}`, 500);
  }
};
