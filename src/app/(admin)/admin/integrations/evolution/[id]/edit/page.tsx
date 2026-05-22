"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";

type EvolutionInstanceResponse = {
  id: string;
  tenantId: string;
  externalId: string;
  baseUrl: string;
  instanceName: string | null;
};

export default function EditEvolutionInstancePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [externalId, setExternalId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/integrations/evolution/${id}`, {
          method: "GET",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as Partial<EvolutionInstanceResponse> & {
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Erro ao carregar instância");
          setLoading(false);
          return;
        }
        setExternalId(data.externalId ?? "");
        setBaseUrl(data.baseUrl ?? "");
        setInstanceName(data.instanceName ?? "");
        setLoading(false);
      } catch (err) {
        // Race ao trocar id: AbortError é benigno; outros viram erro visível.
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
      const res = await fetch(`/api/admin/integrations/evolution/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_id: externalId.trim(),
          base_url: baseUrl.trim(),
          instance_name: instanceName.trim() || undefined,
          api_key: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao atualizar instância");
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
        <Link href="/superadmin/integrations" className="text-sm text-brand-neon hover:opacity-90">
          ← Voltar às integrações
        </Link>
      </div>
      <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-brand-text">
        <ProviderBrandIcon provider="evolution" className="h-5 w-5 rounded" />
        Editar instância Evolution
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Atualize os dados da instância sem precisar excluir e recriar.
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-brand-muted">
        <ProviderBrandIcon provider="whatsapp" className="h-3.5 w-3.5 rounded" />
        Integração de canal WhatsApp.
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
                ID externo da instância (external_id)
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
                Base URL da Evolution API
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
              <label htmlFor="instance_name" className="block text-sm font-medium text-brand-muted">
                Nome da instância (opcional)
              </label>
              <Input
                id="instance_name"
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="api_key" className="block text-sm font-medium text-brand-muted">
                Nova API Key (opcional)
              </label>
              <Input
                id="api_key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Deixe em branco para manter a API key atual"
                className="mt-1"
              />
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
