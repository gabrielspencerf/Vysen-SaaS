import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { Card, CardContent } from "@/components/ui";

const hubLinks = [
  {
    href: "/admin/integrations",
    title: "Integrações",
    description: "Configurar e monitorar integrações em nível de plataforma (Typebot, Evolution, Google Ads).",
  },
  {
    href: "/admin/observability",
    title: "Observabilidade",
    description: "Visão das contas, tenants e saúde das conexões.",
  },
  {
    href: "/admin/tenants",
    title: "Tenants",
    description: "Listar, criar e editar tenants.",
  },
  {
    href: "/admin/users",
    title: "Usuários",
    description: "Listar usuários e memberships.",
  },
];

export default function AdminPage() {
  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <h1 className="text-2xl font-bold text-brand-text mb-2">
        Admin central
      </h1>
      <p className="text-brand-muted">
        Gestão da base, integrações e observabilidade. Escolha uma área abaixo.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hubLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-all group-hover:border-brand-neon/50 group-hover:shadow-md bg-brand-surface border-brand-border">
              <CardContent className="p-5">
                <h2 className="font-semibold text-brand-text group-hover:text-brand-neon transition-colors">{item.title}</h2>
                <p className="mt-2 text-sm text-brand-muted">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageSection>
  );
}
