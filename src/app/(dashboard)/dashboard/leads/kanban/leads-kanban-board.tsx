"use client";

import { useState } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
  duplicate: "Duplicado",
  bad_lead: "Lead ruim",
};

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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {localColumns.map((col) => (
        <div
          key={col.status}
          className="min-w-[280px] flex-shrink-0 rounded-lg border border-brand-border bg-brand-surface/50 p-3"
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
          <div className="flex flex-col gap-2">
            {col.leads.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => handleDragStart(e, lead.id)}
                className={`cursor-grab rounded-md border border-brand-border bg-brand-surface p-3 shadow-sm transition-shadow active:cursor-grabbing hover:shadow ${
                  moving === lead.id ? "opacity-60" : ""
                }`}
              >
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="font-medium text-brand-text hover:text-brand-neon"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lead.name ?? lead.email ?? lead.phone ?? lead.id.slice(0, 8)}
                </Link>
                {(lead.email || lead.phone) && (
                  <p className="mt-1 truncate text-xs text-brand-muted">
                    {lead.email ?? lead.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
