import Link from "next/link";
import { Bot, MessageCircle, BarChart3, Plus, Send } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import {
  getIntegrationStats,
  listTypebotBots,
  listEvolutionInstances,
  listUazapiInstances,
} from "@/server/admin/integrations-stats";

export default async function AdminIntegrationsPage() {
  const [stats, typebotBots, evolutionInstances, uazapiInstances] = await Promise.all([
    getIntegrationStats(),
    listTypebotBots(),
    listEvolutionInstances(),
    listUazapiInstances(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-brand-text">Integrações</h1>
      <p className="mt-2 text-brand-muted">
        Cadastre Typebot e Evolution aqui. Google Ads é conectado pelos
        usuários no Dashboard.
      </p>

      {/* Ações: Conectar Typebot / Conectar Evolution */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/integrations/typebot/new">
          <Button variant="secondary" className="gap-2 border-brand-border bg-brand-surface text-brand-text hover:border-brand-neon/40 hover:text-brand-neon">
            <Plus className="h-4 w-4" aria-hidden />
            Conectar Typebot
          </Button>
        </Link>
        <Link href="/admin/integrations/typebot/metrics">
          <Button variant="secondary" className="gap-2 border-brand-border bg-brand-surface text-brand-text hover:border-brand-neon/40 hover:text-brand-neon">
            Sincronizar métricas Typebot
          </Button>
        </Link>
        <Link href="/admin/integrations/evolution/new">
          <Button variant="secondary" className="gap-2 border-brand-border bg-brand-surface text-brand-text hover:border-brand-neon/40 hover:text-brand-neon">
            <Plus className="h-4 w-4" aria-hidden />
            Conectar Evolution API
          </Button>
        </Link>
        <Link href="/admin/integrations/uazapi/new">
          <Button variant="secondary" className="gap-2 border-brand-border bg-brand-surface text-brand-text hover:border-brand-neon/40 hover:text-brand-neon">
            <Plus className="h-4 w-4" aria-hidden />
            Conectar UAZAPI
          </Button>
        </Link>
      </div>

      {/* Cards resumo */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon">
                <Bot className="h-5 w-5" aria-hidden />
              </div>
              <span className="text-2xl font-bold text-brand-text">
                {stats.typebotBots}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-text">
              Typebot
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Bots com webhook. Cadastre acima e use a URL no painel do Typebot.
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon">
                <Send className="h-5 w-5" aria-hidden />
              </div>
              <span className="text-2xl font-bold text-brand-text">
                {stats.uazapiInstances}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-text">
              UAZAPI
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Instâncias paralelas à Evolution para mensageria e operação.
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </div>
              <span className="text-2xl font-bold text-brand-text">
                {stats.evolutionInstances}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-text">
              Evolution API
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Instâncias WhatsApp. Cadastre acima e use a URL na Evolution.
            </p>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon">
                <BarChart3 className="h-5 w-5" aria-hidden />
              </div>
              <span className="text-2xl font-bold text-brand-text">
                {stats.googleAdsAccounts}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-text">
              Google Ads
            </h2>
            <p className="mt-1 text-sm text-brand-muted">
              Conectado no Dashboard pelo tenant (Google Ads → Conectar conta).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista: Bots Typebot */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-text">
          Bots Typebot cadastrados
        </h2>
        {typebotBots.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">
            Nenhum bot. Use &quot;Conectar Typebot&quot; para cadastrar.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left">
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Tenant
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Nome / external_id
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    URL do webhook
                  </th>
                </tr>
              </thead>
              <tbody>
                {typebotBots.map((bot) => {
                  const url = appUrl
                    ? `${appUrl.replace(/\/$/, "")}/api/webhooks/typebot/${bot.id}`
                    : `[APP_URL]/api/webhooks/typebot/${bot.id}`;
                  return (
                    <tr
                      key={bot.id}
                      className="border-b border-brand-border last:border-0"
                    >
                      <td className="px-4 py-3 text-brand-text">
                        {bot.tenantName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-brand-text">
                          {bot.name || bot.externalId}
                        </span>
                        {bot.name && (
                          <span className="ml-1 text-brand-muted font-mono text-xs">
                            ({bot.externalId})
                          </span>
                        )}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 font-mono text-xs text-brand-neon">
                        {url}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lista: Instâncias Evolution */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-text">
          Instâncias Evolution cadastradas
        </h2>
        {evolutionInstances.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">
            Nenhuma instância. Use &quot;Conectar Evolution API&quot; para
            cadastrar.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left">
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Tenant
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Nome / external_id
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Base URL
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    URL do webhook
                  </th>
                </tr>
              </thead>
              <tbody>
                {evolutionInstances.map((inst) => {
                  const url = appUrl
                    ? `${appUrl.replace(/\/$/, "")}/api/webhooks/evolution/${inst.id}`
                    : `[APP_URL]/api/webhooks/evolution/${inst.id}`;
                  return (
                    <tr
                      key={inst.id}
                      className="border-b border-brand-border last:border-0"
                    >
                      <td className="px-4 py-3 text-brand-text">
                        {inst.tenantName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-brand-text">
                          {inst.instanceName || inst.externalId}
                        </span>
                        {inst.instanceName && (
                          <span className="ml-1 font-mono text-xs text-brand-muted">
                            ({inst.externalId})
                          </span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-brand-muted">
                        {inst.baseUrl}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 font-mono text-xs text-brand-neon">
                        {url}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-text">
          Instâncias UAZAPI cadastradas
        </h2>
        {uazapiInstances.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">
            Nenhuma instância. Use &quot;Conectar UAZAPI&quot; para cadastrar.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left">
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Tenant
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Nome / external_id
                  </th>
                  <th className="px-4 py-3 font-medium text-brand-muted">
                    Base URL
                  </th>
                </tr>
              </thead>
              <tbody>
                {uazapiInstances.map((inst) => (
                  <tr
                    key={inst.id}
                    className="border-b border-brand-border last:border-0"
                  >
                    <td className="px-4 py-3 text-brand-text">
                      {inst.tenantName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-brand-text">
                        {inst.instanceName || inst.externalId}
                      </span>
                      {inst.instanceName && (
                        <span className="ml-1 font-mono text-xs text-brand-muted">
                          ({inst.externalId})
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-brand-muted">
                      {inst.baseUrl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
