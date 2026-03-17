import { notFound } from "next/navigation";
import {
  getDashboardTenantContext,
  getOpportunityForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { OpportunityEditForm } from "./opportunity-edit-form";
import Link from "next/link";

export default async function DashboardOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const { id } = await params;
  const opportunity = await getOpportunityForTenant(tenantId, id);
  if (!opportunity) notFound();

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/opportunities"
          className="text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          ← Voltar para Oportunidades
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-brand-text mb-4">
        {opportunity.title ?? "Oportunidade"}
      </h1>

      <p className="mb-6 text-sm text-brand-muted">
        Edite os dados principais da oportunidade: estágio, título, data de início do contato e valor do trabalho.
      </p>

      <OpportunityEditForm
        opportunityId={opportunity.id}
        defaultValues={{
          stage: opportunity.stage,
          title: opportunity.title ?? "",
          contactStartedAt: opportunity.contactStartedAt
            ? opportunity.contactStartedAt.toISOString().slice(0, 10)
            : "",
          jobValue: opportunity.jobValue ?? "",
          contractedModel: opportunity.contractedModel ?? "",
        }}
      />
    </PageSection>
  );
}

