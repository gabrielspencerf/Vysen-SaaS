import Link from "next/link";
import { Cable, MessageSquare, Pencil, SlidersHorizontal } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { IntegrationsPlaybookHelp } from "@/components/integrations-playbook-help";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";
import { Button, Card, CardContent } from "@/components/ui";
import { agentDebugLog } from "@/server/debug/agent-debug-log";
import {
  getIntegrationStats,
  listChatwootAccounts,
  listEvolutionInstances,
  listGoogleAdsAccounts,
  listTypebotBots,
  listUazapiInstances,
  listWhatsappCloudNumbers,
} from "@/server/admin/integrations-stats";
import { listTenants } from "@/server/admin/tenants";
import { IntegrationDeleteButton } from "@/app/(admin)/admin/integrations/integration-delete-button";

type TenantGroup = {
  tenantId: string;
  tenantName: string;
  typebot: Awaited<ReturnType<typeof listTypebotBots>>;
  evolution: Awaited<ReturnType<typeof listEvolutionInstances>>;
  uazapi: Awaited<ReturnType<typeof listUazapiInstances>>;
  googleAds: Awaited<ReturnType<typeof listGoogleAdsAccounts>>;
  chatwoot: Awaited<ReturnType<typeof listChatwootAccounts>>;
  whatsappCloud: Awaited<ReturnType<typeof listWhatsappCloudNumbers>>;
};

function buildTenantGroups(
  typebotBots: Awaited<ReturnType<typeof listTypebotBots>>,
  evolutionInstances: Awaited<ReturnType<typeof listEvolutionInstances>>,
  uazapiInstances: Awaited<ReturnType<typeof listUazapiInstances>>,
  googleAdsAccounts: Awaited<ReturnType<typeof listGoogleAdsAccounts>>,
  chatwootAccounts: Awaited<ReturnType<typeof listChatwootAccounts>>,
  whatsappCloudNumbers: Awaited<ReturnType<typeof listWhatsappCloudNumbers>>
): TenantGroup[] {
  const map = new Map<string, TenantGroup>();

  const ensureGroup = (tenantId: string, tenantName: string) => {
    const existing = map.get(tenantId);
    if (existing) return existing;
    const created: TenantGroup = {
      tenantId,
      tenantName,
      typebot: [],
      evolution: [],
      uazapi: [],
      googleAds: [],
      chatwoot: [],
      whatsappCloud: [],
    };
    map.set(tenantId, created);
    return created;
  };

  for (const row of typebotBots) ensureGroup(row.tenantId, row.tenantName).typebot.push(row);
  for (const row of evolutionInstances) ensureGroup(row.tenantId, row.tenantName).evolution.push(row);
  for (const row of uazapiInstances) ensureGroup(row.tenantId, row.tenantName).uazapi.push(row);
  for (const row of googleAdsAccounts) ensureGroup(row.tenantId, row.tenantName).googleAds.push(row);
  for (const row of chatwootAccounts) ensureGroup(row.tenantId, row.tenantName).chatwoot.push(row);
  for (const row of whatsappCloudNumbers) ensureGroup(row.tenantId, row.tenantName).whatsappCloud.push(row);

  return Array.from(map.values()).sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export async function SuperadminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const params = await searchParams;
  const selectedTenantId = typeof params.tenantId === "string" && params.tenantId.trim() ? params.tenantId : undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const [
    tenants,
    stats,
    typebotBots,
    evolutionInstances,
    uazapiInstances,
    googleAdsAccounts,
    chatwootAccounts,
    whatsappCloudNumbers,
  ] = await Promise.all([
    listTenants(),
    getIntegrationStats(selectedTenantId),
    listTypebotBots(selectedTenantId),
    listEvolutionInstances(selectedTenantId),
    listUazapiInstances(selectedTenantId),
    listGoogleAdsAccounts(selectedTenantId),
    listChatwootAccounts(selectedTenantId),
    listWhatsappCloudNumbers(selectedTenantId),
  ]);

  const tenantGroups = buildTenantGroups(
    typebotBots,
    evolutionInstances,
    uazapiInstances,
    googleAdsAccounts,
    chatwootAccounts,
    whatsappCloudNumbers
  );

  agentDebugLog({
    runId: "superadmin-pages-separation",
    hypothesisId: "H_SUPERADMIN_INTEGRATIONS_1",
    location: "src/features/superadmin/integrations-page.tsx:SuperadminIntegrationsPage",
    message: "Render da pagina oficial de integracoes do superadmin",
    data: {
      selectedTenantId: selectedTenantId ?? null,
      totalTenants: tenants.length,
      tenantGroups: tenantGroups.length,
      stats,
    },
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <Cable className="h-4 w-4 text-brand-text" />
            </div>
            <h1 className="text-2xl font-semibold text-brand-text">Integracoes</h1>
          </div>
          <p className="mt-2 text-brand-muted">
            Area organizada por cliente para gestao de Typebot, Evolution, UAZAPI, Chatwoot, WhatsApp Cloud e Google Ads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-brand-border px-2.5 py-1 text-xs text-brand-muted">
            {tenantGroups.length} clientes com integracoes
          </span>
          <IntegrationsPlaybookHelp />
        </div>
      </div>

      <form method="GET" action="/superadmin/integrations" className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted" htmlFor="tenantId">
            Filtrar por cliente
          </label>
          <select id="tenantId" name="tenantId" defaultValue={selectedTenantId ?? ""} className="app-select min-w-[240px]">
            <option value="">Todos os clientes</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          <SlidersHorizontal className="mr-1 h-4 w-4" aria-hidden />
          Aplicar filtro
        </Button>
        {selectedTenantId ? (
          <Link href="/superadmin/integrations">
            <Button type="button" variant="secondary">Limpar</Button>
          </Link>
        ) : null}
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/superadmin/integrations/typebot/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ""}`}>
          <Button variant="secondary" className="gap-2">
            <ProviderBrandIcon provider="typebot" frameClassName="h-5 w-5" className="h-3 w-3" />
            Conectar Typebot
          </Button>
        </Link>
        <Link href="/superadmin/integrations/typebot/metrics">
          <Button variant="secondary" className="gap-2">
            <ProviderBrandIcon provider="typebot" frameClassName="h-5 w-5" className="h-3 w-3" />
            Sincronizar metricas Typebot
          </Button>
        </Link>
        <Link href={`/superadmin/integrations/evolution/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ""}`}>
          <Button variant="secondary" className="gap-2">
            <ProviderBrandIcon provider="evolution" frameClassName="h-5 w-5" className="h-3 w-3" />
            Conectar Evolution API
          </Button>
        </Link>
        <Link href={`/superadmin/integrations/uazapi/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ""}`}>
          <Button variant="secondary" className="gap-2">
            <ProviderBrandIcon provider="uazapi" frameClassName="h-5 w-5" className="h-3 w-3" />
            Conectar UAZAPI
          </Button>
        </Link>
        <Link href={`/superadmin/integrations/chatwoot/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ""}`}>
          <Button variant="secondary" className="gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-brand-border/80 bg-brand-surface/80">
              <MessageSquare className="h-3 w-3 text-brand-text" aria-hidden />
            </span>
            Conectar Chatwoot
          </Button>
        </Link>
        <Link href={`/superadmin/integrations/whatsapp-cloud/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ""}`}>
          <Button variant="secondary" className="gap-2">
            <ProviderBrandIcon provider="whatsapp" frameClassName="h-5 w-5" className="h-3 w-3" />
            Conectar WhatsApp Cloud
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><ProviderBrandIcon provider="typebot" frameClassName="h-8 w-8" className="h-5 w-5 rounded" /></div><span className="text-2xl font-bold text-brand-text">{stats.typebotBots}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">Typebot</h2></CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><ProviderBrandIcon provider="uazapi" frameClassName="h-8 w-8" className="h-5 w-5 rounded" /></div><span className="text-2xl font-bold text-brand-text">{stats.uazapiInstances}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">UAZAPI</h2></CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><ProviderBrandIcon provider="evolution" frameClassName="h-8 w-8" className="h-5 w-5 rounded" /></div><span className="text-2xl font-bold text-brand-text">{stats.evolutionInstances}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">Evolution API</h2></CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><MessageSquare className="h-5 w-5" aria-hidden /></div><span className="text-2xl font-bold text-brand-text">{stats.chatwootAccounts}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">Chatwoot</h2></CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><ProviderBrandIcon provider="whatsapp" frameClassName="h-8 w-8" className="h-5 w-5 rounded" /></div><span className="text-2xl font-bold text-brand-text">{stats.whatsappCloudNumbers}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">WhatsApp Cloud</h2></CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-neon/10 text-brand-neon"><ProviderBrandIcon provider="googleAds" frameClassName="h-8 w-8" className="h-5 w-5 rounded" /></div><span className="text-2xl font-bold text-brand-text">{stats.googleAdsAccounts}</span></div><h2 className="mt-4 text-lg font-semibold text-brand-text">Google Ads</h2></CardContent></Card>
      </div>

      {tenantGroups.length === 0 ? (
        <section className="mt-10 rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-sm text-brand-muted">Nenhuma integracao encontrada para o filtro selecionado.</p>
        </section>
      ) : (
        <div className="mt-10 space-y-8">
          {tenantGroups.map((group) => (
            <section key={group.tenantId} className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-brand-text">{group.tenantName}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><ProviderBrandIcon provider="typebot" frameClassName="h-4 w-4 rounded-sm border-brand-border/60" className="h-2.5 w-2.5" />Typebot: {group.typebot.length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><ProviderBrandIcon provider="evolution" className="h-3.5 w-3.5 rounded" />Evolution: {group.evolution.length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><ProviderBrandIcon provider="uazapi" className="h-3.5 w-3.5 rounded" />UAZAPI: {group.uazapi.length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><MessageSquare className="h-3 w-3" aria-hidden />Chatwoot: {group.chatwoot.length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><ProviderBrandIcon provider="whatsapp" className="h-3.5 w-3.5 rounded" />WA Cloud: {group.whatsappCloud.length}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border px-2 py-0.5"><ProviderBrandIcon provider="googleAds" frameClassName="h-4 w-4 rounded-sm border-brand-border/60" className="h-2.5 w-2.5" />Google Ads: {group.googleAds.length}</span>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><ProviderBrandIcon provider="typebot" className="h-4 w-4 rounded" />Typebot</h3>
                  {group.typebot.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem bots cadastrados.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Nome / external_id</th><th className="px-4 py-2 font-medium text-brand-muted">Webhook</th><th className="w-10 px-4 py-2 font-medium text-brand-muted">Acoes</th></tr></thead><tbody>{group.typebot.map((bot) => { const webhook = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/typebot/${bot.id}` : `[APP_URL]/api/webhooks/typebot/${bot.id}`; return <tr key={bot.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 text-brand-text">{bot.name || bot.externalId}{bot.name ? <span className="ml-1 font-mono text-xs text-brand-muted">({bot.externalId})</span> : null}</td><td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs text-brand-neon">{webhook}</td><td className="px-4 py-2"><div className="flex items-center gap-1"><Link href={`/superadmin/integrations/typebot/${bot.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition hover:bg-brand-border/40 hover:text-brand-text" aria-label="Editar bot Typebot" title="Editar bot Typebot"><Pencil className="h-4 w-4" aria-hidden /></Link><IntegrationDeleteButton id={bot.id} provider="typebot" label="Excluir bot Typebot" /></div></td></tr>; })}</tbody></table></div>
                  )}
                </div>

                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><ProviderBrandIcon provider="evolution" className="h-4 w-4 rounded" />Evolution API</h3>
                  {group.evolution.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem instancias cadastradas.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Nome / external_id</th><th className="px-4 py-2 font-medium text-brand-muted">Base URL</th><th className="px-4 py-2 font-medium text-brand-muted">Webhook</th><th className="w-10 px-4 py-2 font-medium text-brand-muted">Acoes</th></tr></thead><tbody>{group.evolution.map((inst) => { const webhook = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/evolution/${inst.id}` : `[APP_URL]/api/webhooks/evolution/${inst.id}`; return <tr key={inst.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 text-brand-text">{inst.instanceName || inst.externalId}{inst.instanceName ? <span className="ml-1 font-mono text-xs text-brand-muted">({inst.externalId})</span> : null}</td><td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs text-brand-muted">{inst.baseUrl}</td><td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs text-brand-neon">{webhook}</td><td className="px-4 py-2"><div className="flex items-center gap-1"><Link href={`/superadmin/integrations/evolution/${inst.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition hover:bg-brand-border/40 hover:text-brand-text" aria-label="Editar instancia Evolution" title="Editar instancia Evolution"><Pencil className="h-4 w-4" aria-hidden /></Link><IntegrationDeleteButton id={inst.id} provider="evolution" label="Excluir instancia Evolution" /></div></td></tr>; })}</tbody></table></div>
                  )}
                </div>

                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><ProviderBrandIcon provider="uazapi" className="h-4 w-4 rounded" />UAZAPI</h3>
                  {group.uazapi.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem instancias cadastradas.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Nome / external_id</th><th className="px-4 py-2 font-medium text-brand-muted">Base URL</th><th className="px-4 py-2 font-medium text-brand-muted">Webhook</th><th className="w-10 px-4 py-2 font-medium text-brand-muted">Acoes</th></tr></thead><tbody>{group.uazapi.map((inst) => { const webhook = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/uazapi/${inst.id}` : `[APP_URL]/api/webhooks/uazapi/${inst.id}`; return <tr key={inst.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 text-brand-text">{inst.instanceName || inst.externalId}{inst.instanceName ? <span className="ml-1 font-mono text-xs text-brand-muted">({inst.externalId})</span> : null}</td><td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs text-brand-muted">{inst.baseUrl}</td><td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs text-brand-neon">{webhook}</td><td className="px-4 py-2"><div className="flex items-center gap-1"><Link href={`/superadmin/integrations/uazapi/${inst.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition hover:bg-brand-border/40 hover:text-brand-text" aria-label="Editar instancia UAZAPI" title="Editar instancia UAZAPI"><Pencil className="h-4 w-4" aria-hidden /></Link><IntegrationDeleteButton id={inst.id} provider="uazapi" label="Excluir instancia UAZAPI" /></div></td></tr>; })}</tbody></table></div>
                  )}
                </div>

                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><MessageSquare className="h-4 w-4" aria-hidden />Chatwoot</h3>
                  {group.chatwoot.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem contas cadastradas.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Rótulo / external_id</th><th className="px-4 py-2 font-medium text-brand-muted">Base URL</th><th className="px-4 py-2 font-medium text-brand-muted">Webhook</th><th className="w-10 px-4 py-2 font-medium text-brand-muted">Acoes</th></tr></thead><tbody>{group.chatwoot.map((acc) => { const webhook = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/chatwoot/${acc.id}` : `[APP_URL]/api/webhooks/chatwoot/${acc.id}`; return <tr key={acc.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 text-brand-text">{acc.label || acc.externalId}{acc.label ? <span className="ml-1 font-mono text-xs text-brand-muted">({acc.externalId})</span> : null}{acc.inboxId ? <span className="ml-1 text-xs text-brand-muted">· inbox {acc.inboxId}</span> : null}</td><td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs text-brand-muted">{acc.baseUrl}</td><td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs text-brand-neon">{webhook}</td><td className="px-4 py-2"><div className="flex items-center gap-1"><Link href={`/superadmin/integrations/chatwoot/${acc.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition hover:bg-brand-border/40 hover:text-brand-text" aria-label="Editar conta Chatwoot" title="Editar conta Chatwoot"><Pencil className="h-4 w-4" aria-hidden /></Link><IntegrationDeleteButton id={acc.id} provider="chatwoot" label="Excluir conta Chatwoot" /></div></td></tr>; })}</tbody></table></div>
                  )}
                </div>

                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><ProviderBrandIcon provider="whatsapp" className="h-4 w-4 rounded" />WhatsApp Cloud</h3>
                  {group.whatsappCloud.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem números cadastrados.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Rótulo / telefone</th><th className="px-4 py-2 font-medium text-brand-muted">phone_number_id / WABA</th><th className="px-4 py-2 font-medium text-brand-muted">Webhook</th><th className="w-10 px-4 py-2 font-medium text-brand-muted">Acoes</th></tr></thead><tbody>{group.whatsappCloud.map((num) => { const webhook = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp-cloud/${num.id}` : `[APP_URL]/api/webhooks/whatsapp-cloud/${num.id}`; const display = num.label || num.displayPhone || num.phoneNumberId; return <tr key={num.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 text-brand-text">{display}{num.label && num.displayPhone ? <span className="ml-1 font-mono text-xs text-brand-muted">({num.displayPhone})</span> : null}</td><td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs text-brand-muted">{num.phoneNumberId} <span className="text-brand-muted">·</span> WABA {num.wabaId}</td><td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs text-brand-neon">{webhook}</td><td className="px-4 py-2"><div className="flex items-center gap-1"><Link href={`/superadmin/integrations/whatsapp-cloud/${num.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition hover:bg-brand-border/40 hover:text-brand-text" aria-label="Editar número WhatsApp Cloud" title="Editar número WhatsApp Cloud"><Pencil className="h-4 w-4" aria-hidden /></Link><IntegrationDeleteButton id={num.id} provider="whatsapp_cloud" label="Excluir número WhatsApp Cloud" /></div></td></tr>; })}</tbody></table></div>
                  )}
                </div>

                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text"><ProviderBrandIcon provider="googleAds" className="h-4 w-4 rounded" />Google Ads</h3>
                  {group.googleAds.length === 0 ? <p className="mt-1 text-xs text-brand-muted">Sem contas conectadas.</p> : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-border"><table className="min-w-full text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="px-4 py-2 font-medium text-brand-muted">Customer ID</th><th className="px-4 py-2 font-medium text-brand-muted">Label</th><th className="px-4 py-2 font-medium text-brand-muted">Moeda</th></tr></thead><tbody>{group.googleAds.map((acc) => <tr key={acc.id} className="border-b border-brand-border last:border-0"><td className="px-4 py-2 font-mono text-brand-text">{acc.externalId}</td><td className="px-4 py-2 text-brand-muted">{acc.label ?? "-"}</td><td className="px-4 py-2 text-brand-muted">{acc.currencyCode ?? "-"}</td></tr>)}</tbody></table></div>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </PageSection>
  );
}
