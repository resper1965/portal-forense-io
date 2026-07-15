import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/projetos — List projects.
 *
 * Admin: returns ALL projects with client info.
 * Client: returns only projects where the client's contact email matches.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data } = context;
  const { userEmail, isAdmin } = data;

  try {
    let query: string;
    let params: string[];

    if (isAdmin) {
      // Admin sees all projects
      query = `
        SELECT
          p.*,
          c.razao_social AS cliente_nome,
          c.cnpj AS cliente_cnpj,
          (SELECT COUNT(*) FROM entregaveis e WHERE e.projeto_id = p.id) AS entregaveis_count,
          (SELECT COUNT(*) FROM uploads u WHERE u.projeto_id = p.id) AS uploads_count
        FROM projetos p
        JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      // Client sees only their own projects
      query = `
        SELECT
          p.*,
          c.razao_social AS cliente_nome,
          c.cnpj AS cliente_cnpj,
          (SELECT COUNT(*) FROM entregaveis e WHERE e.projeto_id = p.id AND e.publicado = 1) AS entregaveis_count,
          (SELECT COUNT(*) FROM uploads u WHERE u.projeto_id = p.id) AS uploads_count
        FROM projetos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN contatos_cliente cc ON cc.cliente_id = c.id
        WHERE cc.email = ? AND cc.ativo = 1 AND c.ativo = 1
        ORDER BY p.created_at DESC
      `;
      params = [userEmail];
    }

    const stmt = params.length > 0
      ? env.DB.prepare(query).bind(...params)
      : env.DB.prepare(query);

    const { results } = await stmt.all();

    return jsonResponse({ projetos: results || [] });
  } catch (err) {
    return errorResponse(`Erro ao listar projetos: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/projetos — Create a new project (admin only).
 *
 * Body: { codigo_proposta, cliente_id, titulo, descricao?, github_repo_url?, status?, valor?, data_inicio?, data_entrega? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { isAdmin, userEmail } = data;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    const body = await request.json<{
      codigo_proposta: string;
      cliente_id: string;
      titulo: string;
      descricao?: string;
      github_repo_url?: string;
      status?: string;
      valor?: number;
      data_inicio?: string;
      data_entrega?: string;
    }>();

    // Validate required fields
    if (!body.codigo_proposta || !body.cliente_id || !body.titulo) {
      return errorResponse('Campos obrigatórios: codigo_proposta, cliente_id, titulo.', 400);
    }

    // Verify client exists
    const cliente = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
      .bind(body.cliente_id)
      .first();

    if (!cliente) {
      return errorResponse('Cliente não encontrado.', 404);
    }

    const projetoId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert project
    await env.DB.prepare(
      `INSERT INTO projetos (id, codigo_proposta, cliente_id, titulo, descricao, github_repo_url, status, valor, data_inicio, data_entrega, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        projetoId,
        body.codigo_proposta,
        body.cliente_id,
        body.titulo,
        body.descricao || null,
        body.github_repo_url || null,
        body.status || 'proposta',
        body.valor || null,
        body.data_inicio || null,
        body.data_entrega || null,
        now,
        now
      )
      .run();

    // Add timeline entry (non-blocking)
    const timelineId = crypto.randomUUID();
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
         VALUES (?, ?, 'status', 'Projeto criado', ?, 1, ?, datetime('now'))`
      )
        .bind(timelineId, projetoId, `Projeto ${body.codigo_proposta} criado por ${userEmail}`, userEmail)
        .run()
        .catch(() => {})
    );

    return jsonResponse(
      {
        id: projetoId,
        codigo_proposta: body.codigo_proposta,
        cliente_id: body.cliente_id,
        titulo: body.titulo,
        descricao: body.descricao || null,
        github_repo_url: body.github_repo_url || null,
        status: body.status || 'proposta',
        created_at: now,
      },
      201
    );
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um projeto com este código de proposta.', 409);
    }
    return errorResponse(`Erro ao criar projeto: ${message}`, 500);
  }
};
