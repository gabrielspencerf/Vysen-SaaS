"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageSection } from "@/components/layout";
import { Button } from "@/components/ui";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  createdAt: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function DashboardNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/notifications", {
        method: "GET",
        signal,
      });
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
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError("Falha de conexão ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const unreadIds = useMemo(
    () => items.filter((item) => !item.isRead).map((item) => item.id),
    [items]
  );

  async function markAllAsRead() {
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });
      if (!res.ok) {
        setError("Não foi possível marcar notificações como lidas.");
        return;
      }
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      setError("Falha de conexão ao atualizar notificações.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Notificações</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Alertas internos de leads, mudanças de status e follow-ups comerciais.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={markingAll || unreadIds.length === 0}
          onClick={markAllAsRead}
        >
          {markingAll ? "Marcando…" : "Marcar todas como lidas"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-brand-border bg-brand-surface/50 px-4 py-3"
            >
              <div className="h-4 w-1/3 animate-pulse rounded bg-brand-border/70" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-brand-border/50" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-brand-border/40" />
            </div>
          ))}
          <span className="sr-only">Carregando notificações…</span>
        </div>
      ) : error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2"
          role="alert"
        >
          <p className="text-sm text-red-300">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => load()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-muted">Nenhuma notificação disponível no momento.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border px-4 py-3 ${
                item.isRead
                  ? "border-brand-border bg-brand-surface/50"
                  : "border-brand-neon/30 bg-brand-surface"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-text">{item.title}</p>
                <span className="text-xs text-brand-muted">{formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-brand-muted">{item.message}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-brand-border px-2 py-0.5 text-brand-muted">
                  Tipo: {item.type}
                </span>
                {!item.isRead && (
                  <span className="rounded-full border border-brand-neon/40 bg-brand-neon/10 px-2 py-0.5 text-brand-neon">
                    Não lida
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageSection>
  );
}
