import { PagesFunction } from '@cloudflare/workers-types';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { results } = await context.env.DB.prepare('SELECT * FROM projetos').all();
  return Response.json(results);
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
  const data = await context.request.json<{ codigo_proposta: string; cliente_id: string; titulo: string; descricao?: string; github_repo_url?: string }>();
  const id = crypto.randomUUID();

  await context.env.DB.prepare(
    'INSERT INTO projetos (id, codigo_proposta, cliente_id, titulo, descricao, github_repo_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, data.codigo_proposta, data.cliente_id, data.titulo, data.descricao || '', data.github_repo_url || '', 'proposta').run();

  return new Response(JSON.stringify({ id, ...data }), { status: 201 });
};
