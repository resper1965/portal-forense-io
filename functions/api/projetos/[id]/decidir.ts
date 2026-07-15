import type { Env, UserContext } from '../../../types';
import { jsonResponse, errorResponse } from '../../../types';

/**
 * POST /api/projetos/:id/decidir — Accept or decline a proposal (client only).
 *
 * Body: { decisao: 'aceitar' | 'recusar' }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data, params } = context;
  const { userEmail, isAdmin } = data;
  const projetoId = params.id as string;

  try {
    const body = await request.json<{ decisao: 'aceitar' | 'recusar' }>();

    if (!body.decisao || !['aceitar', 'recusar'].includes(body.decisao)) {
      return errorResponse('Campo "decisao" deve ser "aceitar" ou "recusar".', 400);
    }

    // 1. Fetch project with client info
    const projeto = await env.DB.prepare(
      `SELECT p.id, p.codigo_proposta AS codigo, p.status, p.cliente_id
       FROM projetos p
       WHERE p.id = ?`
    )
      .bind(projetoId)
      .first<{
        id: string;
        codigo: string;
        status: string;
        cliente_id: string;
      }>();

    if (!projeto) {
      return errorResponse('Proposta/Projeto não encontrado.', 404);
    }

    // 2. Access control: only an active contact of the client owner can decide
    const contact = await env.DB.prepare(
      'SELECT id FROM contatos_cliente WHERE cliente_id = ? AND email = ? AND ativo = 1'
    )
      .bind(projeto.cliente_id, userEmail)
      .first();

    if (!contact) {
      return errorResponse('Acesso negado. Apenas contatos ativos do cliente proprietário podem responder a esta proposta.', 403);
    }

    // 3. Status check: must currently be a proposal
    if (projeto.status !== 'proposta') {
      return errorResponse('Esta proposta já foi respondida ou não está pendente de aceitação.', 400);
    }

    const now = new Date().toISOString();
    const newStatus = body.decisao === 'aceitar' ? 'em_andamento' : 'rejeitado';
    const statusLabel = body.decisao === 'aceitar' ? 'Aceita' : 'Recusada';

    // 4. Update status in DB
    await env.DB.prepare(
      'UPDATE projetos SET status = ?, updated_at = ? WHERE id = ?'
    )
      .bind(newStatus, now, projetoId)
      .run();

    // 5. Add timeline entry
    const timelineId = crypto.randomUUID();
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
         VALUES (?, ?, 'status', ?, ?, 1, ?, datetime('now'))`
      )
        .bind(
          timelineId,
          projetoId,
          `Proposta ${statusLabel}`,
          `A proposta comercial ${projeto.codigo} foi ${statusLabel.toLowerCase()} pelo cliente.`,
          userEmail
        )
        .run()
        .catch(() => {})
    );

    return jsonResponse({
      success: true,
      status: newStatus,
      message: `Proposta ${statusLabel.toLowerCase()} com sucesso.`
    });
  } catch (err) {
    return errorResponse(`Erro ao registrar decisão da proposta: ${(err as Error).message}`, 500);
  }
};
