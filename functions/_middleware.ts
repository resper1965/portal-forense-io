import type { Env } from './types';

/**
 * Global middleware — runs on EVERY request to the portal.
 *
 * Responsibilities:
 * 1. Extract authenticated user email from Cf-Access header (or X-Dev-Email in dev)
 * 2. Log every request to access_log table (non-blocking via waitUntil)
 * 3. Set context.data.userEmail for downstream handlers
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  // Extract user email from Cloudflare Access header (trusted, injected by Access)
  let userEmail = request.headers.get('Cf-Access-Authenticated-User-Email');

  // Dev fallback: allow X-Dev-Email header when no Access header present
  if (!userEmail) {
    userEmail = request.headers.get('X-Dev-Email') || '';
  }

  // Store in context for downstream functions
  context.data.userEmail = userEmail;

  // Non-blocking access log (fire-and-forget)
  if (userEmail && env.DB) {
    const url = new URL(request.url);
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO access_log (id, email, acao, recurso, ip, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          crypto.randomUUID(),
          userEmail,
          request.method,
          url.pathname,
          request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
          request.headers.get('User-Agent') || ''
        )
        .run()
        .catch(() => {}) // Silently ignore logging errors
    );
  }

  return next();
};
