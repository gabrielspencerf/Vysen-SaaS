import { Flag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRowCard, ListTableHeader, PageSection } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { getDashboardTenantContext, listComplaintsForTenant } from "@/server/dashboard";
import { NewSupportTicketForm } from "./new-support-ticket-form";
import { formatDateTime as formatDate } from "@/lib/i18n/date";

const statusLabel: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Encerrado",
};

export default async function DashboardSupportPage() {
  const { tenantId } = await getDashboardTenantContext();
  const tickets = await listComplaintsForTenant(tenantId);

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <DashboardPageHeader
        title="Suporte"
        description="Abra chamados para incidentes, dúvidas e solicitações com histórico de acompanhamento."
        icon={Flag}
        badges={[`${tickets.length} chamados`]}
      />

      <NewSupportTicketForm />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">Chamados</h2>
        {tickets.length === 0 ? (
          <EmptyState
            title="Nenhum chamado registrado"
            description="Quando você abrir um chamado, ele aparecerá aqui com status e data."
            icon={<Flag className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-4 gap-4">
                <div>Assunto</div>
                <div>Descrição</div>
                <div>Status</div>
                <div>Data</div>
              </ListTableHeader>
            </div>
            {tickets.map((ticket) => (
              <ListRowCard key={ticket.id} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                <div className="font-medium text-brand-text">{ticket.subject ?? "(sem assunto)"}</div>
                <div className="text-sm text-brand-muted line-clamp-2" title={ticket.body}>
                  {ticket.body}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${
                      ticket.status === "closed"
                        ? "bg-brand-text/10 border-brand-text/20 text-brand-muted"
                        : ticket.status === "in_progress"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                          : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {statusLabel[ticket.status] ?? ticket.status}
                  </span>
                </div>
                <div className="text-xs text-brand-muted">{formatDate(ticket.createdAt)}</div>
              </ListRowCard>
            ))}
          </div>
        )}
      </div>
    </PageSection>
  );
}
