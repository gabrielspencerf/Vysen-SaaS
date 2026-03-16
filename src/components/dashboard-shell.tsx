/**
 * Shell do dashboard por tenant: sidebar (nav, tenant, logout) + área principal.
 * Paleta CL: fundo escuro, container central com espaçamento.
 */

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardMobileHeader } from "@/components/dashboard-mobile-header";
import { DashboardPageLayout } from "@/components/layout";
import type { SessionWithUserAndTenant } from "@/server/auth/session";
import type { MembershipItem } from "@/server/tenancy/membership";

interface DashboardShellProps {
  session: SessionWithUserAndTenant;
  currentMembership: MembershipItem;
  children: React.ReactNode;
}

export function DashboardShell({
  session,
  currentMembership,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-dark md:flex-row">
      {/* Sidebar: desktop */}
      <div className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] md:block">
        <DashboardSidebar
          session={session}
          currentMembership={currentMembership}
        />
      </div>
      {/* Espaço para não sobrepor o conteúdo ao sidebar */}
      <div className="hidden w-[220px] shrink-0 md:block" aria-hidden />
      
      {/* Mobile: barra superior com drawer */}
      <DashboardMobileHeader session={session} currentMembership={currentMembership} />

      <main className="min-w-0 flex-1 overflow-auto">
        <DashboardPageLayout>{children}</DashboardPageLayout>
      </main>
    </div>
  );
}
