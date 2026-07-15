import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * Helper: verify user has access to a project (for entregáveis operations).
 */
async function verifyProjetoAccess(
  env: Env,
  projetoId: string,
  userEmail: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;

  const row = await env.DB.prepare(
    `SELECT 1 FROM projetos p
     JOIN contatos_cliente cc ON p.cliente_id = cc.cliente_id
     WHERE p.id = ? AND cc.email = ? AND cc.ativo = 1`
  )
    .bind(projetoId, userEmail)
    .first();

  return !!row;
}

/**
 * GET /api/entregaveis — List entregáveis for a project.
 *
 * Query params: projeto_id (required)
 * Clients see only publicado=1.
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail, isAdmin } = data;

  const url = new URL(request.url);
  const projetoId = url.searchParams.get('projeto_id');

  if (!projetoId) {
    return errorResponse('Query param obrigatório: projeto_id.', 400);
  }

  try {
    // Verify access
    const hasAccess = await verifyProjetoAccess(env, projetoId, userEmail, isAdmin);
    if (!hasAccess) {
      return errorResponse('Acesso negado a este projeto.', 403);
    }

    const query = isAdmin
      ? 'SELECT * FROM entregaveis WHERE projeto_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM entregaveis WHERE projeto_id = ? AND publicado = 1 ORDER BY created_at DESC';

    const { results } = await env.DB.prepare(query)
      .bind(projetoId)
      .all();

    return jsonResponse({ entregaveis: results || [] });
  } catch (err) {
    return errorResponse(`Erro ao listar entregáveis: ${(err as Error).message}`, 500);
  }
};

/**
 * POST /api/entregaveis — Create entregável metadata (admin only).
 *
 * Body: { projeto_id, tipo, titulo, descricao?, r2_key, mime_type?, tamanho?, publicado? }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { isAdmin, userEmail } = data;

  if (!isAdmin) {
    return errorResponse('Acesso restrito a administradores.', 403);
  }

  try {
    const body = await request.json<{
      projeto_id: string;
      tipo: string;
      titulo: string;
      descricao?: string;
      r2_key: string;
      mime_type?: string;
      tamanho?: number;
      publicado?: number;
    }>();

    // Validate required fields
    if (!body.projeto_id || !body.tipo || !body.titulo || !body.r2_key) {
      return errorResponse('Campos obrigatórios: projeto_id, tipo, titulo, r2_key.', 400);
    }

    // Verify project exists
    const projeto = await env.DB.prepare(
      `SELECT p.id, p.codigo_proposta AS codigo, c.razao_social AS cliente_nome,
              (SELECT email FROM contatos_cliente WHERE cliente_id = c.id AND ativo = 1 LIMIT 1) AS cliente_email
       FROM projetos p JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = ?`
    )
      .bind(body.projeto_id)
      .first<{ id: string; codigo: string; cliente_email: string; cliente_nome: string }>();

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    const entregavelId = crypto.randomUUID();
    const now = new Date().toISOString();
    const publicado = body.publicado ?? 0;

    await env.DB.prepare(
      `INSERT INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, publicado, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entregavelId,
        body.projeto_id,
        body.tipo,
        body.titulo,
        body.descricao || null,
        body.r2_key,
        body.mime_type || 'text/html',
        body.tamanho || null,
        publicado,
        now,
        now
      )
      .run();

    // If published, add timeline entry and send email notification
    if (publicado === 1) {
      const tipoLabels: Record<string, string> = {
        relatorio: 'Relatório',
        apresentacao: 'Apresentação',
        proposta: 'Proposta',
        anexo: 'Anexo',
      };
      const label = tipoLabels[body.tipo] || body.tipo;

      // Timeline entry
      context.waitUntil(
        env.DB.prepare(
          `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
           VALUES (?, ?, 'entrega', ?, ?, 1, ?, datetime('now'))`
        )
          .bind(
            crypto.randomUUID(),
            body.projeto_id,
            `${label} publicado: ${body.titulo}`,
            `O ${label.toLowerCase()} "${body.titulo}" está disponível para visualização.`,
            userEmail
          )
          .run()
          .catch(() => {})
      );

      // Email notification (non-blocking)
      if (env.EMAIL && projeto.cliente_email) {
        context.waitUntil(
          sendPublicationEmail(env, projeto.cliente_email, projeto.cliente_nome, body.titulo, label)
        );
      }
    }

    return jsonResponse(
      {
        id: entregavelId,
        projeto_id: body.projeto_id,
        tipo: body.tipo,
        titulo: body.titulo,
        publicado,
        created_at: now,
      },
      201
    );
  } catch (err) {
    return errorResponse(`Erro ao criar entregável: ${(err as Error).message}`, 500);
  }
};

/**
 * Send publication notification email to client.
 */
async function sendPublicationEmail(
  env: Env,
  clienteEmail: string,
  clienteNome: string,
  titulo: string,
  tipo: string
): Promise<void> {
  try {
    if (env.EMAIL && typeof env.EMAIL.send === 'function') {
      await env.EMAIL.send({
        to: clienteEmail,
        from: 'portal@forense.io',
        subject: `Novo ${tipo} disponível — ${titulo}`,
        html: `<html><body style="font-family: 'Montserrat', sans-serif; color: #e0e0e0; background: #0a0a0f; padding: 20px;">` +
          `<div style="border-bottom: 2px solid #00ade8; padding-bottom: 16px; margin-bottom: 24px;">` +
          `<span style="font-size: 20px; font-weight: 500; color: #fff;">forense<span style="color: #00ade8;">.</span>io</span></div>` +
          `<h2 style="color: #fff;">Olá, ${clienteNome}</h2>` +
          `<p style="color: #ccc;">Um novo ${tipo.toLowerCase()} está disponível no seu portal:</p>` +
          `<p style="color: #fff;"><strong>${titulo}</strong></p>` +
          `<p><a href="https://portal.forense.io" style="background: #00ade8; color: #0a0a0f; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Acessar Portal</a></p>` +
          `<p style="color: #666; font-size: 12px; margin-top: 32px;">forense.io · a ness. company</p>` +
          `</body></html>`,
        text: `Olá, ${clienteNome}. Um novo ${tipo.toLowerCase()} "${titulo}" está disponível em portal.forense.io`,
      });
    }
  } catch {
    // Silently ignore email errors — don't block the main flow
  }
}

