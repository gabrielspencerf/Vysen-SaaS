import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPageHeader, PageSection } from "@/components/layout";
import { Badge, Card, CardContent } from "@/components/ui";
import {
  WORKER_PIPELINE_GROUPS,
  getWorkerPipelineSnapshot,
  metricForPipeline,
  pendingCountForMetricKey,
  queueDepthForMetricKey,
  type PipelineStepDef,
  type WorkerPipelineDef,
} from "@/server/admin/worker-pipeline";
import { RelationalArchitectureDiagram } from "@/components/admin/relational-architecture-diagram";
import {
  ArrowDown,
  ArrowRight,
  Cable,
  CheckCircle2,
  Clock3,
  Database,
  ListTree,
  Radio,
  Server,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Worker e fluxo de dados",
  description: "Mapa relacional, filas Redis, workers e tabelas do Postgres.",
};

function stepIcon(kind: PipelineStepDef["kind"]) {
  switch (kind) {
    case "ingress":
      return Radio;
    case "table":
      return Database;
    case "queue":
      return Cable;
    case "worker":
      return Server;
    default:
      return Database;
  }
}

function stepRingClass(kind: PipelineStepDef["kind"]): string {
  switch (kind) {
    case "ingress":
      return "border-cyan-500/35 bg-cyan-500/10";
    case "table":
      return "border-violet-500/35 bg-violet-500/10";
    case "queue":
      return "border-amber-500/35 bg-amber-500/10";
    case "worker":
      return "border-emerald-500/35 bg-emerald-500/10";
    default:
      return "border-brand-border bg-brand-surface/80";
  }
}

function PipelineCard({
  pipeline,
  snapshot,
}: {
  pipeline: WorkerPipelineDef;
  snapshot: Awaited<ReturnType<typeof getWorkerPipelineSnapshot>>;
}) {
  const { q, dlq } = metricForPipeline(pipeline.id, snapshot.queueDepths);

  return (
    <Card className="h-full border-brand-border bg-brand-surface">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-brand-text">{pipeline.label}</h3>
            <p className="mt-1 text-sm text-brand-muted">{pipeline.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="font-mono text-[10px]">
              job: {pipeline.jobType}
            </Badge>
            <Badge variant={q > 0 ? "warning" : "default"} className="text-xs">
              Fila: {q}
            </Badge>
            <Badge variant={dlq > 0 ? "error" : "success"} className="text-xs">
              DLQ: {dlq}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-brand-muted">
          Processador: <span className="font-mono text-brand-text/90">{pipeline.processorFile}</span>
        </p>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-stretch">
          {pipeline.steps.map((step, idx) => {
            const Icon = stepIcon(step.kind);
            const pending =
              step.metricKey ?
                pendingCountForMetricKey(step.metricKey, snapshot.pendingRaw)
              : undefined;
            const qd =
              step.metricKey ?
                queueDepthForMetricKey(step.metricKey, snapshot.queueDepths)
              : undefined;

            return (
              <div key={`${pipeline.id}-${idx}`} className="flex min-w-0 flex-1 items-stretch gap-2 lg:min-w-[200px]">
                <div
                  className={`flex flex-1 flex-col rounded-xl border px-3 py-2.5 ${stepRingClass(step.kind)}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-1 break-words font-mono text-xs leading-snug text-brand-text">{step.detail}</p>
                  {pending !== undefined && pending > 0 ? (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      {pending} pendente(s) na tabela (sem processed_at)
                    </p>
                  ) : null}
                  {qd ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      Redis: {qd.main} aguardando · DLQ {qd.dlq}
                    </p>
                  ) : null}
                </div>
                {idx < pipeline.steps.length - 1 ? (
                  <div className="hidden items-center text-brand-muted lg:flex" aria-hidden>
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                ) : null}
                {idx < pipeline.steps.length - 1 ? (
                  <div className="flex items-center justify-center text-brand-muted lg:hidden" aria-hidden>
                    <ArrowDown className="h-4 w-4 shrink-0 opacity-60" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminWorkerPipelinePage() {
  const snapshot = await getWorkerPipelineSnapshot();

  const workerOk = snapshot.workerStatus === "ok";
  const workerLabel =
    snapshot.workerStatus === "ok" ? "Worker ativo"
    : snapshot.workerStatus === "stale" ? "Heartbeat atrasado"
    : "Worker ausente";

  const generatedShort = new Date(snapshot.generatedAt).toLocaleString("pt-BR");

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mx-auto w-full max-w-7xl">
        <DashboardPageHeader
          title="Worker e fluxo de dados"
          description="Arquitetura assíncrona: Postgres para persistência, Redis para filas e processo worker que consome os jobs. Em desenvolvimento: npm run worker:dev. Métricas instantâneas."
          icon={Cable}
          badges={[
            workerOk ? "Worker OK" : "Verificar worker",
            `Atualizado ${new Date(snapshot.generatedAt).toLocaleTimeString("pt-BR")}`,
          ]}
          actions={
            <Link
              href="/admin/observability"
              className="rounded-xl text-sm font-medium text-brand-neon transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
            >
              Observabilidade →
            </Link>
          }
        />
        <nav className="mb-8 mt-6 rounded-2xl border border-brand-border bg-brand-surface/35 p-4" aria-label="Atalhos da página">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-text">
            <ListTree className="h-4 w-4 text-brand-neon" />
            Navegação rápida
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="#mapa-relacional" className="rounded-full border border-brand-border px-3 py-1.5 text-brand-muted hover:text-brand-text">
              Mapa relacional
            </Link>
            <Link href="#metricas-rapidas" className="rounded-full border border-brand-border px-3 py-1.5 text-brand-muted hover:text-brand-text">
              Métricas rápidas
            </Link>
            <Link href="#pipelines-filas" className="rounded-full border border-brand-border px-3 py-1.5 text-brand-muted hover:text-brand-text">
              Pipelines e filas
            </Link>
          </div>
        </nav>

        <section id="mapa-relacional" className="mb-12 scroll-mt-24" aria-labelledby="relational-map-heading">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Arquitetura</p>
          <h2 id="relational-map-heading" className="mt-1 text-lg font-semibold text-brand-text">
            Mapa relacional
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-brand-muted">
            Domínios principais do schema e convergência para o núcleo (worker + Redis + Postgres). Listas
            espelham tabelas reais; linhas tracejadas indicam fluxo de dados e escopo multi-tenant.
          </p>
          <details className="mt-5 rounded-2xl border border-brand-border bg-brand-surface/25 p-3" open>
            <summary className="cursor-pointer text-sm font-medium text-brand-text">
              Exibir/ocultar diagrama relacional
            </summary>
            <div className="mt-3">
              <RelationalArchitectureDiagram
                hubStats={{
                  backlogTotal: snapshot.backlogTotal,
                  dlqTotal: snapshot.dlqTotal,
                  workerOk,
                }}
              />
            </div>
          </details>
        </section>

        <div id="metricas-rapidas" className="scroll-mt-24 border-t border-brand-border pt-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Saúde em tempo real</p>
          <h2 className="mt-1 text-lg font-semibold text-brand-text">Métricas rápidas</h2>
          <p className="mt-1 max-w-3xl text-sm text-brand-muted">
            Mesmo padrão visual da Observabilidade: leitura centralizada por cartão.
          </p>
          <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="h-full border-brand-border bg-brand-surface">
              <CardContent className="flex h-full flex-col items-center p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-brand-muted">
                  {workerOk ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-500" aria-hidden />
                  )}
                  <span>Worker</span>
                </div>
                <p
                  className={`mt-2 text-lg font-semibold ${workerOk ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}
                >
                  {workerLabel}
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  {snapshot.lastHeartbeatAt ?
                    <>
                      Último heartbeat:{" "}
                      {new Date(snapshot.lastHeartbeatAt).toLocaleString("pt-BR")}
                      {snapshot.heartbeatAgeMs !== null ?
                        ` · há ${Math.round(snapshot.heartbeatAgeMs / 1000)}s`
                      : null}
                    </>
                  : "Nenhum heartbeat no Redis."}
                </p>
              </CardContent>
            </Card>
            <Card className="h-full border-brand-border bg-brand-surface">
              <CardContent className="flex h-full flex-col items-center p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-brand-muted">
                  <Database className="h-5 w-5 text-violet-400" aria-hidden />
                  <span>Redis</span>
                </div>
                <p
                  className={`mt-2 text-lg font-semibold ${snapshot.redisOk ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}
                >
                  {snapshot.redisOk ? "Conectado" : "Indisponível"}
                </p>
                <p className="mt-1 text-xs text-brand-muted">Filas e DLQs detalhadas nos pipelines abaixo.</p>
              </CardContent>
            </Card>
            <Card className="h-full border-brand-border bg-brand-surface">
              <CardContent className="flex h-full flex-col items-center p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-brand-muted">
                  <Server className="h-5 w-5 text-cyan-400" aria-hidden />
                  <span>Jobs na fila</span>
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums text-brand-text">{snapshot.backlogTotal}</p>
                <p className="mt-1 text-xs text-brand-muted">Soma de todas as filas de processamento.</p>
              </CardContent>
            </Card>
            <Card className="h-full border-brand-border bg-brand-surface">
              <CardContent className="flex h-full flex-col items-center p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-brand-muted">
                  <Clock3 className="h-5 w-5 text-red-400/90" aria-hidden />
                  <span>Dead letter</span>
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums text-red-600 dark:text-red-300">
                  {snapshot.dlqTotal}
                </p>
                <p className="mt-1 text-xs text-brand-muted">Jobs após tentativas esgotadas — ver logs.</p>
              </CardContent>
            </Card>
          </div>
          <p className="mt-4 text-center text-[11px] text-brand-muted">
            Snapshot: {generatedShort} · Pendentes em staging = eventos sem{" "}
            <span className="font-mono text-brand-text/80">processed_at</span> (worker parado ou fila cheia).
          </p>
        </div>

        <div id="pipelines-filas" className="mt-12 space-y-10 scroll-mt-24 border-t border-brand-border pt-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Detalhe operacional</p>
            <h2 className="mt-1 text-lg font-semibold text-brand-text">Pipelines e filas</h2>
            <p className="mt-1 max-w-3xl text-sm text-brand-muted">
              Cada card mostra o caminho HTTP → tabela → Redis → worker → destino, com profundidade de fila.
            </p>
          </div>
          {WORKER_PIPELINE_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`}>
              <h3 id={`group-${group.id}`} className="text-base font-semibold text-brand-text">
                {group.title}
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-brand-muted">{group.intro}</p>
              <div className="mt-5 space-y-5">
                {group.pipelines.map((p) => (
                  <PipelineCard key={p.id} pipeline={p} snapshot={snapshot} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageSection>
  );
}
