import { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction<{ DB: D1Database }, any, { user?: any }> = async (context) => {
  const user = context.data.user;
  if (!user) {
    return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
  }
  return new Response(JSON.stringify({ authenticated: true, user }), { status: 200 });
};
