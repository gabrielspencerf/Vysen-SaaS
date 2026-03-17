import Link from "next/link";
import {
  getDashboardTenantContext,
  listFunnelsForTenant,
  getDefaultFunnelIdForTenant,
  getFunnelWithStepsForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { FunnelConfigClient } from "./funnel-config-client";

export default async function FunnelConfigPage() {
  const { tenantId } = await getDashboardTenantContext();
  const [funnels, defaultFunnelId] = await Promise.all([
    listFunnelsForTenant(tenantId),
    getDefaultFunnelIdForTenant(tenantId),
  ]);

  const funnelsWithSteps = (
    await Promise.all(
      funnels.map((f) => getFunnelWithStepsForTenant(tenantId, f.id))
    )
  ).filter((f): f is NonNullable<typeof f> => f != null);

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Configurar funil</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Defina o funil de vendas do seu perfil: etapas e ordem. O funil padrão será usado para novos leads quando aplicável.
          </p>
        </div>
        <Link
          href="/dashboard/funnel"
          className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-surface/80"
        >
          ← Ver visão do funil
        </Link>
      </div>

      <FunnelConfigClient
        initialFunnels={funnelsWithSteps}
        defaultFunnelId={defaultFunnelId}
      />
    </PageSection>
  );
}
