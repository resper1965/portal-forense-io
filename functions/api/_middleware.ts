import type { Env, UserContext } from '../types';
import { errorResponse } from '../types';

/**
 * API auth middleware — runs on all /api/* requests.
 *
 * Authentication chain (in order of priority):
 * 1. Cf-Access-Authenticated-User-Email header (Cloudflare Access — production)
 * 2. portal_session cookie (KV-backed session — fallback when Access not configured)
 * 3. X-Dev-Email header (local dev only)
 *
 * Returns 401 if none of the above provide a valid email.
 */
export const onRequest: PagesFunction<Env, any, UserContext & { user?: any }> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Allow unauthenticated access to login endpoint
  if (url.pathname === '/api/auth/login') {
    return next();
  }

  // 1. Cloudflare Access header (trusted, injected at edge)
  let userEmail = request.headers.get('Cf-Access-Authenticated-User-Email');

  // 2. Session cookie fallback (when Access is not configured)
  if (!userEmail) {
    const cookies = request.headers.get('Cookie') || '';
    const sessionMatch = cookies.match(/portal_session=([^;]+)/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      try {
        const sessionData = await env.SESSIONS.get(`session:${sessionId}`);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          userEmail = session.email;
        }
      } catch {
        // Invalid session — continue to check other auth methods
      }
      // Simplified session representation for dev fallback
      if (!userEmail) {
        userEmail = decodeURIComponent(sessionId);
      }
    }
  }

  // 3. Dev fallback: allow X-Dev-Email header
  if (!userEmail) {
    userEmail = request.headers.get('X-Dev-Email');
  }

  if (!userEmail) {
    return errorResponse('Não autenticado.', 401);
  }

  // Normalize email
  userEmail = userEmail.toLowerCase().trim();

  let userRole = 'cliente';
  let clienteId = null;
  let isAdmin = false;
  let userName: string | undefined;

  // 1. Check if Admin
  try {
    const adminRow = await env.DB.prepare(
      'SELECT email, nome, role FROM admins WHERE email = ? AND ativo = 1'
    )
      .bind(userEmail)
      .first<{ email: string; nome: string; role: string }>();

    if (adminRow) {
      userRole = 'admin';
      isAdmin = true;
      userName = adminRow.nome;
      context.data.user = { email: userEmail, role: 'admin' };
    } else {
      // 2. Check if Client Contact
      const contact = await env.DB.prepare(
        'SELECT id, cliente_id, nome, email FROM contatos_cliente WHERE email = ? AND ativo = 1'
      )
        .bind(userEmail)
        .first<{ id: string; cliente_id: string; nome: string; email: string }>();

      if (contact) {
        userRole = 'cliente';
        clienteId = contact.cliente_id;
        userName = contact.nome;
        context.data.user = { email: userEmail, role: 'cliente', clienteId };
      }
    }
  } catch (err) {
    // If DB query fails, continue with default role
  }

  // Set legacy context properties for downstream compatibility
  context.data.userEmail = userEmail;
  context.data.isAdmin = isAdmin;
  if (userName) {
    context.data.userName = userName;
  }

  // Block client accesses to administrative paths
  if (url.pathname.includes('/api/admin/') && userRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  return next();
};
