import {
  getDashboardTenantContext,
  listClarityConnectionsForTenant,
  listLatestClaritySnapshotsForTenant,
} from "@/server/dashboard";
import { DashboardPageHeader } from "@/components/layout";
import { PageSection } from "@/components/layout";
import { env } from "@/config/env";
import { ClarityConnectionActions, NewClarityConnectionForm } from "./clarity-client";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";
import { formatDateTime } from "@/lib/i18n/date";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateTime(d);
}

export default async function DashboardClarityPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const connections = await listClarityConnectionsForTenant(tenantId);
  const snapshots = await listLatestClaritySnapshotsForTenant(tenantId, 15);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        iconNode={
          <ProviderBrandIcon
            provider="clarity"
            variant="plain"
            className="brand-icon-monochrome h-4 w-4"
          />
        }
        title="Microsoft Clarity"
        description="Conecte seu projeto para acompanhar insights de comportamento dos visitantes."
      />

      {params.sync === "enqueued" ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Sincronização iniciada com sucesso.
        </div>
      ) : null}

      <PageSection>
        <span className="section-eyebrow mb-2">integração</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Nova conexão
        </h2>
        {env.clarityConnectEnabled ? (
          <NewClarityConnectionForm />
        ) : (
          <p className="text-sm text-brand-muted">
            A conexão com o Clarity está indisponível no momento. Tente novamente mais tarde.
          </p>
        )}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">projetos</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Conexões
        </h2>
        {connections.length === 0 ? (
          <p className="text-sm text-brand-muted">Nenhuma conexão ainda.</p>
        ) : (
          <ul className="space-y-3">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-surface/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-brand-text">{c.label ?? "Projeto Clarity"}</p>
                  <p className="text-xs text-brand-muted">
                    Último sync: {formatDate(c.lastSyncedAt)}
                    {c.lastSyncError ? ` · ${c.lastSyncError}` : ""}
                  </p>
                </div>
                {env.clarityConnectEnabled ? <ClarityConnectionActions connectionId={c.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection>
        <span className="section-eyebrow mb-2">dados</span>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Últimas importações
        </h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-brand-muted">Nenhuma importação realizada ainda.</p>
        ) : (
          <ul className="space-y-4">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-brand-border/80 bg-brand-dark/20 p-3 text-xs"
              >
                <p className="font-medium text-brand-text">
                  {s.connectionLabel ?? "Clarity"} · {s.numOfDays}d ·{" "}
                  {s.dimension1 ?? "—"} · {formatDate(s.syncedAt)}
                </p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-brand-muted">
                  {s.payloadPreview}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </div>
  );
}
