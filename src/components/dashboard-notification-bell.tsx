"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { formatDateTime as formatDate } from "@/lib/i18n/date";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardNotificationBellProps {
  /**
   * end = painel alinhado à direita do gatilho (default; canto da tela / mobile).
   * start = painel alinhado à esquerda do gatilho, expandindo para a direita (sidebar esquerda).
   */
  dropdownAlign?: "end" | "start";
}

export function DashboardNotificationBell({
  dropdownAlign = "end",
}: DashboardNotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const unreadIds = useMemo(
    () => items.filter((item) => !item.isRead).map((item) => item.id),
    [items]
  );

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/notifications", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : typeof data.error?.message === "string"
              ? data.error.message
              : "Erro ao carregar notificações.";
        setError(message);
        return;
      }
      const notifications =
        data.ok === true && data.data && typeof data.data === "object"
          ? (data.data as { notifications?: NotificationItem[] }).notifications
          : (data.notifications as NotificationItem[] | undefined);
      setItems(notifications ?? []);
    } catch {
      setError("Falha de conexão ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markManyAsRead(ids: string[]) {
    if (ids.length === 0) return;
    try {
      await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setItems((prev) =>
        prev.map((item) => (ids.includes(item.id) ? { ...item, isRead: true } : item))
      );
    } catch {
      // Não bloqueia UX do dropdown por erro pontual.
    }
  }

  async function handleOpenToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleOpenToggle}
        className="relative rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-neon"
        aria-label="Abrir notificações"
      >
        <Bell className="h-5 w-5" />
        {unreadIds.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-neon px-1.5 text-[10px] font-semibold text-black">
            {unreadIds.length > 9 ? "9+" : unreadIds.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-[360px] max-w-[min(92vw,calc(100vw-2rem))] rounded-xl border border-brand-border bg-brand-surface shadow-2xl ${
            dropdownAlign === "start" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-brand-border px-3 py-2">
            <p className="text-sm font-semibold text-brand-text">Notificações</p>
            <button
              type="button"
              onClick={() => markManyAsRead(unreadIds)}
              disabled={unreadIds.length === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-muted hover:bg-brand-surface/80 hover:text-brand-text disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar lidas
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-brand-muted">
                Carregando...
              </p>
            ) : error ? (
              <p className="px-2 py-6 text-center text-sm text-red-400">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-brand-muted">
                Nenhuma notificação no momento.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.slice(0, 12).map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-lg border p-2 ${
                      item.isRead
                        ? "border-brand-border bg-brand-surface/40"
                        : "border-brand-neon/30 bg-brand-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-brand-text">{item.title}</p>
                      <span className="text-[10px] text-brand-muted whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-muted">{item.message}</p>
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => markManyAsRead([item.id])}
                        className="mt-2 text-[11px] text-brand-neon hover:underline"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-brand-border px-3 py-2 text-right">
            <Link
              href="/dashboard/notifications"
              className="text-xs text-brand-neon hover:underline"
              onClick={() => setOpen(false)}
            >
              Ver central completa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

