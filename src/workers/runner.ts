/**
 * Worker: Redis, heartbeat e consumidores das filas Typebot, Evolution e Google Ads sync.
 * Uso: npm run worker:dev
 */
import "dotenv/config";
import Redis from "ioredis";
import { HEARTBEAT_KEY, MAX_AGE_MS } from "./readiness";
import {
  dequeue,
  QUEUE_RAW_TYPEBOT,
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_UAZAPI,
  QUEUE_SYNC_GOOGLE_ADS,
  DLQ_RAW_TYPEBOT,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_UAZAPI,
  DLQ_SYNC_GOOGLE_ADS,
  enqueue,
} from "./queue";
import { processTypebotRaw } from "./processors/typebot";
import { processEvolutionRaw } from "./processors/evolution";
import { processUazapiRaw } from "./processors/uazapi";
import { runSyncForAccount } from "@/server/integrations/google-ads";
import type {
  JobPayload,
  JobProcessTypebotRaw,
  JobProcessEvolutionRaw,
  JobProcessUazapiRaw,
  JobSyncGoogleAdsAccount,
} from "./queue/types";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("REDIS_URL não definida.");
  process.exit(1);
}

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const MAX_ATTEMPTS = 5;

async function pushToDlq(queueName: string, job: JobPayload, error: string) {
  const payload = JSON.stringify({
    failedAt: new Date().toISOString(),
    error,
    job,
  });
  await redis.lpush(queueName, payload);
}

async function retryJob(
  job: JobPayload,
  queueName: string,
  deadLetterQueue: string,
  error: string
) {
  const currentAttempt = (job.attempt ?? 0) + 1;
  if (currentAttempt >= MAX_ATTEMPTS) {
    await pushToDlq(deadLetterQueue, { ...job, attempt: currentAttempt }, error);
    return;
  }
  const backoffMs = Math.min(30_000, currentAttempt * 2_000);
  setTimeout(() => {
    enqueue(redis, { ...job, attempt: currentAttempt }).catch((err) => {
      console.error("[worker] enqueue retry failed", { queueName, err });
    });
  }, backoffMs);
}

function writeHeartbeat(): void {
  redis.set(HEARTBEAT_KEY, Date.now().toString(), "PX", MAX_AGE_MS).catch((err) => {
    console.error("Heartbeat write failed:", err);
  });
}

const heartbeatInterval = setInterval(writeHeartbeat, 10_000);
writeHeartbeat();

async function runTypebotConsumer(): Promise<void> {
  const job = await dequeue(redis, QUEUE_RAW_TYPEBOT, 5);
  if (!job) return;
  if (job.type !== "process_typebot_raw") return;
  const result = await processTypebotRaw(job);
  if ("error" in result) {
    console.error("[typebot] processing failed", {
      rawEventId: job.rawEventId,
      error: result.error,
    });
    await retryJob(
      job as JobProcessTypebotRaw,
      QUEUE_RAW_TYPEBOT,
      DLQ_RAW_TYPEBOT,
      result.error
    );
  } else {
    console.log("[typebot] processed", { rawEventId: job.rawEventId });
  }
}

async function runEvolutionConsumer(): Promise<void> {
  const job = await dequeue(redis, QUEUE_RAW_EVOLUTION, 5);
  if (!job) return;
  if (job.type !== "process_evolution_raw") return;
  const result = await processEvolutionRaw(job);
  if ("error" in result) {
    console.error("[evolution] processing failed", {
      rawEventId: job.rawEventId,
      error: result.error,
    });
    await retryJob(
      job as JobProcessEvolutionRaw,
      QUEUE_RAW_EVOLUTION,
      DLQ_RAW_EVOLUTION,
      result.error
    );
  } else {
    console.log("[evolution] processed", { rawEventId: job.rawEventId });
  }
}

function loopTypebot(): void {
  runTypebotConsumer()
    .catch((err) => {
      console.error("[typebot] consumer error", err);
    })
    .then(() => {
      setImmediate(loopTypebot);
    });
}

function loopEvolution(): void {
  runEvolutionConsumer()
    .catch((err) => {
      console.error("[evolution] consumer error", err);
    })
    .then(() => {
      setImmediate(loopEvolution);
    });
}

async function runUazapiConsumer(): Promise<void> {
  const job = await dequeue(redis, QUEUE_RAW_UAZAPI, 5);
  if (!job) return;
  if (job.type !== "process_uazapi_raw") return;
  const result = await processUazapiRaw(job);
  if ("error" in result) {
    console.error("[uazapi] processing failed", {
      rawEventId: job.rawEventId,
      error: result.error,
    });
    await retryJob(
      job as JobProcessUazapiRaw,
      QUEUE_RAW_UAZAPI,
      DLQ_RAW_UAZAPI,
      result.error
    );
  } else {
    console.log("[uazapi] processed", { rawEventId: job.rawEventId });
  }
}

function loopUazapi(): void {
  runUazapiConsumer()
    .catch((err) => {
      console.error("[uazapi] consumer error", err);
    })
    .then(() => {
      setImmediate(loopUazapi);
    });
}

async function runGoogleAdsSyncConsumer(): Promise<void> {
  const job = await dequeue(redis, QUEUE_SYNC_GOOGLE_ADS, 5);
  if (!job) return;
  if (job.type !== "sync_google_ads_account") return;
  const result = await runSyncForAccount(job.accountId);
  if (result.ok) {
    console.log("[google-ads] sync ok", { accountId: job.accountId, logId: result.logId });
  } else {
    console.error("[google-ads] sync failed", {
      accountId: job.accountId,
      error: result.error,
      logId: result.logId,
    });
    await retryJob(
      job as JobSyncGoogleAdsAccount,
      QUEUE_SYNC_GOOGLE_ADS,
      DLQ_SYNC_GOOGLE_ADS,
      result.error
    );
  }
}

function loopGoogleAdsSync(): void {
  runGoogleAdsSyncConsumer()
    .catch((err) => {
      console.error("[google-ads] consumer error", err);
    })
    .then(() => {
      setImmediate(loopGoogleAdsSync);
    });
}

redis.on("connect", () => {
  console.log(
    "Worker: Redis conectado; heartbeat e filas typebot/evolution/uazapi/google-ads ativos."
  );
  loopTypebot();
  loopEvolution();
  loopUazapi();
  loopGoogleAdsSync();
});

redis.on("error", (err) => {
  console.error("Worker: Redis error", err);
});

process.on("SIGINT", () => {
  clearInterval(heartbeatInterval);
  redis.quit().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  clearInterval(heartbeatInterval);
  redis.quit().then(() => process.exit(0));
});
