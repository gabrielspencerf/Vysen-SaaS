/**
 * Mapa estático + métricas ao vivo: worker, filas Redis e tabelas relacionadas.
 * Somente para super admin (layout /admin já restringe).
 */
import { isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  chatwootWebhookEvents,
  evolutionWebhookEvents,
  typebotWebhookEvents,
  uazapiWebhookEvents,
  whatsappCloudWebhookEvents,
} from "@/db/schema";
import { createRedisClient } from "@/server/redis";
import { HEARTBEAT_KEY, MAX_AGE_MS } from "@/workers/readiness";
import {
  DLQ_AI_CLASSIFICATION,
  DLQ_FOLLOWUP_DUE_TENANT,
  DLQ_RAW_CHATWOOT,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_TYPEBOT,
  DLQ_RAW_UAZAPI,
  DLQ_RAW_WHATSAPP_CLOUD,
  DLQ_SYNC_CLARITY,
  DLQ_SYNC_GOOGLE_ADS,
  DLQ_SYNC_META_ADS,
  QUEUE_AI_CLASSIFICATION,
  QUEUE_FOLLOWUP_DUE_TENANT,
  QUEUE_RAW_CHATWOOT,
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_TYPEBOT,
  QUEUE_RAW_UAZAPI,
  QUEUE_RAW_WHATSAPP_CLOUD,
  QUEUE_SYNC_CLARITY,
  QUEUE_SYNC_GOOGLE_ADS,
  QUEUE_SYNC_META_ADS,
} from "@/workers/queue";

export type PipelineStepKind = "ingress" | "table" | "queue" | "worker" | "output";

export interface PipelineStepDef {
  kind: PipelineStepKind;
  title: string;
  detail: string;
  /** chave para ligar métrica ao vivo (ex.: pending_evolution) */
  metricKey?: string;
}

export interface WorkerPipelineDef {
  id: string;
  label: string;
  description: string;
  queueName: string;
  dlqName: string;
  jobType: string;
  processorFile: string;
  steps: PipelineStepDef[];
}

export interface WorkerPipelineGroupDef {
  id: string;
  title: string;
  intro: string;
  pipelines: WorkerPipelineDef[];
}

/** Definição canônica: mantida alinhada a `src/workers/runner.ts` e ingest de webhooks. */
export const WORKER_PIPELINE_GROUPS: WorkerPipelineGroupDef[] = [
  {
    id: "ingest_messaging",
    title: "Webhooks de mensagens",
    intro:
      "Eventos brutos entram pela API, gravam em tabela de staging e o worker consome a fila Redis para criar conversas e mensagens.",
    pipelines: [
      {
        id: "evolution",
        label: "Evolution API",
        description: "WhatsApp via Evolution: webhook → raw → fila → conversas.",
        queueName: QUEUE_RAW_EVOLUTION,
        dlqName: DLQ_RAW_EVOLUTION,
        jobType: "process_evolution_raw",
        processorFile: "processors/evolution.ts",
        steps: [
          {
            kind: "ingress",
            title: "Webhook HTTP",
            detail: "POST /api/webhooks/evolution/[instanceId]",
          },
          {
            kind: "table",
            title: "Staging",
            detail: "evolution_webhook_events",
            metricKey: "pending_evolution_raw",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_RAW_EVOLUTION,
            metricKey: "queue_evolution",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processEvolutionRaw — conversa, mensagem, mídia (Whisper/Vision), contato",
          },
          {
            kind: "output",
            title: "Persistência",
            detail:
              "conversations · conversation_messages · contacts · enqueue classify_conversation (fila AI)",
          },
        ],
      },
      {
        id: "uazapi",
        label: "UAZAPI",
        description: "WhatsApp via UAZAPI com o mesmo padrão de fila que a Evolution.",
        queueName: QUEUE_RAW_UAZAPI,
        dlqName: DLQ_RAW_UAZAPI,
        jobType: "process_uazapi_raw",
        processorFile: "processors/uazapi.ts",
        steps: [
          {
            kind: "ingress",
            title: "Webhook HTTP",
            detail: "POST /api/webhooks/uazapi/[instanceId]",
          },
          {
            kind: "table",
            title: "Staging",
            detail: "uazapi_webhook_events",
            metricKey: "pending_uazapi_raw",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_RAW_UAZAPI,
            metricKey: "queue_uazapi",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processUazapiRaw — conversa e mensagem (paridade Evolution)",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "conversations · conversation_messages · contacts",
          },
        ],
      },
      {
        id: "chatwoot",
        label: "Chatwoot",
        description: "Conversas vindas do Chatwoot via webhook → fila → conversas/mensagens.",
        queueName: QUEUE_RAW_CHATWOOT,
        dlqName: DLQ_RAW_CHATWOOT,
        jobType: "process_chatwoot_raw",
        processorFile: "processors/chatwoot.ts",
        steps: [
          {
            kind: "ingress",
            title: "Webhook HTTP",
            detail: "POST /api/webhooks/chatwoot/[accountId]",
          },
          {
            kind: "table",
            title: "Staging",
            detail: "chatwoot_webhook_events",
            metricKey: "pending_chatwoot_raw",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_RAW_CHATWOOT,
            metricKey: "queue_chatwoot",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processChatwootRaw — conversas, mensagens, contato",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "conversations · conversation_messages · contacts · enqueue classify_conversation",
          },
        ],
      },
      {
        id: "whatsapp_cloud",
        label: "WhatsApp Cloud",
        description: "Cloud API oficial da Meta: webhook → staging → fila → conversas.",
        queueName: QUEUE_RAW_WHATSAPP_CLOUD,
        dlqName: DLQ_RAW_WHATSAPP_CLOUD,
        jobType: "process_whatsapp_cloud_raw",
        processorFile: "processors/whatsapp-cloud.ts",
        steps: [
          {
            kind: "ingress",
            title: "Webhook HTTP",
            detail: "POST /api/webhooks/whatsapp-cloud/[numberId]",
          },
          {
            kind: "table",
            title: "Staging",
            detail: "wc_webhook_events",
            metricKey: "pending_whatsapp_cloud_raw",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_RAW_WHATSAPP_CLOUD,
            metricKey: "queue_whatsapp_cloud",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processWhatsappCloudRaw — conversas, mensagens, statuses",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "conversations · conversation_messages · contacts",
          },
        ],
      },
      {
        id: "typebot",
        label: "Typebot",
        description: "Eventos do bot em staging antes do processamento assíncrono.",
        queueName: QUEUE_RAW_TYPEBOT,
        dlqName: DLQ_RAW_TYPEBOT,
        jobType: "process_typebot_raw",
        processorFile: "processors/typebot.ts",
        steps: [
          {
            kind: "ingress",
            title: "Webhook HTTP",
            detail: "POST /api/webhooks/typebot/[botId]",
          },
          {
            kind: "table",
            title: "Staging",
            detail: "typebot_webhook_events",
            metricKey: "pending_typebot_raw",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_RAW_TYPEBOT,
            metricKey: "queue_typebot",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processTypebotRaw",
          },
          {
            kind: "output",
            title: "Persistência",
            detail:
              "leads · lead_events · utm_attributions · funis/etapas · followup_tasks · notificações internas",
          },
        ],
      },
    ],
  },
  {
    id: "ai_agent",
    title: "Agente & follow-up",
    intro:
      "Classificação de conversas e tarefas agendadas rodam em filas dedicadas, desacopladas dos webhooks.",
    pipelines: [
      {
        id: "ai_classification",
        label: "Classificação IA",
        description: "Job enfileirado após novas mensagens relevantes na conversa.",
        queueName: QUEUE_AI_CLASSIFICATION,
        dlqName: DLQ_AI_CLASSIFICATION,
        jobType: "classify_conversation",
        processorFile: "processors/classify-conversation.ts",
        steps: [
          {
            kind: "ingress",
            title: "Origem",
            detail: "enqueueConversationClassification (após ingest de mensagem)",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_AI_CLASSIFICATION,
            metricKey: "queue_ai_classification",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processClassifyConversation — OpenAI / regras comerciais",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "ai_classifications · atualização de contexto da conversa",
          },
        ],
      },
      {
        id: "followup_due",
        label: "Follow-ups vencidos",
        description: "Processamento por tenant de tarefas de follow-up devidas.",
        queueName: QUEUE_FOLLOWUP_DUE_TENANT,
        dlqName: DLQ_FOLLOWUP_DUE_TENANT,
        jobType: "process_due_followups_tenant",
        processorFile: "processors/process-due-followups.ts",
        steps: [
          {
            kind: "ingress",
            title: "Origem",
            detail: "Scheduler / API interna enfileira tenant com tarefas due",
          },
          {
            kind: "table",
            title: "Dados",
            detail: "followup_tasks",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_FOLLOWUP_DUE_TENANT,
            metricKey: "queue_followup_due",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "processDueFollowupsTenantJob",
          },
          {
            kind: "output",
            title: "Efeitos",
            detail: "Notificações internas · integrações conforme motor",
          },
        ],
      },
    ],
  },
  {
    id: "sync_ads",
    title: "Sincronização de canais (Ads & Clarity)",
    intro:
      "Jobs de sync puxam dados das APIs externas e gravam snapshots e logs; disparados pelo dashboard ou rotinas internas.",
    pipelines: [
      {
        id: "google_ads",
        label: "Google Ads",
        description: "Sincronização por conta cadastrada.",
        queueName: QUEUE_SYNC_GOOGLE_ADS,
        dlqName: DLQ_SYNC_GOOGLE_ADS,
        jobType: "sync_google_ads_account",
        processorFile: "integrations/google-ads (runSyncForAccount)",
        steps: [
          {
            kind: "table",
            title: "Config",
            detail: "google_ads_accounts",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_SYNC_GOOGLE_ADS,
            metricKey: "queue_google_ads",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "runSyncForAccount",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "google_ads_sync_logs · campaign_snapshots (e relacionadas)",
          },
        ],
      },
      {
        id: "meta_ads",
        label: "Meta Ads",
        description: "Sincronização de insights por ad account.",
        queueName: QUEUE_SYNC_META_ADS,
        dlqName: DLQ_SYNC_META_ADS,
        jobType: "sync_meta_ads_account",
        processorFile: "integrations/meta-ads (runMetaSyncForAccount)",
        steps: [
          {
            kind: "table",
            title: "Config",
            detail: "meta_ads_accounts",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_SYNC_META_ADS,
            metricKey: "queue_meta_ads",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "runMetaSyncForAccount",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "meta_ads_sync_logs · meta_ads_insight_snapshots",
          },
        ],
      },
      {
        id: "clarity",
        label: "Microsoft Clarity",
        description: "Importação de dados exportados por conexão.",
        queueName: QUEUE_SYNC_CLARITY,
        dlqName: DLQ_SYNC_CLARITY,
        jobType: "sync_clarity_connection",
        processorFile: "integrations/clarity/run-sync",
        steps: [
          {
            kind: "table",
            title: "Config",
            detail: "clarity_connections",
          },
          {
            kind: "queue",
            title: "Fila Redis",
            detail: QUEUE_SYNC_CLARITY,
            metricKey: "queue_clarity",
          },
          {
            kind: "worker",
            title: "Worker",
            detail: "runClaritySyncForConnection",
          },
          {
            kind: "output",
            title: "Persistência",
            detail: "clarity_insight_snapshots",
          },
        ],
      },
    ],
  },
];

export interface QueueDepths {
  typebot: number;
  evolution: number;
  uazapi: number;
  chatwoot: number;
  whatsappCloud: number;
  googleAds: number;
  metaAds: number;
  clarity: number;
  aiClassification: number;
  followupDue: number;
  dlqTypebot: number;
  dlqEvolution: number;
  dlqUazapi: number;
  dlqChatwoot: number;
  dlqWhatsappCloud: number;
  dlqGoogleAds: number;
  dlqMetaAds: number;
  dlqClarity: number;
  dlqAiClassification: number;
  dlqFollowupDue: number;
}

export interface PendingRawCounts {
  evolution: number;
  uazapi: number;
  typebot: number;
  chatwoot: number;
  whatsappCloud: number;
}

export interface WorkerPipelineSnapshot {
  generatedAt: string;
  redisOk: boolean;
  workerStatus: "ok" | "stale" | "missing";
  heartbeatAgeMs: number | null;
  lastHeartbeatAt: string | null;
  queueDepths: QueueDepths;
  pendingRaw: PendingRawCounts;
  backlogTotal: number;
  dlqTotal: number;
}

function metricForPipeline(pipelineId: string, depths: QueueDepths): { q: number; dlq: number } {
  switch (pipelineId) {
    case "evolution":
      return { q: depths.evolution, dlq: depths.dlqEvolution };
    case "uazapi":
      return { q: depths.uazapi, dlq: depths.dlqUazapi };
    case "chatwoot":
      return { q: depths.chatwoot, dlq: depths.dlqChatwoot };
    case "whatsapp_cloud":
      return { q: depths.whatsappCloud, dlq: depths.dlqWhatsappCloud };
    case "typebot":
      return { q: depths.typebot, dlq: depths.dlqTypebot };
    case "ai_classification":
      return { q: depths.aiClassification, dlq: depths.dlqAiClassification };
    case "followup_due":
      return { q: depths.followupDue, dlq: depths.dlqFollowupDue };
    case "google_ads":
      return { q: depths.googleAds, dlq: depths.dlqGoogleAds };
    case "meta_ads":
      return { q: depths.metaAds, dlq: depths.dlqMetaAds };
    case "clarity":
      return { q: depths.clarity, dlq: depths.dlqClarity };
    default:
      return { q: 0, dlq: 0 };
  }
}

export { metricForPipeline };

const EMPTY_DEPTHS: QueueDepths = {
  typebot: 0,
  evolution: 0,
  uazapi: 0,
  chatwoot: 0,
  whatsappCloud: 0,
  googleAds: 0,
  metaAds: 0,
  clarity: 0,
  aiClassification: 0,
  followupDue: 0,
  dlqTypebot: 0,
  dlqEvolution: 0,
  dlqUazapi: 0,
  dlqChatwoot: 0,
  dlqWhatsappCloud: 0,
  dlqGoogleAds: 0,
  dlqMetaAds: 0,
  dlqClarity: 0,
  dlqAiClassification: 0,
  dlqFollowupDue: 0,
};

async function loadQueueDepths(): Promise<{ redisOk: boolean; depths: QueueDepths }> {
  if (!process.env.REDIS_URL) {
    return { redisOk: false, depths: { ...EMPTY_DEPTHS } };
  }
  const redis = createRedisClient();
  try {
    const [
      typebot,
      evolution,
      uazapi,
      chatwoot,
      whatsappCloud,
      googleAds,
      metaAds,
      clarity,
      aiClassification,
      followupDue,
      dlqTypebot,
      dlqEvolution,
      dlqUazapi,
      dlqChatwoot,
      dlqWhatsappCloud,
      dlqGoogleAds,
      dlqMetaAds,
      dlqClarity,
      dlqAiClassification,
      dlqFollowupDue,
    ] = await Promise.all([
      redis.llen(QUEUE_RAW_TYPEBOT),
      redis.llen(QUEUE_RAW_EVOLUTION),
      redis.llen(QUEUE_RAW_UAZAPI),
      redis.llen(QUEUE_RAW_CHATWOOT),
      redis.llen(QUEUE_RAW_WHATSAPP_CLOUD),
      redis.llen(QUEUE_SYNC_GOOGLE_ADS),
      redis.llen(QUEUE_SYNC_META_ADS),
      redis.llen(QUEUE_SYNC_CLARITY),
      redis.llen(QUEUE_AI_CLASSIFICATION),
      redis.llen(QUEUE_FOLLOWUP_DUE_TENANT),
      redis.llen(DLQ_RAW_TYPEBOT),
      redis.llen(DLQ_RAW_EVOLUTION),
      redis.llen(DLQ_RAW_UAZAPI),
      redis.llen(DLQ_RAW_CHATWOOT),
      redis.llen(DLQ_RAW_WHATSAPP_CLOUD),
      redis.llen(DLQ_SYNC_GOOGLE_ADS),
      redis.llen(DLQ_SYNC_META_ADS),
      redis.llen(DLQ_SYNC_CLARITY),
      redis.llen(DLQ_AI_CLASSIFICATION),
      redis.llen(DLQ_FOLLOWUP_DUE_TENANT),
    ]);
    return {
      redisOk: true,
      depths: {
        typebot,
        evolution,
        uazapi,
        chatwoot,
        whatsappCloud,
        googleAds,
        metaAds,
        clarity,
        aiClassification,
        followupDue,
        dlqTypebot,
        dlqEvolution,
        dlqUazapi,
        dlqChatwoot,
        dlqWhatsappCloud,
        dlqGoogleAds,
        dlqMetaAds,
        dlqClarity,
        dlqAiClassification,
        dlqFollowupDue,
      },
    };
  } catch {
    return { redisOk: false, depths: { ...EMPTY_DEPTHS } };
  } finally {
    await redis.quit().catch(() => {});
  }
}

async function loadPendingRawCounts(): Promise<PendingRawCounts> {
  const db = getDb();
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };
  const [evo, uaz, tb, cw, wc] = await Promise.all([
    safe(async () => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(evolutionWebhookEvents)
        .where(isNull(evolutionWebhookEvents.processedAt));
      return Number(row?.n ?? 0);
    }, 0),
    safe(async () => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(uazapiWebhookEvents)
        .where(isNull(uazapiWebhookEvents.processedAt));
      return Number(row?.n ?? 0);
    }, 0),
    safe(async () => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(typebotWebhookEvents)
        .where(isNull(typebotWebhookEvents.processedAt));
      return Number(row?.n ?? 0);
    }, 0),
    safe(async () => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(chatwootWebhookEvents)
        .where(isNull(chatwootWebhookEvents.processedAt));
      return Number(row?.n ?? 0);
    }, 0),
    safe(async () => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(whatsappCloudWebhookEvents)
        .where(isNull(whatsappCloudWebhookEvents.processedAt));
      return Number(row?.n ?? 0);
    }, 0),
  ]);
  return { evolution: evo, uazapi: uaz, typebot: tb, chatwoot: cw, whatsappCloud: wc };
}

async function loadWorkerHeartbeat(): Promise<{
  status: "ok" | "stale" | "missing";
  ageMs: number | null;
  lastAt: string | null;
}> {
  if (!process.env.REDIS_URL) {
    return { status: "missing", ageMs: null, lastAt: null };
  }
  const redis = createRedisClient();
  try {
    const raw = await redis.get(HEARTBEAT_KEY);
    const ts = raw ? Number(raw) : NaN;
    if (!Number.isFinite(ts)) {
      return { status: "missing", ageMs: null, lastAt: null };
    }
    const ageMs = Date.now() - ts;
    const status =
      ageMs <= MAX_AGE_MS ? "ok" : ("stale" as const);
    return {
      status,
      ageMs,
      lastAt: new Date(ts).toISOString(),
    };
  } catch {
    return { status: "missing", ageMs: null, lastAt: null };
  } finally {
    await redis.quit().catch(() => {});
  }
}

export async function getWorkerPipelineSnapshot(): Promise<WorkerPipelineSnapshot> {
  const [{ redisOk, depths }, pendingRaw, hb] = await Promise.all([
    loadQueueDepths(),
    loadPendingRawCounts(),
    loadWorkerHeartbeat(),
  ]);

  const backlogTotal =
    depths.typebot +
    depths.evolution +
    depths.uazapi +
    depths.chatwoot +
    depths.whatsappCloud +
    depths.googleAds +
    depths.metaAds +
    depths.clarity +
    depths.aiClassification +
    depths.followupDue;

  const dlqTotal =
    depths.dlqTypebot +
    depths.dlqEvolution +
    depths.dlqUazapi +
    depths.dlqChatwoot +
    depths.dlqWhatsappCloud +
    depths.dlqGoogleAds +
    depths.dlqMetaAds +
    depths.dlqClarity +
    depths.dlqAiClassification +
    depths.dlqFollowupDue;

  return {
    generatedAt: new Date().toISOString(),
    redisOk,
    workerStatus: hb.status,
    heartbeatAgeMs: hb.ageMs,
    lastHeartbeatAt: hb.lastAt,
    queueDepths: depths,
    pendingRaw,
    backlogTotal,
    dlqTotal,
  };
}

export function pendingCountForMetricKey(
  key: string | undefined,
  pending: PendingRawCounts
): number | undefined {
  if (!key) return undefined;
  if (key === "pending_evolution_raw") return pending.evolution;
  if (key === "pending_uazapi_raw") return pending.uazapi;
  if (key === "pending_typebot_raw") return pending.typebot;
  if (key === "pending_chatwoot_raw") return pending.chatwoot;
  if (key === "pending_whatsapp_cloud_raw") return pending.whatsappCloud;
  return undefined;
}

export function queueDepthForMetricKey(
  key: string | undefined,
  depths: QueueDepths
): { main: number; dlq: number } | undefined {
  if (!key) return undefined;
  const map: Record<string, { main: keyof QueueDepths; dlq: keyof QueueDepths }> = {
    queue_evolution: { main: "evolution", dlq: "dlqEvolution" },
    queue_uazapi: { main: "uazapi", dlq: "dlqUazapi" },
    queue_typebot: { main: "typebot", dlq: "dlqTypebot" },
    queue_chatwoot: { main: "chatwoot", dlq: "dlqChatwoot" },
    queue_whatsapp_cloud: { main: "whatsappCloud", dlq: "dlqWhatsappCloud" },
    queue_ai_classification: { main: "aiClassification", dlq: "dlqAiClassification" },
    queue_followup_due: { main: "followupDue", dlq: "dlqFollowupDue" },
    queue_google_ads: { main: "googleAds", dlq: "dlqGoogleAds" },
    queue_meta_ads: { main: "metaAds", dlq: "dlqMetaAds" },
    queue_clarity: { main: "clarity", dlq: "dlqClarity" },
  };
  const m = map[key];
  if (!m) return undefined;
  return { main: depths[m.main], dlq: depths[m.dlq] };
}
