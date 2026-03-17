"use client";

/**
 * Sidebar do admin.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  Activity,
  Building2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui";

const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/admin", label: "Início", icon: LayoutDashboard },
  { href: "/admin/integrations", label: "Integrações", icon: Box },
  { href: "/admin/observability", label: "Observabilidade", icon: Activity },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/users", label: "Usuários", icon: Users },
];

interface AdminSidebarProps {
  userEmail: string;
}

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar flex h-full flex-col scroll-hide overflow-y-auto overflow-x-hidden border-r border-brand-border">
      <div className="flex flex-1 flex-col">
        {/* Logo + cabeçalho da conta */}
        <div className="border-b border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
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
          <div className="text-xs font-medium text-brand-muted uppercase tracking-wider mt-2">
            Administração
          </div>
        </div>

        {/* Navegação: item ativo = verde, inativo = texto muted */}
        <nav className="select-none p-4 pt-6 text-sm flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (pathname.startsWith(href + "/") && href !== "/admin");
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
          <p className="truncate text-xs text-brand-muted" title={userEmail}>
            {userEmail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href="/">
              <Button type="button" variant="ghost" size="sm">
                Voltar
              </Button>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
