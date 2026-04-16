/**
 * Shell do dashboard por tenant: sidebar (nav, tenant, logout) + área principal.
 * Paleta CL: fundo escuro, container central com espaçamento.
 */

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardMobileHeader } from "@/components/dashboard-mobile-header";
import { DashboardPageLayout } from "@/components/layout";
import { DashboardVysenChatDock } from "@/components/dashboard-vysen-chat-dock";
import { DashboardFirstAccessGuide } from "@/components/dashboard-first-access-guide";
import type { SidebarInsightsPayload } from "@/types/sidebar-insights";

interface DashboardShellProps {
  tenantId: string;
  userEmail: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
  showAdminLink?: boolean;
  insights: SidebarInsightsPayload;
  children: React.ReactNode;
}

export function DashboardShell({
  tenantId,
  userEmail,
  userName,
  userAvatarUrl,
  showAdminLink = false,
  insights,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-dark md:flex-row">
      {/* Sidebar: desktop */}
      <div className="fixed left-0 top-0 z-30 hidden h-screen w-[248px] md:block">
        <DashboardSidebar
          userEmail={userEmail}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          showAdminLink={showAdminLink}
          insights={insights}
        />
      </div>
      {/* Espaço para não sobrepor o conteúdo ao sidebar */}
      <div className="hidden w-[248px] shrink-0 md:block" aria-hidden />
      
      {/* Mobile: barra superior com drawer */}
      <DashboardMobileHeader
        userEmail={userEmail}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        showAdminLink={showAdminLink}
        insights={insights}
      />

      <div className="min-w-0 flex-1 overflow-hidden pt-16 md:pt-0">
        <DashboardVysenChatDock tenantId={tenantId}>
          <DashboardPageLayout>{children}</DashboardPageLayout>
        </DashboardVysenChatDock>
        <DashboardFirstAccessGuide tenantId={tenantId} userEmail={userEmail} />
      </div>
    </div>
  );
}
