import { getDashboardTenantContext, listLeadsForTenant } from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { LeadsKanbanBoard } from "./leads-kanban-board";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
] as const;

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
  duplicate: "Duplicado",
  bad_lead: "Lead ruim",
};

export default async function LeadsKanbanPage() {
  const { tenantId } = await getDashboardTenantContext();
  const leads = await listLeadsForTenant(tenantId, { limit: 500 });
  const columns = LEAD_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    leads: leads.filter((l) => l.status === status),
  }));

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">Leads — Kanban</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Arraste os cards entre colunas para alterar o status do lead.
        </p>
      </div>
      <LeadsKanbanBoard columns={columns} />
    </PageSection>
  );
}
