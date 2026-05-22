import Link from "next/link";
import {
  getDashboardTenantContext,
  listOpportunitiesForTenant,
} from "@/server/dashboard";
import { PageSection, ListTableHeader, ListRowCard } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/i18n/date";

const OPPORTUNITIES_LIMIT = 200;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateTime(d);
}

function formatCurrency(value: string | null): string {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

export default async function DashboardOpportunitiesPage() {
  const { tenantId } = await getDashboardTenantContext();
  const opportunities = await listOpportunitiesForTenant(tenantId, {
    limit: OPPORTUNITIES_LIMIT,
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <DashboardPageHeader
        title="Oportunidades"
        description="Pipeline comercial com estágio, valor e evolução dos negócios."
        icon={TrendingUp}
        badges={[`${opportunities.length} itens`]}
      />

      {opportunities.length === 0 ? (
        <EmptyState
          title="Nenhuma oportunidade ainda"
          description="Quando você começar a criar oportunidades a partir de leads, contatos ou conversas, elas aparecerão aqui."
          icon={<TrendingUp className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {opportunities.length >= OPPORTUNITIES_LIMIT && (
            <p className="mb-3 text-sm text-brand-muted">
              Mostrando até {OPPORTUNITIES_LIMIT} resultados.
            </p>
          )}

          <div className="hidden lg:grid">
            <ListTableHeader className="grid grid-cols-6 gap-4">
              <div>Título</div>
              <div>Lead / Contato</div>
              <div>Estágio</div>
              <div>Valor</div>
              <div>Início contato</div>
              <div>Atualizado em</div>
            </ListTableHeader>
          </div>

          {opportunities.map((o) => (
            <ListRowCard
              key={o.id}
              className="grid grid-cols-1 gap-4 items-center lg:grid-cols-6"
            >
              <div>
                <Link
                  href={`/dashboard/opportunities/${o.id}`}
                  className="font-medium text-brand-text hover:text-brand-neon transition-colors"
                >
                  {o.title ?? "(sem título)"}
                </Link>
              </div>
              <div className="text-sm text-brand-muted">
                {o.leadId && o.contactId
                  ? `Lead ${o.leadId.slice(0, 8)} · Contato ${o.contactId.slice(0, 8)}`
                  : o.leadId
                    ? `Lead ${o.leadId.slice(0, 8)}`
                    : o.contactId
                      ? `Contato ${o.contactId.slice(0, 8)}`
                      : "—"}
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                  {o.stage}
                </span>
              </div>
              <div className="text-sm text-brand-text font-medium">
                {formatCurrency(o.jobValue)}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(o.contactStartedAt)}
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(o.updatedAt)}
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}

