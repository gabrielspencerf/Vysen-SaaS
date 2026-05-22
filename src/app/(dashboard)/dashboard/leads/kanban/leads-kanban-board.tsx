"use client";

import { useState } from "react";
import Link from "next/link";

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  sourceProvider: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type Column = {
  status: string;
  label: string;
  leads: LeadRow[];
};

function formatRelativeDate(value: Date): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / dayMs);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function sourceLabel(sourceProvider: string | null): string {
  if (!sourceProvider) return "manual";
  if (sourceProvider === "google_ads") return "Google Ads";
  if (sourceProvider === "uazapi") return "UAZAPI";
  if (sourceProvider === "typebot") return "Typebot";
  if (sourceProvider === "evolution") return "Evolution";
  return sourceProvider;
}

export function LeadsKanbanBoard({ columns }: { columns: Column[] }) {
  const [moving, setMoving] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState(() =>
    columns.map((c) => ({ ...c, leads: [...c.leads] }))
  );

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const res = await fetch(`/api/dashboard/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error("Falha ao atualizar status");
  };

  /**
   * Move um lead entre colunas, independentemente do gesto que disparou (drag
   * ou select via teclado). Atualiza state otimisticamente, persiste no servidor
   * e faz rollback se a API falhar.
   */
  const moveLead = async (leadId: string, targetStatus: string) => {
    const lead = localColumns
      .flatMap((c) => c.leads)
      .find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;
    setLocalColumns((prev) =>
      prev.map((col) => {
        if (col.status === lead.status) {
          return { ...col, leads: col.leads.filter((l) => l.id !== leadId) };
        }
        if (col.status === targetStatus) {
          return {
            ...col,
            leads: [...col.leads, { ...lead, status: targetStatus }],
          };
        }
        return col;
      })
    );
    try {
      await updateLeadStatus(leadId, targetStatus);
    } catch {
      setLocalColumns(columns.map((c) => ({ ...c, leads: [...c.leads] })));
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setMoving(leadId);
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId || moving === null) return;
    setMoving(null);
    await moveLead(leadId, targetStatus);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {localColumns.map((col) => (
        <div
          key={col.status}
          className="kanban-column min-h-[260px] p-3"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.status)}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-text">
              {col.label}
            </h3>
            <span className="rounded-full bg-brand-text/10 px-2 py-0.5 text-xs text-brand-muted">
              {col.leads.length}
            </span>
          </div>
          <div className="flex min-h-[180px] flex-col gap-2">
            {col.leads.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-brand-border/80 bg-brand-surface/40 px-3 text-center text-xs text-brand-muted">
                Sem leads nesta etapa
              </div>
            ) : (
              col.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className={`kanban-card cursor-grab p-2.5 active:cursor-grabbing ${
                    moving === lead.id ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="line-clamp-1 text-sm font-semibold text-brand-text hover:text-brand-neon"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.name ?? lead.email ?? lead.phone ?? lead.id.slice(0, 8)}
                    </Link>
                    <span className="rounded-full border border-brand-border bg-brand-surface/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-muted">
                      {sourceLabel(lead.sourceProvider)}
                    </span>
                  </div>
                  {(lead.email || lead.phone) && (
                    <p className="mt-1.5 truncate text-xs text-brand-muted">
                      {lead.email ?? lead.phone}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-brand-border/60 pt-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-brand-muted">
                      Atualizado
                    </span>
                    <span className="text-[11px] font-medium text-brand-text">
                      {formatRelativeDate(lead.lastSeenAt)}
                    </span>
                  </div>
                  {/* Alternativa acessível ao drag&drop: dropdown que muda o
                      status do lead. Reach por teclado, screen reader e touch
                      em mobile (onde drag entre colunas é difícil). */}
                  <label className="mt-2 block">
                    <span className="sr-only">Mover {lead.name ?? "lead"} para outra etapa</span>
                    <select
                      value={lead.status}
                      onChange={(e) => {
                        void moveLead(lead.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-full rounded-md border border-brand-border bg-brand-surface px-2 py-1 text-[11px] text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-neon"
                    >
                      {localColumns.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
