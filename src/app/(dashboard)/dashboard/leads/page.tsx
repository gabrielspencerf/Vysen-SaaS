import { getDashboardTenantContext, listLeadsForTenant } from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Button, LinkButton } from "@/components/ui";
import { ImportExportActions } from "@/components/dashboard/import-export-actions";
import Link from "next/link";
import { Users } from "lucide-react";
import { agentDebugLog } from "@/server/debug/agent-debug-log";
import { formatDateTime as formatDate } from "@/lib/i18n/date";

const LEADS_LIMIT = 200;

export default async function DashboardLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const leads = await listLeadsForTenant(tenantId, { search, limit: LEADS_LIMIT });
  agentDebugLog({
    runId: "dashboard-visual-standardization",
    hypothesisId: "H_CLIENT_STYLE_1",
    location: "src/app/(dashboard)/dashboard/leads/page.tsx:DashboardLeadsPage",
    message: "Render da página leads com header padronizado",
    data: {
      leadsCount: leads.length,
      hasSearch: Boolean(search),
    },
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <DashboardPageHeader
        title="Leads"
        description="Base de leads capturados e atualizados pelos canais conectados."
        icon={Users}
        badges={[`${leads.length} itens`]}
        actions={
          <>
            <LinkButton
              href="/dashboard/leads/kanban"
              variant="outline"
              size="sm"
              className="rounded-md border border-brand-border px-2.5 py-1 text-xs font-medium text-brand-muted transition hover:bg-brand-surface hover:text-brand-text"
            >
              Ver Kanban
            </LinkButton>
            <ImportExportActions
              exportUrl="/api/dashboard/leads/export"
              importUrl="/api/dashboard/leads/import"
              templateUrl="/templates/modelo-leads.csv"
              search={search}
              label="Leads"
            />
            <form method="GET" action="/dashboard/leads" className="flex gap-2">
              <Input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Nome, e-mail ou telefone"
                className="w-48 bg-brand-surface border-brand-border text-brand-text"
                aria-label="Buscar leads"
              />
              <Button type="submit" variant="primary" size="sm" className="btn-cta-primary">
                Buscar
              </Button>
            </form>
          </>
        }
      />

      {leads.length === 0 ? (
        <EmptyState
          title={search ? "Nenhum lead encontrado" : "Nenhum lead ainda"}
          description={search ? "Tente ajustar seus critérios de busca." : "Seus leads capturados aparecerão aqui."}
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {leads.length >= LEADS_LIMIT && (
            <p className="mb-3 text-sm text-brand-muted">
              Mostrando até {LEADS_LIMIT} resultados. Use a busca para refinar.
            </p>
          )}
          
          <div className="hidden lg:grid">
            <ListTableHeader className="grid grid-cols-7 gap-4">
              <div>Nome</div>
              <div>E-mail</div>
              <div>Telefone</div>
              <div>Status</div>
              <div>Origem</div>
              <div>1º Contato</div>
              <div>Últ. Contato</div>
            </ListTableHeader>
          </div>

          {leads.map((lead) => (
            <ListRowCard key={lead.id} className="grid grid-cols-1 lg:grid-cols-7 gap-4 items-center">
              <div>
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="font-medium text-brand-text hover:text-brand-neon transition-colors"
                >
                  {lead.name ?? lead.email ?? lead.phone ?? lead.id}
                </Link>
              </div>
              <div className="text-sm text-brand-muted truncate" title={lead.email ?? ""}>
                {lead.email ?? "—"}
              </div>
              <div className="text-sm text-brand-muted">
                {lead.phone ?? "—"}
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                  {lead.status}
                </span>
              </div>
              <div className="text-sm text-brand-muted">
                {lead.sourceProvider ?? "—"}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(lead.firstSeenAt)}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(lead.lastSeenAt)}
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
