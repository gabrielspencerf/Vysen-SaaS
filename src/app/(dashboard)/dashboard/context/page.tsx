"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  roleSlug: string;
}

export default function DashboardContextPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/context/tenants")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar");
        return res.json();
      })
      .then((data: { tenants: TenantOption[] }) => {
        setTenants(data.tenants ?? []);
      })
      .catch(() => setError("Falha ao carregar tenants"))
      .finally(() => setLoading(false));
  }, []);

  async function selectTenant(tenantId: string) {
    setSwitching(tenantId);
    setError(null);
    try {
      const res = await fetch("/api/context/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível trocar");
        return;
      }
      router.push("/dashboard/home");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSwitching(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-brand-muted">Carregando…</p>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="px-1 py-0 sm:px-2">
        <div className="panel-lux max-w-2xl rounded-xl border border-brand-border bg-brand-surface p-6">
          <p className="text-brand-text">Nenhum tenant disponível.</p>
          <p className="mt-2 text-sm text-brand-muted">
          Você não tem acesso a nenhum tenant. Entre em contato com o
          administrador ou saia para tentar outra conta.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action="/api/auth/logout" method="POST" className="inline">
              <button
                type="submit"
                className="btn-cta-primary rounded-lg px-4 py-2 text-sm font-medium"
              >
                Sair
              </button>
            </form>
            <Link
              href="/"
              className="rounded border border-brand-border px-4 py-2 text-sm font-medium text-brand-text transition-colors hover:bg-brand-surface"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 py-0 sm:px-2">
      <h1 className="text-lg font-semibold text-brand-text">
        Selecione um tenant
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Escolha o contexto de trabalho para continuar.
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </div>
      )}
      <ul className="mt-6 space-y-2">
        {tenants.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => selectTenant(t.id)}
              disabled={switching !== null}
              className="panel-lux w-full rounded-md border border-brand-border bg-brand-surface px-4 py-3 text-left text-sm transition-colors hover:border-brand-neon/30 disabled:opacity-50"
            >
              <span className="font-medium text-brand-text">{t.name}</span>
              <span className="ml-2 text-brand-muted">({t.slug})</span>
              {switching === t.id && (
                <span className="ml-2 text-brand-muted">…</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
