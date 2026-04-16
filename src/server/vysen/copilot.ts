import { getGlobalOpenAIAgentApiKeyOnly, getGlobalOpenAIAgentConfig } from "@/server/config/openai-agent";
import {
  getVysenAdminInsights,
  getVysenTenantInsights,
} from "@/server/vysen/orchestrator";
import { searchKnowledge } from "@/server/vysen/knowledge";
import { runVysenTenantDataTool } from "@/server/vysen/tenant-data-tool";
import { logVysenUsage } from "@/server/vysen/usage";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_FAST_MODEL = "gpt-4o-mini";
const DEFAULT_THINKING_TIMEOUT_MS = 30000;

type ReasoningMode = "thinking" | "fast";

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "nao", "não"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function askVysenCopilot(input: {
  question: string;
  tenantId?: string | null;
  userId?: string | null;
  channel?: "admin" | "dashboard";
  reasoningMode?: ReasoningMode;
  contextArea?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  memoryContext?: {
    threadSummary?: string | null;
    threadContexts?: string[];
    previousSummaries?: string[];
  };
}) {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Pergunta vazia.");
  }
  const [apiKey, config, insights, globalKb, tenantKb, tenantTool] = await Promise.all([
    getGlobalOpenAIAgentApiKeyOnly(),
    getGlobalOpenAIAgentConfig(),
    input.tenantId
      ? getVysenTenantInsights({ tenantId: input.tenantId, periodDays: 30 })
      : getVysenAdminInsights(30),
    searchKnowledge({
      query: question,
      scope: "global",
      limit: 5,
    }).catch(() => []),
    input.tenantId
      ? searchKnowledge({
          query: question,
          scope: "tenant",
          tenantId: input.tenantId,
          limit: 5,
        }).catch(() => [])
      : Promise.resolve([]),
    input.tenantId ? runVysenTenantDataTool(input.tenantId).catch(() => null) : Promise.resolve(null),
  ]);
  if (!apiKey) {
    throw new Error("OpenAI API key não configurada para a Vysen.");
  }

  const references = [...tenantKb, ...globalKb].slice(0, 8);
  const requestedMode: ReasoningMode = input.reasoningMode === "fast" ? "fast" : "thinking";
  const thinkingModel =
    process.env.OPENAI_MODEL_THINKING?.trim() || config.model || DEFAULT_FAST_MODEL;
  const fastModel = process.env.OPENAI_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL;
  const thinkingTimeoutMs = parsePositiveIntEnv(
    process.env.OPENAI_THINKING_TIMEOUT_MS,
    DEFAULT_THINKING_TIMEOUT_MS
  );
  const fallbackEnabled = parseBooleanEnv(
    process.env.OPENAI_MODEL_FALLBACK_ENABLED,
    true
  );
  const modelsToTry =
    requestedMode === "thinking" && fallbackEnabled
      ? [thinkingModel, fastModel]
      : [requestedMode === "fast" ? fastModel : thinkingModel];
  const contextJson = JSON.stringify(
    {
      insights,
      tenantDataTool: tenantTool,
      references: references.map((r) => ({
        title: r.title,
        sourceType: r.sourceType,
        sourceUri: r.sourceUri,
        score: r.score,
        excerpt: r.content.slice(0, 320),
      })),
    },
    null,
    2
  );

  const history = Array.isArray(input.history)
    ? input.history
        .filter(
          (item) =>
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim().length > 0
        )
        .slice(-12)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 1800),
        }))
    : [];
  const contextArea =
    typeof input.contextArea === "string" && input.contextArea.trim()
      ? input.contextArea.trim().toLowerCase()
      : "geral";
  const memoryContext = {
    threadSummary:
      typeof input.memoryContext?.threadSummary === "string"
        ? input.memoryContext.threadSummary.trim().slice(0, 420)
        : null,
    threadContexts: Array.isArray(input.memoryContext?.threadContexts)
      ? input.memoryContext.threadContexts
          .filter((item) => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 380))
          .slice(0, 12)
      : [],
    previousSummaries: Array.isArray(input.memoryContext?.previousSummaries)
      ? input.memoryContext.previousSummaries
          .filter((item) => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 280))
          .slice(0, 8)
      : [],
  };

  const baseMessages = [
    {
      role: "system",
      content: [
        config.systemPrompt?.trim() || "",
        "Você é a Vysen, capitã analista da operação comercial e de aquisição.",
        "Seja objetiva, consultiva e baseada em evidências.",
        "Você não responde cliente final nem atua como bot de WhatsApp.",
        "Seu foco: funil, aquisição, negociações, observabilidade, gargalos, melhorias e recomendações acionáveis.",
        `Priorize respostas para a área de contexto selecionada: ${contextArea}.`,
        "Quando houver dados brutos/contextos, explique o que cada métrica/dado significa antes de recomendar ações.",
        "Use memória da conversa atual e também resumos anteriores para manter continuidade quando relevante.",
        "Sempre cite de forma curta quais evidências sustentam cada recomendação.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...history,
    {
      role: "user",
      content: [
        "Contexto estruturado:",
        contextJson,
        "",
        "Memória de conversas e contextos selecionados:",
        JSON.stringify(memoryContext, null, 2),
        "",
        `Pergunta: ${question}`,
        "",
        "Responda em português com esta estrutura:",
        "1) diagnóstico",
        "2) gargalos",
        "3) ações recomendadas (priorizadas)",
        "4) riscos/observações",
      ].join("\n"),
    },
  ];

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  } | null = null;
  let selectedModel = modelsToTry[0];
  const attemptErrors: string[] = [];

  for (let idx = 0; idx < modelsToTry.length; idx += 1) {
    const model = modelsToTry[idx];
    const controller = new AbortController();
    const timeoutMs = idx === 0 && requestedMode === "thinking" ? thinkingTimeoutMs : 20000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: requestedMode === "thinking" ? 0.15 : 0.2,
          messages: baseMessages,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        attemptErrors.push(`${model}: http_${response.status} ${body.slice(0, 120)}`);
        continue;
      }

      const parsed = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const answer = parsed.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        attemptErrors.push(`${model}: empty_response`);
        continue;
      }
      data = parsed;
      selectedModel = model;
      break;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "AbortError"
            ? `${model}: timeout_${timeoutMs}ms`
            : `${model}: ${err.message}`
          : `${model}: network_error`;
      attemptErrors.push(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!data) {
    await logVysenUsage({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      channel: input.channel ?? (input.tenantId ? "dashboard" : "admin"),
      operation: "copilot_chat",
      model: modelsToTry.join(" => "),
      success: false,
      errorMessage: attemptErrors.join(" | ").slice(0, 500),
    });
    throw new Error("Falha ao consultar Vysen neste momento.");
  }

  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    await logVysenUsage({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      channel: input.channel ?? (input.tenantId ? "dashboard" : "admin"),
      operation: "copilot_chat",
      model: selectedModel,
      success: false,
      errorMessage: "empty_response",
    });
    throw new Error("Resposta vazia da Vysen.");
  }
  await logVysenUsage({
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
    channel: input.channel ?? (input.tenantId ? "dashboard" : "admin"),
    operation: "copilot_chat",
    model:
      selectedModel +
      (selectedModel !== modelsToTry[0] ? ` (fallback_from:${modelsToTry[0]})` : ""),
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
    success: true,
  });
  return {
    answer,
    references: references.map((r) => ({
      title: r.title,
      sourceType: r.sourceType,
      sourceUri: r.sourceUri,
      score: r.score,
    })),
  };
}

