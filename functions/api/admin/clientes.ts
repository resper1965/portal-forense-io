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

    return jsonResponse(results || []);
  } catch (err) {
    return errorResponse(`Erro ao listar clientes: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/admin/clientes — Create a new client.
 *
 * Body: { razao_social, cnpj?, notas? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const data = await request.json<{
      razao_social: string;
      cnpj?: string;
      notas?: string;
    }>();

    // Validate required fields
    if (!data.razao_social) {
      return errorResponse('Campo obrigatório: razao_social.', 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cnpj = data.cnpj ? data.cnpj.trim() : null;

    await env.DB.prepare(
      `INSERT INTO clientes (id, razao_social, cnpj, notas, ativo, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(id, data.razao_social, cnpj, data.notas || '', now, now)
      .run();

    return jsonResponse(
      {
        id,
        razao_social: data.razao_social,
        cnpj,
        notas: data.notas || '',
        ativo: 1,
        created_at: now,
        updated_at: now,
      },
      201
    );
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um cliente com este CNPJ.', 409);
    }
    return errorResponse(`Erro ao criar cliente: ${message}`, 500);
  }
};

/**
 * PUT /api/admin/clientes — Update a client.
 *
 * Body: { id, razao_social?, cnpj?, notas?, ativo? }
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json<{
      id: string;
      razao_social?: string;
      cnpj?: string;
      notas?: string;
      ativo?: number;
    }>();

    if (!body.id) {
      return errorResponse('Campo obrigatório: id.', 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return errorResponse('Cliente não encontrado.', 404);
    }

    const allowedFields = ['razao_social', 'cnpj', 'notas', 'ativo'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      const value = (body as Record<string, unknown>)[field];
      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(field === 'cnpj' && typeof value === 'string' ? value.trim() : value);
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
      `UPDATE clientes SET ${setClauses.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM clientes WHERE id = ?')
      .bind(body.id)
      .first();

    return jsonResponse(updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um cliente com este CNPJ.', 409);
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
    const cliente = await env.DB.prepare('SELECT id, razao_social, cnpj FROM clientes WHERE id = ?')
      .bind(clienteId)
      .first<{ id: string; razao_social: string; cnpj: string }>();

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
      razao_social: cliente.razao_social,
      cnpj: cliente.cnpj,
    });
  } catch (err) {
    return errorResponse(`Erro ao desativar cliente: ${(err as Error).message}`, 500);
  }
};
