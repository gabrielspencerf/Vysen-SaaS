"use client";

/**
 * Sidebar do admin.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, UserCircle2 } from "lucide-react";
import { SidebarNavSections } from "@/components/sidebar-nav-sections";
import { SidebarInsightsCarousel } from "@/components/sidebar-insights-carousel";
import { adminNavSections } from "@/components/sidebar-navigation";
import type { SidebarInsightsPayload } from "@/types/sidebar-insights";

interface AdminSidebarProps {
  userEmail: string;
  userName?: string | null;
  insights: SidebarInsightsPayload;
}

export function AdminSidebar({ userEmail, userName, insights }: AdminSidebarProps) {
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = userName?.trim() || userEmail.split("@")[0] || "Usuário";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const firstName = displayName.split(" ")[0] || displayName;

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [profileMenuOpen]);

  return (
    <aside className="sidebar flex h-full flex-col scroll-hide overflow-y-auto overflow-x-hidden border-r border-brand-border">
      <div className="flex flex-1 flex-col">
        {/* Topo: branding e boas-vindas */}
        <div className="border-b border-brand-border p-4">
          <div className="mb-3 h-px w-full bg-gradient-to-r from-brand-neon/0 via-brand-neon/45 to-brand-neon/0" />
          <div className="flex flex-col gap-1 px-2">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-muted">
              SUPERADMIN
            </div>
            <h2 className="truncate text-lg font-semibold text-brand-text">Vysen</h2>
            <p className="text-xs text-brand-muted">Bem-vindo, {firstName}</p>
          </div>
        </div>

        <SidebarNavSections
          pathname={pathname}
          sections={adminNavSections}
        />

        <div className="sidebar-fade-cap shrink-0 p-4">
          <SidebarInsightsCarousel insights={insights} />
        </div>

        {/* Rodapé: usuário + ações */}
        <div className="sidebar-fade-cap mt-auto shrink-0 p-4">
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex w-full items-center gap-3 rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-2 text-left transition-colors hover:bg-brand-surface"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Abrir menu de perfil do superadmin"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-sm font-semibold text-brand-text shadow-sm">
                {avatarLetter}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-text" title={displayName}>
                  {displayName}
                </p>
                <p className="truncate text-xs text-brand-muted" title={userEmail}>
                  {userEmail}
                </p>
              </div>
              <ChevronUp
                className={`h-4 w-4 shrink-0 text-brand-muted transition-transform ${
                  profileMenuOpen ? "rotate-0" : "rotate-180"
                }`}
                aria-hidden
              />
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-full overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-lg animate-[pageContentIn_200ms_ease-out]"
              >
                <div className="border-b border-brand-border bg-brand-surface/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                    Menu da conta
                  </p>
                </div>
                <div className="p-2">
                  <Link
                    href="/dashboard/settings"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="fx-button mb-1.5 inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-text transition-colors hover:bg-brand-surface/80"
                  >
                    <UserCircle2 className="h-4 w-4 text-brand-muted" aria-hidden />
                    <span>Meu perfil</span>
                  </Link>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="fx-button inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      <span>Sair</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
