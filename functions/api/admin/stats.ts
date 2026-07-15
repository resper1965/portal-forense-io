import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * GET /api/admin/stats — Dashboard statistics for admins.
 *
 * Returns:
 * - Total projects, active projects, pending uploads, total clients
 * - Recent access logs (last 20)
 * - Recent timeline entries (last 20)
 */
export const onRequestGet: PagesFunction<Env, string, UserContext> = async (context) => {
  const { env } = context;

  try {
    // Run all stat queries in parallel for performance
    const [
      totalProjetosResult,
      activeProjetosResult,
      pendingUploadsResult,
      totalClientesResult,
      totalEntregaveisResult,
      recentLogsResult,
      recentTimelineResult,
      projetosByStatusResult,
    ] = await Promise.all([
      // Total projects
      env.DB.prepare('SELECT COUNT(*) AS count FROM projetos').first<{ count: number }>(),

      // Active projects (em_andamento)
      env.DB.prepare("SELECT COUNT(*) AS count FROM projetos WHERE status = 'em_andamento'").first<{ count: number }>(),

      // Pending uploads
      env.DB.prepare("SELECT COUNT(*) AS count FROM uploads WHERE status = 'pendente'").first<{ count: number }>(),

      // Total active clients
      env.DB.prepare('SELECT COUNT(*) AS count FROM clientes WHERE ativo = 1').first<{ count: number }>(),

      // Total entregáveis
      env.DB.prepare('SELECT COUNT(*) AS count FROM entregaveis WHERE publicado = 1').first<{ count: number }>(),

      // Recent access logs (last 20)
      env.DB.prepare(
        'SELECT * FROM access_log ORDER BY created_at DESC LIMIT 20'
      ).all(),

      // Recent timeline entries (last 20)
      env.DB.prepare(
        `SELECT t.*, p.codigo_proposta AS projeto_codigo, p.titulo AS projeto_titulo
         FROM timeline t
         JOIN projetos p ON t.projeto_id = p.id
         ORDER BY t.created_at DESC LIMIT 20`
      ).all(),

      // Projects by status
      env.DB.prepare(
        `SELECT status, COUNT(*) AS count FROM projetos GROUP BY status`
      ).all(),
    ]);

    return jsonResponse({
      stats: {
        total_projetos: totalProjetosResult?.count || 0,
        projetos_ativos: activeProjetosResult?.count || 0,
        uploads_pendentes: pendingUploadsResult?.count || 0,
        total_clientes: totalClientesResult?.count || 0,
        total_entregaveis: totalEntregaveisResult?.count || 0,
        projetos_por_status: projetosByStatusResult.results || [],
      },
      recent_logs: recentLogsResult.results || [],
      recent_timeline: recentTimelineResult.results || [],
    });
  } catch (err) {
    return errorResponse(`Erro ao buscar estatísticas: ${(err as Error).message}`, 500);
  }
};
