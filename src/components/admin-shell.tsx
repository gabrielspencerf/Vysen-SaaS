"use client";

/**
 * Shell da área admin (super_admin): navegação dedicada usando Sidebar.
 */

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminMobileHeader } from "@/components/admin-mobile-header";
import { DashboardPageLayout } from "@/components/layout";

interface AdminShellProps {
  userEmail: string;
  children: React.ReactNode;
}

export function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-dark md:flex-row">
      {/* Sidebar: desktop */}
      <div className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] md:block">
        <AdminSidebar userEmail={userEmail} />
      </div>
      {/* Espaço para não sobrepor o conteúdo ao sidebar */}
      <div className="hidden w-[220px] shrink-0 md:block" aria-hidden />
      
      {/* Mobile: barra superior com drawer */}
      <AdminMobileHeader userEmail={userEmail} />

      <main className="min-w-0 flex-1 overflow-auto">
        <DashboardPageLayout>{children}</DashboardPageLayout>
      </main>
    </div>
  );
}
