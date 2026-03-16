import Link from "next/link";
import { getDashboardTenantContext } from "@/server/dashboard";
import { listConversationsForTenant } from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageSquare } from "lucide-react";

const CONVERSATIONS_LIMIT = 200;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(d));
}

export default async function DashboardConversationsPage() {
  const { tenantId } = await getDashboardTenantContext();
  const conversations = await listConversationsForTenant(tenantId, {
    limit: CONVERSATIONS_LIMIT,
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-text">Conversas</h1>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="Nenhuma conversa ainda"
          description="O histórico de mensagens das suas integrações aparecerá aqui."
          icon={<MessageSquare className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {conversations.length >= CONVERSATIONS_LIMIT && (
            <p className="mb-3 text-sm text-brand-muted">
              Mostrando até {CONVERSATIONS_LIMIT} resultados.
            </p>
          )}

          <div className="hidden lg:grid">
            <ListTableHeader className="grid grid-cols-6 gap-4">
              <div>Identificador</div>
              <div>Instância</div>
              <div>Status</div>
              <div>Mensagens</div>
              <div>Início</div>
              <div>Últ. Sincronia</div>
            </ListTableHeader>
          </div>

          {conversations.map((c) => (
            <ListRowCard key={c.id} className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
              <div>
                <Link
                  href={`/dashboard/conversations/${c.id}`}
                  className="font-mono font-medium text-brand-text hover:text-brand-neon transition-colors"
                >
                  {c.externalId}
                </Link>
              </div>
              <div className="text-sm text-brand-muted">
                {c.instanceDisplay}
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                  {c.status}
                </span>
              </div>
              <div className="text-sm text-brand-muted">
                {c.messageCount}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(c.startedAt)}
              </div>
              <div className="text-xs text-brand-muted">
                {c.lastSyncedAt ? formatDate(c.lastSyncedAt) : "—"}
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
