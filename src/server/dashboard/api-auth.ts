/**
 * Auth + RBAC para rotas /api/dashboard/* (escopo tenant da sessão).
 */
import { getSessionFromCookie } from "@/server/auth/session";
import type { SessionWithUserAndTenant } from "@/server/auth/session";
import { shouldRequireCsrf, validateCsrfRequest } from "@/server/security/csrf";
import { requirePermission } from "@/server/rbac";
import { PERMISSION_SLUGS, type PermissionSlug } from "@/server/rbac/permissions";
import { runWithRlsContext } from "@/server/db/access-context";

/**
 * Valida sessão, CSRF e RBAC sem abrir contexto RLS.
 * Retorna a sessão e o tenantId para uso em `withDashboardApiAuth`.
 */
async function validateDashboardSession(
  request: Request,
  permission: PermissionSlug
): Promise<SessionWithUserAndTenant> {
  const session = await getSessionFromCookie(request, { updateActivity: true });
  if (!session) {
    const err = new Error("Não autenticado") as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  if (shouldRequireCsrf(request)) {
    const csrf = await validateCsrfRequest(request);
    if (!csrf.ok) {
      const err = new Error("CSRF inválido") as Error & { status?: number };
      err.status = 403;
      throw err;
    }
  }

  const tenantId = session.session.currentTenantId;
  if (!tenantId) {
    const err = new Error("Selecione um tenant") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  await requirePermission(session.user.id, tenantId, permission);
  return session;
}

/**
 * Auth + RBAC correto: executa `handler` dentro do `runWithRlsContext` com
 * o tenantId da sessão, garantindo que `getDb()` devolva a transação com
 * os GUCs RLS ativos durante todo o handler.
 *
 * Preferir este sobre `requireDashboardApiAuth` para todas as novas rotas e
 * ao migrar rotas existentes.
 *
 * ```ts
 * export async function GET(request: NextRequest) {
 *   return withDashboardApiAuth(request, async (session) => {
 *     const leads = await getDb().select().from(leads)...
 *     return NextResponse.json(leads);
 *   });
 * }
 * ```
 */
export async function withDashboardApiAuth<T>(
  request: Request,
  handler: (session: SessionWithUserAndTenant) => Promise<T>,
  permission: PermissionSlug = PERMISSION_SLUGS.DASHBOARD_READ
): Promise<T> {
  const session = await validateDashboardSession(request, permission);
  const tenantId = session.session.currentTenantId!;
  return runWithRlsContext({ tenantId, bypassRls: false }, () => handler(session));
}

/**
 * @deprecated Usar `withDashboardApiAuth` — este retorna antes dos handlers
 * rodarem, fazendo com que `getDb()` neles use o pool raiz sem contexto RLS.
 */
export async function requireDashboardApiAuth(
  request: Request,
  permission: PermissionSlug = PERMISSION_SLUGS.DASHBOARD_READ
): Promise<SessionWithUserAndTenant> {
  return validateDashboardSession(request, permission);
}
