"use client";

/**
 * Sidebar do dashboard (usuário). Paleta CL: tema escuro, destaque verde.
 * Estrutura: cabeçalho conta, CTA Início, nav com ícones Lucide, rodapé (email + sair).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Filter,
  Settings,
} from "lucide-react";
import { TenantSwitcher } from "@/components/tenant-switcher";
import type { SessionWithUserAndTenant } from "@/server/auth/session";
import type { MembershipItem } from "@/server/tenancy/membership";

const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard/home", label: "Início", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/conversations", label: "Conversas", icon: MessageSquare },
  { href: "/dashboard/google-ads", label: "Google Ads", icon: BarChart3 },
  { href: "/dashboard/funnel", label: "Funil", icon: Filter },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

interface DashboardSidebarProps {
  session: SessionWithUserAndTenant;
  currentMembership: MembershipItem;
}

export function DashboardSidebar({
  session,
  currentMembership,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar flex h-full flex-col scroll-hide overflow-y-auto overflow-x-hidden border-r border-brand-border">
      <div className="flex flex-1 flex-col">
        {/* Logo + cabeçalho da conta */}
        <div className="border-b border-brand-border p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="brand-logo-avatar shrink-0">
              <img
                src="/logo.svg"
                alt="Creative Lane"
                width={18}
                height={18}
                className="logo-adaptive h-[18px] w-[18px] shrink-0 text-brand-text"
              />
            </div>
            <span className="text-sm font-semibold text-brand-text">
              Creative Lane
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="pl-2 text-xs font-medium uppercase tracking-wider text-brand-muted">
              Dashboard
            </span>
            <TenantSwitcher
              currentTenantId={session.session.currentTenantId!}
              currentTenantName={currentMembership.tenantName}
              currentUserName={session.user.name?.trim() || session.user.email}
            />
          </div>
        </div>

        {/* Navegação: item ativo = verde, inativo = texto muted */}
        <nav className="select-none p-4 pt-6 text-sm flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-nav-item mx-2 flex items-center gap-3 px-4 py-3 ${
                  isActive
                    ? "sidebar-nav-item-active"
                    : ""
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: email + sair */}
        <div className="mt-auto border-t border-brand-border p-4">
          <p className="truncate text-xs text-brand-muted" title={session.user.email}>
            {session.user.email}
          </p>
          <form action="/api/auth/logout" method="POST" className="mt-2">
            <button
              type="submit"
              className="text-sm text-brand-muted transition-colors hover:text-brand-text"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
