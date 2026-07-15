import type { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * POST /api/auth/login — Simple email-based login.
 *
 * When Cloudflare Access is not configured, this endpoint allows
 * admin users to log in with their email. It creates a KV session
 * and returns a Set-Cookie header.
 *
 * NOTE: In production with Cloudflare Access enabled, this endpoint
 * is not needed — Access handles authentication at the edge.
 * This is a fallback for when Access is not yet configured.
 *
 * Only allows emails that exist in the admins or clientes table.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = await request.json<{ email: string }>();

    if (!body.email || !body.email.includes('@')) {
      return errorResponse('Email inválido.', 400);
    }

    const email = body.email.toLowerCase().trim();

    // Check if user exists (admin or client)
    const isAdmin = await env.DB.prepare(
      'SELECT email FROM admins WHERE email = ? AND ativo = 1'
    )
      .bind(email)
      .first();

    const isClient = await env.DB.prepare(
      `SELECT cc.email FROM contatos_cliente cc
       JOIN clientes c ON cc.cliente_id = c.id
       WHERE cc.email = ? AND cc.ativo = 1 AND c.ativo = 1`
    )
      .bind(email)
      .first();

    if (!isAdmin && !isClient) {
      return errorResponse('Email não autorizado. Contate o administrador.', 403);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const sessionData = JSON.stringify({
      email,
      created_at: new Date().toISOString(),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    });

    // Store session in KV (24 hour TTL)
    await env.SESSIONS.put(`session:${sessionId}`, sessionData, {
      expirationTtl: 86400,
    });

    // Log access
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO access_log (id, email, acao, recurso, ip, user_agent, created_at)
         VALUES (?, ?, 'login', 'portal', ?, ?, datetime('now'))`
      )
        .bind(
          crypto.randomUUID(),
          email,
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || ''
        )
        .run()
        .catch(() => {})
    );

    // Return session cookie
    const response = jsonResponse({
      success: true,
      email,
      isAdmin: !!isAdmin,
    });

    // Set cookie — secure, httpOnly, SameSite=Lax, 24h expiry
    const expires = new Date(Date.now() + 86400 * 1000).toUTCString();
    response.headers.set(
      'Set-Cookie',
      `portal_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`
    );

    return response;
  } catch (err) {
    return errorResponse(`Erro no login: ${(err as Error).message}`, 500);
  }
};

/**
 * DELETE /api/auth/login — Logout (clear session).
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Extract session from cookie
  const cookies = request.headers.get('Cookie') || '';
  const sessionMatch = cookies.match(/portal_session=([^;]+)/);

  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    // Delete from KV
    await env.SESSIONS.delete(`session:${sessionId}`).catch(() => {});
  }

  // Clear cookie
  const response = jsonResponse({ success: true });
  response.headers.set(
    'Set-Cookie',
    'portal_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );

  return response;
};
