import Link from "next/link";
import {
  BarChart3,
  Bot,
  Building2,
  Gauge,
  Layers,
  Settings2,
  Users,
  Waypoints,
} from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Card, CardContent } from "@/components/ui";
import { AdminGlobalInsightsCharts } from "@/components/admin-global-insights-charts-lazy";
import { getAdminGlobalUserInsights } from "@/server/admin/global-user-insights";

const hubLinks = [
  {
    href: "/superadmin/integrations",
    title: "Integracoes",
    description: "Configurar e monitorar integracoes em nivel de plataforma.",
    icon: Settings2,
  },
  {
    href: "/superadmin/agent",
    title: "Agente IA",
    description: "Governanca tecnica da Vysen, knowledge base e configuracao global.",
    icon: Bot,
  },
  {
    href: "/superadmin/worker-pipeline",
    title: "Worker & dados",
    description: "Mapa de filas Redis, workers e fluxo ponta a ponta do processamento.",
    icon: Waypoints,
  },
  {
    href: "/superadmin/observability",
    title: "Observabilidade",
    description: "Saude tecnica, instancias, webhooks, DLQ e falhas recentes.",
    icon: Gauge,
  },
  {
    href: "/superadmin/tenants",
    title: "Tenants",
    description: "Cadastro e manutencao das contas clientes na plataforma.",
    icon: Building2,
  },
  {
    href: "/superadmin/users",
    title: "Usuarios",
    description: "Usuarios, memberships e acesso administrativo.",
    icon: Users,
  },
];

const primaryLinks = hubLinks.slice(0, 4);
const managementLinks = hubLinks.slice(4);
const priorityLinks = [
  {
    href: "/superadmin/observability",
    label: "Saude da plataforma",
    description: "Verificar filas, heartbeat, DLQ e status de servicos.",
    icon: Gauge,
  },
  {
    href: "/superadmin/worker-pipeline",
    label: "Fluxo de processamento",
    description: "Inspecionar pipeline, eventos crus e operacao de workers.",
    icon: Waypoints,
  },
  {
    href: "/superadmin/agent",
    label: "Governanca da Vysen",
    description: "Acompanhar uso, falhas recentes e ajustes do agente.",
    icon: Bot,
  },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function HubSection({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: typeof hubLinks;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-brand-text">{title}</h2>
        <p className="text-sm text-brand-muted">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full border-brand-border bg-brand-surface transition-all duration-300 group-hover:border-brand-neon/50 group-hover:shadow-md">
              <CardContent className="p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-brand-neon/10 text-brand-neon">
                  <item.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-brand-text transition-colors group-hover:text-brand-neon">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-brand-muted">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SuperadminPage() {
  const globalInsights = await getAdminGlobalUserInsights();

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <BarChart3 className="h-4 w-4 text-brand-text" />
            </div>
            <h1 className="text-2xl font-bold text-brand-text">Superadmin</h1>
          </div>
          <p className="mt-2 text-brand-muted">
            Operacao tecnica da plataforma: integracoes, monitoramento, dados e governanca.
          </p>
        </div>
        <span className="rounded-full border border-brand-border px-2.5 py-1 text-xs text-brand-muted">
          Camada tecnica
        </span>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <div className="rounded-2xl border border-brand-border bg-gradient-to-br from-brand-surface to-brand-dark p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-neon" />
            <p className="text-sm font-semibold text-brand-text">Prioridade tecnica</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-brand-text">
            Console dev separado da operacao da empresa
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            Use esta camada para plataforma, integracoes, filas, webhooks e governanca tecnica. A carteira da empresa e o uso do cliente ficam fora daqui.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {priorityLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-brand-border bg-brand-surface/70 p-4 transition hover:border-brand-neon/40 hover:bg-brand-surface"
            >
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-brand-neon" />
                <p className="text-sm font-semibold text-brand-text">{item.label}</p>
              </div>
              <p className="mt-2 text-xs text-brand-muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <HubSection
          title="Plataforma"
          description="Entradas usadas no dia a dia tecnico para operar a infraestrutura da Vysen."
          links={primaryLinks}
        />
        <HubSection
          title="Gestao de contas"
          description="Administracao estrutural de tenants, usuarios e memberships."
          links={managementLinks}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-brand-border bg-brand-surface/35 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-neon" />
          <h2 className="text-base font-semibold text-brand-text">Resumo global</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="p-4">
              <p className="text-sm text-brand-muted">Infos globais</p>
              <p className="mt-1 text-2xl font-semibold text-brand-text">
                {formatNumber(globalInsights.totals.totalInfos)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="p-4">
              <p className="text-sm text-brand-muted">Contas com membership</p>
              <p className="mt-1 text-2xl font-semibold text-brand-text">
                {formatNumber(globalInsights.totals.usersWithMembership)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="p-4">
              <p className="text-sm text-brand-muted">Media por conta</p>
              <p className="mt-1 text-2xl font-semibold text-brand-text">
                {formatNumber(globalInsights.totals.avgInfosPerUser)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <AdminGlobalInsightsCharts
          byType={globalInsights.byType}
          byUserTop={globalInsights.byUserTop}
        />
      </div>
    </PageSection>
  );
}
