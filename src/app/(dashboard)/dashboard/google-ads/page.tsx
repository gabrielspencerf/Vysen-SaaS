import Link from "next/link";
import { cookies } from "next/headers";
import {
  getDashboardTenantContext,
  listGoogleAdsAccountsForTenant,
  listCampaignSnapshotsForTenant,
  getCampaignAttributionForTenant,
  getLandingPageUrlForTenant,
  listPageSpeedResultsForTenant,
} from "@/server/dashboard";
import { PageSection, ListTableHeader, ListRowCard } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { formatDateTime } from "@/lib/i18n/date";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";
import { AdsSpendChart } from "@/components/dashboard-charts-lazy";
import { env } from "@/config/env";
import { PageSpeedForm } from "../pagespeed/pagespeed-form";
import { PageSpeedResults } from "../pagespeed/pagespeed-results";
import { OfflineGoogleSheetActions } from "./offline-google-sheet-actions";
import { agentDebugLog } from "@/server/debug/agent-debug-log";
import { getCsrfCookieName } from "@/server/security/csrf";

const PAGE_SIZE = 50;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateTime(d);
}

function formatCost(value: number, currencyCode: string | null): string {
  const code =
    currencyCode &&
    typeof currencyCode === "string" &&
    currencyCode.length === 3
      ? currencyCode.toUpperCase()
      : null;
  if (code) {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      // fallback se moeda não suportada
    }
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildSnapshotParams(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number>
): string {
  const p = new URLSearchParams();
  const accountId = overrides.accountId ?? current.accountId;
  const periodFrom = overrides.periodFrom ?? current.periodFrom;
  const periodTo = overrides.periodTo ?? current.periodTo;
  const page = overrides.page ?? current.page;
  if (accountId) p.set("accountId", String(accountId));
  if (periodFrom) p.set("periodFrom", String(periodFrom));
  if (periodTo) p.set("periodTo", String(periodTo));
  if (page && Number(page) > 1) p.set("page", String(page));
  return p.toString() ? `?${p.toString()}` : "";
}

export default async function DashboardGoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sync?: string;
    google_ads?: string;
    google_ads_error?: string;
    google_ads_message?: string;
    accountId?: string;
    periodFrom?: string;
    periodTo?: string;
    page?: string;
    period?: string;
  }>;
}) {
  function extractScore(result: Record<string, unknown>): number | null {
    const cat = result?.categories as Record<string, unknown> | undefined;
    const perf = cat?.performance as Record<string, unknown> | undefined;
    const score = perf?.score;
    if (typeof score === "number") return Math.round(score * 100);
    return null;
  }

  const { tenantId } = await getDashboardTenantContext();
  const csrfToken =
    (await cookies()).get(getCsrfCookieName())?.value ?? "";
  const params = await searchParams;
  const syncStatus = typeof params.sync === "string" ? params.sync : null;
  const connectedStatus =
    typeof params.google_ads === "string" ? params.google_ads : null;
  const errorCode =
    typeof params.google_ads_error === "string"
      ? params.google_ads_error
      : null;
  const errorMessage =
    typeof params.google_ads_message === "string"
      ? params.google_ads_message
      : null;

  const accountId = params.accountId || undefined;
  const periodFrom = params.periodFrom || undefined;
  const periodTo = params.periodTo || undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const ATTRIBUTION_PERIOD_OPTIONS = [7, 30, 90] as const;
  const periodParam = params.period ?? "30";
  const attributionPeriodDays = ATTRIBUTION_PERIOD_OPTIONS.includes(
    Number(periodParam) as (typeof ATTRIBUTION_PERIOD_OPTIONS)[number]
  )
    ? Number(periodParam)
    : 30;

  const [accounts, snapshotResult, attributionResult, landingUrl, pageSpeedResults] = await Promise.all([
    listGoogleAdsAccountsForTenant(tenantId),
    listCampaignSnapshotsForTenant(tenantId, {
      accountId,
      periodFrom,
      periodTo,
      page,
      pageSize: PAGE_SIZE,
    }),
    getCampaignAttributionForTenant(tenantId, {
      periodDays: attributionPeriodDays,
    }),
    getLandingPageUrlForTenant(tenantId),
    listPageSpeedResultsForTenant(tenantId, { limit: 30 }),
  ]);
  const resultsWithScore = pageSpeedResults.map((row) => ({
    ...row,
    score: extractScore(row.result),
  }));

  const attributionRows = attributionResult.campaigns;
  const attributionSummary = attributionResult.summary;

  const { items: snapshots, total: totalSnapshots } = snapshotResult;
  const totalPages = Math.max(1, Math.ceil(totalSnapshots / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  agentDebugLog({
    runId: "dashboard-visual-standardization",
    hypothesisId: "H_CLIENT_STYLE_3",
    location: "src/app/(dashboard)/dashboard/google-ads/page.tsx:DashboardGoogleAdsPage",
    message: "Render do Google Ads com header padronizado",
    data: {
      accounts: accounts.length,
      snapshots: snapshots.length,
      attributionRows: attributionRows.length,
    },
  });
  const filterParams = {
    accountId,
    periodFrom,
    periodTo,
    page: String(page),
  };

  function attributionPeriodUrl(days: number): string {
    const p = new URLSearchParams();
    if (accountId) p.set("accountId", accountId);
    if (periodFrom) p.set("periodFrom", periodFrom);
    if (periodTo) p.set("periodTo", periodTo);
    if (page > 1) p.set("page", String(page));
    if (days !== 30) p.set("period", String(days));
    const q = p.toString();
    return "/dashboard/google-ads" + (q ? "?" + q : "");
  }

  return (
    <div className="space-y-6">
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <DashboardPageHeader
          title="Google Ads"
          description="Contas conectadas e métricas por campanha sincronizadas."
          iconNode={
            <ProviderBrandIcon
              provider="googleAds"
              variant="plain"
              className="brand-icon-monochrome h-4 w-4"
            />
          }
          badges={[`${accounts.length} contas`]}
          actions={
            env.googleAdsConnectEnabled ? (
              <Link href="/api/google-ads/auth/start">
                <Button className="btn-cta-primary text-sm">
                  Conectar nova conta
                </Button>
              </Link>
            ) : (
              <Button
                disabled
                className="btn-cta-primary text-sm opacity-60 cursor-not-allowed"
                title="Autenticação por conta em breve"
              >
                Conectar nova conta (em breve)
              </Button>
            )
          }
        />

        {syncStatus === "enqueued" && (
          <div className="mt-4 rounded bg-brand-neon/10 border border-brand-neon/20 px-4 py-3 text-sm text-brand-neon">
            Sync enfileirado. Os dados serão atualizados em breve.
          </div>
        )}
        {connectedStatus === "connected" && (
          <div className="mt-4 rounded bg-brand-neon/10 border border-brand-neon/20 px-4 py-3 text-sm text-brand-neon">
            Conta conectada com sucesso.
          </div>
        )}
        {errorCode && (
          <div className="mt-4 rounded bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
            {errorMessage || errorCode}
          </div>
        )}
      </PageSection>

      {/* Gráfico principal mock */}
      <PageSection>
        <span className="section-eyebrow mb-2">visão consolidada</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Desempenho Geral
        </h2>
        <AdsSpendChart />
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">integrações</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Contas Conectadas
        </h2>
        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta conectada"
            description="Conecte sua conta do Google Ads para importar métricas e ver a atribuição de leads."
            icon={
              <ProviderBrandIcon
                provider="googleAds"
                variant="plain"
                className="brand-icon-monochrome h-5 w-5"
              />
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-6 gap-4">
                <div>Customer ID</div>
                <div>Label</div>
                <div>Moeda</div>
                <div>Último sync</div>
                <div>Erro</div>
                <div className="text-right">Ação</div>
              </ListTableHeader>
            </div>
            {accounts.map((acc) => (
              <ListRowCard key={acc.id} className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                <div className="font-mono text-brand-text">{acc.externalId}</div>
                <div className="text-brand-muted">{acc.label ?? "—"}</div>
                <div className="text-brand-muted">{acc.currencyCode ?? "—"}</div>
                <div className="text-xs text-brand-muted">{formatDate(acc.lastSyncedAt)}</div>
                <div className="text-xs text-red-500 truncate max-w-[200px]" title={acc.lastSyncError ?? ""}>
                  {acc.lastSyncError ?? "—"}
                </div>
                <div className="lg:text-right">
                  <form action={`/api/google-ads/sync/${acc.id}`} method="POST">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <Button type="submit" variant="secondary" size="sm" className="text-xs border-brand-border text-brand-text hover:text-brand-neon">
                      Sincronizar
                    </Button>
                  </form>
                </div>
              </ListRowCard>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">atribuição</span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-neon mb-1">
              Atribuição Ads → Leads
            </h2>
            <p className="text-xs text-brand-muted max-w-xl">
              Gasto, cliques e impressões e leads atribuídos no período. CPL = gasto ÷ total atribuído.
            </p>
          </div>
          <div className="panel-mini flex items-center gap-2 rounded-lg p-1 text-sm">
            {ATTRIBUTION_PERIOD_OPTIONS.map((days) => (
              <Link
                key={days}
                href={attributionPeriodUrl(days)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  attributionPeriodDays === days
                    ? "nav-active-neon font-medium"
                    : "text-brand-muted hover:text-brand-text"
                }`}
              >
                {days} dias
              </Link>
            ))}
          </div>
        </div>

        {(attributionSummary.totalExactMatch > 0 ||
          attributionSummary.totalNameMatch > 0 ||
          attributionSummary.totalAmbiguous > 0 ||
          attributionSummary.totalUnmatched > 0) && (
          <div className="panel-lux mb-6 grid grid-cols-2 gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 md:grid-cols-4">
            <div className="flex flex-col">
              <span className="text-xs text-brand-muted">Exato (ID)</span>
              <span className="text-lg font-semibold text-brand-text">{attributionSummary.totalExactMatch.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-brand-muted">Por nome</span>
              <span className="text-lg font-semibold text-brand-text">{attributionSummary.totalNameMatch.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-brand-muted">Ambíguos</span>
              <span className="text-lg font-semibold text-brand-text">{attributionSummary.totalAmbiguous.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-brand-muted">Sem match</span>
              <span className="text-lg font-semibold text-brand-text">{attributionSummary.totalUnmatched.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}

        {attributionRows.length === 0 ? (
          <EmptyState
            title="Nenhum dado de atribuição"
            description="Nenhuma campanha com dados no período ou nenhum lead com UTM compatível."
            icon={
              <ProviderBrandIcon
                provider="googleAds"
                variant="plain"
                className="brand-icon-monochrome h-5 w-5"
              />
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden xl:grid">
              <ListTableHeader className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4">
                <div>Campanha</div>
                <div>Conta</div>
                <div title="Match exato por external_campaign_id">Exato</div>
                <div title="Match por nome normalizado">Por nome</div>
                <div>Total</div>
                <div>Gasto</div>
                <div title="Custo por lead (gasto ÷ total atribuído); indicativo">CPL</div>
                <div>Cliques</div>
                <div>Impr.</div>
              </ListTableHeader>
            </div>
            {attributionRows.map((row) => {
              const cpl =
                row.attributedLeadCount > 0
                  ? row.spend / row.attributedLeadCount
                  : null;
              return (
                <ListRowCard key={`${row.googleAdsAccountId}-${row.externalCampaignId}`} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center">
                  <div className="truncate font-medium text-brand-text" title={row.campaignName}>{row.campaignName}</div>
                  <div className="font-mono text-xs text-brand-muted">{row.accountExternalId}</div>
                  <div className="text-brand-muted">{row.exactMatchLeadCount.toLocaleString("pt-BR")}</div>
                  <div className="text-brand-muted">{row.nameMatchLeadCount.toLocaleString("pt-BR")}</div>
                  <div className="font-semibold text-brand-neon">{row.attributedLeadCount.toLocaleString("pt-BR")}</div>
                  <div className="text-brand-text">{formatCost(row.spend, null)}</div>
                  <div className="text-brand-muted">{cpl !== null ? formatCost(cpl, null) : "—"}</div>
                  <div className="text-brand-muted">{row.clicks.toLocaleString("pt-BR")}</div>
                  <div className="text-brand-muted">{row.impressions.toLocaleString("pt-BR")}</div>
                </ListRowCard>
              );
            })}
          </div>
        )}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">exploração</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Métricas por campanha (snapshots)
        </h2>

        <form
          method="GET"
          action="/dashboard/google-ads"
          className="panel-lux mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-brand-border bg-brand-surface p-4"
        >
          <input type="hidden" name="page" value="1" />
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="accountId" className="block text-xs font-medium text-brand-muted mb-1">
              Conta
            </label>
            <select
              id="accountId"
              name="accountId"
              defaultValue={accountId ?? ""}
              className="app-select"
            >
              <option value="">Todas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.externalId}
                  {acc.label ? ` (${acc.label})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[140px]">
            <label htmlFor="periodFrom" className="block text-xs font-medium text-brand-muted mb-1">
              De (data)
            </label>
            <input
              id="periodFrom"
              name="periodFrom"
              type="date"
              defaultValue={periodFrom}
              className="app-date-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="w-[140px]">
            <label htmlFor="periodTo" className="block text-xs font-medium text-brand-muted mb-1">
              Até (data)
            </label>
            <input
              id="periodTo"
              name="periodTo"
              type="date"
              defaultValue={periodTo}
              className="app-date-input w-full px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" className="border-brand-border">
            Filtrar
          </Button>
        </form>

        {snapshots.length === 0 ? (
          <EmptyState
            title="Nenhum snapshot"
            description="Nenhum snapshot para os filtros atuais. Conecte uma conta e execute o sync."
            icon={
              <ProviderBrandIcon
                provider="googleAds"
                variant="plain"
                className="brand-icon-monochrome h-5 w-5"
              />
            }
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-brand-muted mb-4">
              Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalSnapshots)} de{" "}
              {totalSnapshots}.
            </p>
            
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-[1fr_2fr_1.5fr_1fr_1fr_1fr] gap-4">
                <div>Conta</div>
                <div>Campanha</div>
                <div>Período</div>
                <div>Impressões</div>
                <div>Cliques</div>
                <div>Custo</div>
              </ListTableHeader>
            </div>

            {snapshots.map((s) => (
              <ListRowCard key={s.id} className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1.5fr_1fr_1fr_1fr] gap-4 items-center">
                <div className="font-mono text-xs text-brand-muted">{s.accountExternalId}</div>
                <div className="font-medium text-brand-text truncate" title={s.campaignName}>{s.campaignName}</div>
                <div className="text-xs text-brand-muted">
                  {s.periodStart}
                  {s.periodStart !== s.periodEnd ? ` – ${s.periodEnd}` : ""}
                </div>
                <div className="text-brand-muted">{s.impressions.toLocaleString("pt-BR")}</div>
                <div className="text-brand-muted">{s.clicks.toLocaleString("pt-BR")}</div>
                <div className="text-brand-text font-medium">{formatCost(s.cost, s.accountCurrencyCode)}</div>
              </ListRowCard>
            ))}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4 text-sm">
                {hasPrev ? (
                  <Link
                    href={`/dashboard/google-ads${buildSnapshotParams(filterParams, { page: page - 1 })}`}
                    className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-brand-text hover:bg-brand-border transition-colors"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="rounded-lg border border-brand-border/50 bg-brand-surface/50 px-4 py-2 text-brand-muted cursor-not-allowed">
                    Anterior
                  </span>
                )}
                <span className="text-brand-muted font-medium">
                  Página {page} de {totalPages}
                </span>
                {hasNext ? (
                  <Link
                    href={`/dashboard/google-ads${buildSnapshotParams(filterParams, { page: page + 1 })}`}
                    className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-brand-text hover:bg-brand-border transition-colors"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span className="rounded-lg border border-brand-border/50 bg-brand-surface/50 px-4 py-2 text-brand-muted cursor-not-allowed">
                    Próxima
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </PageSection>

      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <span className="section-eyebrow">conversões offline</span>
        <h2 className="mt-2 text-lg font-semibold text-brand-text">
          Planilha offline / Leads qualificados
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          O Google Ads permite enviar conversões e leads qualificados via planilha. Exporte seus leads
          no formato esperado e faça o upload em{" "}
          <a
            href="https://ads.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-neon hover:underline"
          >
            Google Ads
          </a>{" "}
          (Ferramentas e configurações → Medição → Conversões → Importar).
        </p>
        <OfflineGoogleSheetActions />
        <div className="mt-3">
          <a
            href="https://support.google.com/google-ads/answer/6331314"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-muted underline-offset-4 hover:text-brand-text hover:underline"
          >
            Ver modelo oficial e instruções do Google
          </a>
        </div>
      </PageSection>

      <div id="pagespeed">
        <PageSection>
          <span className="section-eyebrow mb-2">qualidade da landing</span>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-neon">
            PageSpeed
          </h2>
          <p className="mb-4 text-sm text-brand-muted">
            Configure a URL da landing e acompanhe historico de performance por dispositivo.
          </p>
          <PageSpeedForm initialUrl={landingUrl ?? ""} />
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Historico por data e dispositivo
            </h3>
            <PageSpeedResults results={resultsWithScore} />
          </div>
        </PageSection>
      </div>
    </div>
  );
}
