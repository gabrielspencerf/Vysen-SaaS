import Link from "next/link";
import { cookies } from "next/headers";
import {
  getDashboardTenantContext,
  listMetaAdsAccountsForTenant,
  listMetaInsightSnapshotsForTenant,
} from "@/server/dashboard";
import { PageSection, ListTableHeader, ListRowCard } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui";
import { Megaphone } from "lucide-react";
import { env } from "@/config/env";
import { getCsrfCookieName } from "@/server/security/csrf";
import { MetaCapiPanel, MetaPixelForm } from "./meta-ads-actions-client";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";
import { formatDateTime } from "@/lib/i18n/date";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateTime(d);
}

function formatMoney(value: number, currency: string | null): string {
  const code =
    currency && typeof currency === "string" && currency.length === 3
      ? currency.toUpperCase()
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
      // ignore
    }
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const PAGE_SIZE = 50;

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

export default async function DashboardMetaAdsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sync?: string;
    meta_ads?: string;
    meta_ads_error?: string;
    meta_ads_message?: string;
    accountId?: string;
    periodFrom?: string;
    periodTo?: string;
    page?: string;
  }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const csrfToken = (await cookies()).get(getCsrfCookieName())?.value ?? "";
  const params = await searchParams;
  const accounts = await listMetaAdsAccountsForTenant(tenantId);

  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const accountFilter = params.accountId || undefined;
  const periodFrom = params.periodFrom || undefined;
  const periodTo = params.periodTo || undefined;
  const { items: snapshots, total } = await listMetaInsightSnapshotsForTenant(tenantId, {
    accountId: accountFilter,
    periodFrom,
    periodTo,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const err = params.meta_ads_error;
  const errMsg = params.meta_ads_message;
  const syncStatus = params.sync;
  const connectedStatus = params.meta_ads;
  const filterParams = {
    accountId: accountFilter,
    periodFrom,
    periodTo,
    page: String(page),
  };

  return (
    <div className="space-y-6">
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <DashboardPageHeader
          iconNode={
            <ProviderBrandIcon
              provider="metaAds"
              variant="plain"
              className="brand-icon-monochrome h-4 w-4"
            />
          }
          title="Meta Ads"
          description="Contas conectadas e insights sincronizados por conta."
          badges={[`${accounts.length} contas`]}
          actions={
            env.metaAdsConnectEnabled ? (
              <Link href="/api/meta-ads/auth/start">
                <Button className="btn-cta-primary text-sm">
                  Conectar nova conta
                </Button>
              </Link>
            ) : (
              <Button
                disabled
                className="btn-cta-primary text-sm opacity-60 cursor-not-allowed"
                title="Conexão Meta desativada neste ambiente"
              >
                Conectar nova conta (indisponível)
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
            Conta Meta conectada com sucesso.
          </div>
        )}
        {err ? (
          <div className="mt-4 rounded bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
            {errMsg ? `${err} — ${errMsg}` : err}
          </div>
        ) : null}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">integrações</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Contas conectadas
        </h2>
        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta Meta"
            description="Conecte uma conta para começar a acompanhar seus resultados."
            icon={
              <ProviderBrandIcon
                provider="metaAds"
                variant="plain"
                className="brand-icon-monochrome h-5 w-5"
              />
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-6 gap-4">
                <div>Account ID</div>
                <div>Label</div>
                <div>Moeda</div>
                <div>Último sync</div>
                <div>Erro</div>
                <div className="text-right">Ação</div>
              </ListTableHeader>
            </div>
            {accounts.map((acc) => {
              return (
                <ListRowCard key={acc.id} className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                    <div className="font-mono text-brand-text">{acc.externalId}</div>
                    <div className="text-brand-muted">{acc.label ?? "—"}</div>
                    <div className="text-brand-muted">{acc.currencyCode ?? "—"}</div>
                    <div className="text-xs text-brand-muted">{formatDate(acc.lastSyncedAt)}</div>
                    <div className="text-xs text-red-500 truncate max-w-[220px]" title={acc.lastSyncError ?? ""}>
                      {acc.lastSyncError ?? "—"}
                    </div>
                    <div className="lg:text-right">
                      <form action={`/api/meta-ads/sync/${acc.id}`} method="POST">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <Button type="submit" size="sm" variant="secondary" className="text-xs border-brand-border text-brand-text hover:text-brand-neon">
                          Sincronizar
                        </Button>
                      </form>
                    </div>
                  </div>
                  {acc.tokenExpiresAt ? (
                    <p className="text-xs text-brand-muted">
                      Token expira em: {formatDate(acc.tokenExpiresAt)} (reconecte se necessário)
                    </p>
                  ) : null}
                  <MetaPixelForm accountId={acc.id} initialPixelId={acc.pixelId} />
                  <MetaCapiPanel accountId={acc.id} hasPixel={Boolean(acc.pixelId?.trim())} />
                </ListRowCard>
              );
            })}
          </div>
        )}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">exploração</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Insights sincronizados (conta / dia)
        </h2>

        <form
          method="GET"
          action="/dashboard/meta-ads"
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
              defaultValue={accountFilter ?? ""}
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
                provider="metaAds"
                variant="plain"
                className="brand-icon-monochrome h-5 w-5"
              />
            }
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-brand-muted mb-4">
              Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}.
            </p>
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-6 gap-3">
                <div>Conta</div>
                <div>Data</div>
                <div>Spend</div>
                <div>Impr.</div>
                <div>Cliques</div>
                <div>Sync</div>
              </ListTableHeader>
            </div>
            {snapshots.map((s) => {
              const acc = accounts.find((a) => a.id === s.metaAdsAccountId);
              const cur = acc?.currencyCode ?? null;
              return (
                <ListRowCard key={s.id} className="grid grid-cols-1 gap-2 sm:grid-cols-6 sm:items-center">
                  <span className="font-mono text-xs text-brand-muted">{s.accountExternalId}</span>
                  <span className="text-sm text-brand-text">{s.insightDate}</span>
                  <span className="text-sm text-brand-text">{formatMoney(s.spend, cur)}</span>
                  <span className="text-sm text-brand-text">
                    {new Intl.NumberFormat("pt-BR").format(s.impressions)}
                  </span>
                  <span className="text-sm text-brand-text">
                    {new Intl.NumberFormat("pt-BR").format(s.clicks)}
                  </span>
                  <span className="text-xs text-brand-muted">{formatDate(s.syncedAt)}</span>
                </ListRowCard>
              );
            })}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4 text-sm">
                {hasPrev ? (
                  <Link
                    href={`/dashboard/meta-ads${buildSnapshotParams(filterParams, { page: page - 1 })}`}
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
                    href={`/dashboard/meta-ads${buildSnapshotParams(filterParams, { page: page + 1 })}`}
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
    </div>
  );
}
