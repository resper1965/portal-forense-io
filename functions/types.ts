/**
 * Environment bindings for Cloudflare Pages Functions.
 * Configured in wrangler.toml and Cloudflare dashboard.
 */
export interface Env {
  /** D1 SQLite database — projetos, clientes, entregáveis, logs */
  DB: D1Database;

  /** R2 object storage — relatórios, uploads de clientes */
  BUCKET: R2Bucket;

  /** KV namespace — sessões e cache de permissões */
  SESSIONS: KVNamespace;

  /** Cloudflare Email Service binding (configured via dashboard) */
  EMAIL: any;

  /** Cloudflare Access team domain (e.g. "forense") */
  CF_ACCESS_TEAM: string;

  /** Cloudflare Access audience tag */
  CF_ACCESS_AUD: string;

  /** R2 API key for presigned URLs */
  R2_ACCESS_KEY_ID: string;

  /** R2 API secret for presigned URLs */
  R2_SECRET_ACCESS_KEY: string;

  /** R2 account ID */
  R2_ACCOUNT_ID: string;

  /** R2 S3-compatible endpoint */
  R2_ENDPOINT: string;

  /** Turnstile secret key for server-side validation */
  TURNSTILE_SECRET: string;

  /** Comma-separated allowed MIME types for uploads */
  ALLOWED_UPLOAD_TYPES: string;

  /** Max upload size in bytes (string, parsed at runtime) */
  MAX_UPLOAD_SIZE: string;
}

/**
 * User context injected by middleware into context.data.
 */
export interface UserContext {
  userEmail: string;
  isAdmin: boolean;
  userName?: string;
}

/**
 * Helper: create a JSON Response.
 */
export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Helper: create a JSON error Response.
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
