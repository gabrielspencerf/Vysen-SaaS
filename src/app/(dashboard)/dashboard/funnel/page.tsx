import Link from "next/link";
import { Filter } from "lucide-react";
import {
  getDashboardTenantContext,
  getFunnelOverviewForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";

const PERIOD_OPTIONS = [
  { value: "", label: "Todos os leads" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatPercent(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(n) + "%";
}

export default async function DashboardFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const periodParam = params.period ?? "";
  const periodDays =
    periodParam === ""
      ? undefined
      : PERIOD_OPTIONS.some((p) => p.value === periodParam)
        ? parseInt(periodParam, 10)
        : undefined;

  const overview = await getFunnelOverviewForTenant(tenantId, {
    periodDays,
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <span className="section-eyebrow">análise de pipeline</span>
      <h1 className="text-2xl font-bold text-brand-text">Funil</h1>
      <p className="mt-2 text-brand-muted">
        Volume por etapa, conversão e progressão. Destaque para o possível
        gargalo entre etapas.
      </p>

      {/* Filtro de período: leads com first_seen_at no período */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-brand-muted">Período (primeiro contato):</span>
        <nav className="flex flex-wrap gap-1" aria-label="Filtrar por período">
          {PERIOD_OPTIONS.map((opt) => (
            <Link
              key={opt.value || "all"}
              href={
                opt.value === ""
                  ? "/dashboard/funnel"
                  : `/dashboard/funnel?period=${opt.value}`
              }
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                (periodParam || "") === opt.value
                  ? "nav-active-neon border-transparent"
                  : "border-brand-border bg-brand-surface/50 text-brand-muted hover:bg-brand-surface hover:text-brand-text"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </nav>
        {periodDays != null && (
          <span className="text-brand-muted">
            (leads com primeiro contato nos últimos {periodDays} dias)
          </span>
        )}
      </div>

      {overview.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhum funil configurado para este tenant"
            description="Funis e etapas são configurados no banco ou via integrações (ex.: Typebot com variáveis de etapa). Quando houver funil ativo e leads associados, a progressão aparecerá aqui."
            icon={<Filter className="h-6 w-6" />}
            action={
              <Link
                href="/dashboard/leads"
                className="inline-flex items-center rounded-lg border border-brand-border bg-transparent px-4 py-2 text-xs font-medium uppercase tracking-wider text-brand-text transition-colors hover:bg-brand-surface"
              >
                ← Voltar para Leads
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {overview.map((row) => (
            <section
              key={row.funnelId}
              className="panel-lux rounded-2xl border border-brand-border bg-brand-surface/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium text-brand-text">
                    {row.funnelName}
                  </h2>
                  <span className="dashboard-chip">
                    {row.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <span className="dashboard-chip">
                  Total: {formatNumber(row.totalLeads)} leads
                </span>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {row.steps.map((step, idx) => {
                  const isBottleneck =
                    row.bottleneckFromStepIndex !== null &&
                    idx === row.bottleneckFromStepIndex + 1;
                  return (
                    <div
                      key={step.stepId}
                      className={`panel-mini flex min-w-[7rem] flex-col rounded-lg border px-3 py-2 ${
                        isBottleneck
                          ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30"
                          : "border-brand-border bg-brand-surface/30"
                      }`}
                    >
                      {isBottleneck && (
                        <span className="mb-0.5 text-xs font-medium text-amber-600">
                          Possível gargalo
                        </span>
                      )}
                      <span className="text-xs font-medium text-brand-muted">
                        {step.stepName}
                      </span>
                      <span className="text-lg font-semibold text-brand-text">
                        {formatNumber(step.leadCount)}
                      </span>
                      {step.conversionFromPrevious != null && (
                        <span className="text-xs text-brand-muted">
                          {formatPercent(step.conversionFromPrevious)} da anterior
                        </span>
                      )}
                      {row.totalLeads > 0 && (
                        <span className="text-xs text-brand-muted">
                          {formatPercent(step.percentOfTotal)} do total
                        </span>
                      )}
                    </div>
                  );
                })}
                {row.unassignedCount > 0 && (
                  <div className="panel-mini flex min-w-[7rem] flex-col rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
                    <span className="text-xs font-medium text-amber-600">
                      Sem etapa
                    </span>
                    <span className="text-lg font-semibold text-brand-text">
                      {formatNumber(row.unassignedCount)}
                    </span>
                    {row.totalLeads > 0 && (
                      <span className="text-xs text-brand-muted">
                        {formatPercent(row.unassignedPercentOfTotal)} do total
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/dashboard/leads"
          className="text-sm text-brand-muted hover:text-brand-neon transition-colors"
        >
          ← Voltar para Leads
        </Link>
      </div>
    </PageSection>
  );
}
