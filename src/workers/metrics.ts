/**
 * Contadores leves do worker via Redis. Substituto simples de Prometheus
 * exporter — sem `prom-client`, sem porta HTTP extra no worker.
 *
 * Cada evento incrementa um contador no Redis (INCR). O admin observability
 * page consome via `getWorkerMetricsSnapshot()` e mostra valores acumulados.
 * Reset opcional via `resetWorkerMetrics()` (admin only, futuro).
 *
 * Para Prometheus de verdade, no futuro: criar um endpoint `/api/metrics` no
 * app que renderiza os contadores no formato text/plain do Prometheus a
 * partir dessas mesmas keys Redis.
 */
import { getSharedRedis } from "@/server/redis";

export type WorkerMetricEvent =
  | "processed"
  | "failed"
  | "retried"
  | "sent_to_dlq"
  | "reaper_revived";

function metricKey(queueName: string, event: WorkerMetricEvent): string {
  return `worker:metrics:${queueName}:${event}`;
}

/** Incrementa o contador (event, queueName). Fire-and-forget — não bloqueia. */
export function recordWorkerMetric(event: WorkerMetricEvent, queueName: string): void {
  try {
    const redis = getSharedRedis();
    redis.incr(metricKey(queueName, event)).catch(() => {
      // Métricas não devem falhar o caller. Erros são engolidos.
    });
  } catch {
    // getSharedRedis pode lançar se REDIS_URL ausente — ignora.
  }
}

export interface WorkerMetricsByQueue {
  processed: number;
  failed: number;
  retried: number;
  sent_to_dlq: number;
  reaper_revived: number;
}

export interface WorkerMetricsSnapshot {
  generatedAt: string;
  byQueue: Record<string, WorkerMetricsByQueue>;
  totals: WorkerMetricsByQueue;
}

const EVENTS: WorkerMetricEvent[] = [
  "processed",
  "failed",
  "retried",
  "sent_to_dlq",
  "reaper_revived",
];

/**
 * Lê os contadores acumulados desde o último reset. Usado pelo admin
 * observability page.
 */
export async function getWorkerMetricsSnapshot(
  queueNames: readonly string[]
): Promise<WorkerMetricsSnapshot> {
  const totals: WorkerMetricsByQueue = {
    processed: 0,
    failed: 0,
    retried: 0,
    sent_to_dlq: 0,
    reaper_revived: 0,
  };
  const byQueue: Record<string, WorkerMetricsByQueue> = {};

  try {
    const redis = getSharedRedis();
    for (const queueName of queueNames) {
      const values = await Promise.all(
        EVENTS.map((event) => redis.get(metricKey(queueName, event)))
      );
      const row: WorkerMetricsByQueue = {
        processed: Number(values[0] ?? 0),
        failed: Number(values[1] ?? 0),
        retried: Number(values[2] ?? 0),
        sent_to_dlq: Number(values[3] ?? 0),
        reaper_revived: Number(values[4] ?? 0),
      };
      byQueue[queueName] = row;
      totals.processed += row.processed;
      totals.failed += row.failed;
      totals.retried += row.retried;
      totals.sent_to_dlq += row.sent_to_dlq;
      totals.reaper_revived += row.reaper_revived;
    }
  } catch {
    // Redis indisponível — retorna zeros.
  }

  return {
    generatedAt: new Date().toISOString(),
    byQueue,
    totals,
  };
}
