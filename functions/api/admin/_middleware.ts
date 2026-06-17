import type { Env, UserContext } from '../../types';
import { errorResponse } from '../../types';

/**
 * Admin middleware — runs on all /api/admin/* requests.
 *
 * Verifies that the authenticated user has admin privileges.
 * Must run AFTER the /api/_middleware.ts which sets context.data.isAdmin.
 */
export const onRequest: PagesFunction<Env, string, UserContext> = async (context) => {
  const { data, next } = context;

  if (!data.isAdmin) {
    return errorResponse('Acesso restrito a administradores. Seu email não está registrado como admin.', 403);
  }

  return next();
};
