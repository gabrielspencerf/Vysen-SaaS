"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer";
import { DashboardNotificationBell } from "@/components/dashboard-notification-bell";
import type { SidebarInsightsPayload } from "@/types/sidebar-insights";

interface DashboardMobileHeaderProps {
  userEmail: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
  showAdminLink?: boolean;
  insights: SidebarInsightsPayload;
}

export function DashboardMobileHeader({
  userEmail,
  userName,
  userAvatarUrl,
  showAdminLink = false,
  insights,
}: DashboardMobileHeaderProps) {
  return (
    <MobileSidebarDrawer
      menuAriaLabel="Abrir menu do dashboard"
      rightSlot={<DashboardNotificationBell />}
    >
      <DashboardSidebar
        userEmail={userEmail}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        showAdminLink={showAdminLink}
        insights={insights}
        hideNotificationBell
      />
    </MobileSidebarDrawer>
  );
}
