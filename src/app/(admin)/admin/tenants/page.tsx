import Link from "next/link";
import { listTenants } from "@/server/admin/tenants";
import { PageSection } from "@/components/layout/page-section";
import { ListTableHeader } from "@/components/layout/list-table-header";
import { ListRowCard } from "@/components/layout/list-row-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminTenantsPage() {
  const tenants = await listTenants();
  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-text">Tenants</h1>
        <Link href="/admin/tenants/new" className="btn-cta-primary inline-flex text-sm">
          Novo tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Nenhum tenant cadastrado"
          description="Você ainda não possui tenants. Crie o primeiro tenant para começar."
          action={
            <Link href="/admin/tenants/new" className="btn-cta-primary mt-2 inline-flex">
              Criar Tenant
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
              <div className="text-right">Ações</div>
            </ListTableHeader>
          </div>
          {tenants.map((t) => (
            <ListRowCard key={t.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div>
                <p className="text-sm font-semibold text-brand-text">{t.name}</p>
              </div>
              <div className="text-sm font-mono text-brand-muted">{t.slug}</div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    t.isActive
                      ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20"
                      : "bg-brand-border/50 text-brand-muted border border-brand-border"
                  }`}
                >
                  {t.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-center md:justify-end gap-3 text-sm">
                <Link
                  href={`/admin/tenants/${t.id}`}
                  className="text-brand-muted hover:text-brand-text transition-colors"
                >
                  Ver
                </Link>
                <Link
                  href={`/admin/tenants/${t.id}/edit`}
                  className="text-brand-neon hover:text-brand-neon/80 transition-colors"
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
