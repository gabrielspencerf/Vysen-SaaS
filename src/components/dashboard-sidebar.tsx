"use client";

/**
 * Sidebar do dashboard (usuário). Paleta CL: tema escuro, destaque verde.
 * Estrutura: cabeçalho conta, CTA Início, nav com ícones Lucide, rodapé (email + sair).
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, LifeBuoy, LogOut, UserCircle2 } from "lucide-react";
import { DashboardNotificationBell } from "@/components/dashboard-notification-bell";
import { SidebarNavSections } from "@/components/sidebar-nav-sections";
import { SidebarInsightsCarousel } from "@/components/sidebar-insights-carousel";
import { dashboardNavSections } from "@/components/sidebar-navigation";
import type { SidebarInsightsPayload } from "@/types/sidebar-insights";

interface DashboardSidebarProps {
  userEmail: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
  insights: SidebarInsightsPayload;
  hideNotificationBell?: boolean;
}

export function DashboardSidebar({
  userEmail,
  userName,
  userAvatarUrl = null,
  insights,
  hideNotificationBell = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const defaultDisplayName = userName?.trim() || userEmail.split("@")[0] || "Usuário";
  const [userDisplayName, setUserDisplayName] = useState(defaultDisplayName);
  const avatarLetter = userDisplayName.charAt(0).toUpperCase();
  const userFirstName = userDisplayName.split(" ")[0] || userDisplayName;
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(userAvatarUrl);

  useEffect(() => {
    setUserDisplayName(defaultDisplayName);
  }, [defaultDisplayName]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [userAvatarUrl]);

  useEffect(() => {
    setResolvedAvatarUrl(userAvatarUrl);
  }, [userAvatarUrl]);

  useEffect(() => {
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string | null; avatarUrl?: string | null }>).detail;
      if (typeof detail?.name === "string" && detail.name.trim()) {
        setUserDisplayName(detail.name.trim());
      }
      if (detail && "avatarUrl" in detail) {
        setAvatarBroken(false);
        setResolvedAvatarUrl(detail.avatarUrl ?? null);
      }
    };

    fetch("/api/context/profile")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        const nextName =
          data && typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : null;
        const nextAvatar =
          data && typeof data.avatarUrl === "string" && data.avatarUrl.trim()
            ? data.avatarUrl.trim()
            : null;
        if (nextName) setUserDisplayName(nextName);
        setResolvedAvatarUrl(nextAvatar);
      })
      .catch(() => undefined);
    window.addEventListener("vysen-profile-updated", onProfileUpdated as EventListener);
    return () =>
      window.removeEventListener("vysen-profile-updated", onProfileUpdated as EventListener);
  }, []);

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
    <aside className="sidebar flex h-full min-h-0 min-w-0 flex-col overflow-x-visible border-r border-brand-border">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Topo: branding e boas-vindas (overflow visível para o dropdown do sininho) */}
        <div className="shrink-0 border-b border-brand-border p-4">
          <div className="mb-3 h-px w-full bg-gradient-to-r from-brand-neon/0 via-brand-neon/45 to-brand-neon/0" />
          <div className="flex items-start justify-between gap-2 px-2">
            <div className="min-w-0 flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-brand-muted">
                Dashboard
              </span>
              <h2 className="truncate text-lg font-semibold text-brand-text" title="Vysen">
                Vysen
              </h2>
              <p className="text-xs text-brand-muted">Bem-vindo, {userFirstName}</p>
            </div>
            {!hideNotificationBell && (
              <div className="shrink-0 self-start pt-0.5">
                <DashboardNotificationBell dropdownAlign="start" />
              </div>
            )}
          </div>
        </div>

        <div className="scroll-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <SidebarNavSections
            pathname={pathname}
            sections={dashboardNavSections}
            enableAccordion
          />
        </div>

        <div className="sidebar-fade-cap shrink-0 p-4">
          <SidebarInsightsCarousel insights={insights} />
        </div>

        {/* Rodapé: usuário + ações */}
        <div className="sidebar-fade-cap shrink-0 p-4">
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex w-full items-center gap-3 rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-2 text-left transition-colors hover:bg-brand-surface"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Abrir menu de perfil"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-surface text-sm font-semibold text-brand-text shadow-sm">
                {resolvedAvatarUrl && !avatarBroken ? (
                  <img
                    src={resolvedAvatarUrl}
                    alt={`Avatar de ${userDisplayName}`}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  avatarLetter
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-text" title={userDisplayName}>
                  {userDisplayName}
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
                <Link
                  href="/dashboard/support"
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                  className="fx-button mb-1.5 inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-text transition-colors hover:bg-brand-surface/80"
                >
                  <LifeBuoy className="h-4 w-4 text-brand-muted" aria-hidden />
                  <span>Suporte</span>
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
