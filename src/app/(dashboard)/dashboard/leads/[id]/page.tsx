import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getDashboardTenantContext,
  getLeadDetailForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}

export default async function DashboardLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const { id: leadId } = await params;
  const lead = await getLeadDetailForTenant(tenantId, leadId);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/leads"
            className="text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ← Voltar para Leads
          </Link>
          <span className="text-brand-muted">|</span>
          <Link
            href={`/dashboard/leads/${lead.id}/edit`}
            className="text-sm text-brand-neon hover:underline transition-colors"
          >
            Editar informações
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-brand-text mb-6">
          {lead.name ?? lead.email ?? lead.phone ?? "Lead"}
        </h1>

        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Dados principais
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-brand-muted">Nome</dt>
              <dd className="text-brand-text font-medium">{lead.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">E-mail</dt>
              <dd className="text-brand-text font-medium">{lead.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Telefone</dt>
              <dd className="text-brand-text font-medium">{lead.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Status</dt>
              <dd className="text-brand-text font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                  {lead.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted">Origem</dt>
              <dd className="text-brand-text font-medium">
                {lead.sourceProvider ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted">ID externo (origem)</dt>
              <dd className="font-mono text-brand-muted">
                {lead.sourceExternalId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted">Primeiro contato</dt>
              <dd className="text-brand-text font-medium">{formatDate(lead.firstSeenAt)}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Último contato</dt>
              <dd className="text-brand-text font-medium">{formatDate(lead.lastSeenAt)}</dd>
            </div>
            {(lead.funnelId ?? lead.funnelName ?? lead.currentStepName) && (
              <>
                <div>
                  <dt className="text-brand-muted">Funil</dt>
                  <dd className="text-brand-text font-medium">{lead.funnelName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted">Etapa atual</dt>
                  <dd className="text-brand-text font-medium">
                    {lead.currentStepName ?? "—"}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </PageSection>

      {lead.utmAttributions.length > 0 && (
        <PageSection>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
            UTM (atribuição)
          </h2>
          <div className="space-y-3">
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-7 gap-4">
                <div>Toque</div>
                <div>Data</div>
                <div>Source</div>
                <div>Medium</div>
                <div>Campaign</div>
                <div>Term</div>
                <div>Content</div>
              </ListTableHeader>
            </div>
            {lead.utmAttributions.map((u) => (
              <ListRowCard key={u.id} className="grid grid-cols-1 lg:grid-cols-7 gap-4 items-center">
                <div className="text-sm font-medium text-brand-text">
                  {u.touchType} <span className="text-brand-muted text-xs">(#{u.touchSequence})</span>
                </div>
                <div className="text-sm text-brand-muted">
                  {formatDate(u.touchedAt)}
                </div>
                <div className="text-sm text-brand-muted">{u.utmSource ?? "—"}</div>
                <div className="text-sm text-brand-muted">{u.utmMedium ?? "—"}</div>
                <div className="text-sm text-brand-muted">{u.utmCampaign ?? "—"}</div>
                <div className="text-sm text-brand-muted">{u.utmTerm ?? "—"}</div>
                <div className="text-sm text-brand-muted">{u.utmContent ?? "—"}</div>
              </ListRowCard>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
          Jornada (eventos)
        </h2>
        {lead.events.length === 0 ? (
          <p className="text-sm text-brand-muted">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-4">
            {lead.events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col gap-2 border-l-2 border-brand-border pl-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-brand-text">
                    {ev.eventType}
                  </span>
                  <span className="text-xs text-brand-muted">
                    {formatDate(ev.occurredAt)}
                  </span>
                  {ev.stepName && (
                    <span className="rounded-full bg-brand-text/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-text border border-brand-text/10">
                      {ev.stepName}
                    </span>
                  )}
                </div>
                {ev.payload &&
                  Object.keys(ev.payload).length > 0 &&
                  !("_rawEventId" in ev.payload && Object.keys(ev.payload).length === 1) && (
                    <pre className="mt-1 w-full overflow-x-auto rounded-xl bg-brand-dark/50 border border-brand-border p-3 text-xs text-brand-muted font-mono">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {lead.conversations.length > 0 && (
        <PageSection>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-neon">
            Conversas vinculadas
          </h2>
          <div className="space-y-3">
            {lead.conversations.map((c) => (
              <ListRowCard key={c.id} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/dashboard/conversations/${c.id}`}
                    className="font-medium text-brand-text hover:text-brand-neon transition-colors"
                  >
                    {c.externalId}
                  </Link>
                  <span className="ml-3 text-sm text-brand-muted">
                    {c.instanceDisplay}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                    {c.status}
                  </span>
                  <span className="text-brand-muted">{formatDate(c.startedAt)}</span>
                </div>
              </ListRowCard>
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}
