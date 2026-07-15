import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * Helper: verify the user has access to a project.
 * Admin can access any project; clients can only access their own.
 */
async function verifyProjectAccess(
  env: Env,
  projetoId: string,
  userEmail: string,
  isAdmin: boolean
): Promise<{ allowed: boolean; projeto: Record<string, unknown> | null }> {
  const projeto = await env.DB.prepare(
    `SELECT p.*, c.razao_social AS cliente_nome, c.cnpj AS cliente_cnpj
     FROM projetos p
     JOIN clientes c ON p.cliente_id = c.id
     WHERE p.id = ?`
  )
    .bind(projetoId)
    .first<Record<string, unknown>>();

  if (!projeto) {
    return { allowed: false, projeto: null };
  }

  if (isAdmin) {
    return { allowed: true, projeto };
  }

  // Client can only access their own projects - user must be an active contact of this client
  const contact = await env.DB.prepare(
    'SELECT id FROM contatos_cliente WHERE cliente_id = ? AND email = ? AND ativo = 1'
  )
    .bind(projeto.cliente_id, userEmail)
    .first();

  return {
    allowed: !!contact,
    projeto,
  };
}

/**
 * GET /api/projetos/:id — Project detail with entregáveis, uploads, timeline.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { userEmail, isAdmin } = data;
  const projetoId = params.id as string;

  try {
    const { allowed, projeto } = await verifyProjectAccess(env, projetoId, userEmail, isAdmin);

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    if (!allowed) {
      return errorResponse('Acesso negado a este projeto.', 403);
    }

    // Fetch entregáveis (clients see only publicado=1)
    const entregaveisQuery = isAdmin
      ? 'SELECT * FROM entregaveis WHERE projeto_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM entregaveis WHERE projeto_id = ? AND publicado = 1 ORDER BY created_at DESC';

    const { results: entregaveis } = await env.DB.prepare(entregaveisQuery)
      .bind(projetoId)
      .all();

    // Fetch uploads
    const { results: uploads } = await env.DB.prepare(
      'SELECT * FROM uploads WHERE projeto_id = ? ORDER BY created_at DESC'
    )
      .bind(projetoId)
      .all();

    // Fetch timeline (clients see only visivel_cliente=1)
    const timelineQuery = isAdmin
      ? 'SELECT * FROM timeline WHERE projeto_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM timeline WHERE projeto_id = ? AND visivel_cliente = 1 ORDER BY created_at DESC';

    const { results: timeline } = await env.DB.prepare(timelineQuery)
      .bind(projetoId)
      .all();

    return jsonResponse({
      projeto,
      entregaveis: entregaveis || [],
      uploads: uploads || [],
      timeline: timeline || [],
    });
  } catch (err) {
    return errorResponse(`Erro ao buscar projeto: ${(err as Error).message}`, 500);
  }
};

/**
 * PUT /api/projetos/:id — Update project (admin only).
 *
 * Body: any subset of project fields to update.
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data, params } = context;
  const { isAdmin, userEmail } = data;
  const projetoId = params.id as string;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    // Verify project exists
    const existing = await env.DB.prepare('SELECT * FROM projetos WHERE id = ?')
      .bind(projetoId)
      .first<Record<string, unknown>>();

    if (!existing) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    const body = await request.json<Record<string, unknown>>();
    const now = new Date().toISOString();

    // Allowed fields for update
    const allowedFields = [
      'codigo_proposta', 'titulo', 'descricao', 'github_repo_url', 'status',
      'valor', 'data_inicio', 'data_entrega',
    ];

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

    // Always update updated_at
    setClauses.push('updated_at = ?');
    values.push(now);

    // Add the WHERE clause value
    values.push(projetoId);

    await env.DB.prepare(
      `UPDATE projetos SET ${setClauses.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // If status changed, add timeline entry
    if (body.status && body.status !== existing.status) {
      const statusLabels: Record<string, string> = {
        proposta: 'Proposta enviada',
        em_andamento: 'Projeto em andamento',
        entregue: 'Projeto entregue',
        arquivado: 'Projeto arquivado',
      };
      const label = statusLabels[body.status as string] || `Status alterado para ${body.status}`;

      context.waitUntil(
        env.DB.prepare(
          `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
           VALUES (?, ?, 'status', ?, ?, 1, ?, datetime('now'))`
        )
          .bind(
            crypto.randomUUID(),
            projetoId,
            label,
            `Status alterado de "${existing.status}" para "${body.status}"`,
            userEmail
          )
          .run()
          .catch(() => {})
      );
    }

    // Fetch updated project
    const updated = await env.DB.prepare('SELECT * FROM projetos WHERE id = ?')
      .bind(projetoId)
      .first();

    return jsonResponse({ projeto: updated });
  } catch (err) {
    return errorResponse(`Erro ao atualizar projeto: ${(err as Error).message}`, 500);
  }
};

/**
 * DELETE /api/projetos/:id — Delete project (admin only).
 *
 * Cascades to entregáveis, uploads, and timeline via ON DELETE CASCADE.
 */
export const onRequestDelete: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data, params } = context;
  const { isAdmin } = data;
  const projetoId = params.id as string;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    // Check project exists
    const projeto = await env.DB.prepare('SELECT id, codigo_proposta FROM projetos WHERE id = ?')
      .bind(projetoId)
      .first<{ id: string; codigo_proposta: string }>();

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    // Get all R2 keys to clean up (entregáveis + uploads)
    const { results: entregaveis } = await env.DB.prepare(
      'SELECT r2_key FROM entregaveis WHERE projeto_id = ?'
    )
      .bind(projetoId)
      .all<{ r2_key: string }>();

    const { results: uploads } = await env.DB.prepare(
      'SELECT r2_key FROM uploads WHERE projeto_id = ?'
    )
      .bind(projetoId)
      .all<{ r2_key: string }>();

    // Delete from D1 (cascades to entregaveis, uploads, timeline)
    await env.DB.prepare('DELETE FROM projetos WHERE id = ?')
      .bind(projetoId)
      .run();

    // Clean up R2 objects (non-blocking)
    const allKeys = [
      ...(entregaveis || []).map((e) => e.r2_key),
      ...(uploads || []).map((u) => u.r2_key),
    ].filter(Boolean);

    if (allKeys.length > 0) {
      context.waitUntil(
        Promise.all(
          allKeys.map((key) => env.BUCKET.delete(key).catch(() => {}))
        )
      );
    }

    return jsonResponse({ deleted: true, codigo_proposta: projeto.codigo_proposta });
  } catch (err) {
    return errorResponse(`Erro ao excluir projeto: ${(err as Error).message}`, 500);
  }
};
