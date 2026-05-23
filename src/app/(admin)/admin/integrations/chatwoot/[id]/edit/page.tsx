"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type ChatwootResponse = {
  id: string;
  tenantId: string;
  externalId: string;
  baseUrl: string;
  inboxId: string | null;
  label: string | null;
  hasApiToken: boolean;
};

export default function EditChatwootAccountPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [externalId, setExternalId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [inboxId, setInboxId] = useState("");
  const [label, setLabel] = useState("");
  const [hasApiToken, setHasApiToken] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/integrations/chatwoot/${id}`, {
          method: "GET",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as Partial<
          ChatwootResponse
        > & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Erro ao carregar conta");
          setLoading(false);
          return;
        }
        setExternalId(data.externalId ?? "");
        setBaseUrl(data.baseUrl ?? "");
        setInboxId(data.inboxId ?? "");
        setLabel(data.label ?? "");
        setHasApiToken(Boolean(data.hasApiToken));
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
        external_id: externalId.trim(),
        base_url: baseUrl.trim(),
        inbox_id: inboxId.trim() || null,
        label: label.trim() || null,
      };
      if (clearApiToken) {
        body.api_token = "";
      } else if (apiToken.trim()) {
        body.api_token = apiToken.trim();
      }
      const res = await fetch(`/api/admin/integrations/chatwoot/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar conta");
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
      <h1 className="text-xl font-semibold text-brand-text">Editar conta Chatwoot</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Atualize os dados da conta. O API token só é alterado se preenchido.
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
              <label htmlFor="external_id" className="block text-sm font-medium text-brand-muted">
                Account ID (external_id)
              </label>
              <Input
                id="external_id"
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label htmlFor="base_url" className="block text-sm font-medium text-brand-muted">
                Base URL
              </label>
              <Input
                id="base_url"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label htmlFor="inbox_id" className="block text-sm font-medium text-brand-muted">
                Inbox ID (opcional)
              </label>
              <Input
                id="inbox_id"
                type="text"
                value={inboxId}
                onChange={(e) => setInboxId(e.target.value)}
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
              <label htmlFor="api_token" className="block text-sm font-medium text-brand-muted">
                Novo API token{" "}
                {hasApiToken && (
                  <span className="ml-1 text-xs text-emerald-400">(configurado)</span>
                )}
              </label>
              <Input
                id="api_token"
                type="password"
                autoComplete="new-password"
                value={apiToken}
                onChange={(e) => {
                  setApiToken(e.target.value);
                  if (e.target.value) setClearApiToken(false);
                }}
                placeholder={hasApiToken ? "Deixe em branco para manter" : "API token"}
                disabled={clearApiToken}
                className="mt-1"
              />
              {hasApiToken && (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-brand-muted">
                  <input
                    type="checkbox"
                    checked={clearApiToken}
                    onChange={(e) => {
                      setClearApiToken(e.target.checked);
                      if (e.target.checked) setApiToken("");
                    }}
                  />
                  Remover API token atual
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
