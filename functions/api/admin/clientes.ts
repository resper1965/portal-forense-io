import { PagesFunction } from '@cloudflare/workers-types';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { results } = await context.env.DB.prepare(
    'SELECT c.*, (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id = c.id) AS projetos_count FROM clientes c'
  ).all();
  return Response.json(results);
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
  const data = await context.request.json<{ razao_social: string; cnpj: string; notas?: string }>();
  const id = crypto.randomUUID();
  
  await context.env.DB.prepare(
    'INSERT INTO clientes (id, razao_social, cnpj, notas) VALUES (?, ?, ?, ?)'
  ).bind(id, data.razao_social, data.cnpj, data.notas || '').run();

  return new Response(JSON.stringify({ id, ...data }), { status: 201 });
};
