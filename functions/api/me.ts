import type { Env, UserContext } from '../types';
import { jsonResponse, errorResponse } from '../types';

/**
 * GET /api/me — Return authenticated user info.
 *
 * For clients: returns client profile + project count.
 * For admins: returns admin profile.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env, data } = context;
  const { userEmail, isAdmin } = data;

  try {
    // Check if user is a registered client
    const cliente = await env.DB.prepare(
      `SELECT c.id, c.nome, c.empresa, c.email, c.telefone, c.notas, c.ativo,
              (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id = c.id) AS projetos_count
       FROM clientes c
       WHERE c.email = ? AND c.ativo = 1`
    )
      .bind(userEmail)
      .first<{
        id: string;
        nome: string;
        empresa: string;
        email: string;
        telefone: string;
        notas: string;
        ativo: number;
        projetos_count: number;
      }>();

    if (isAdmin) {
      // Admin user — may also be a client
      const adminRow = await env.DB.prepare(
        'SELECT email, nome, role FROM admins WHERE email = ? AND ativo = 1'
      )
        .bind(userEmail)
        .first<{ email: string; nome: string; role: string }>();

      return jsonResponse({
        email: userEmail,
        nome: adminRow?.nome || cliente?.nome || userEmail.split('@')[0],
        empresa: cliente?.empresa || 'ness.',
        isAdmin: true,
        role: adminRow?.role || 'admin',
        projetos_count: cliente?.projetos_count || 0,
        cliente_id: cliente?.id || null,
      });
    }

    if (cliente) {
      return jsonResponse({
        email: cliente.email,
        nome: cliente.nome,
        empresa: cliente.empresa,
        isAdmin: false,
        projetos_count: cliente.projetos_count,
        cliente_id: cliente.id,
      });
    }

    // User is authenticated via Access but not registered as client or admin
    return jsonResponse({
      email: userEmail,
      nome: userEmail.split('@')[0],
      empresa: null,
      isAdmin: false,
      projetos_count: 0,
      cliente_id: null,
      registered: false,
    });
  } catch (err) {
    return errorResponse(`Erro ao buscar dados do usuário: ${(err as Error).message}`, 500);
  }
};

/**
 * PUT /api/me — Update authenticated user's profile (name).
 *
 * Body: { nome: string }
 */
export const onRequestPut: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail, isAdmin } = data;

  try {
    const body = await request.json<{ nome: string }>();

    if (!body.nome || typeof body.nome !== 'string' || body.nome.trim().length === 0) {
      return errorResponse('Nome é obrigatório.', 400);
    }

    const nome = body.nome.trim().substring(0, 100); // Max 100 chars

    // Update in admins table if admin
    if (isAdmin) {
      await env.DB.prepare('UPDATE admins SET nome = ? WHERE email = ?')
        .bind(nome, userEmail)
        .run();
    }

    // Update in clientes table if client
    const clienteExists = await env.DB.prepare(
      'SELECT id FROM clientes WHERE email = ? AND ativo = 1'
    )
      .bind(userEmail)
      .first<{ id: string }>();

    if (clienteExists) {
      await env.DB.prepare('UPDATE clientes SET nome = ? WHERE email = ?')
        .bind(nome, userEmail)
        .run();
    }

    return jsonResponse({ success: true, nome });
  } catch (err) {
    return errorResponse(`Erro ao atualizar perfil: ${(err as Error).message}`, 500);
  }
};
