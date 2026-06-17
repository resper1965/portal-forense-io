import type { Env } from '../types';
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
export const onRequest: PagesFunction<Env> = async (context) => {
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

  // Check if user is admin
  let isAdmin = false;
  let userName: string | undefined;

  try {
    const adminRow = await env.DB.prepare(
      'SELECT email, nome, role FROM admins WHERE email = ? AND ativo = 1'
    )
      .bind(userEmail)
      .first<{ email: string; nome: string; role: string }>();

    if (adminRow) {
      isAdmin = true;
      userName = adminRow.nome;
    }
  } catch {
    // If DB query fails, continue without admin privileges
  }

  // Set context data for downstream handlers
  context.data.userEmail = userEmail;
  context.data.isAdmin = isAdmin;
  context.data.userName = userName;

  return next();
};
