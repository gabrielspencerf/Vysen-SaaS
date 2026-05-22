/**
 * GET /api/metrics — exporta contadores do worker em formato Prometheus
 * text/plain (versão 0.0.4).
 *
 * Autenticação: header `Authorization: Bearer <HEALTH_DETAILS_TOKEN>` (mesmo
 * token de `/api/health/details`). Sem o token configurado, retorna 404 —
 * evita expor métricas acidentalmente em ambientes mal configurados.
 *
 * Métricas exportadas (Counter):
 * - vysen_worker_jobs_processed_total{queue}
 * - vysen_worker_jobs_failed_total{queue}
 * - vysen_worker_jobs_retried_total{queue}
 * - vysen_worker_jobs_sent_to_dlq_total{queue}
 * - vysen_worker_reaper_revived_total{queue}
 *
 * Configure no Prometheus scrape_config:
 *   - job_name: vysen
 *     bearer_token: <HEALTH_DETAILS_TOKEN>
 *     metrics_path: /api/metrics
 *     static_configs:
 *       - targets: ['app.vysen.com.br']
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getWorkerMetricsSnapshot } from "@/workers/metrics";
import { ALL_QUEUE_NAMES } from "@/workers/queue";

export const dynamic = "force-dynamic";

function checkAuth(request: NextRequest): boolean {
  const expected = process.env.HEALTH_DETAILS_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1].trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

interface MetricSeries {
  name: string;
  help: string;
  samples: Array<{ queue: string; value: number }>;
}

function renderPrometheus(series: MetricSeries[]): string {
  const lines: string[] = [];
  for (const s of series) {
    lines.push(`# HELP ${s.name} ${s.help}`);
    lines.push(`# TYPE ${s.name} counter`);
    for (const sample of s.samples) {
      lines.push(`${s.name}{queue="${escapeLabel(sample.queue)}"} ${sample.value}`);
    }
  }
  // Convenção: arquivo termina com newline.
  return lines.join("\n") + "\n";
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const snapshot = await getWorkerMetricsSnapshot(ALL_QUEUE_NAMES);
  const queues = Object.keys(snapshot.byQueue);

  const series: MetricSeries[] = [
    {
      name: "vysen_worker_jobs_processed_total",
      help: "Jobs processados com sucesso por fila.",
      samples: queues.map((q) => ({ queue: q, value: snapshot.byQueue[q]!.processed })),
    },
    {
      name: "vysen_worker_jobs_failed_total",
      help: "Jobs que falharam (somando todas as tentativas).",
      samples: queues.map((q) => ({ queue: q, value: snapshot.byQueue[q]!.failed })),
    },
    {
      name: "vysen_worker_jobs_retried_total",
      help: "Jobs re-enfileirados para tentativa subsequente.",
      samples: queues.map((q) => ({ queue: q, value: snapshot.byQueue[q]!.retried })),
    },
    {
      name: "vysen_worker_jobs_sent_to_dlq_total",
      help: "Jobs enviados ao Dead Letter Queue (maxAttempts excedido).",
      samples: queues.map((q) => ({ queue: q, value: snapshot.byQueue[q]!.sent_to_dlq })),
    },
    {
      name: "vysen_worker_reaper_revived_total",
      help: "Jobs presos na processing list re-enfileirados pelo reaper.",
      samples: queues.map((q) => ({ queue: q, value: snapshot.byQueue[q]!.reaper_revived })),
    },
  ];

  return new NextResponse(renderPrometheus(series), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
