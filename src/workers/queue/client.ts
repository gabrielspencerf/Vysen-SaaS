/**
 * Cliente de fila Redis: publicar job (LPUSH) e consumir (BRPOP).
 * Worker usa BRPOP para processar jobs; app usa LPUSH ao ingerir webhook.
 * Ver docs/BASE2_ETAPA1.md.
 */

import type { JobPayload } from "./types";
import {
  QUEUE_RAW_TYPEBOT,
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_UAZAPI,
  QUEUE_SYNC_GOOGLE_ADS,
  DLQ_RAW_TYPEBOT,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_UAZAPI,
  DLQ_SYNC_GOOGLE_ADS,
} from "./types";

export {
  QUEUE_RAW_TYPEBOT,
  QUEUE_RAW_EVOLUTION,
  QUEUE_RAW_UAZAPI,
  QUEUE_SYNC_GOOGLE_ADS,
  DLQ_RAW_TYPEBOT,
  DLQ_RAW_EVOLUTION,
  DLQ_RAW_UAZAPI,
  DLQ_SYNC_GOOGLE_ADS,
};

function getQueueName(job: JobPayload): string {
  switch (job.type) {
    case "process_typebot_raw":
      return QUEUE_RAW_TYPEBOT;
    case "process_evolution_raw":
      return QUEUE_RAW_EVOLUTION;
    case "process_uazapi_raw":
      return QUEUE_RAW_UAZAPI;
    case "sync_google_ads_account":
      return QUEUE_SYNC_GOOGLE_ADS;
    default:
      throw new Error("Unknown job type");
  }
}

/**
 * Publicar job na fila. Requer cliente Redis (ex.: do worker ou criado na app).
 */
export async function enqueue(
  redis: { lpush: (key: string, ...args: string[]) => Promise<number> },
  job: JobPayload
): Promise<void> {
  const queue = getQueueName(job);
  const payload = JSON.stringify(job);
  await redis.lpush(queue, payload);
}

/**
 * Consumir um job da fila (bloqueante). Retorna o job parseado ou null se timeout.
 * keys: [queueName]; timeout em segundos.
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
