import { and, eq } from "drizzle-orm";
import { memberships, tenants } from "@/db/schema";
import { getDb } from "@/server/db";
import {
  getGlobalConfig,
  getGlobalConfigOrEnv,
  getMultipleGlobalConfig,
  setGlobalConfig,
} from "@/server/config/global";
import { tryDecryptStoredSecret } from "@/server/security/secret-storage";

export const OPENAI_AGENT_CONFIG_KEYS = {
  enabled: "openai_agent_enabled",
  model: "openai_agent_model",
  systemPrompt: "openai_agent_system_prompt",
  followupRules: "openai_agent_followup_rules",
  apiKey: "openai_api_key",
} as const;

export interface FollowupRule {
  profileId: string;
  maxFollowups: number;
  intervalHours: number;
  createConsultingAgendaAfterMissed: number;
}

export interface TenantOpenAIAgentSettings {
  openai_agent_enabled?: boolean;
  openai_agent_model?: string;
  openai_agent_system_prompt?: string;
  openai_agent_followup_rules?: FollowupRule[];
  openai_agent_api_key?: string;
}

export interface GlobalOpenAIAgentConfigInput {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  followupRules: FollowupRule[];
  apiKey?: string;
}

export interface GlobalOpenAIAgentConfig {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  followupRules: FollowupRule[];
  apiKeyConfigured: boolean;
}

export interface ResolvedOpenAIAgentConfig {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  followupRules: FollowupRule[];
  apiKey: string | null;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_PROMPT = [
  "Você é a Vysen, IA capitã analista da operação comercial e de aquisição.",
  "Seu tom é um mix: direto e objetivo, mas consultivo e colaborativo.",
  "Você NÃO responde clientes externos; sua função é analisar dados e apoiar decisões internas.",
  "Ao analisar uma conversa e contexto comercial, sempre retorne:",
  "1) resumo executivo em português;",
  "2) acertos, erros e falhas de negociação;",
  "3) classificação (sale, loss, abandonment, no_response, bad_lead, duplicate, rescheduled, other);",
  "4) intenção de fechamento e entendimento do momento da negociação;",
  "5) sugestão de status de lead e estágio de oportunidade (sem autoaplicar), com justificativa curta.",
  "Se houver pouca evidência, retorne other com baixa confiança e informe dados faltantes.",
].join("\n");

const DEFAULT_FOLLOWUP_RULES: FollowupRule[] = [
  {
    profileId: "default",
    maxFollowups: 3,
    intervalHours: 24,
    createConsultingAgendaAfterMissed: 2,
  },
];

function parseBoolean(input: string | null | undefined, fallback: boolean): boolean {
  if (input == null) return fallback;
  const value = input.trim().toLowerCase();
  if (["1", "true", "yes", "sim"].includes(value)) return true;
  if (["0", "false", "no", "nao", "não"].includes(value)) return false;
  return fallback;
}

function parseFollowupRules(input: string | null | undefined): FollowupRule[] {
  if (!input) return DEFAULT_FOLLOWUP_RULES;
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_FOLLOWUP_RULES;
    const normalized = parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const data = item as Record<string, unknown>;
        const profileId =
          typeof data.profileId === "string" && data.profileId.trim()
            ? data.profileId.trim()
            : "default";
        const maxFollowups = Number(data.maxFollowups ?? 3);
        const intervalHours = Number(data.intervalHours ?? 24);
        const createConsultingAgendaAfterMissed = Number(
          data.createConsultingAgendaAfterMissed ?? 2
        );
        if (!Number.isFinite(maxFollowups) || !Number.isFinite(intervalHours)) return null;
        return {
          profileId,
          maxFollowups: Math.max(1, Math.min(30, Math.floor(maxFollowups))),
          intervalHours: Math.max(1, Math.min(24 * 30, Math.floor(intervalHours))),
          createConsultingAgendaAfterMissed: Math.max(
            1,
            Math.min(30, Math.floor(createConsultingAgendaAfterMissed))
          ),
        } satisfies FollowupRule;
      })
      .filter((item): item is FollowupRule => item !== null);
    return normalized.length > 0 ? normalized : DEFAULT_FOLLOWUP_RULES;
  } catch {
    return DEFAULT_FOLLOWUP_RULES;
  }
}

function normalizeTenantSettings(
  value: Record<string, unknown> | null | undefined
): TenantOpenAIAgentSettings {
  if (!value) return {};
  const followupRaw = value.openai_agent_followup_rules;
  let followupRules: FollowupRule[] | undefined;
  if (Array.isArray(followupRaw)) {
    followupRules = parseFollowupRules(JSON.stringify(followupRaw));
  }
  return {
    openai_agent_enabled:
      typeof value.openai_agent_enabled === "boolean" ? value.openai_agent_enabled : undefined,
    openai_agent_model:
      typeof value.openai_agent_model === "string" ? value.openai_agent_model.trim() : undefined,
    openai_agent_system_prompt:
      typeof value.openai_agent_system_prompt === "string"
        ? value.openai_agent_system_prompt.trim()
        : undefined,
    openai_agent_followup_rules: followupRules,
    openai_agent_api_key:
      typeof value.openai_agent_api_key === "string"
        ? (tryDecryptStoredSecret(value.openai_agent_api_key.trim(), "openai-agent-api-key") ??
          undefined)
        : undefined,
  };
}

export async function getGlobalOpenAIAgentConfig(): Promise<GlobalOpenAIAgentConfig> {
  const values = await getMultipleGlobalConfig(Object.values(OPENAI_AGENT_CONFIG_KEYS));
  const apiKeyFallback = process.env.OPENAI_API_KEY?.trim() ?? "";
  const apiKeyValue = values[OPENAI_AGENT_CONFIG_KEYS.apiKey] ?? apiKeyFallback;
  return {
    enabled: parseBoolean(values[OPENAI_AGENT_CONFIG_KEYS.enabled], true),
    model: values[OPENAI_AGENT_CONFIG_KEYS.model] || DEFAULT_MODEL,
    systemPrompt: values[OPENAI_AGENT_CONFIG_KEYS.systemPrompt] || DEFAULT_PROMPT,
    followupRules: parseFollowupRules(values[OPENAI_AGENT_CONFIG_KEYS.followupRules]),
    apiKeyConfigured: Boolean(apiKeyValue && apiKeyValue.length > 10),
  };
}

export async function setGlobalOpenAIAgentConfig(
  input: GlobalOpenAIAgentConfigInput,
  options?: { updatedBy?: string | null }
): Promise<void> {
  const updatedBy = options?.updatedBy ?? null;
  await Promise.all([
    setGlobalConfig(OPENAI_AGENT_CONFIG_KEYS.enabled, String(Boolean(input.enabled)), {
      updatedBy,
    }),
    setGlobalConfig(
      OPENAI_AGENT_CONFIG_KEYS.model,
      input.model?.trim() || DEFAULT_MODEL,
      { updatedBy }
    ),
    setGlobalConfig(
      OPENAI_AGENT_CONFIG_KEYS.systemPrompt,
      input.systemPrompt?.trim() || DEFAULT_PROMPT,
      { updatedBy }
    ),
    setGlobalConfig(
      OPENAI_AGENT_CONFIG_KEYS.followupRules,
      JSON.stringify(input.followupRules?.length ? input.followupRules : DEFAULT_FOLLOWUP_RULES),
      { updatedBy }
    ),
  ]);
  if (input.apiKey !== undefined) {
    await setGlobalConfig(OPENAI_AGENT_CONFIG_KEYS.apiKey, input.apiKey.trim(), {
      updatedBy,
      sensitive: true,
    });
  }
}

export async function getTenantOpenAIAgentSettings(
  tenantId: string
): Promise<TenantOpenAIAgentSettings> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return normalizeTenantSettings(row?.settings ?? null);
}

export async function getResolvedOpenAIAgentConfig(
  tenantId: string | null
): Promise<ResolvedOpenAIAgentConfig> {
  const globalConfig = await getGlobalOpenAIAgentConfig();
  const globalApiKey = await getGlobalConfigOrEnv(
    OPENAI_AGENT_CONFIG_KEYS.apiKey,
    "OPENAI_API_KEY"
  );
  if (!tenantId) {
    return {
      enabled: globalConfig.enabled,
      model: globalConfig.model,
      systemPrompt: globalConfig.systemPrompt,
      followupRules: globalConfig.followupRules,
      apiKey: globalApiKey,
    };
  }

  const tenantSettings = await getTenantOpenAIAgentSettings(tenantId);
  return {
    enabled: tenantSettings.openai_agent_enabled ?? globalConfig.enabled,
    model: tenantSettings.openai_agent_model || globalConfig.model,
    systemPrompt:
      tenantSettings.openai_agent_system_prompt || globalConfig.systemPrompt,
    followupRules:
      tenantSettings.openai_agent_followup_rules || globalConfig.followupRules,
    apiKey: tenantSettings.openai_agent_api_key || globalApiKey,
  };
}

export async function getTenantMembersUserIds(tenantId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.tenantId, tenantId));
  return rows.map((row) => row.userId);
}

export async function mergeTenantOpenAIAgentSettings(
  tenantId: string,
  updates: TenantOpenAIAgentSettings
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!row) return;
  const current = (row.settings ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };

  const cleanString = (value: string | undefined) =>
    value && value.trim().length > 0 ? value.trim() : null;

  if (updates.openai_agent_enabled !== undefined) {
    next.openai_agent_enabled = updates.openai_agent_enabled;
  }
  if (updates.openai_agent_model !== undefined) {
    const value = cleanString(updates.openai_agent_model);
    if (value === null) delete next.openai_agent_model;
    else next.openai_agent_model = value;
  }
  if (updates.openai_agent_system_prompt !== undefined) {
    const value = cleanString(updates.openai_agent_system_prompt);
    if (value === null) delete next.openai_agent_system_prompt;
    else next.openai_agent_system_prompt = value;
  }
  if (updates.openai_agent_followup_rules !== undefined) {
    next.openai_agent_followup_rules = updates.openai_agent_followup_rules;
  }
  if (updates.openai_agent_api_key !== undefined) {
    const value = cleanString(updates.openai_agent_api_key);
    if (value === null) delete next.openai_agent_api_key;
    else next.openai_agent_api_key = value;
  }

  await db
    .update(tenants)
    .set({
      settings: next,
      updatedAt: new Date(),
    })
    .where(and(eq(tenants.id, tenantId)));
}

export async function getGlobalOpenAIAgentApiKeyOnly(): Promise<string | null> {
  const fromDb = await getGlobalConfig(OPENAI_AGENT_CONFIG_KEYS.apiKey);
  if (fromDb && fromDb.trim()) return fromDb.trim();
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : null;
}
