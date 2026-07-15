import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * Helper: verify user has access to an entregável's project.
 */
async function getEntregavelWithAccess(
  env: Env,
  entregavelId: string,
  userEmail: string,
  isAdmin: boolean
): Promise<{ allowed: boolean; entregavel: Record<string, unknown> | null; clienteEmail?: string }> {
  const entregavel = await env.DB.prepare(
    `SELECT e.*, p.codigo_proposta AS projeto_codigo, p.cliente_id,
            c.razao_social AS cliente_nome,
            (SELECT email FROM contatos_cliente WHERE cliente_id = c.id AND ativo = 1 LIMIT 1) AS cliente_email
     FROM entregaveis e
     JOIN projetos p ON e.projeto_id = p.id
     JOIN clientes c ON p.cliente_id = c.id
     WHERE e.id = ?`
  )
    .bind(entregavelId)
    .first<Record<string, unknown>>();

  if (!entregavel) {
    return { allowed: false, entregavel: null };
  }

  if (isAdmin) {
    return { allowed: true, entregavel, clienteEmail: entregavel.cliente_email as string };
  }

  // Client: must be an active contact of the project's client
  const contact = await env.DB.prepare(
    'SELECT id FROM contatos_cliente WHERE cliente_id = ? AND email = ? AND ativo = 1'
  )
    .bind(entregavel.cliente_id, userEmail)
    .first();

  const allowed = !!contact && entregavel.publicado === 1;

  return {
    allowed,
    entregavel: allowed ? entregavel : null,
    clienteEmail: contact ? userEmail : undefined,
  };
}

/**
 * GET /api/entregaveis/:id — Get entregável metadata.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { userEmail, isAdmin } = data;
  const entregavelId = params.id as string;

  try {
    const { allowed, entregavel } = await getEntregavelWithAccess(env, entregavelId, userEmail, isAdmin);

    if (!entregavel) {
      return errorResponse('Entregável não encontrado.', 404);
    }

    if (!allowed) {
      return errorResponse('Acesso negado a este entregável.', 403);
    }

    return jsonResponse({ entregavel });
  } catch (err) {
    return errorResponse(`Erro ao buscar entregável: ${(err as Error).message}`, 500);
  }
};

/**
 * PUT /api/entregaveis/:id — Update entregável (admin only).
 *
 * Commonly used to toggle publicado, update title, description, etc.
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data, params } = context;
  const { isAdmin, userEmail } = data;
  const entregavelId = params.id as string;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    // Fetch existing entregável with project info
    const existing = await env.DB.prepare(
      `SELECT e.*, p.codigo_proposta AS projeto_codigo, c.razao_social AS cliente_nome,
              (SELECT email FROM contatos_cliente WHERE cliente_id = c.id AND ativo = 1 LIMIT 1) AS cliente_email
       FROM entregaveis e
       JOIN projetos p ON e.projeto_id = p.id
       JOIN clientes c ON p.cliente_id = c.id
       WHERE e.id = ?`
    )
      .bind(entregavelId)
      .first<Record<string, unknown>>();

    if (!existing) {
      return errorResponse('Entregável não encontrado.', 404);
    }

    const body = await request.json<Record<string, unknown>>();
    const now = new Date().toISOString();

    // Allowed fields for update
    const allowedFields = ['tipo', 'titulo', 'descricao', 'mime_type', 'publicado', 'versao'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('Nenhum campo para atualizar.', 400);
    }

    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(entregavelId);

    await env.DB.prepare(
      `UPDATE entregaveis SET ${setClauses.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // If toggling publicado from 0 to 1, send notification
    if (body.publicado === 1 && existing.publicado === 0) {
      const titulo = (body.titulo as string) || (existing.titulo as string);
      const tipo = (body.tipo as string) || (existing.tipo as string);

      const tipoLabels: Record<string, string> = {
        relatorio: 'Relatório',
        apresentacao: 'Apresentação',
        proposta: 'Proposta',
        anexo: 'Anexo',
      };
      const label = tipoLabels[tipo] || tipo;

      // Timeline entry
      context.waitUntil(
        env.DB.prepare(
          `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
           VALUES (?, ?, 'entrega', ?, ?, 1, ?, datetime('now'))`
        )
          .bind(
            crypto.randomUUID(),
            existing.projeto_id,
            `${label} publicado: ${titulo}`,
            `O ${label.toLowerCase()} "${titulo}" está disponível para visualização.`,
            userEmail
          )
          .run()
          .catch(() => {})
      );

      // Email notification (graceful)
      if (existing.cliente_email) {
        context.waitUntil(
          (async () => {
            try {
              if (env.EMAIL && typeof env.EMAIL.send === 'function') {
                await env.EMAIL.send({
                  to: existing.cliente_email as string,
                  from: 'portal@forense.io',
                  subject: `Novo ${label} disponível — ${titulo}`,
                  html: `<html><body style="font-family: 'Montserrat', sans-serif; color: #e0e0e0; background: #0a0a0f; padding: 20px;">` +
                    `<div style="border-bottom: 2px solid #00ade8; padding-bottom: 16px; margin-bottom: 24px;">` +
                    `<span style="font-size: 20px; font-weight: 500; color: #fff;">forense<span style="color: #00ade8;">.</span>io</span></div>` +
                    `<h2 style="color: #fff;">Olá, ${existing.cliente_nome}</h2>` +
                    `<p style="color: #ccc;">Um novo ${label.toLowerCase()} está disponível no seu portal:</p>` +
                    `<p style="color: #fff;"><strong>${titulo}</strong></p>` +
                    `<p><a href="https://portal.forense.io" style="background: #00ade8; color: #0a0a0f; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Acessar Portal</a></p>` +
                    `<p style="color: #666; font-size: 12px; margin-top: 32px;">forense.io · a ness. company</p>` +
                    `</body></html>`,
                  text: `Olá, ${existing.cliente_nome}. Um novo ${label.toLowerCase()} "${titulo}" está disponível em portal.forense.io`,
                });
              }
            } catch {
              // Silently ignore email errors
            }
          })()
        );
      }
    }

    // Return updated record
    const updated = await env.DB.prepare('SELECT * FROM entregaveis WHERE id = ?')
      .bind(entregavelId)
      .first();

    return jsonResponse({ entregavel: updated });
  } catch (err) {
    return errorResponse(`Erro ao atualizar entregável: ${(err as Error).message}`, 500);
  }
};

/**
 * DELETE /api/entregaveis/:id — Delete entregável + R2 object (admin only).
 */
export const onRequestDelete: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { isAdmin } = data;
  const entregavelId = params.id as string;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    const entregavel = await env.DB.prepare(
      'SELECT id, r2_key, titulo FROM entregaveis WHERE id = ?'
    )
      .bind(entregavelId)
      .first<{ id: string; r2_key: string; titulo: string }>();

    if (!entregavel) {
      return errorResponse('Entregável não encontrado.', 404);
    }

    // Delete from D1
    await env.DB.prepare('DELETE FROM entregaveis WHERE id = ?')
      .bind(entregavelId)
      .run();

    // Delete from R2 (non-blocking)
    if (entregavel.r2_key) {
      context.waitUntil(
        env.BUCKET.delete(entregavel.r2_key).catch(() => {})
      );
    }

    return jsonResponse({ deleted: true, titulo: entregavel.titulo });
  } catch (err) {
    return errorResponse(`Erro ao excluir entregável: ${(err as Error).message}`, 500);
  }
};
