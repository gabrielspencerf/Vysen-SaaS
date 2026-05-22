"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { validateUazapiCredential } from "@/lib/uazapi-credentials";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";

type Tenant = { id: string; name: string; slug: string };

export default function NewUazapiInstancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string } | null>(null);

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
    const credentialError = validateUazapiCredential({
      apiKey,
      token,
      adminToken,
    });
    if (credentialError) {
      setError(credentialError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/integrations/uazapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          external_id: externalId.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim() || undefined,
          token: token.trim() || undefined,
          admin_token: adminToken.trim() || undefined,
          instance_name: instanceName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar instância UAZAPI");
        return;
      }
      setCreated({ id: data.id });
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
          <h2 className="text-lg font-semibold text-brand-text">Instância UAZAPI criada</h2>
          <p className="mt-2 text-sm text-brand-muted">
            A integração ficou registrada e pronta para monitoramento/sincronização.
          </p>
        </div>
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
        <ProviderBrandIcon provider="uazapi" className="h-5 w-5 rounded" />
        Conectar instância UAZAPI
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Cadastre uma instância UAZAPI para operar em paralelo com a Evolution.
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
            placeholder="Ex: uazapi-main"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-brand-muted">
            Base URL da UAZAPI
          </label>
          <Input
            id="base_url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.uazapi.com"
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
            placeholder="Ex: WhatsApp secundário"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-brand-muted">
            Token da instância (opcional)
          </label>
          <Input
            id="token"
            type="password"
            autoComplete="new-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Ex: 85f5de3a-451b-4fd4-a615-35718ececf04"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="admin_token" className="block text-sm font-medium text-brand-muted">
            Admin token (opcional)
          </label>
          <Input
            id="admin_token"
            type="password"
            autoComplete="new-password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Se o endpoint exigir admin token"
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
            placeholder="Use apenas se o provedor trabalhar com API key"
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
