import Link from "next/link";
import { Building2, CircleDot } from "lucide-react";
import { listTenants } from "@/server/admin/tenants";
import { PageSection } from "@/components/layout/page-section";
import { ListTableHeader } from "@/components/layout/list-table-header";
import { ListRowCard } from "@/components/layout/list-row-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui";

export default async function SuperadminTenantsPage() {
  const tenants = await listTenants();
  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-brand-border/60 p-1.5">
              <Building2 className="h-4 w-4 text-brand-text" />
            </div>
            <h1 className="text-2xl font-bold text-brand-text">Tenants</h1>
          </div>
          <p className="mt-2 text-sm text-brand-muted">
            Cadastre e mantenha as contas de clientes com status e acesso organizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-brand-border px-2.5 py-1 text-xs text-brand-muted">
            {tenants.length} cadastrados
          </span>
          <Link href="/superadmin/tenants/new">
            <Button size="sm">Novo tenant</Button>
          </Link>
        </div>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Nenhum tenant cadastrado"
          description="Voce ainda nao possui tenants. Crie o primeiro tenant para comecar."
          action={
            <Link href="/superadmin/tenants/new">
              <Button size="sm" className="mt-2">Criar Tenant</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="hidden md:block">
            <ListTableHeader className="grid grid-cols-4 gap-4">
              <div>Nome</div>
              <div>Slug</div>
              <div>Status</div>
              <div className="text-right">Acoes</div>
            </ListTableHeader>
          </div>
          {tenants.map((t) => (
            <ListRowCard key={t.id} className="grid grid-cols-1 items-center gap-4 md:grid-cols-4">
              <div className="flex items-center gap-2">
                <CircleDot className="h-3.5 w-3.5 text-brand-muted" />
                <p className="text-sm font-semibold text-brand-text">{t.name}</p>
              </div>
              <div className="text-sm font-mono text-brand-muted">{t.slug}</div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    t.isActive
                      ? "border border-brand-neon/20 bg-brand-neon/10 text-brand-neon"
                      : "border border-brand-border bg-brand-border/50 text-brand-muted"
                  }`}
                >
                  {t.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm md:justify-end">
                <Link
                  href={`/superadmin/tenants/${t.id}`}
                  className="text-brand-muted transition-colors hover:text-brand-text"
                >
                  Ver
                </Link>
                <Link
                  href={`/superadmin/tenants/${t.id}/edit`}
                  className="text-brand-neon transition-colors hover:text-brand-neon/80"
                >
                  Editar
                </Link>
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
