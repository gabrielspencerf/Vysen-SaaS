import { desc, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  evolutionWebhookEvents,
  typebotWebhookEvents,
  processingFailures,
} from "@/db/schema";
import { createRedisClient } from "@/server/redis";
import {
  HEARTBEAT_KEY,
  MAX_AGE_MS,
} from "@/workers/readiness";
import {
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_TYPEBOT,
  QUEUE_SYNC_GOOGLE_ADS,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_TYPEBOT,
  DLQ_SYNC_GOOGLE_ADS,
} from "@/workers/queue";
import { providerRegistry } from "@/server/integrations/providers/registry";

export interface ObservabilitySnapshot {
  generatedAt: string;
  services: {
    api: "ok";
    db: "ok" | "error";
    redis: "ok" | "error";
    worker: "ok" | "stale" | "missing";
  };
  queue: {
    typebotDepth: number;
    evolutionDepth: number;
    googleAdsDepth: number;
    typebotDlqDepth: number;
    evolutionDlqDepth: number;
    googleAdsDlqDepth: number;
  };
  integrations: {
    evolution: Array<{
      instanceId: string;
      tenantId: string;
      provider: "evolution";
      ok: boolean;
      status: string;
      latencyMs: number;
      details?: Record<string, unknown>;
    }>;
    uazapi: Array<{
      instanceId: string;
      tenantId: string;
      provider: "uazapi";
      ok: boolean;
      status: string;
      latencyMs: number;
      details?: Record<string, unknown>;
    }>;
  };
  errors: Array<{
    source: string;
    message: string;
    occurredAt: string;
  }>;
}

async function getQueueMetrics() {
  if (!process.env.REDIS_URL) {
    return {
      redisOk: false,
      workerStatus: "missing" as const,
      queue: {
        typebotDepth: 0,
        evolutionDepth: 0,
        googleAdsDepth: 0,
        typebotDlqDepth: 0,
        evolutionDlqDepth: 0,
        googleAdsDlqDepth: 0,
      },
    };
  }
  const redis = createRedisClient();
  try {
    const [
      typebotDepth,
      evolutionDepth,
      googleAdsDepth,
      typebotDlqDepth,
      evolutionDlqDepth,
      googleAdsDlqDepth,
      workerHeartbeat,
    ] = await Promise.all([
      redis.llen(QUEUE_RAW_TYPEBOT),
      redis.llen(QUEUE_RAW_EVOLUTION),
      redis.llen(QUEUE_SYNC_GOOGLE_ADS),
      redis.llen(DLQ_RAW_TYPEBOT),
      redis.llen(DLQ_RAW_EVOLUTION),
      redis.llen(DLQ_SYNC_GOOGLE_ADS),
      redis.get(HEARTBEAT_KEY),
    ]);

    const heartbeatTs = workerHeartbeat ? Number(workerHeartbeat) : NaN;
    const workerStatus =
      Number.isFinite(heartbeatTs)
        ? Date.now() - heartbeatTs <= MAX_AGE_MS
          ? "ok"
          : "stale"
        : "missing";

    return {
      redisOk: true,
      workerStatus: workerStatus as "ok" | "stale" | "missing",
      queue: {
        typebotDepth,
        evolutionDepth,
        googleAdsDepth,
        typebotDlqDepth,
        evolutionDlqDepth,
        googleAdsDlqDepth,
      },
    };
  } catch {
    return {
      redisOk: false,
      workerStatus: "missing" as const,
      queue: {
        typebotDepth: 0,
        evolutionDepth: 0,
        googleAdsDepth: 0,
        typebotDlqDepth: 0,
        evolutionDlqDepth: 0,
        googleAdsDlqDepth: 0,
      },
    };
  } finally {
    redis.quit();
  }
}

async function getRecentErrors() {
  const db = getDb();
  const [typebotErrors, evolutionErrors, workerFailures] = await Promise.all([
    db
      .select({
        message: typebotWebhookEvents.processingError,
        occurredAt: typebotWebhookEvents.processedAt,
      })
      .from(typebotWebhookEvents)
      .where(isNotNull(typebotWebhookEvents.processingError))
      .orderBy(desc(typebotWebhookEvents.processedAt))
      .limit(10),
    db
      .select({
        message: evolutionWebhookEvents.processingError,
        occurredAt: evolutionWebhookEvents.processedAt,
      })
      .from(evolutionWebhookEvents)
      .where(isNotNull(evolutionWebhookEvents.processingError))
      .orderBy(desc(evolutionWebhookEvents.processedAt))
      .limit(10),
    db
      .select({
        message: processingFailures.errorMessage,
        occurredAt: processingFailures.failedAt,
      })
      .from(processingFailures)
      .orderBy(desc(processingFailures.failedAt))
      .limit(10),
  ]);

  return [
    ...typebotErrors.map((row) => ({
      source: "typebot",
      message: row.message ?? "erro sem mensagem",
      occurredAt: row.occurredAt?.toISOString() ?? new Date(0).toISOString(),
    })),
    ...evolutionErrors.map((row) => ({
      source: "evolution",
      message: row.message ?? "erro sem mensagem",
      occurredAt: row.occurredAt?.toISOString() ?? new Date(0).toISOString(),
    })),
    ...workerFailures.map((row) => ({
      source: "worker",
      message: row.message ?? "erro sem mensagem",
      occurredAt: row.occurredAt?.toISOString() ?? new Date(0).toISOString(),
    })),
  ]
    .sort((a, b) => (a.occurredAt > b.occurredAt ? -1 : 1))
    .slice(0, 15);
}

export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const db = getDb();

  let dbStatus: "ok" | "error" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbStatus = "error";
  }

  const [queueData, providerStatuses, errors] = await Promise.all([
    getQueueMetrics(),
    Promise.all(providerRegistry.map((provider) => provider.fetchStatuses())),
    getRecentErrors(),
  ]);

  const flattenedStatuses = providerStatuses.flat();
  const evolutionStatuses = flattenedStatuses
    .filter((item) => item.provider === "evolution")
    .map((item) => ({
      instanceId: item.resourceId,
      tenantId: item.tenantId,
      provider: "evolution" as const,
      ok: item.ok,
      status: item.status,
      latencyMs: item.latencyMs,
      details: item.details,
    }));
  const uazapiStatuses = flattenedStatuses
    .filter((item) => item.provider === "uazapi")
    .map((item) => ({
      instanceId: item.resourceId,
      tenantId: item.tenantId,
      provider: "uazapi" as const,
      ok: item.ok,
      status: item.status,
      latencyMs: item.latencyMs,
      details: item.details,
    }));

  return {
    generatedAt: new Date().toISOString(),
    services: {
      api: "ok",
      db: dbStatus,
      redis: queueData.redisOk ? "ok" : "error",
      worker: queueData.workerStatus,
    },
    queue: queueData.queue,
    integrations: {
      evolution: evolutionStatuses,
      uazapi: uazapiStatuses,
    },
    errors,
  };
}
