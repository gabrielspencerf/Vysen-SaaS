"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";

type Tenant = { id: string; name: string; slug: string };

export default function NewEvolutionInstancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; webhook_url: string } | null>(null);

  useEffect(() => {
    const preselectedTenantId = searchParams.get("tenantId");
    if (preselectedTenantId) setTenantId(preselectedTenantId);
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/tenants", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { tenants: [] }))
      .then((data: { tenants?: Tenant[] }) => setTenants(data.tenants ?? []))
      .catch((err) => {
        if (err?.name !== "AbortError") setTenants([]);
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/integrations/evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          external_id: externalId.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim() || undefined,
          instance_name: instanceName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar instância");
        return;
      }
      setCreated({ id: data.id, webhook_url: data.webhook_url ?? "" });
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link href="/superadmin/integrations" className="text-sm text-brand-neon hover:opacity-90">
            ← Voltar às integrações
          </Link>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text">Instância Evolution criada</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Configure na Evolution API a URL de webhook abaixo:
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="block max-w-full break-all rounded-lg bg-brand-dark px-3 py-2 text-sm text-brand-neon">
              {created.webhook_url}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard.writeText(created.webhook_url)}
            >
              Copiar
            </Button>
          </div>
          {apiKey && (
            <p className="mt-3 text-xs text-brand-muted">
              Segurança recomendada: assinar payload com{" "}
              <code>X-Webhook-Timestamp</code> e <code>X-Webhook-Signature</code>{" "}
              (HMAC SHA-256 em <code>timestamp.rawBody</code>).
            </p>
          )}
        </div>
        <p className="mt-4">
          <Link href="/superadmin/integrations/evolution/new" className="text-sm text-brand-neon hover:opacity-90">
            Cadastrar outra instância
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/superadmin/integrations" className="text-sm text-brand-neon hover:opacity-90">
          ← Voltar às integrações
        </Link>
      </div>
      <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-brand-text">
        <ProviderBrandIcon provider="evolution" className="h-5 w-5 rounded" />
        Conectar instância Evolution API
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Cadastre uma instância Evolution para receber webhooks. Use a URL gerada na configuração da Evolution.
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-brand-muted">
        <ProviderBrandIcon provider="whatsapp" className="h-3.5 w-3.5 rounded" />
        Conector para canal WhatsApp.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="tenant" className="block text-sm font-medium text-brand-muted">
            Tenant
          </label>
          <select
            id="tenant"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="app-select mt-1 block"
            required
          >
            <option value="">Selecione</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="external_id" className="block text-sm font-medium text-brand-muted">
            ID externo da instância (external_id)
          </label>
          <Input
            id="external_id"
            type="text"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="Ex: instance-1"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-brand-muted">
            Base URL da Evolution API
          </label>
          <Input
            id="base_url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://sua-evolution.com"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label htmlFor="instance_name" className="block text-sm font-medium text-brand-muted">
            Nome da instância (opcional)
          </label>
          <Input
            id="instance_name"
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="Ex: WhatsApp principal"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="api_key" className="block text-sm font-medium text-brand-muted">
            API Key (opcional)
          </label>
          <Input
            id="api_key"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Se a Evolution exige autenticação"
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Criando…" : "Conectar"}
          </Button>
          <Link href="/superadmin/integrations">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
