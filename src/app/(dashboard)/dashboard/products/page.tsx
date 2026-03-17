import {
  getDashboardTenantContext,
  listProductsForTenant,
  computeMrrForTenant,
} from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { StatsRow } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { AddProductForm } from "./add-product-form";
import { Package } from "lucide-react";

function formatCurrency(value: string | number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(Number(value));
}

function billingLabel(billingType: string, billingInterval: string | null): string {
  if (billingType === "recurring") {
    return billingInterval === "yearly" ? "Recorrente (anual)" : "Recorrente (mensal)";
  }
  return "Pagamento único";
}

export default async function DashboardProductsPage() {
  const { tenantId } = await getDashboardTenantContext();
  const [products, mrrData] = await Promise.all([
    listProductsForTenant(tenantId, { activeOnly: false }),
    computeMrrForTenant(tenantId),
  ]);

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-text">Produtos e valor de ticket</h1>
        <AddProductForm />
      </div>

      {products.length > 0 && mrrData.mrr > 0 && (
        <div className="mb-6">
          <StatsRow
            items={[
              {
                label: "MRR (receita recorrente mensal)",
                value: formatCurrency(mrrData.mrr, mrrData.currency),
              },
            ]}
          />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          description="Cadastre produtos ou serviços com o valor de ticket. Marque como recorrente (mensal/anual) para calcular o MRR."
          icon={<Package className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          <div className="hidden lg:grid">
            <ListTableHeader className="grid grid-cols-6 gap-4">
              <div>Nome</div>
              <div>Descrição</div>
              <div>Valor</div>
              <div>Cobrança</div>
              <div>Moeda</div>
              <div>Status</div>
            </ListTableHeader>
          </div>
          {products.map((p) => (
            <ListRowCard
              key={p.id}
              className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center"
            >
              <div className="font-medium text-brand-text">{p.name}</div>
              <div className="text-sm text-brand-muted truncate" title={p.description ?? ""}>
                {p.description ?? "—"}
              </div>
              <div className="text-brand-text font-medium">
                {formatCurrency(p.unitPrice, p.currency)}
              </div>
              <div className="text-sm text-brand-muted">
                {billingLabel(p.billingType, p.billingInterval)}
              </div>
              <div className="text-sm text-brand-muted">{p.currency}</div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${
                    p.isActive
                      ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                      : "bg-brand-text/5 border-brand-text/10 text-brand-muted"
                  }`}
                >
                  {p.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
