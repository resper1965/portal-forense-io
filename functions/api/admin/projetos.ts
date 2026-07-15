import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/admin/projetos — List all projects.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.*, c.razao_social AS cliente_razao_social
       FROM projetos p
       LEFT JOIN clientes c ON p.cliente_id = c.id
       ORDER BY p.created_at DESC`
    ).all();
    return jsonResponse(results || []);
  } catch (err) {
    return errorResponse(`Erro ao listar projetos: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/admin/projetos — Create a new project.
 *
 * Body: { codigo_proposta, cliente_id, titulo, descricao?, github_repo_url?, valor?, data_inicio?, data_entrega? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const userEmail = data.userEmail || 'sistema';

  let body;
  try {
    body = await request.json<{
      codigo_proposta: string;
      cliente_id: string;
      titulo: string;
      descricao?: string;
      github_repo_url?: string;
      valor?: number;
      data_inicio?: string;
      data_entrega?: string;
    }>();
  } catch (err) {
    return errorResponse('JSON inválido.', 400);
  }

  try {

    // Input validation
    if (!body.codigo_proposta || !body.cliente_id || !body.titulo) {
      return errorResponse('Campos obrigatórios: codigo_proposta, cliente_id, titulo.', 400);
    }

    // Check if client exists
    const client = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
      .bind(body.cliente_id)
      .first();

    if (!client) {
      return errorResponse('Cliente informado não existe.', 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert project
    await env.DB.prepare(
      `INSERT INTO projetos (
        id, codigo_proposta, cliente_id, titulo, descricao, github_repo_url, status, valor, data_inicio, data_entrega, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'proposta', ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        body.codigo_proposta.trim(),
        body.cliente_id,
        body.titulo.trim(),
        body.descricao || '',
        body.github_repo_url || '',
        body.valor || null,
        body.data_inicio || null,
        body.data_entrega || null,
        now,
        now
      )
      .run();

    // Insert timeline milestone ("Projeto Iniciado")
    await env.DB.prepare(
      `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
       VALUES (?, ?, 'marco', ?, ?, 1, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        id,
        'Projeto Iniciado',
        'O projeto foi cadastrado e iniciado na plataforma.',
        userEmail,
        now
      )
      .run();

    return jsonResponse(
      {
        id,
        codigo_proposta: body.codigo_proposta,
        cliente_id: body.cliente_id,
        titulo: body.titulo,
        descricao: body.descricao || '',
        github_repo_url: body.github_repo_url || '',
        status: 'proposta',
        valor: body.valor || null,
        data_inicio: body.data_inicio || null,
        data_entrega: body.data_entrega || null,
        created_at: now,
        updated_at: now,
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

/**
 * PUT /api/admin/projetos — Update a project.
 *
 * Body: { id, codigo_proposta?, cliente_id?, titulo?, descricao?, github_repo_url?, status?, valor?, data_inicio?, data_entrega? }
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const userEmail = data.userEmail || 'sistema';

  let body;
  try {
    body = await request.json<{
      id: string;
      codigo_proposta?: string;
      cliente_id?: string;
      titulo?: string;
      descricao?: string;
      github_repo_url?: string;
      status?: string;
      valor?: number;
      data_inicio?: string;
      data_entrega?: string;
    }>();
  } catch (err) {
    return errorResponse('JSON inválido.', 400);
  }

  try {

    if (!body.id) {
      return errorResponse('Campo obrigatório: id.', 400);
    }

    const existing = await env.DB.prepare('SELECT * FROM projetos WHERE id = ?')
      .bind(body.id)
      .first<Record<string, unknown>>();

    if (!existing) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    if (body.cliente_id) {
      const client = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
        .bind(body.cliente_id)
        .first();
      if (!client) {
        return errorResponse('Cliente informado não existe.', 404);
      }
    }

    const allowedFields = [
      'codigo_proposta', 'cliente_id', 'titulo', 'descricao', 'github_repo_url',
      'status', 'valor', 'data_inicio', 'data_entrega',
    ];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      const value = body[field as keyof typeof body];
      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(typeof value === 'string' ? value.trim() : value);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('Nenhum campo para atualizar.', 400);
    }

    const now = new Date().toISOString();
    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(body.id);

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
      const label = statusLabels[body.status] || `Status alterado para ${body.status}`;

      await env.DB.prepare(
        `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
         VALUES (?, ?, 'status', ?, ?, 1, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          body.id,
          label,
          `Status alterado de "${existing.status}" para "${body.status}"`,
          userEmail,
          now
        )
        .run();
    }

    const updated = await env.DB.prepare('SELECT * FROM projetos WHERE id = ?')
      .bind(body.id)
      .first();

    return jsonResponse(updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um projeto com este código de proposta.', 409);
    }
    return errorResponse(`Erro ao atualizar projeto: ${message}`, 500);
  }
};

/**
 * DELETE /api/admin/projetos — Delete a project.
 *
 * Query param: id (required)
 */
export const onRequestDelete: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return errorResponse('Query param obrigatório: id.', 400);
  }

  try {
    const projeto = await env.DB.prepare('SELECT id, codigo_proposta FROM projetos WHERE id = ?')
      .bind(id)
      .first<{ id: string; codigo_proposta: string }>();

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    // Get all R2 keys to clean up
    const { results: entregaveis } = await env.DB.prepare(
      'SELECT r2_key FROM entregaveis WHERE projeto_id = ?'
    )
      .bind(id)
      .all<{ r2_key: string }>();

    const { results: uploads } = await env.DB.prepare(
      'SELECT r2_key FROM uploads WHERE projeto_id = ?'
    )
      .bind(id)
      .all<{ r2_key: string }>();

    // Enable foreign keys and delete in a single batch execution to ensure cascade happens
    await env.DB.batch([
      env.DB.prepare('PRAGMA foreign_keys = ON;'),
      env.DB.prepare('DELETE FROM projetos WHERE id = ?').bind(id)
    ]);

    // Clean up R2
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

    return jsonResponse({ deleted: true, id, codigo_proposta: projeto.codigo_proposta });
  } catch (err) {
    return errorResponse(`Erro ao excluir projeto: ${(err as Error).message}`, 500);
  }
};
