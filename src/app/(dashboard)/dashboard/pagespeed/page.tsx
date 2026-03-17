import {
  getDashboardTenantContext,
  getLandingPageUrlForTenant,
  listPageSpeedResultsForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { PageSpeedForm } from "./pagespeed-form";
import { PageSpeedResults } from "./pagespeed-results";

function extractScore(result: Record<string, unknown>): number | null {
  const cat = result?.categories as Record<string, unknown> | undefined;
  const perf = cat?.performance as Record<string, unknown> | undefined;
  const score = perf?.score;
  if (typeof score === "number") return Math.round(score * 100);
  return null;
}

export default async function PageSpeedPage() {
  const { tenantId } = await getDashboardTenantContext();
  const [landingUrl, results] = await Promise.all([
    getLandingPageUrlForTenant(tenantId),
    listPageSpeedResultsForTenant(tenantId, { limit: 30 }),
  ]);

  const resultsWithScore = results.map((r) => ({
    ...r,
    score: extractScore(r.result),
  }));

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-text">PageSpeed — Landing</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Configure a URL da sua landing e consulte métricas de carregamento por data e dispositivo.
        </p>
      </div>
      <PageSpeedForm initialUrl={landingUrl ?? ""} />
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-brand-text">Histórico por data e dispositivo</h2>
        <PageSpeedResults results={resultsWithScore} />
      </div>
    </PageSection>
  );
}
