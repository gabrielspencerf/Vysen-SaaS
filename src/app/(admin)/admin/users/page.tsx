import Link from "next/link";
import { listUsers } from "@/server/admin/users";
import { PageSection } from "@/components/layout/page-section";
import { ListTableHeader } from "@/components/layout/list-table-header";
import { ListRowCard } from "@/components/layout/list-row-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function AdminUsersPage() {
  const users = await listUsers();
  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-text">Usuários</h1>
        <Button asChild className="btn-cta-primary text-sm">
          <Link href="/admin/users/new">Novo usuário</Link>
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Nenhum usuário cadastrado"
          description="Você ainda não possui usuários. Crie o primeiro usuário para começar."
          action={
            <Button asChild className="btn-cta-primary mt-2">
              <Link href="/admin/users/new">Criar Usuário</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="hidden md:block">
            <ListTableHeader className="grid grid-cols-4 gap-4">
              <div>Nome</div>
              <div>E-mail</div>
              <div>Status</div>
              <div className="text-right">Ações</div>
            </ListTableHeader>
          </div>
          {users.map((u) => (
            <ListRowCard key={u.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div>
                <p className="text-sm font-semibold text-brand-text">{u.name ?? "—"}</p>
              </div>
              <div className="text-sm font-mono text-brand-muted truncate" title={u.email}>{u.email}</div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    u.isActive
                      ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20"
                      : "bg-brand-border/50 text-brand-muted border border-brand-border"
                  }`}
                >
                  {u.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-center md:justify-end gap-3 text-sm">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="text-brand-muted hover:text-brand-text transition-colors"
                >
                  Ver
                </Link>
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
