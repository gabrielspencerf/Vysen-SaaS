import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Card, CardContent } from "@/components/ui";
import { AdminGlobalInsightsCharts } from "@/components/admin-global-insights-charts-lazy";
import { getAdminGlobalUserInsights } from "@/server/admin/global-user-insights";
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

const hubLinks = [
  {
    href: "/admin/integrations",
    title: "Integrações",
    description: "Configurar e monitorar integrações em nível de plataforma (Typebot, Evolution, Google Ads).",
    icon: Settings2,
  },
  {
    href: "/admin/agent",
    title: "Agente IA",
    description:
      "Configurar OpenAI, prompt comercial padrão, regras de follow-up e governança do agente.",
    icon: Bot,
  },
  {
    href: "/admin/worker-pipeline",
    title: "Worker & dados",
    description: "Mapa de filas Redis, workers e tabelas Postgres (fluxo ponta a ponta).",
    icon: Waypoints,
  },
  {
    href: "/admin/observability",
    title: "Observabilidade",
    description: "Visão das contas, tenants e saúde das conexões.",
    icon: Gauge,
  },
  {
    href: "/admin/tenants",
    title: "Tenants",
    description: "Listar, criar e editar tenants.",
    icon: Building2,
  },
  {
    href: "/admin/users",
    title: "Usuários",
    description: "Listar usuários e memberships.",
    icon: Users,
  },
];

const primaryLinks = hubLinks.slice(0, 3);
const operationalLinks = hubLinks.slice(3, 4);
const managementLinks = hubLinks.slice(4);

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

export default async function AdminPage() {
  const globalInsights = await getAdminGlobalUserInsights();

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <BarChart3 className="h-4 w-4 text-brand-text" />
            </div>
            <h1 className="text-2xl font-bold text-brand-text">Admin central</h1>
          </div>
          <p className="mt-2 text-brand-muted">
            Gestão da base, integrações e observabilidade. Escolha uma área abaixo.
          </p>
        </div>
        <span className="rounded-full border border-brand-border px-2.5 py-1 text-xs text-brand-muted">
          Hub da plataforma
        </span>
      </div>
      <div className="space-y-8">
        <HubSection
          title="Ações principais"
          description="Entradas usadas no dia a dia para operar integrações, IA e processamento."
          links={primaryLinks}
        />
        <HubSection
          title="Operação da plataforma"
          description="Diagnósticos de saúde e observabilidade global da operação."
          links={operationalLinks}
        />
        <HubSection
          title="Gestão de acesso e contas"
          description="Administração de tenants, usuários e memberships."
          links={managementLinks}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-brand-border bg-brand-surface/35 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand-neon" />
          <h2 className="text-base font-semibold text-brand-text">Resumo global</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-4">
            <p className="text-sm text-brand-muted">Infos globais</p>
            <p className="mt-1 text-2xl font-semibold text-brand-text">
              {formatNumber(globalInsights.totals.totalInfos)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-4">
            <p className="text-sm text-brand-muted">Contas com membership</p>
            <p className="mt-1 text-2xl font-semibold text-brand-text">
              {formatNumber(globalInsights.totals.usersWithMembership)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-brand-surface border-brand-border">
          <CardContent className="p-4">
            <p className="text-sm text-brand-muted">Média por conta</p>
            <p className="mt-1 text-2xl font-semibold text-brand-text">
              {formatNumber(globalInsights.totals.avgInfosPerUser)}
            </p>
          </CardContent>
        </Card>
        </div>
      </div>

      <div className="mt-8">
        <AdminGlobalInsightsCharts byType={globalInsights.byType} byUserTop={globalInsights.byUserTop} />
      </div>
    </PageSection>
  );
}
