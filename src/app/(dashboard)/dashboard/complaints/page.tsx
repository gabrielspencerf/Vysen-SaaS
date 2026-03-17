import { getDashboardTenantContext, listComplaintsForTenant } from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { NewComplaintForm } from "./new-complaint-form";
import { Flag } from "lucide-react";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}

const statusLabel: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Encerrado",
};

export default async function DashboardComplaintsPage() {
  const { tenantId } = await getDashboardTenantContext();
  const complaints = await listComplaintsForTenant(tenantId);

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">Reclamações</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Registre feedbacks e reclamações. Isso nos ajuda a melhorar o serviço e acompanhar pendências.
        </p>
      </div>

      <NewComplaintForm />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Histórico
        </h2>

        {complaints.length === 0 ? (
          <EmptyState
            title="Nenhuma reclamação registrada"
            description="Quando você enviar uma reclamação ou feedback, ele aparecerá aqui com o status."
            icon={<Flag className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden lg:grid">
              <ListTableHeader className="grid grid-cols-4 gap-4">
                <div>Assunto</div>
                <div>Texto</div>
                <div>Status</div>
                <div>Data</div>
              </ListTableHeader>
            </div>
            {complaints.map((c) => (
              <ListRowCard
                key={c.id}
                className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start"
              >
                <div className="font-medium text-brand-text">
                  {c.subject ?? "(sem assunto)"}
                </div>
                <div className="text-sm text-brand-muted line-clamp-2" title={c.body}>
                  {c.body}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${
                      c.status === "closed"
                        ? "bg-brand-text/10 border-brand-text/20 text-brand-muted"
                        : c.status === "in_progress"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                          : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {statusLabel[c.status] ?? c.status}
                  </span>
                </div>
                <div className="text-xs text-brand-muted">
                  {formatDate(c.createdAt)}
                </div>
              </ListRowCard>
            ))}
          </div>
        )}
      </div>
    </PageSection>
  );
}
