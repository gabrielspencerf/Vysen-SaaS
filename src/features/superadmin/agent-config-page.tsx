"use client";

import { useEffect, useState } from "react";
import { PageSection } from "@/components/layout/page-section";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { AdminVysenKnowledgeManager } from "@/components/admin-vysen-knowledge-manager";

interface FollowupRule {
  profileId: string;
  maxFollowups: number;
  intervalHours: number;
  createConsultingAgendaAfterMissed: number;
}

interface AgentConfigResponse {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  followupRules: FollowupRule[];
  apiKeyConfigured: boolean;
}

const DEFAULT_RULE: FollowupRule = {
  profileId: "default",
  maxFollowups: 3,
  intervalHours: 24,
  createConsultingAgendaAfterMissed: 2,
};

export function SuperadminAgentConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [, setFollowupRules] = useState<FollowupRule[]>([DEFAULT_RULE]);
  const [followupRulesRaw, setFollowupRulesRaw] = useState(
    JSON.stringify([DEFAULT_RULE], null, 2)
  );
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/agent-config", { method: "GET" });
        const data = (await res.json()) as AgentConfigResponse;
        if (!res.ok) {
          setError("Nao foi possivel carregar a configuracao do agente.");
          return;
        }
        setEnabled(data.enabled ?? true);
        setModel(data.model ?? "gpt-4o-mini");
        setSystemPrompt(data.systemPrompt ?? "");
        const nextRules = data.followupRules?.length ? data.followupRules : [DEFAULT_RULE];
        setFollowupRules(nextRules);
        setFollowupRulesRaw(JSON.stringify(nextRules, null, 2));
        setApiKeyConfigured(Boolean(data.apiKeyConfigured));
      } catch {
        setError("Falha de conexao ao carregar configuracao.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function parseRulesFromJson(raw: string): FollowupRule[] | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const data = item as Record<string, unknown>;
          if (typeof data.profileId !== "string" || !data.profileId.trim()) return null;
          const maxFollowups = Number(data.maxFollowups);
          const intervalHours = Number(data.intervalHours);
          const createConsultingAgendaAfterMissed = Number(
            data.createConsultingAgendaAfterMissed
          );
          if (
            !Number.isFinite(maxFollowups) ||
            !Number.isFinite(intervalHours) ||
            !Number.isFinite(createConsultingAgendaAfterMissed)
          ) {
            return null;
          }
          return {
            profileId: data.profileId.trim(),
            maxFollowups: Math.max(1, Math.floor(maxFollowups)),
            intervalHours: Math.max(1, Math.floor(intervalHours)),
            createConsultingAgendaAfterMissed: Math.max(
              1,
              Math.floor(createConsultingAgendaAfterMissed)
            ),
          } satisfies FollowupRule;
        })
        .filter((item): item is FollowupRule => item !== null);
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedRules = parseRulesFromJson(followupRulesRaw);
    if (!parsedRules) {
      setError("Regras de follow-up invalidas. Revise o JSON.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enabled,
        model: model.trim() || "gpt-4o-mini",
        systemPrompt: systemPrompt.trim(),
        followupRules: parsedRules,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      };
      const res = await fetch("/api/admin/agent-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Erro ao salvar configuracao.");
        return;
      }
      if (apiKey.trim()) {
        setApiKey("");
        setApiKeyConfigured(true);
      }
      setSuccess("Configuracao do agente salva com sucesso.");
    } catch {
      setError("Falha de conexao ao salvar configuracao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">Vysen</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Configuracao global da Vysen: modelo, politica analitica e regras de acompanhamento.
        </p>
      </div>

      <Card className="border-brand-border bg-brand-surface">
        <CardContent className="p-5">
          {loading ? (
            <p className="text-sm text-brand-muted">Carregando configuracao...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {success}
                </p>
              ) : null}

              <div className="flex items-center gap-3">
                <input
                  id="agent_enabled"
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="rounded border-brand-border bg-brand-surface text-brand-neon focus:ring-brand-neon"
                />
                <label htmlFor="agent_enabled" className="text-sm text-brand-text">
                  Ativar Vysen na plataforma
                </label>
              </div>

              <div>
                <label htmlFor="agent_model" className="mb-1 block text-sm text-brand-muted">
                  Modelo OpenAI padrao
                </label>
                <Input
                  id="agent_model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div>
                <label htmlFor="agent_api_key" className="mb-1 block text-sm text-brand-muted">
                  Chave OpenAI global
                </label>
                <Input
                  id="agent_api_key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={apiKeyConfigured ? "******** ja configurada" : "sk-..."}
                />
                <p className="mt-1 text-xs text-brand-muted">
                  {apiKeyConfigured
                    ? "Ja existe uma chave global configurada. Preencha novamente apenas se quiser trocar."
                    : "Nenhuma chave global detectada."}
                </p>
              </div>

              <div>
                <label htmlFor="agent_prompt" className="mb-1 block text-sm text-brand-muted">
                  Prompt padrao da Vysen (global)
                </label>
                <textarea
                  id="agent_prompt"
                  rows={10}
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-neon focus:ring-2 focus:ring-brand-neon/30"
                />
              </div>

              <div>
                <label htmlFor="agent_followup_rules" className="mb-1 block text-sm text-brand-muted">
                  Regras de follow-up (JSON)
                </label>
                <textarea
                  id="agent_followup_rules"
                  rows={8}
                  value={followupRulesRaw}
                  onChange={(event) => {
                    setFollowupRulesRaw(event.target.value);
                    const parsed = parseRulesFromJson(event.target.value);
                    if (parsed) {
                      setFollowupRules(parsed);
                      setError((prev) =>
                        prev === "Regras de follow-up invalidas. Revise o JSON." ? null : prev
                      );
                    }
                  }}
                  className="w-full rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-2 font-mono text-xs text-brand-text outline-none focus:border-brand-neon focus:ring-2 focus:ring-brand-neon/30"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar configuracao da Vysen"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <AdminVysenKnowledgeManager />
      </div>
    </PageSection>
  );
}
