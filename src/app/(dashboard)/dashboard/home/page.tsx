import Link from "next/link";
import { Users, MessageSquare, BarChart3, TrendingUp, MousePointerClick } from "lucide-react";
import {
  getDashboardTenantContext,
  getAnalyticsSummaryForTenant,
} from "@/server/dashboard";
import { PageSection, StatsRow } from "@/components/layout";
import { LeadsChart, AdsSpendChart } from "@/components/dashboard-charts";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const periodParam = params.period ?? "30";
  const periodDays =
    PERIOD_OPTIONS.some((p) => p.value === periodParam)
      ? parseInt(periodParam, 10)
      : 30;

  const summary = await getAnalyticsSummaryForTenant(tenantId, {
    periodDays,
  });

  const { adsPeriodTotals, topCampaignsBySpend } = summary;

  const statsItems = [
    {
      value: formatNumber(summary.totalLeads),
      label: "Leads",
      icon: Users,
      iconClassName: "text-brand-neon",
    },
    {
      value: formatNumber(summary.totalConversations),
      label: "Conversas",
      icon: MessageSquare,
      iconClassName: "text-brand-neon",
    },
    {
      value: formatNumber(summary.totalGoogleAdsAccounts),
      label: "Contas Google Ads",
      icon: BarChart3,
      iconClassName: "text-brand-neon",
    },
  ];

  return (
    <>
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <span className="section-eyebrow">visão executiva</span>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-brand-text sm:mb-2">
              Início
            </h1>
            <p className="max-w-md text-sm text-brand-muted">
              Visão geral e analítica do tenant. Leads, conversas e aquisição
              (Google Ads).
            </p>
          </div>
          <StatsRow items={statsItems} className="sm:mt-0 mt-6" />
        </div>

        {/* Gráficos principais */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2 mb-8">
          <div className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover-lift">
            <span className="section-eyebrow mb-2">captação</span>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-brand-neon" />
              <h2 className="text-base font-medium text-brand-text">Captura de Leads</h2>
            </div>
            <p className="text-sm text-brand-muted">Evolução de novos leads na última semana</p>
            <LeadsChart data={summary.leadsByDay} />
          </div>
          <div className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover-lift">
            <span className="section-eyebrow mb-2">investimento</span>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-brand-neon" />
              <h2 className="text-base font-medium text-brand-text">Gasto em Ads</h2>
            </div>
            <p className="text-sm text-brand-muted">Evolução do investimento nas últimas 4 semanas</p>
            <AdsSpendChart data={summary.adsSpendByWeek} />
          </div>
        </div>

        {/* Filtro de período (afeta apenas métricas Ads) */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-brand-muted">Período para métricas Ads:</span>
          <nav className="flex flex-wrap gap-1" aria-label="Período para métricas Ads">
            {PERIOD_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={
                  opt.value === "30"
                    ? "/dashboard/home"
                    : `/dashboard/home?period=${opt.value}`
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  periodDays === parseInt(opt.value, 10)
                    ? "nav-active-neon"
                    : "bg-brand-surface text-brand-muted hover:bg-brand-border hover:text-brand-text border border-brand-border"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Cards: totais operacionais */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/leads"
            className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm transition hover:border-brand-neon/50 hover:shadow"
          >
            <div className="text-2xl font-semibold text-brand-text mb-1">
              {formatNumber(summary.totalLeads)}
            </div>
            <div className="text-sm font-medium text-brand-muted">Leads Gerados</div>
          </Link>
          <Link
            href="/dashboard/conversations"
            className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm transition hover:border-brand-neon/50 hover:shadow-md"
          >
            <div className="text-2xl font-semibold text-brand-text mb-1">
              {formatNumber(summary.totalConversations)}
            </div>
            <div className="text-sm font-medium text-brand-muted">Conversas Ativas</div>
          </Link>
          <Link
            href="/dashboard/google-ads"
            className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm transition hover:border-brand-neon/50 hover:shadow-md"
          >
            <div className="text-2xl font-semibold text-brand-text mb-1">
              {formatNumber(summary.totalGoogleAdsAccounts)}
            </div>
            <div className="text-sm font-medium text-brand-muted">Contas Ads Conectadas</div>
          </Link>
        </div>

        {/* Cards: métricas Ads no período */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
            <div className="text-xl font-bold text-brand-neon mb-1">
              {formatCurrency(adsPeriodTotals.spend)}
            </div>
            <div className="text-sm font-medium text-brand-muted">
              Gasto (últimos {summary.periodDays} dias)
            </div>
          </div>
          <div className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
            <div className="text-xl font-bold text-brand-neon mb-1">
              {formatNumber(adsPeriodTotals.clicks)}
            </div>
            <div className="text-sm font-medium text-brand-muted">
              Cliques (últimos {summary.periodDays} dias)
            </div>
          </div>
          <div className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm">
            <div className="text-xl font-bold text-brand-neon mb-1">
              {formatNumber(adsPeriodTotals.impressions)}
            </div>
            <div className="text-sm font-medium text-brand-muted">
              Impressões (últimos {summary.periodDays} dias)
            </div>
          </div>
        </div>
      </PageSection>

      {/* Tabelas: top campanhas, leads recentes, conversas recentes */}
      <div className="mt-8 px-1 pb-4 sm:px-2">
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-sm font-medium text-brand-muted">
              Campanhas com maior gasto (últimos {summary.periodDays} dias)
              </h2>
              <Link
                href="/dashboard/google-ads"
                className="shrink-0 text-sm font-medium text-brand-neon hover:text-brand-neon-hover"
              >
                Ver Google Ads
              </Link>
            </div>
            {topCampaignsBySpend.length === 0 ? (
              <p className="text-sm text-brand-muted">
                Nenhum dado de campanha no período. Conecte contas e sincronize.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-left">
                      <th className="py-2 pr-2 font-medium text-brand-muted">Campanha</th>
                      <th className="py-2 pr-2 font-medium text-brand-muted">Conta</th>
                      <th className="py-2 pr-2 font-medium text-brand-muted">Gasto</th>
                      <th className="py-2 pr-2 font-medium text-brand-muted">Cliques</th>
                      <th className="py-2 font-medium text-brand-muted">Impr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaignsBySpend.map((c, i) => (
                      <tr
                        key={`${c.accountExternalId}-${c.externalCampaignId}-${i}`}
                        className="border-b border-brand-border hover:bg-brand-surface/50"
                      >
                        <td className="max-w-[180px] truncate py-2 pr-2 text-brand-text">
                          {c.campaignName}
                        </td>
                        <td className="py-2 pr-2 font-mono text-brand-muted">
                          {c.accountExternalId}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-brand-neon">
                          {formatCurrency(c.spend)}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-brand-muted">
                          {formatNumber(c.clicks)}
                        </td>
                        <td className="py-2 tabular-nums text-brand-muted">
                          {formatNumber(c.impressions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel-lux rounded-xl border border-brand-border bg-brand-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-sm font-medium text-brand-muted">Últimos leads</h2>
              <Link
                href="/dashboard/leads"
                className="shrink-0 text-sm font-medium text-brand-neon hover:text-brand-neon-hover"
              >
                Ver todos
              </Link>
            </div>
            {summary.recentLeads.length === 0 ? (
              <p className="text-sm text-brand-muted">Nenhum lead ainda.</p>
            ) : (
              <ul className="space-y-2">
                {summary.recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="block rounded py-1.5 text-sm text-brand-text hover:bg-brand-surface hover:underline"
                    >
                      <span className="font-medium">
                        {lead.name ?? lead.email ?? lead.phone ?? lead.id}
                      </span>
                      <span className="ml-2 text-brand-muted">
                        {formatDate(lead.lastSeenAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="panel-lux mt-6 rounded-xl border border-brand-border bg-brand-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-sm font-medium text-brand-muted">Últimas conversas</h2>
            <Link
              href="/dashboard/conversations"
              className="shrink-0 text-sm font-medium text-brand-neon hover:text-brand-neon-hover"
            >
              Ver todas
            </Link>
          </div>
          {summary.recentConversations.length === 0 ? (
            <p className="text-sm text-brand-muted">Nenhuma conversa ainda.</p>
          ) : (
            <ul className="space-y-2">
              {summary.recentConversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/conversations/${c.id}`}
                    className="block rounded py-1.5 text-sm text-brand-text hover:bg-brand-surface hover:underline"
                  >
                    <span className="font-mono font-medium">{c.externalId}</span>
                    <span className="ml-2 text-brand-muted">
                      {c.instanceDisplay} · {c.messageCount} msgs
                    </span>
                    <span className="ml-2 text-brand-muted">
                      {c.lastSyncedAt
                        ? formatDate(c.lastSyncedAt)
                        : formatDate(c.startedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
