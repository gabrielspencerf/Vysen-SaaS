import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTenantById,
  listMembershipsByTenant,
  listRoles,
  listUsers,
} from "@/server/admin";
import { AddMembershipForm } from "./add-membership-form";
import { PageSection } from "@/components/layout/page-section";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tenant, members, rolesList, usersList] = await Promise.all([
    getTenantById(id),
    listMembershipsByTenant(id),
    listRoles(),
    listUsers(),
  ]);
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <div className="mb-6">
          <Link
            href="/admin/tenants"
            className="text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ← Voltar
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-text mb-1">{tenant.name}</h1>
            <p className="font-mono text-sm text-brand-muted mb-3">{tenant.slug}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                tenant.isActive
                  ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20"
                  : "bg-brand-border/50 text-brand-muted border border-brand-border"
              }`}
            >
              {tenant.isActive ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Link
            href={`/admin/tenants/${id}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-brand-border bg-transparent px-5 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-muted"
          >
            Editar
          </Link>
        </div>
      </PageSection>

      <PageSection>
        <h2 className="text-xl font-bold text-brand-text mb-6">Memberships</h2>
        <div className="mb-6">
          <AddMembershipForm
            tenantId={id}
            tenantName={tenant.name}
            roles={rolesList}
            users={usersList}
            existingUserIds={members.map((m) => m.userId)}
          />
        </div>
        
        {members.length === 0 ? (
          <EmptyState
            title="Nenhum membership"
            description="Este tenant ainda não possui usuários vinculados."
            icon={<Users className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden md:block">
              <ListTableHeader className="grid grid-cols-2 gap-4">
                <div>Usuário</div>
                <div>Role</div>
              </ListTableHeader>
            </div>
            {members.map((m) => (
              <ListRowCard key={m.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <Link
                    href={`/admin/users/${m.userId}`}
                    className="font-medium text-brand-text hover:text-brand-neon transition-colors"
                  >
                    {m.userName ?? m.userEmail}
                  </Link>
                  <span className="ml-2 text-xs text-brand-muted font-mono">({m.userEmail})</span>
                </div>
                <div className="text-sm font-mono text-brand-muted">
                  {m.roleSlug}
                </div>
              </ListRowCard>
            ))}
          </div>
        )}
      </PageSection>
    </div>
  );
}
