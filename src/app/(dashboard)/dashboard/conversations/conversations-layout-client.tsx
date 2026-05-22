"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui";
import { Input } from "@/components/ui";
import { formatDate } from "@/lib/i18n/date";

/** Payload vindo do Server Component (datas já em ISO string). */
export type ConversationListItem = {
  id: string;
  externalId: string;
  status: string;
  startedAt: string;
  lastSyncedAt: string | null;
  instanceDisplay: string;
  messageCount: number;
  leadName: string | null;
  leadPhone: string | null;
};

function formatRelativeTime(d: Date | string): string {
  const now = Date.now();
  const t = new Date(d).getTime();
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return "agora";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD} d`;
  return formatDate(d);
}

function statusBadgeVariant(
  status: string
): "success" | "default" | "warning" {
  if (status === "open") return "success";
  if (status === "archived") return "warning";
  return "default";
}

function statusLabel(status: string): string {
  if (status === "open") return "Aberta";
  if (status === "closed") return "Encerrada";
  if (status === "archived") return "Arquivada";
  return status;
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

export function ConversationsLayoutClient({
  conversations,
  children,
  className = "",
}: {
  conversations: ConversationListItem[];
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const selectedId = pathname?.startsWith("/dashboard/conversations/")
    ? pathname.replace("/dashboard/conversations/", "").split("/")[0]
    : null;

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return conversations;
    return conversations.filter((c) => {
      const blob = [
        c.externalId,
        c.instanceDisplay,
        c.leadName ?? "",
        c.leadPhone ?? "",
        c.status,
        String(c.messageCount),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [conversations, query]);

  return (
    <div className={`min-h-0 min-w-0 ${className}`}>
      {/*
        Mobile: limita altura da lista para o painel da direita não sumir no scroll.
        md+: lista em coluna fixa com altura do container (flex stretch).
      */}
      <aside className="flex max-h-[min(42dvh,20rem)] min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-brand-border bg-brand-surface/60 backdrop-blur-sm md:h-full md:max-h-none md:w-80 md:shrink-0 md:border-r lg:w-96">
        <div className="shrink-0 space-y-3 border-b border-brand-border bg-brand-surface/90 px-3 py-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-muted/90">
              Canal
            </p>
            <h2 className="text-base font-semibold text-brand-text">Conversas</h2>
            <p className="mt-0.5 text-xs text-brand-muted">
              {conversations.length === 0
                ? "Nenhuma conversa sincronizada"
                : `${conversations.length} conversa${conversations.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {conversations.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                type="search"
                placeholder="Buscar por contato, número, instância…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9"
                aria-label="Filtrar conversas"
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-border bg-brand-surface">
                <MessageSquare className="h-7 w-7 text-brand-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-text">Nenhuma conversa ainda</p>
                <p className="mt-1 text-xs text-brand-muted">
                  Quando mensagens chegarem pelas integrações WhatsApp, elas aparecem aqui.
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-brand-muted">
              Nenhum resultado para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="divide-y divide-brand-border/60">
              {filtered.map((c) => {
                const isSelected = selectedId === c.id;
                const title =
                  c.leadName?.trim() ||
                  c.leadPhone?.trim() ||
                  c.externalId ||
                  "Conversa";
                const subtitle = c.leadName?.trim()
                  ? c.externalId
                  : c.leadPhone?.trim() || c.instanceDisplay;

                return (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/conversations/${c.id}`}
                      className={`block px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon/50 ${
                        isSelected
                          ? "bg-brand-neon/12 border-l-[3px] border-brand-neon"
                          : "border-l-[3px] border-transparent hover:bg-brand-surface/90"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-brand-text" title={title}>
                            {title}
                          </p>
                          <p
                            className="mt-0.5 truncate font-mono text-[11px] text-brand-muted"
                            title={subtitle}
                          >
                            {subtitle}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(c.status)} className="shrink-0 text-[10px]">
                          {statusLabel(c.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-muted">
                        <span>{c.messageCount} msg</span>
                        <span aria-hidden>·</span>
                        <span>{formatRelativeTime(c.lastSyncedAt ?? c.startedAt)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{c.instanceDisplay}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-brand-dark/40">
        {children}
      </main>
    </div>
  );
}
