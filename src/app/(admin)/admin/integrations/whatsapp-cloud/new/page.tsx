"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

type Tenant = { id: string; name: string; slug: string };

export default function NewWhatsappCloudNumberPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [label, setLabel] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    webhook_url: string;
    verify_token: string;
  } | null>(null);

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
      const res = await fetch("/api/admin/integrations/whatsapp-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          display_phone: displayPhone.trim() || undefined,
          label: label.trim() || undefined,
          access_token: accessToken.trim() || undefined,
          webhook_verify_token: webhookVerifyToken.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar número");
        return;
      }
      setCreated({
        id: data.id,
        webhook_url: data.webhook_url ?? "",
        verify_token: webhookVerifyToken.trim(),
      });
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
          <Link
            href="/superadmin/integrations"
            className="text-sm text-brand-neon hover:opacity-90"
          >
            ← Voltar às integrações
          </Link>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text">
            Número WhatsApp Cloud conectado
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            No Meta App Dashboard &gt; WhatsApp &gt; Configuration &gt; Webhooks, configure:
          </p>
          <ul className="mt-3 space-y-3">
            <li>
              <p className="text-xs uppercase tracking-wide text-brand-muted">Callback URL</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
            </li>
            {created.verify_token && (
              <li>
                <p className="text-xs uppercase tracking-wide text-brand-muted">
                  Verify token
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="block max-w-full break-all rounded-lg bg-brand-dark px-3 py-2 text-sm text-brand-neon">
                    {created.verify_token}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigator.clipboard.writeText(created.verify_token)
                    }
                  >
                    Copiar
                  </Button>
                </div>
              </li>
            )}
          </ul>
          <p className="mt-4 text-xs text-brand-muted">
            Eventos: <code>messages</code> (e <code>message_status</code> para
            entregas). Assinatura HMAC SHA-256 do app secret no header{" "}
            <code>x-hub-signature-256</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link
          href="/superadmin/integrations"
          className="text-sm text-brand-neon hover:opacity-90"
        >
          ← Voltar às integrações
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-brand-text">
        Conectar número WhatsApp Cloud
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Cadastre um número do WhatsApp Business Cloud (Meta) para receber webhooks de
        mensagens e status.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
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
          <label
            htmlFor="phone_number_id"
            className="block text-sm font-medium text-brand-muted"
          >
            Phone Number ID
          </label>
          <Input
            id="phone_number_id"
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Ex.: 1064547432054123"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label htmlFor="waba_id" className="block text-sm font-medium text-brand-muted">
            WABA ID (Business Account ID)
          </label>
          <Input
            id="waba_id"
            type="text"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="Ex.: 23984573829374"
            className="mt-1"
            required
          />
        </div>
        <div>
          <label
            htmlFor="display_phone"
            className="block text-sm font-medium text-brand-muted"
          >
            Telefone exibido (opcional)
          </label>
          <Input
            id="display_phone"
            type="tel"
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="label" className="block text-sm font-medium text-brand-muted">
            Rótulo (opcional)
          </label>
          <Input
            id="label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Comercial / Suporte"
            className="mt-1"
          />
        </div>
        <div>
          <label
            htmlFor="access_token"
            className="block text-sm font-medium text-brand-muted"
          >
            Access token (System User)
          </label>
          <Input
            id="access_token"
            type="password"
            autoComplete="new-password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Token de longa duração do System User da Meta"
            className="mt-1"
          />
        </div>
        <div>
          <label
            htmlFor="webhook_verify_token"
            className="block text-sm font-medium text-brand-muted"
          >
            Verify token (hub.verify_token)
          </label>
          <Input
            id="webhook_verify_token"
            type="text"
            value={webhookVerifyToken}
            onChange={(e) => setWebhookVerifyToken(e.target.value)}
            placeholder="String aleatória (ex.: gere 32 chars)"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-brand-muted">
            Usado pelo Meta durante a verificação GET inicial do webhook.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Conectando…" : "Conectar"}
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
