/**
 * Cliente de fila Redis: publicar job, consumir com visibility lock, retry persistente.
 *
 * Arquitetura (sem BullMQ):
 * - LIST `queue:X`              — fila principal (LPUSH na cauda esquerda)
 * - LIST `queue:X:processing`   — itens em processamento (BRPOPLPUSH atomico)
 * - ZSET `queue:X:processing:tracker` — score = enqueuedAtMs por payload (para reaper)
 * - ZSET `queue:X:delayed`      — score = runAtMs por payload (retries agendados)
 *
 * Worker chama `dequeueWithLock` (move da main pra processing list) e depois `ackJob`
 * (LREM da processing + ZREM do tracker). Em SIGTERM ou crash, items presos no processing
 * list são re-enfileirados pelo reaper periódico.
 */

import type { JobPayload } from "./types";
import {
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
} from "./types";

export {
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
};

export const ALL_QUEUE_NAMES = [
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
] as const;

export function processingKey(queueName: string): string {
  return `${queueName}:processing`;
}
export function processingTrackerKey(queueName: string): string {
  return `${queueName}:processing:tracker`;
}
export function delayedKey(queueName: string): string {
  return `${queueName}:delayed`;
}

function getQueueName(job: JobPayload): string {
  switch (job.type) {
    case "process_typebot_raw":
      return QUEUE_RAW_TYPEBOT;
    case "process_evolution_raw":
      return QUEUE_RAW_EVOLUTION;
    case "process_uazapi_raw":
      return QUEUE_RAW_UAZAPI;
    case "process_chatwoot_raw":
      return QUEUE_RAW_CHATWOOT;
    case "process_whatsapp_cloud_raw":
      return QUEUE_RAW_WHATSAPP_CLOUD;
    case "sync_google_ads_account":
      return QUEUE_SYNC_GOOGLE_ADS;
    case "sync_meta_ads_account":
      return QUEUE_SYNC_META_ADS;
    case "sync_clarity_connection":
      return QUEUE_SYNC_CLARITY;
    case "classify_conversation":
      return QUEUE_AI_CLASSIFICATION;
    case "process_due_followups_tenant":
      return QUEUE_FOLLOWUP_DUE_TENANT;
    default:
      throw new Error("Unknown job type");
  }
}

// Tipos mínimos da API ioredis que usamos. Mantém o cliente desacoplado da implementação.
export interface QueueRedisClient {
  lpush(key: string, ...args: string[]): Promise<number>;
  brpoplpush(source: string, destination: string, timeout: number): Promise<string | null>;
  lrem(key: string, count: number, value: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  zadd(key: string, score: number, member: string): Promise<number | string>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  llen(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    mode: "EX",
    seconds: number,
    nx: "NX"
  ): Promise<"OK" | null>;
}

/**
 * Publicar job na fila (LPUSH). Worker consome via `dequeueWithLock`.
 */
export async function enqueue(
  redis: QueueRedisClient,
  job: JobPayload
): Promise<void> {
  const queue = getQueueName(job);
  const payload = JSON.stringify(job);
  await redis.lpush(queue, payload);
}

/**
 * Enfileira apenas se não houver outro job com a mesma `dedupKey` em vôo.
 *
 * Usado para syncs que NÃO devem rodar duas vezes em paralelo para o mesmo recurso
 * (ex.: `sync_google_ads_account:<accountId>` — uma corrida dispara duas chamadas
 * pra API Google ao mesmo tempo, queimando quota). TTL padrão 300s cobre o sync
 * típico; um job real ainda em curso após esse tempo prefere ser enfileirado de
 * novo do que ficar bloqueado indefinidamente.
 *
 * Retorna `{ enqueued: true }` se enfileirou, ou `{ enqueued: false }` se a key
 * dedup já existia (sync já em vôo).
 */
export async function enqueueWithDedup(
  redis: QueueRedisClient,
  job: JobPayload,
  opts: { dedupKey: string; dedupTtlSec?: number }
): Promise<{ enqueued: boolean }> {
  const ttl = opts.dedupTtlSec ?? 300;
  const fullKey = `dedup:enqueue:${opts.dedupKey}`;
  const reserved = await redis.set(fullKey, "1", "EX", ttl, "NX");
  if (reserved === null) {
    return { enqueued: false };
  }
  await enqueue(redis, job);
  return { enqueued: true };
}

/**
 * Re-enfileira payload já serializado (usado pelo reaper para items presos).
 */
export async function enqueueRaw(
  redis: QueueRedisClient,
  queueName: string,
  payload: string
): Promise<void> {
  await redis.lpush(queueName, payload);
}

export interface DequeueLockResult {
  job: JobPayload;
  /** String exata armazenada em Redis — usar em `ackJob` para LREM. */
  payload: string;
}

/**
 * Consome com lock: BRPOPLPUSH move atomicamente da fila principal para a processing list.
 * Job NÃO some do Redis até `ackJob`; se o worker crashar, o reaper recupera.
 *
 * Retorna null se timeout (sem job na fila) ou payload corrompido (descartado e logado).
 */
export async function dequeueWithLock(
  redis: QueueRedisClient,
  queueName: string,
  timeoutSeconds: number = 5
): Promise<DequeueLockResult | null> {
  const payload = await redis.brpoplpush(queueName, processingKey(queueName), timeoutSeconds);
  if (!payload) return null;

  let job: JobPayload;
  try {
    job = JSON.parse(payload) as JobPayload;
  } catch (err) {
    // Payload corrompido — remover do processing list e logar (não há como reprocessar).
    console.error("[queue] payload JSON inválido descartado", {
      queueName,
      preview: payload.slice(0, 120),
      err: err instanceof Error ? err.message : String(err),
    });
    await redis.lrem(processingKey(queueName), 1, payload).catch(() => {});
    return null;
  }

  // Tracker do timestamp de entrada na processing list — usado pelo reaper.
  await redis
    .zadd(processingTrackerKey(queueName), Date.now(), payload)
    .catch((err) => {
      console.error("[queue] tracker zadd failed", { queueName, err });
    });

  return { job, payload };
}

/**
 * ACK: remove o job da processing list e do tracker. Chamar após sucesso OU
 * decisão final (DLQ / retry agendado).
 */
export async function ackJob(
  redis: QueueRedisClient,
  queueName: string,
  payload: string
): Promise<void> {
  await Promise.allSettled([
    redis.lrem(processingKey(queueName), 1, payload),
    redis.zrem(processingTrackerKey(queueName), payload),
  ]);
}

/**
 * Agenda retry persistente: ZADD em queue:X:delayed. Quando o scheduler observar
 * score <= now, promove o item para a fila principal.
 *
 * Persistente: sobrevive a SIGTERM / crash do worker — diferente do antigo setTimeout.
 */
export async function enqueueDelayed(
  redis: QueueRedisClient,
  job: JobPayload,
  runAtMs: number
): Promise<void> {
  const queueName = getQueueName(job);
  const payload = JSON.stringify(job);
  await redis.zadd(delayedKey(queueName), runAtMs, payload);
}

/**
 * Move jobs agendados que já venceram para a fila principal.
 * Retorna o total promovido (para métricas / logs).
 */
export async function promoteDueDelayedJobs(
  redis: QueueRedisClient,
  queueName: string,
  nowMs: number = Date.now()
): Promise<number> {
  const due = await redis.zrangebyscore(delayedKey(queueName), 0, nowMs);
  if (due.length === 0) return 0;
  let moved = 0;
  for (const payload of due) {
    // ZREM idempotente — se outro tick já moveu, removed=0 e pulamos.
    const removed = await redis.zrem(delayedKey(queueName), payload);
    if (removed === 0) continue;
    await redis.lpush(queueName, payload);
    moved += 1;
  }
  return moved;
}

/**
 * Reaper: jobs que estão na processing list há mais de `staleAfterMs` voltam para
 * a fila principal. Cobre crashes / SIGKILL onde `ackJob` nunca foi chamado.
 *
 * Retorna o número de jobs ressuscitados.
 */
export async function reapStaleProcessing(
  redis: QueueRedisClient,
  queueName: string,
  staleAfterMs: number,
  nowMs: number = Date.now()
): Promise<number> {
  const threshold = nowMs - staleAfterMs;
  const stale = await redis.zrangebyscore(processingTrackerKey(queueName), 0, threshold);
  if (stale.length === 0) return 0;
  let revived = 0;
  for (const payload of stale) {
    const removedFromProcessing = await redis.lrem(processingKey(queueName), 1, payload);
    await redis.zrem(processingTrackerKey(queueName), payload);
    if (removedFromProcessing > 0) {
      await redis.lpush(queueName, payload);
      revived += 1;
    }
    // Se removed=0, outro worker já tinha feito ack (ZREM ainda assim limpa lixo).
  }
  return revived;
}

/**
 * @deprecated Use `dequeueWithLock`. Mantido apenas para compatibilidade com chamadas
 * fora do runner (testes, scripts). NOTA: BRPOP remove o item imediatamente —
 * sem visibility timeout, perde job em crash mid-process.
 */
export async function dequeue(
  redis: { brpop: (key: string, timeout: number) => Promise<[string, string] | null> },
  queueName: string,
  timeoutSeconds: number = 5
): Promise<JobPayload | null> {
  const result = await redis.brpop(queueName, timeoutSeconds);
  if (!result) return null;
  const [, payload] = result;
  return JSON.parse(payload) as JobPayload;
}
