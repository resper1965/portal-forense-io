import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/admin/clientes — List all clients.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id = c.id) AS projetos_count
       FROM clientes c
       ORDER BY c.created_at DESC`
    ).all();

    return jsonResponse({ clientes: results || [] });
  } catch (err) {
    return errorResponse(`Erro ao listar clientes: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/admin/clientes — Create a new client.
 *
 * Body: { nome, empresa?, email, telefone?, notas? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json<{
      nome: string;
      empresa?: string;
      email: string;
      telefone?: string;
      notas?: string;
    }>();

    // Validate required fields
    if (!body.nome || !body.email) {
      return errorResponse('Campos obrigatórios: nome, email.', 400);
    }

    // Validate email format
    if (!body.email.includes('@')) {
      return errorResponse('Email inválido.', 400);
    }

    const clienteId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO clientes (id, nome, empresa, email, telefone, notas, ativo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(
        clienteId,
        body.nome,
        body.empresa || null,
        body.email.toLowerCase().trim(),
        body.telefone || null,
        body.notas || null,
        now,
        now
      )
      .run();

    return jsonResponse(
      {
        id: clienteId,
        nome: body.nome,
        empresa: body.empresa || null,
        email: body.email.toLowerCase().trim(),
        ativo: 1,
        created_at: now,
      },
      201
    );
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um cliente com este email.', 409);
    }
    return errorResponse(`Erro ao criar cliente: ${message}`, 500);
  }
};

/**
 * PUT /api/admin/clientes — Update a client.
 *
 * Body: { id, nome?, empresa?, email?, telefone?, notas?, ativo? }
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json<{
      id: string;
      nome?: string;
      empresa?: string;
      email?: string;
      telefone?: string;
      notas?: string;
      ativo?: number;
    }>();

    if (!body.id) {
      return errorResponse('Campo obrigatório: id.', 400);
    }

    // Verify client exists
    const existing = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return errorResponse('Cliente não encontrado.', 404);
    }

    const allowedFields = ['nome', 'empresa', 'email', 'telefone', 'notas', 'ativo'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      const value = (body as Record<string, unknown>)[field];
      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(field === 'email' ? (value as string).toLowerCase().trim() : value);
      }
    }

    if (setClauses.length === 0) {
      return errorResponse('Nenhum campo para atualizar.', 400);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(body.id);

    await env.DB.prepare(
      `UPDATE clientes SET ${setClauses.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM clientes WHERE id = ?')
      .bind(body.id)
      .first();

    return jsonResponse({ cliente: updated });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um cliente com este email.', 409);
    }
    return errorResponse(`Erro ao atualizar cliente: ${message}`, 500);
  }
};

/**
 * DELETE /api/admin/clientes — Deactivate a client (soft delete, set ativo=0).
 *
 * Query param: id (required)
 */
export const onRequestDelete: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  const url = new URL(request.url);
  const clienteId = url.searchParams.get('id');

  if (!clienteId) {
    return errorResponse('Query param obrigatório: id.', 400);
  }

  try {
    const cliente = await env.DB.prepare('SELECT id, nome, email FROM clientes WHERE id = ?')
      .bind(clienteId)
      .first<{ id: string; nome: string; email: string }>();

    if (!cliente) {
      return errorResponse('Cliente não encontrado.', 404);
    }

    // Soft delete — set ativo=0
    await env.DB.prepare(
      "UPDATE clientes SET ativo = 0, updated_at = ? WHERE id = ?"
    )
      .bind(new Date().toISOString(), clienteId)
      .run();

    return jsonResponse({
      deactivated: true,
      nome: cliente.nome,
      email: cliente.email,
    });
  } catch (err) {
    return errorResponse(`Erro ao desativar cliente: ${(err as Error).message}`, 500);
  }
};
