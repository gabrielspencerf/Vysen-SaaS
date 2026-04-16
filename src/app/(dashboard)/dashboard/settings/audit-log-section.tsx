"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface AuditLogItem {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  occurredAt: string;
  userId: string | null;
}

interface AuditApiResponse {
  enabled: boolean;
  scopes: string[];
  logs: AuditLogItem[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AuditLogSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditApiResponse>({
    enabled: false,
    scopes: [],
    logs: [],
  });

  useEffect(() => {
    async function loadAudit() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/settings/audit", { method: "GET" });
        const payload = (await res.json().catch(() => ({}))) as Partial<AuditApiResponse> & {
          error?: string;
        };
        if (!res.ok) {
          setError(payload.error ?? "Não foi possível carregar a auditoria.");
          return;
        }
        setData({
          enabled: payload.enabled === true,
          scopes: Array.isArray(payload.scopes)
            ? payload.scopes.filter((scope): scope is string => typeof scope === "string")
            : [],
          logs: Array.isArray(payload.logs)
            ? payload.logs.filter((item): item is AuditLogItem => {
                return (
                  item &&
                  typeof item === "object" &&
                  typeof item.id === "string" &&
                  typeof item.action === "string" &&
                  typeof item.occurredAt === "string"
                );
              })
            : [],
        });
      } catch {
        setError("Falha de conexão ao carregar auditoria.");
      } finally {
        setLoading(false);
      }
    }

    loadAudit();
  }, []);

  if (!loading && !data.enabled) {
    return null;
  }

  return (
    <Card className="mt-6 border-brand-border bg-brand-surface">
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-brand-text">Auditoria da conta</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Histórico das ações críticas registradas para este tenant.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-brand-muted">Carregando auditoria...</p>
        ) : error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : data.logs.length === 0 ? (
          <p className="mt-4 text-sm text-brand-muted">
            Nenhum evento de auditoria registrado até o momento.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {data.logs.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-brand-border bg-brand-surface/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-brand-text">
                    {item.action.toUpperCase()} {item.resourceType ?? "recurso"}
                  </p>
                  <span className="text-xs text-brand-muted">
                    {formatDate(item.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-muted">
                  {item.resourceId ? `Recurso: ${item.resourceId}` : "Recurso sem ID"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

