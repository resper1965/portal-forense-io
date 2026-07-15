import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/admin/contatos — List all contacts or filter by cliente_id.
 *
 * Query param: cliente_id (optional)
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');

  try {
    let results;
    if (clienteId) {
      const query = await env.DB.prepare(
        'SELECT * FROM contatos_cliente WHERE cliente_id = ? ORDER BY created_at DESC'
      )
        .bind(clienteId)
        .all();
      results = query.results;
    } else {
      const query = await env.DB.prepare(
        'SELECT * FROM contatos_cliente ORDER BY created_at DESC'
      ).all();
      results = query.results;
    }
    return jsonResponse(results || []);
  } catch (err) {
    return errorResponse(`Erro ao listar contatos: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/admin/contatos — Create a new contact.
 *
 * Body: { cliente_id, nome, email, telefone?, cargo? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const data = await request.json<{
      cliente_id: string;
      nome: string;
      email: string;
      telefone?: string;
      cargo?: string;
    }>();

    // Input validation
    if (!data.cliente_id || !data.nome || !data.email) {
      return errorResponse('Campos obrigatórios: cliente_id, nome, email.', 400);
    }

    if (!data.email.includes('@')) {
      return errorResponse('Email inválido. Deve conter "@".', 400);
    }

    // Verify that the client exists
    const clientExists = await env.DB.prepare('SELECT id FROM clientes WHERE id = ?')
      .bind(data.cliente_id)
      .first();

    if (!clientExists) {
      return errorResponse('Cliente associado não encontrado.', 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const email = data.email.toLowerCase().trim();

    await env.DB.prepare(
      `INSERT INTO contatos_cliente (id, cliente_id, nome, email, telefone, cargo, ativo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(id, data.cliente_id, data.nome, email, data.telefone || '', data.cargo || '', now, now)
      .run();

    return jsonResponse(
      {
        id,
        cliente_id: data.cliente_id,
        nome: data.nome,
        email,
        telefone: data.telefone || '',
        cargo: data.cargo || '',
        ativo: 1,
        created_at: now,
        updated_at: now,
      },
      201
    );
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um contato cadastrado com este email.', 409);
    }
    return errorResponse(`Erro ao criar contato: ${message}`, 500);
  }
};

/**
 * PUT /api/admin/contatos — Update a contact.
 *
 * Body: { id, nome?, email?, telefone?, cargo?, ativo? }
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json<{
      id: string;
      nome?: string;
      email?: string;
      telefone?: string;
      cargo?: string;
      ativo?: number;
    }>();

    if (!body.id) {
      return errorResponse('Campo obrigatório: id.', 400);
    }

    if (body.email && !body.email.includes('@')) {
      return errorResponse('Email inválido. Deve conter "@".', 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM contatos_cliente WHERE id = ?')
      .bind(body.id)
      .first();

    if (!existing) {
      return errorResponse('Contato não encontrado.', 404);
    }

    const allowedFields = ['nome', 'email', 'telefone', 'cargo', 'ativo'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      const value = (body as Record<string, unknown>)[field];
      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(field === 'email' && typeof value === 'string' ? value.toLowerCase().trim() : value);
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
      `UPDATE contatos_cliente SET ${setClauses.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM contatos_cliente WHERE id = ?')
      .bind(body.id)
      .first();

    return jsonResponse(updated);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE constraint')) {
      return errorResponse('Já existe um contato cadastrado com este email.', 409);
    }
    return errorResponse(`Erro ao atualizar contato: ${message}`, 500);
  }
};

/**
 * DELETE /api/admin/contatos — Deactivate a contact (soft delete, set ativo=0).
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
    const contato = await env.DB.prepare('SELECT * FROM contatos_cliente WHERE id = ?')
      .bind(id)
      .first<{ id: string; nome: string; email: string }>();

    if (!contato) {
      return errorResponse('Contato não encontrado.', 404);
    }

    // Soft delete: update ativo = 0
    await env.DB.prepare(
      "UPDATE contatos_cliente SET ativo = 0, updated_at = ? WHERE id = ?"
    )
      .bind(new Date().toISOString(), id)
      .run();

    return jsonResponse({
      deactivated: true,
      id: contato.id,
      nome: contato.nome,
      email: contato.email,
    });
  } catch (err) {
    return errorResponse(`Erro ao desativar contato: ${(err as Error).message}`, 500);
  }
};
