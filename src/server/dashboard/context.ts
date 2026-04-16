/**
 * Contexto tenant para páginas do dashboard (home, leads, conversations).
 * Garante sessão + tenant atual + membership; redireciona para /dashboard/context se não houver tenant.
 * Não confia em tenant vindo do frontend — usa apenas sessão.
 */

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth";
import { getCurrentMembership } from "@/server/tenancy/membership";
import type { MembershipItem } from "@/server/tenancy/membership";
import type { SessionWithUserAndTenant } from "@/server/auth/session";
import { requestFromHeaders } from "@/server/request";
import { headers } from "next/headers";

export interface DashboardTenantContext {
  session: SessionWithUserAndTenant;
  currentMembership: MembershipItem;
  tenantId: string;
  showAdminLink: boolean;
}

/**
 * Obtém sessão, valida tenant atual e membership. Redireciona para login ou /dashboard/context se inválido.
 * Usar em layouts e páginas que precisam do tenant atual (leads, conversations, home).
 */
export async function getDashboardTenantContext(): Promise<DashboardTenantContext> {
  const request = requestFromHeaders(await headers());
  const session = await getCurrentSession(request);
  if (!session) {
    redirect("/login?from=/dashboard");
  }

  const currentTenantId = session.session.currentTenantId;
  if (!currentTenantId) {
    redirect("/dashboard/context");
  }

  const currentMembership = await getCurrentMembership(
    session.user.id,
    currentTenantId
  );
  if (!currentMembership) {
    redirect("/dashboard/context");
  }

  const showAdminLink = currentMembership.roleSlug === "super_admin";

  return {
    session,
    currentMembership,
    tenantId: currentTenantId,
    showAdminLink,
  };
}
