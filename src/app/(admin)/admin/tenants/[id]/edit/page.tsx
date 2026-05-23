"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Input, Button, Card, CardContent } from "@/components/ui";
import { adminGet, adminPatch } from "@/features/shared/api/admin-api-client";
import { TenantSmtpSection } from "../tenant-smtp-section";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings?: Record<string, unknown> | null;
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [agentEnabledOverride, setAgentEnabledOverride] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [agentModel, setAgentModel] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [followupRulesJson, setFollowupRulesJson] = useState("[]");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [auditScopes, setAuditScopes] = useState<string[]>([]);

  function toggleAuditScope(scope: string, checked: boolean) {
    setAuditScopes((prev) => {
      if (checked) return Array.from(new Set([...prev, scope]));
      return prev.filter((item) => item !== scope);
    });
  }

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      const result = await adminGet<TenantData>(`/api/admin/tenants/${id}`);
      if (controller.signal.aborted) return;
      if (result.error) {
        if (result.status === 404) {
          setTenant(null);
        }
        setLoading(false);
        return;
      }
      const data = result.data!;
      setTenant(data);
      setName(data.name ?? "");
      setSlug(data.slug ?? "");
      setIsActive(data.isActive ?? true);
      const loadedSettings =
        data.settings && typeof data.settings === "object"
          ? (data.settings as Record<string, unknown>)
          : {};
      setSettings(loadedSettings);
      if (typeof loadedSettings.openai_agent_enabled === "boolean") {
        setAgentEnabledOverride(true);
        setAgentEnabled(loadedSettings.openai_agent_enabled);
      }
      setAgentModel(
        typeof loadedSettings.openai_agent_model === "string"
          ? loadedSettings.openai_agent_model
          : ""
      );
      setAgentPrompt(
        typeof loadedSettings.openai_agent_system_prompt === "string"
          ? loadedSettings.openai_agent_system_prompt
          : ""
      );
      setAgentApiKey(
        typeof loadedSettings.openai_agent_api_key === "string"
          ? loadedSettings.openai_agent_api_key
          : ""
      );
      setFollowupRulesJson(
        JSON.stringify(loadedSettings.openai_agent_followup_rules ?? [], null, 2)
      );
      const rawFeatures =
        typeof loadedSettings.features === "object" && loadedSettings.features
          ? (loadedSettings.features as Record<string, unknown>)
          : {};
      setNotificationsEnabled(rawFeatures.notificationsEnabled === true);
      setAuditEnabled(rawFeatures.auditEnabled === true);
      setAuditScopes(
        Array.isArray(rawFeatures.auditScopes)
          ? rawFeatures.auditScopes.filter((scope): scope is string => typeof scope === "string")
          : []
      );
      setLoading(false);
    }
    load();
    return () => controller.abort();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let parsedFollowupRules: unknown = [];
      try {
        parsedFollowupRules = JSON.parse(followupRulesJson || "[]");
      } catch {
        setError("JSON de regras de follow-up inválido.");
        setSubmitting(false);
        return;
      }

      const nextSettings: Record<string, unknown> = { ...settings };
      if (agentEnabledOverride) {
        nextSettings.openai_agent_enabled = agentEnabled;
      } else {
        delete nextSettings.openai_agent_enabled;
      }

      if (agentModel.trim()) nextSettings.openai_agent_model = agentModel.trim();
      else delete nextSettings.openai_agent_model;

      if (agentPrompt.trim()) nextSettings.openai_agent_system_prompt = agentPrompt.trim();
      else delete nextSettings.openai_agent_system_prompt;

      if (Array.isArray(parsedFollowupRules)) {
        nextSettings.openai_agent_followup_rules = parsedFollowupRules;
      } else {
        delete nextSettings.openai_agent_followup_rules;
      }

      if (agentApiKey.trim()) nextSettings.openai_agent_api_key = agentApiKey.trim();
      else delete nextSettings.openai_agent_api_key;
      const currentFeatures =
        typeof nextSettings.features === "object" && nextSettings.features
          ? (nextSettings.features as Record<string, unknown>)
          : {};
      nextSettings.features = {
        ...currentFeatures,
        notificationsEnabled,
        auditEnabled,
        auditScopes: auditEnabled ? auditScopes : [],
      };

      const result = await adminPatch(`/api/admin/tenants/${id}`, {
        name: name.trim(),
        slug: slug.trim(),
        is_active: isActive,
        settings: nextSettings,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      router.push(`/superadmin/tenants/${id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-md bg-brand-surface/70" />
          <div className="h-24 animate-pulse rounded-xl border border-brand-border bg-brand-surface/60" />
          <div className="h-48 animate-pulse rounded-xl border border-brand-border bg-brand-surface/60" />
        </div>
      </PageSection>
    );
  }
  if (!tenant) {
    return (
      <PageSection>
        <p className="text-brand-muted">Tenant não encontrado.</p>
        <Link href="/superadmin/tenants" className="mt-2 inline-block text-sm text-brand-neon hover:text-brand-neon/80">
          Voltar
        </Link>
      </PageSection>
    );
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <Link
          href={`/superadmin/tenants/${id}`}
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Voltar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-brand-text mb-6">Editar tenant</h1>
      <p className="mb-6 max-w-3xl text-sm text-brand-muted">
        Ajuste identidade da conta, governança de usabilidade e parâmetros de IA. As mudanças abaixo afetam
        diretamente a experiência dos usuários deste tenant.
      </p>
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}
        <Card className="border-brand-border bg-brand-surface/40">
          <CardContent className="space-y-4 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">Geral</h2>
            <p className="text-xs text-brand-muted">
              Identificação da conta e status operacional.
            </p>
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-brand-text">
                Nome
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
              />
              <label htmlFor="is_active" className="text-sm text-brand-text">
                Ativo
              </label>
            </div>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface/40">
          <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Governança da conta (tenant)
          </h2>
          <p className="text-xs text-brand-muted">
            Recursos desta seção controlam visibilidade de auditoria e geração de notificações para ações críticas.
          </p>
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
          <p className="pl-6 text-xs text-brand-muted">
            Quando desativado, nenhum aviso novo de criação/edição/exclusão será criado para este tenant.
          </p>
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
          <p className="pl-6 text-xs text-brand-muted">
            Quando desativado, a seção de auditoria fica oculta e não grava novos eventos de trilha.
          </p>
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
                  onChange={(e) =>
                    toggleAuditScope("products_leads", e.target.checked)
                  }
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Produtos e leads
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text">
                <input
                  type="checkbox"
                  checked={auditScopes.includes("users_memberships")}
                  onChange={(e) =>
                    toggleAuditScope("users_memberships", e.target.checked)
                  }
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                Usuários e memberships
              </label>
            </div>
          )}
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface/40">
          <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Override do agente IA
          </h2>
          <p className="text-xs text-brand-muted">
            Parametrização opcional para sobrescrever comportamento global do agente neste tenant.
          </p>
          <div className="flex items-center gap-2">
            <input
              id="agent_enabled_override"
              type="checkbox"
              checked={agentEnabledOverride}
              onChange={(e) => setAgentEnabledOverride(e.target.checked)}
              className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
            />
            <label htmlFor="agent_enabled_override" className="text-sm text-brand-text">
              Definir habilitação do agente neste tenant
            </label>
          </div>
          {agentEnabledOverride && (
            <div className="flex items-center gap-2">
              <input
                id="agent_enabled"
                type="checkbox"
                checked={agentEnabled}
                onChange={(e) => setAgentEnabled(e.target.checked)}
                className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
              />
              <label htmlFor="agent_enabled" className="text-sm text-brand-text">
                Agente habilitado para este tenant
              </label>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="agent_model" className="block text-sm font-medium text-brand-text">
              Modelo OpenAI (override)
            </label>
            <Input
              id="agent_model"
              type="text"
              value={agentModel}
              onChange={(e) => setAgentModel(e.target.value)}
              className="w-full bg-brand-surface border-brand-border text-brand-text"
              placeholder="gpt-4o-mini"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="agent_api_key" className="block text-sm font-medium text-brand-text">
              API Key OpenAI (override)
            </label>
            <Input
              id="agent_api_key"
              type="password"
              autoComplete="new-password"
              value={agentApiKey}
              onChange={(e) => setAgentApiKey(e.target.value)}
              className="w-full bg-brand-surface border-brand-border text-brand-text"
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="agent_prompt" className="block text-sm font-medium text-brand-text">
              Prompt do agente (override)
            </label>
            <textarea
              id="agent_prompt"
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="followup_rules" className="block text-sm font-medium text-brand-text">
              Regras de follow-up (JSON override)
            </label>
            <textarea
              id="followup_rules"
              value={followupRulesJson}
              onChange={(e) => setFollowupRulesJson(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-mono text-brand-text"
            />
          </div>
          </CardContent>
        </Card>
        <TenantSmtpSection tenantId={id} />
        <div className="sticky bottom-4 z-10 flex gap-3 rounded-xl border border-brand-border bg-brand-surface/95 p-3 backdrop-blur">
          <Button
            type="submit"
            disabled={submitting}
            >
            {submitting ? "Salvando…" : "Salvar"}
          </Button>
          <Link href={`/superadmin/tenants/${id}`}>
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </form>
    </PageSection>
  );
}
