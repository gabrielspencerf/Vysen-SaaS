import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getDashboardTenantContext,
  getLeadDetailForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { LeadEditForm } from "./lead-edit-form";

export default async function DashboardLeadEditPage({
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
            href={`/dashboard/leads/${leadId}`}
            className="text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ← Voltar para o lead
          </Link>
          <span className="text-brand-muted">|</span>
          <Link
            href="/dashboard/leads"
            className="text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            Lista de leads
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-brand-text mb-6">
          Editar lead
        </h1>

        <LeadEditForm
          leadId={leadId}
          defaultValues={{
            name: lead.name ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            status: lead.status,
          }}
        />
      </PageSection>
    </div>
  );
}
