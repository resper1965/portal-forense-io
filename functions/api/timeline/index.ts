import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/timeline — Timeline entries for a project.
 *
 * Query params: projeto_id (required)
 * Clients see only visivel_cliente=1 entries.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail, isAdmin } = data;

  const url = new URL(request.url);
  const projetoId = url.searchParams.get('projeto_id');

  if (!projetoId) {
    return errorResponse('Query param obrigatório: projeto_id.', 400);
  }

  try {
    // Verify user has access to this project
    if (!isAdmin) {
      const hasAccess = await env.DB.prepare(
        `SELECT 1 FROM projetos p
         JOIN clientes c ON p.cliente_id = c.id
         JOIN contatos_cliente cc ON cc.cliente_id = c.id
         WHERE p.id = ? AND cc.email = ? AND cc.ativo = 1 AND c.ativo = 1`
      )
        .bind(projetoId, userEmail)
        .first();

      if (!hasAccess) {
        return errorResponse('Acesso negado a este projeto.', 403);
      }
    }

    // Fetch timeline entries
    const query = isAdmin
      ? 'SELECT * FROM timeline WHERE projeto_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM timeline WHERE projeto_id = ? AND visivel_cliente = 1 ORDER BY created_at DESC';

    const { results } = await env.DB.prepare(query)
      .bind(projetoId)
      .all();

    return jsonResponse({ timeline: results || [] });
  } catch (err) {
    return errorResponse(`Erro ao buscar timeline: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/timeline — Add a timeline entry (admin only).
 *
 * Body: { projeto_id, tipo, titulo, descricao?, visivel_cliente? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { isAdmin, userEmail } = data;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    const body = await request.json<{
      projeto_id: string;
      tipo: string;
      titulo: string;
      descricao?: string;
      visivel_cliente?: number;
    }>();

    // Validate required fields
    if (!body.projeto_id || !body.tipo || !body.titulo) {
      return errorResponse('Campos obrigatórios: projeto_id, tipo, titulo.', 400);
    }

    // Verify project exists
    const projeto = await env.DB.prepare('SELECT id FROM projetos WHERE id = ?')
      .bind(body.projeto_id)
      .first();

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    const timelineId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        timelineId,
        body.projeto_id,
        body.tipo,
        body.titulo,
        body.descricao || null,
        body.visivel_cliente ?? 1,
        userEmail,
        now
      )
      .run();

    return jsonResponse(
      {
        id: timelineId,
        projeto_id: body.projeto_id,
        tipo: body.tipo,
        titulo: body.titulo,
        visivel_cliente: body.visivel_cliente ?? 1,
        created_at: now,
      },
      201
    );
  } catch (err) {
    return errorResponse(`Erro ao criar entrada na timeline: ${(err as Error).message}`, 500);
  }
};
