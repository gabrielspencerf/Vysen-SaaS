"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Input, Button } from "@/components/ui";

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [auditScopes, setAuditScopes] = useState<string[]>([]);

  function toggleAuditScope(scope: string, checked: boolean) {
    setAuditScopes((prev) => {
      if (checked) return Array.from(new Set([...prev, scope]));
      return prev.filter((item) => item !== scope);
    });
  }

  function deriveSlug(value: string) {
    setSlug(
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          settings: {
            features: {
              notificationsEnabled,
              auditEnabled,
              auditScopes: auditEnabled ? auditScopes : [],
            },
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar tenant");
        return;
      }
      router.push("/admin/tenants");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <Link
          href="/admin/tenants"
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Voltar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-text mb-6">Novo tenant</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-brand-text">
            Nome
          </label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              deriveSlug(e.target.value);
            }}
            className="w-full bg-brand-surface border-brand-border text-brand-text"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium text-brand-text">
            Slug
          </label>
          <Input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full bg-brand-surface border-brand-border text-brand-text font-mono"
            required
          />
        </div>
        <div className="space-y-3 rounded-xl border border-brand-border bg-brand-surface/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Governança da conta (tenant)
          </h2>
          <div className="flex items-center gap-2">
            <input
              id="notifications_enabled"
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
            />
            <label htmlFor="notifications_enabled" className="text-sm text-brand-text">
              Habilitar notificações in-app de ações da conta
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="audit_enabled"
              type="checkbox"
              checked={auditEnabled}
              onChange={(e) => setAuditEnabled(e.target.checked)}
              className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
            />
            <label htmlFor="audit_enabled" className="text-sm text-brand-text">
              Habilitar auditoria da conta em configurações
            </label>
          </div>
          {auditEnabled && (
            <div className="space-y-2 rounded-lg border border-brand-border/80 bg-brand-dark/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Escopos de auditoria liberados
              </p>
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={auditScopes.includes("integrations")}
                  onChange={(e) => toggleAuditScope("integrations", e.target.checked)}
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Integrações
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={auditScopes.includes("products_leads")}
                  onChange={(e) => toggleAuditScope("products_leads", e.target.checked)}
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Produtos e leads
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={auditScopes.includes("users_memberships")}
                  onChange={(e) => toggleAuditScope("users_memberships", e.target.checked)}
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Usuários e memberships
              </label>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={submitting}
            >
            {submitting ? "Criando…" : "Criar"}
          </Button>
          <Link href="/admin/tenants">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </form>
    </PageSection>
  );
}
