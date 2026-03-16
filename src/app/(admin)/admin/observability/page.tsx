import { PageSection } from "@/components/layout/page-section";
import { Card, CardContent } from "@/components/ui";
import { getObservabilitySnapshot } from "@/server/admin/observability";
import { Activity, Database, Radio, Server, TriangleAlert } from "lucide-react";

function statusBadge(status: string) {
  if (status === "ok" || status === "online") {
    return "text-emerald-600 dark:text-emerald-300";
  }
  if (status === "stale" || status.includes("http_")) {
    return "text-amber-600 dark:text-amber-300";
  }
  return "text-red-600 dark:text-red-300";
}

export default async function AdminObservabilityPage() {
  const snapshot = await getObservabilitySnapshot();

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <h1 className="text-2xl font-bold text-brand-text mb-2">
        Observabilidade
      </h1>
      <p className="text-brand-muted">
        Estado operacional em tempo real: serviços, filas, instâncias e erros.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-brand-muted">
              <Server className="h-4 w-4" />
              <span>API</span>
            </div>
            <p className={`mt-2 text-lg font-semibold ${statusBadge(snapshot.services.api)}`}>
              {snapshot.services.api}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-brand-muted">
              <Database className="h-4 w-4" />
              <span>Banco</span>
            </div>
            <p className={`mt-2 text-lg font-semibold ${statusBadge(snapshot.services.db)}`}>
              {snapshot.services.db}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-brand-muted">
              <Radio className="h-4 w-4" />
              <span>Redis</span>
            </div>
            <p className={`mt-2 text-lg font-semibold ${statusBadge(snapshot.services.redis)}`}>
              {snapshot.services.redis}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-brand-muted">
              <Activity className="h-4 w-4" />
              <span>Worker</span>
            </div>
            <p className={`mt-2 text-lg font-semibold ${statusBadge(snapshot.services.worker)}`}>
              {snapshot.services.worker}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <h2 className="text-brand-text font-semibold">Filas</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p className="text-brand-muted">Typebot</p>
              <p className="text-brand-text">{snapshot.queue.typebotDepth}</p>
              <p className="text-brand-muted">Evolution</p>
              <p className="text-brand-text">{snapshot.queue.evolutionDepth}</p>
              <p className="text-brand-muted">Google Ads</p>
              <p className="text-brand-text">{snapshot.queue.googleAdsDepth}</p>
              <p className="text-brand-muted">DLQ Typebot</p>
              <p className="text-brand-text">{snapshot.queue.typebotDlqDepth}</p>
              <p className="text-brand-muted">DLQ Evolution</p>
              <p className="text-brand-text">{snapshot.queue.evolutionDlqDepth}</p>
              <p className="text-brand-muted">DLQ Google Ads</p>
              <p className="text-brand-text">{snapshot.queue.googleAdsDlqDepth}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <h2 className="text-brand-text font-semibold">Erros recentes</h2>
            {snapshot.errors.length === 0 ? (
              <p className="mt-3 text-sm text-brand-muted">Sem erros recentes.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.errors.slice(0, 6).map((item, idx) => (
                  <li key={`${item.source}-${idx}`} className="rounded-lg border border-brand-border p-2">
                    <p className="text-xs text-brand-muted flex items-center gap-2">
                      <TriangleAlert className="h-3 w-3" />
                      {item.source} • {new Date(item.occurredAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 text-sm text-brand-text">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <h2 className="text-brand-text font-semibold">Evolution</h2>
            {snapshot.integrations.evolution.length === 0 ? (
              <p className="mt-3 text-sm text-brand-muted">Nenhuma instância cadastrada.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.integrations.evolution.map((item) => (
                  <li key={item.instanceId} className="flex items-center justify-between text-sm">
                    <span className="text-brand-muted">{item.details?.externalId as string}</span>
                    <span className={statusBadge(item.status)}>
                      {item.status} ({item.latencyMs}ms)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-5">
            <h2 className="text-brand-text font-semibold">UAZAPI</h2>
            {snapshot.integrations.uazapi.length === 0 ? (
              <p className="mt-3 text-sm text-brand-muted">Nenhuma instância cadastrada.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.integrations.uazapi.map((item) => (
                  <li key={item.instanceId} className="flex items-center justify-between text-sm">
                    <span className="text-brand-muted">{item.details?.externalId as string}</span>
                    <span className={statusBadge(item.status)}>
                      {item.status} ({item.latencyMs}ms)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageSection>
  );
}
