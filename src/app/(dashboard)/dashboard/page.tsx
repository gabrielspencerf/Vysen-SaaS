import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth";
import { getCurrentMembership, isSuperAdmin } from "@/server/tenancy/membership";
import { requestFromHeaders } from "@/server/request";
import { headers } from "next/headers";

/**
 * /dashboard — redireciona para a área correta com base em sessão + role.
 *
 * Regras:
 * - Sem sessão → /login com `from` preservado.
 * - Usuário com tenant atual válido → /dashboard/home.
 * - Sem membership no tenant atual (ou sem currentTenantId):
 *   - Super_admin → /superadmin (hub técnico; admin global não precisa de tenant).
 *   - Demais → /dashboard/context (seletor; mostra mensagem "sem tenant" se a lista vier vazia).
 */
export default async function DashboardEntryPage() {
  const request = requestFromHeaders(await headers());
  const session = await getCurrentSession(request);
  if (!session) redirect("/login?from=/dashboard");

  const currentMembership = session.session.currentTenantId
    ? await getCurrentMembership(
        session.user.id,
        session.session.currentTenantId
      )
    : null;

  if (!currentMembership) {
    const superAdmin = await isSuperAdmin(session.user.id);
    if (superAdmin) {
      redirect("/superadmin");
    }
    redirect("/dashboard/context");
  }
  redirect("/dashboard/home");
}
