/**
 * Worker: Redis, heartbeat e consumidores das filas.
 *
 * Arquitetura:
 * - BRPOPLPUSH atomico move jobs da fila principal para uma "processing list"
 *   (visibility lock). Após sucesso ou decisão final (DLQ / retry agendado),
 *   `ackJob` remove o item da processing list.
 * - Retries agendados vão para ZSET `queue:X:delayed` — sobrevive a SIGTERM,
 *   diferente do antigo `setTimeout` em memória.
 * - Scheduler periódico promove jobs cujo `runAt <= now` para a fila principal.
 * - Reaper periódico recupera jobs presos no processing list (crash mid-process).
 * - Shutdown drena jobs ativos com timeout antes de fechar Redis.
 *
 * Uso: npm run worker:dev
 */
import "dotenv/config";
import Redis from "ioredis";
import {
  HEARTBEAT_KEY,
  MAX_AGE_MS,
  workerInstanceHeartbeatKey,
  workerInstanceId,
} from "./readiness";
import { env } from "@/config/env";
import {
  enqueue,
  dequeueWithLock,
  ackJob,
  enqueueDelayed,
  promoteDueDelayedJobs,
  reapStaleProcessing,
  ALL_QUEUE_NAMES,
  QUEUE_RAW_TYPEBOT,
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_UAZAPI,
  QUEUE_RAW_CHATWOOT,
  QUEUE_RAW_WHATSAPP_CLOUD,
  QUEUE_SYNC_GOOGLE_ADS,
  QUEUE_SYNC_META_ADS,
  QUEUE_SYNC_CLARITY,
  QUEUE_AI_CLASSIFICATION,
  QUEUE_FOLLOWUP_DUE_TENANT,
  DLQ_RAW_TYPEBOT,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_UAZAPI,
  DLQ_RAW_CHATWOOT,
  DLQ_RAW_WHATSAPP_CLOUD,
  DLQ_SYNC_GOOGLE_ADS,
  DLQ_SYNC_META_ADS,
  DLQ_SYNC_CLARITY,
  DLQ_AI_CLASSIFICATION,
  DLQ_FOLLOWUP_DUE_TENANT,
  getQueuePolicy,
  computeBackoffMs,
} from "./queue";
import { processTypebotRaw } from "./processors/typebot";
import { processEvolutionRaw } from "./processors/evolution";
import { processUazapiRaw } from "./processors/uazapi";
import { processChatwootRaw } from "./processors/chatwoot";
import { processWhatsappCloudRaw } from "./processors/whatsapp-cloud";
import { processClassifyConversation } from "./processors/classify-conversation";
import { processDueFollowupsTenantJob } from "./processors/process-due-followups";
import { runSyncForAccount } from "@/server/integrations/google-ads";
import { runMetaSyncForAccount } from "@/server/integrations/meta-ads";
import { runClaritySyncForConnection } from "@/server/integrations/clarity/run-sync";
import { cleanupExpiredAuthArtifacts } from "@/server/auth/cleanup";
import { getDb } from "@/server/db";
import { processingFailures } from "@/db/schema";
import { runWithRlsContext } from "@/server/db/access-context";
import type { DbAccessContextInput } from "@/server/db/access-context";
import { assertProductionRuntimeWebhookSecrets } from "@/server/security/startup-guards";
import { cleanupWebhookEvents } from "@/server/privacy/cleanup-webhook-events";
import { cleanupVysenUsageEvents } from "@/server/vysen/usage";
import { emitDomainEvent } from "@/server/observability/domain-events";
import type {
  JobPayload,
  JobProcessTypebotRaw,
  JobProcessEvolutionRaw,
  JobProcessUazapiRaw,
  JobProcessChatwootRaw,
  JobProcessWhatsappCloudRaw,
  JobSyncGoogleAdsAccount,
  JobSyncMetaAdsAccount,
  JobSyncClarityConnection,
  JobClassifyConversation,
  JobProcessDueFollowupsTenant,
} from "./queue/types";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("REDIS_URL não definida.");
  process.exit(1);
}

try {
  assertProductionRuntimeWebhookSecrets();
} catch (e) {
  console.error("[worker] verificação de segurança na inicialização falhou:", e);
  process.exit(1);
}

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
// Conexão dedicada para heartbeat: evita atraso quando BRPOPLPUSH bloqueia a principal.
const heartbeatRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// === Shutdown state ===
let shuttingDown = false;
const activeJobs = new Set<Promise<unknown>>();
function trackActive<T>(p: Promise<T>): Promise<T> {
  activeJobs.add(p);
  p.finally(() => activeJobs.delete(p)).catch(() => {});
  return p;
}

// Após N ms na processing list sem ack, o reaper considera o job "preso" (worker
// crashou) e re-enfileira na fila principal. Tem que ser maior que o tempo médio
// do job mais demorado (Vysen classify pode levar dezenas de segundos).
const STALE_AFTER_MS = 5 * 60 * 1000;
const DELAYED_SCHEDULER_INTERVAL_MS = 2_000;
const REAPER_INTERVAL_MS = 60_000;
const SHUTDOWN_DRAIN_TIMEOUT_MS = 25_000;

function logRlsRolloutStatus(): void {
  const mode = env.workerDbAccessMode;
  const rlsEnforced = env.securityEnforceRls;
  console.log("[worker] db access rollout", {
    securityEnforceRls: rlsEnforced,
    workerDbAccessMode: mode,
  });

  if (rlsEnforced && mode === "off") {
    console.warn(
      "[worker] SECURITY_ENFORCE_RLS=true com WORKER_DB_ACCESS_MODE=off. " +
        "Risco de falha por contexto ausente em jobs durante rollout."
    );
  }

  if (rlsEnforced && mode === "tenant") {
    console.warn(
      "[worker] WORKER_DB_ACCESS_MODE=tenant ativo. Jobs globais (sem tenantId) " +
        "usam fallback bypass para manter compatibilidade operacional."
    );
  }
}

function resolveJobId(job: JobPayload): string | null {
  if ("rawEventId" in job) return job.rawEventId;
  if ("accountId" in job) return job.accountId;
  if ("connectionId" in job) return job.connectionId;
  if ("conversationId" in job) return job.conversationId;
  if ("tenantId" in job) return job.tenantId;
  return null;
}

function resolveTenantId(job: JobPayload): string | null {
  return "tenantId" in job ? job.tenantId : null;
}

function hasTenantContext(job: JobPayload): job is JobPayload & { tenantId: string } {
  return "tenantId" in job && typeof job.tenantId === "string" && job.tenantId.length > 0;
}

function workerRlsInput(job: JobPayload): DbAccessContextInput {
  const mode = env.workerDbAccessMode;
  if (mode === "off") {
    return { tenantId: null, bypassRls: false };
  }
  if (mode === "bypass") {
    return { tenantId: null, bypassRls: true };
  }
  if (hasTenantContext(job)) {
    return { tenantId: job.tenantId, bypassRls: false };
  }
  return { tenantId: null, bypassRls: true };
}

async function withWorkerAccessContext<T>(
  job: JobPayload,
  fn: () => Promise<T>
): Promise<T> {
  if (env.workerDbAccessMode === "off") {
    return fn();
  }
  return runWithRlsContext(workerRlsInput(job), fn);
}

async function recordProcessingFailure(params: {
  queueName: string;
  deadLetterQueue: string;
  job: JobPayload;
  error: string;
}): Promise<void> {
  // Telemetria de DLQ é cross-tenant — sempre roda com bypass RLS para não falhar
  // silenciosamente em modo `tenant` quando o job é global (sem tenantId).
  // Antes esta insert rodava fora de qualquer contexto e era recusada quando
  // SECURITY_ENFORCE_RLS=true em modo tenant.
  const insertFailure = async () => {
    const db = getDb();
    await db.insert(processingFailures).values({
      tenantId: resolveTenantId(params.job),
      jobType: params.job.type,
      jobId: resolveJobId(params.job),
      resourceType: "queue_job",
      resourceId: resolveJobId(params.job),
      payloadSummary: {
        queue: params.queueName,
        deadLetterQueue: params.deadLetterQueue,
        attempt: params.job.attempt ?? 0,
      },
      errorMessage: params.error,
      failedAt: new Date(),
      retryCount: params.job.attempt ?? 0,
      resolvedAt: null,
    });
  };

  try {
    if (env.workerDbAccessMode === "off") {
      await insertFailure();
    } else {
      await runWithRlsContext({ tenantId: null, bypassRls: true }, insertFailure);
    }
  } catch (err) {
    console.error("[worker] failed to persist processing failure", err);
  }
}

async function pushToDlq(
  queueName: string,
  deadLetterQueue: string,
  job: JobPayload,
  error: string
) {
  const payload = JSON.stringify({
    failedAt: new Date().toISOString(),
    error,
    job,
  });
  await redis.lpush(deadLetterQueue, payload);
  await recordProcessingFailure({
    queueName,
    deadLetterQueue,
    job,
    error,
  });
  emitDomainEvent({
    name: "worker.job.sent_to_dlq",
    level: "error",
    tenantId: resolveTenantId(job),
    metadata: {
      queueName,
      deadLetterQueue,
      jobType: job.type,
      attempt: job.attempt ?? 0,
      error,
    },
  });
}

/**
 * Decide entre agendar retry persistente (ZSET delayed) ou enviar pra DLQ.
 * Em ambos os casos, faz `ackJob` para liberar o item do processing list.
 */
async function retryOrDlq(opts: {
  job: JobPayload;
  payload: string;
  queueName: string;
  dlqName: string;
  error: string;
}): Promise<void> {
  const { job, payload, queueName, dlqName, error } = opts;
  const policy = getQueuePolicy(job);
  const currentAttempt = (job.attempt ?? 0) + 1;

  if (currentAttempt >= policy.maxAttempts) {
    await pushToDlq(queueName, dlqName, { ...job, attempt: currentAttempt }, error);
    await ackJob(redis, queueName, payload);
    return;
  }

  const backoffMs = computeBackoffMs(currentAttempt, policy);
  const runAtMs = Date.now() + backoffMs;

  emitDomainEvent({
    name: "worker.job.retry_scheduled",
    level: "warn",
    tenantId: resolveTenantId(job),
    metadata: {
      queueName,
      jobType: job.type,
      currentAttempt,
      maxAttempts: policy.maxAttempts,
      criticality: policy.criticality,
      backoffMs,
      error,
    },
  });

  try {
    await enqueueDelayed(redis, { ...job, attempt: currentAttempt }, runAtMs);
  } catch (err) {
    // Se falhar o agendamento, tenta enqueue direto (sem delay) pra não perder o job.
    console.error("[worker] enqueueDelayed falhou — re-enqueueing imediato", { queueName, err });
    await enqueue(redis, { ...job, attempt: currentAttempt }).catch((e) => {
      console.error("[worker] enqueue imediato também falhou", { queueName, e });
    });
  }
  await ackJob(redis, queueName, payload);
}

/**
 * Wrapper genérico: executa o processor, faz ack/retry conforme resultado.
 * `isFailure` retorna string com a mensagem de erro, ou null em sucesso.
 */
async function executeAndAck<T>(opts: {
  job: JobPayload;
  payload: string;
  queueName: string;
  dlqName: string;
  run: () => Promise<T>;
  isFailure: (result: T) => string | null;
}): Promise<void> {
  const { job, payload, queueName, dlqName, run, isFailure } = opts;
  try {
    const result = await withWorkerAccessContext(job, () => run());
    const errorMessage = isFailure(result);
    if (errorMessage) {
      console.error(`[${queueName}] processing failed`, {
        jobId: resolveJobId(job),
        error: errorMessage,
      });
      await retryOrDlq({ job, payload, queueName, dlqName, error: errorMessage });
      return;
    }
    const policy = getQueuePolicy(job);
    console.log(`[${queueName}] processed`, { jobId: resolveJobId(job) });
    emitDomainEvent({
      name: "worker.job.processed",
      tenantId: resolveTenantId(job),
      metadata: {
        queueName,
        jobType: job.type,
        criticality: policy.criticality,
        sloTargetSeconds: policy.sloTargetSeconds,
      },
    });
    await ackJob(redis, queueName, payload);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${queueName}] consumer threw`, { error });
    await retryOrDlq({ job, payload, queueName, dlqName, error });
  }
}

function hasErrorKey(value: unknown): value is { error: string } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function hasOkFalse(value: unknown): value is { ok: false; error?: string } {
  return Boolean(
    value && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false
  );
}

function failureFromErrorShape(result: unknown): string | null {
  if (hasErrorKey(result)) return result.error;
  return null;
}

function failureFromOkShape(result: unknown): string | null {
  if (hasOkFalse(result)) return result.error ?? "unknown_error";
  return null;
}

// === Consumers ===

async function runTypebotConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_RAW_TYPEBOT, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_typebot_raw") {
    await ackJob(redis, QUEUE_RAW_TYPEBOT, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_RAW_TYPEBOT,
    dlqName: DLQ_RAW_TYPEBOT,
    run: () => processTypebotRaw(job as JobProcessTypebotRaw),
    isFailure: failureFromErrorShape,
  });
}

async function runEvolutionConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_RAW_EVOLUTION, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_evolution_raw") {
    await ackJob(redis, QUEUE_RAW_EVOLUTION, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_RAW_EVOLUTION,
    dlqName: DLQ_RAW_EVOLUTION,
    run: () => processEvolutionRaw(job as JobProcessEvolutionRaw),
    isFailure: failureFromErrorShape,
  });
}

async function runUazapiConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_RAW_UAZAPI, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_uazapi_raw") {
    await ackJob(redis, QUEUE_RAW_UAZAPI, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_RAW_UAZAPI,
    dlqName: DLQ_RAW_UAZAPI,
    run: () => processUazapiRaw(job as JobProcessUazapiRaw),
    isFailure: failureFromErrorShape,
  });
}

async function runChatwootConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_RAW_CHATWOOT, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_chatwoot_raw") {
    await ackJob(redis, QUEUE_RAW_CHATWOOT, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_RAW_CHATWOOT,
    dlqName: DLQ_RAW_CHATWOOT,
    run: () => processChatwootRaw(job as JobProcessChatwootRaw),
    isFailure: failureFromErrorShape,
  });
}

async function runWhatsappCloudConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_RAW_WHATSAPP_CLOUD, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_whatsapp_cloud_raw") {
    await ackJob(redis, QUEUE_RAW_WHATSAPP_CLOUD, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_RAW_WHATSAPP_CLOUD,
    dlqName: DLQ_RAW_WHATSAPP_CLOUD,
    run: () => processWhatsappCloudRaw(job as JobProcessWhatsappCloudRaw),
    isFailure: failureFromErrorShape,
  });
}

async function runGoogleAdsSyncConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_SYNC_GOOGLE_ADS, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "sync_google_ads_account") {
    await ackJob(redis, QUEUE_SYNC_GOOGLE_ADS, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_SYNC_GOOGLE_ADS,
    dlqName: DLQ_SYNC_GOOGLE_ADS,
    run: () => runSyncForAccount((job as JobSyncGoogleAdsAccount).accountId),
    isFailure: failureFromOkShape,
  });
}

async function runMetaAdsSyncConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_SYNC_META_ADS, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "sync_meta_ads_account") {
    await ackJob(redis, QUEUE_SYNC_META_ADS, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_SYNC_META_ADS,
    dlqName: DLQ_SYNC_META_ADS,
    run: () => runMetaSyncForAccount((job as JobSyncMetaAdsAccount).accountId),
    isFailure: failureFromOkShape,
  });
}

async function runClaritySyncConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_SYNC_CLARITY, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "sync_clarity_connection") {
    await ackJob(redis, QUEUE_SYNC_CLARITY, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_SYNC_CLARITY,
    dlqName: DLQ_SYNC_CLARITY,
    run: () => runClaritySyncForConnection((job as JobSyncClarityConnection).connectionId),
    isFailure: failureFromOkShape,
  });
}

async function runAiClassificationConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_AI_CLASSIFICATION, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "classify_conversation") {
    await ackJob(redis, QUEUE_AI_CLASSIFICATION, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_AI_CLASSIFICATION,
    dlqName: DLQ_AI_CLASSIFICATION,
    run: () => processClassifyConversation(job as JobClassifyConversation),
    isFailure: failureFromErrorShape,
  });
}

async function runDueFollowupsConsumer(): Promise<void> {
  const item = await dequeueWithLock(redis, QUEUE_FOLLOWUP_DUE_TENANT, 5);
  if (!item) return;
  const { job, payload } = item;
  if (job.type !== "process_due_followups_tenant") {
    await ackJob(redis, QUEUE_FOLLOWUP_DUE_TENANT, payload);
    return;
  }
  await executeAndAck({
    job,
    payload,
    queueName: QUEUE_FOLLOWUP_DUE_TENANT,
    dlqName: DLQ_FOLLOWUP_DUE_TENANT,
    run: () => processDueFollowupsTenantJob(job as JobProcessDueFollowupsTenant),
    isFailure: failureFromErrorShape,
  });
}

// === Loop runner ===

function startLoop(name: string, run: () => Promise<void>): void {
  const tick = async () => {
    if (shuttingDown) return;
    try {
      await trackActive(run());
    } catch (err) {
      console.error(`[${name}] consumer loop error`, err);
    } finally {
      if (!shuttingDown) {
        setImmediate(tick);
      }
    }
  };
  tick();
}

// === Schedulers ===

async function tickDelayedScheduler(): Promise<void> {
  for (const queueName of ALL_QUEUE_NAMES) {
    if (shuttingDown) return;
    try {
      const moved = await promoteDueDelayedJobs(redis, queueName);
      if (moved > 0) {
        console.log(`[delayed-scheduler] promoveu ${moved} jobs em ${queueName}`);
      }
    } catch (err) {
      console.error("[delayed-scheduler] tick failed", { queueName, err });
    }
  }
}

async function tickReaper(): Promise<void> {
  for (const queueName of ALL_QUEUE_NAMES) {
    if (shuttingDown) return;
    try {
      const revived = await reapStaleProcessing(redis, queueName, STALE_AFTER_MS);
      if (revived > 0) {
        console.warn(`[reaper] re-enfileirou ${revived} jobs presos em ${queueName}`);
        emitDomainEvent({
          name: "worker.reaper.revived",
          level: "warn",
          metadata: { queueName, revived },
        });
      }
    } catch (err) {
      console.error("[reaper] tick failed", { queueName, err });
    }
  }
}

// === Periodic ticks ===

const WORKER_INSTANCE_ID = workerInstanceId();
const WORKER_INSTANCE_KEY = workerInstanceHeartbeatKey(WORKER_INSTANCE_ID);

function writeHeartbeat(): void {
  const now = Date.now().toString();
  // Chave agregada (HEARTBEAT_KEY): mantida para compatibilidade — qualquer
  // worker que escreve "ganha". Útil pra healthcheck "tem ALGUM worker vivo?".
  heartbeatRedis.set(HEARTBEAT_KEY, now, "PX", MAX_AGE_MS).catch((err) => {
    console.error("Heartbeat write failed:", err);
  });
  // Chave por instância (worker:heartbeat:<id>): permite detectar split-brain,
  // worker individual com problema, e dashboards de "quantas réplicas vivas".
  heartbeatRedis.set(WORKER_INSTANCE_KEY, now, "PX", MAX_AGE_MS).catch((err) => {
    console.error("Heartbeat per-instance write failed:", err);
  });
}

const heartbeatInterval = setInterval(writeHeartbeat, 10_000);
writeHeartbeat();

const authCleanupInterval = setInterval(() => {
  cleanupExpiredAuthArtifacts()
    .then((result) => {
      if (result.sessionsDeleted > 0 || result.passwordResetTokensDeleted > 0) {
        console.log("[auth-cleanup] expired records removed", result);
      }
    })
    .catch((err) => {
      console.error("[auth-cleanup] failed", err);
    });
}, 15 * 60 * 1000);

const webhookRetentionInterval = setInterval(() => {
  cleanupWebhookEvents()
    .then((r) => {
      if (r.redactedRows > 0) {
        console.log("[webhook-retention] payloads anonimizados", r.redactedRows);
      }
    })
    .catch((err) => {
      console.error("[webhook-retention] failed", err);
    });
}, 24 * 60 * 60 * 1000);

setTimeout(() => {
  cleanupWebhookEvents().catch((err) => {
    console.error("[webhook-retention] initial run failed", err);
  });
}, 120_000);

const vysenUsageRetentionInterval = setInterval(() => {
  cleanupVysenUsageEvents()
    .then((r) => {
      if (r.removed > 0) {
        console.log("[vysen-usage-retention] eventos removidos", r.removed);
      }
    })
    .catch((err) => {
      console.error("[vysen-usage-retention] failed", err);
    });
}, 24 * 60 * 60 * 1000);

setTimeout(() => {
  cleanupVysenUsageEvents().catch((err) => {
    console.error("[vysen-usage-retention] initial run failed", err);
  });
}, 180_000);

const delayedSchedulerInterval = setInterval(() => {
  tickDelayedScheduler().catch((err) => console.error("[delayed-scheduler] failed", err));
}, DELAYED_SCHEDULER_INTERVAL_MS);

const reaperInterval = setInterval(() => {
  tickReaper().catch((err) => console.error("[reaper] failed", err));
}, REAPER_INTERVAL_MS);

// === Connect & shutdown ===

redis.on("connect", () => {
  console.log(
    `Worker [${WORKER_INSTANCE_ID}]: Redis conectado; heartbeat, schedulers e filas typebot/evolution/uazapi/chatwoot/whatsapp-cloud/google-ads/meta-ads/clarity/ai/followup ativos.`
  );
  logRlsRolloutStatus();
  startLoop("typebot", runTypebotConsumer);
  startLoop("evolution", runEvolutionConsumer);
  startLoop("uazapi", runUazapiConsumer);
  startLoop("chatwoot", runChatwootConsumer);
  startLoop("whatsapp-cloud", runWhatsappCloudConsumer);
  startLoop("google-ads", runGoogleAdsSyncConsumer);
  startLoop("meta-ads", runMetaAdsSyncConsumer);
  startLoop("clarity", runClaritySyncConsumer);
  startLoop("ai-classification", runAiClassificationConsumer);
  startLoop("followup", runDueFollowupsConsumer);
});

redis.on("error", (err) => {
  console.error("Worker: Redis error", err);
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} recebido — drenando jobs ativos (max ${SHUTDOWN_DRAIN_TIMEOUT_MS}ms)`);

  clearInterval(heartbeatInterval);
  clearInterval(authCleanupInterval);
  clearInterval(webhookRetentionInterval);
  clearInterval(vysenUsageRetentionInterval);
  clearInterval(delayedSchedulerInterval);
  clearInterval(reaperInterval);

  const start = Date.now();
  while (activeJobs.size > 0 && Date.now() - start < SHUTDOWN_DRAIN_TIMEOUT_MS) {
    await Promise.race([
      Promise.allSettled(Array.from(activeJobs)),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }

  if (activeJobs.size > 0) {
    console.warn(
      `[worker] ${activeJobs.size} jobs ainda ativos após drain — items ficarão na processing list e serão recuperados pelo reaper na próxima inicialização`
    );
  } else {
    console.log("[worker] drain completo");
  }

  try {
    await Promise.allSettled([redis.quit(), heartbeatRedis.quit()]);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((err) => {
    console.error("[worker] shutdown failed", err);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((err) => {
    console.error("[worker] shutdown failed", err);
    process.exit(1);
  });
});
