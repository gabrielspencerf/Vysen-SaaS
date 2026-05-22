"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

type Tenant = { id: string; name: string; slug: string };

export default function NewTypebotBotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [name, setName] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [metricsApiBaseUrl, setMetricsApiBaseUrl] = useState("");
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
      const res = await fetch("/api/admin/integrations/typebot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          external_id: externalId.trim(),
          name: name.trim() || undefined,
          webhook_secret: webhookSecret.trim() || undefined,
          api_token: apiToken.trim() || undefined,
          metrics_api_base_url: metricsApiBaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar bot");
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
          <h2 className="text-lg font-semibold text-brand-text">Bot Typebot criado</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Configure no painel do Typebot a URL de webhook abaixo:
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
          {webhookSecret && (
            <p className="mt-3 text-xs text-brand-muted">
              Preferencial: envie <code>X-Webhook-Timestamp</code> e{" "}
              <code>X-Webhook-Signature</code> (HMAC SHA-256 em{" "}
              <code>timestamp.rawBody</code>). Compatível com{" "}
              <code>X-Webhook-Secret</code> legado.
            </p>
          )}
        </div>
        <p className="mt-4">
          <Link href="/superadmin/integrations/typebot/new" className="text-sm text-brand-neon hover:opacity-90">
            Cadastrar outro bot
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
      <h1 className="text-xl font-semibold text-brand-text">Conectar bot Typebot</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Cadastre um bot para receber webhooks do Typebot. Depois use a URL gerada no painel do Typebot.
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
            ID do bot no Typebot (external_id)
          </label>
          <Input
            id="external_id"
            type="text"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="Ex: clxx123abc"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-brand-muted">
            Nome (opcional)
          </label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bot de vendas"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="webhook_secret" className="block text-sm font-medium text-brand-muted">
            Webhook secret (opcional)
          </label>
          <Input
            id="webhook_secret"
            type="password"
            autoComplete="new-password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Se configurado, Typebot deve enviar no header X-Webhook-Secret"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="api_token" className="block text-sm font-medium text-brand-muted">
            Token da API de métricas (opcional)
          </label>
          <Input
            id="api_token"
            type="password"
            autoComplete="new-password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Token para coletar métricas via Typebot API"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="metrics_api_base_url" className="block text-sm font-medium text-brand-muted">
            Base URL da API de métricas (opcional)
          </label>
          <Input
            id="metrics_api_base_url"
            type="url"
            value={metricsApiBaseUrl}
            onChange={(e) => setMetricsApiBaseUrl(e.target.value)}
            placeholder="https://api.typebot.io"
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
