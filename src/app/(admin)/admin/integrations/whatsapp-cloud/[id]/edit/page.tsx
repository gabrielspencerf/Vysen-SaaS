"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type WhatsappCloudResponse = {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  label: string | null;
  webhookVerifyToken: string | null;
  hasAccessToken: boolean;
};

export default function EditWhatsappCloudNumberPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [label, setLabel] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [clearAccessToken, setClearAccessToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/integrations/whatsapp-cloud/${id}`, {
          method: "GET",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as Partial<
          WhatsappCloudResponse
        > & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Erro ao carregar número");
          setLoading(false);
          return;
        }
        setPhoneNumberId(data.phoneNumberId ?? "");
        setWabaId(data.wabaId ?? "");
        setDisplayPhone(data.displayPhone ?? "");
        setLabel(data.label ?? "");
        setWebhookVerifyToken(data.webhookVerifyToken ?? "");
        setHasAccessToken(Boolean(data.hasAccessToken));
        setLoading(false);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setError("Erro de conexão");
          setLoading(false);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        display_phone: displayPhone.trim() || null,
        label: label.trim() || null,
        webhook_verify_token: webhookVerifyToken.trim() || null,
      };
      if (clearAccessToken) {
        body.access_token = "";
      } else if (accessToken.trim()) {
        body.access_token = accessToken.trim();
      }
      const res = await fetch(`/api/admin/integrations/whatsapp-cloud/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar número");
        return;
      }
      router.push("/superadmin/integrations");
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
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
        Editar número WhatsApp Cloud
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Atualize os dados do número. O access token só é alterado se preenchido.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
        {loading ? (
          <p className="text-sm text-brand-muted">Carregando…</p>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {error}
              </div>
            )}
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
                className="mt-1"
                required
              />
            </div>
            <div>
              <label htmlFor="waba_id" className="block text-sm font-medium text-brand-muted">
                WABA ID
              </label>
              <Input
                id="waba_id"
                type="text"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
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
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="access_token"
                className="block text-sm font-medium text-brand-muted"
              >
                Novo access token{" "}
                {hasAccessToken && (
                  <span className="ml-1 text-xs text-emerald-400">(configurado)</span>
                )}
              </label>
              <Input
                id="access_token"
                type="password"
                autoComplete="new-password"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  if (e.target.value) setClearAccessToken(false);
                }}
                placeholder={
                  hasAccessToken ? "Deixe em branco para manter" : "Access token Meta"
                }
                disabled={clearAccessToken}
                className="mt-1"
              />
              {hasAccessToken && (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-brand-muted">
                  <input
                    type="checkbox"
                    checked={clearAccessToken}
                    onChange={(e) => {
                      setClearAccessToken(e.target.checked);
                      if (e.target.checked) setAccessToken("");
                    }}
                  />
                  Remover access token atual
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando…" : "Salvar alterações"}
              </Button>
              <Link href="/superadmin/integrations">
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
