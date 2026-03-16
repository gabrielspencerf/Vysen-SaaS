import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUserById,
  listMembershipsByUser,
  listRoles,
  listTenants,
} from "@/server/admin";
import { AddMembershipForm } from "./add-membership-form";
import { PageSection } from "@/components/layout/page-section";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, members, rolesList, tenantsList] = await Promise.all([
    getUserById(id),
    listMembershipsByUser(id),
    listRoles(),
    listTenants(),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
        <div className="mb-6">
          <Link
            href="/admin/users"
            className="text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ← Voltar
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-text mb-1">
            {user.name ?? user.email}
          </h1>
          <p className="font-mono text-sm text-brand-muted mb-2">{user.email}</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              user.isActive
                ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20"
                : "bg-brand-border/50 text-brand-muted border border-brand-border"
            }`}
          >
            {user.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>
      </PageSection>

      <PageSection>
        <h2 className="text-xl font-bold text-brand-text mb-6">Memberships</h2>
        <div className="mb-6">
          <AddMembershipForm
            userId={id}
            userName={user.name ?? user.email}
            roles={rolesList}
            tenants={tenantsList}
            existingTenantIds={members.map((m) => m.tenantId)}
          />
        </div>
        
        {members.length === 0 ? (
          <EmptyState
            title="Nenhum membership"
            description="Este usuário ainda não está vinculado a nenhum tenant."
            icon={<Building2 className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-3">
            <div className="hidden md:block">
              <ListTableHeader className="grid grid-cols-2 gap-4">
                <div>Tenant</div>
                <div>Role</div>
              </ListTableHeader>
            </div>
            {members.map((m) => (
              <ListRowCard key={m.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <Link
                    href={`/admin/tenants/${m.tenantId}`}
                    className="font-medium text-brand-text hover:text-brand-neon transition-colors"
                  >
                    {m.tenantName}
                  </Link>
                  <span className="ml-2 text-xs text-brand-muted font-mono">({m.tenantSlug})</span>
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
