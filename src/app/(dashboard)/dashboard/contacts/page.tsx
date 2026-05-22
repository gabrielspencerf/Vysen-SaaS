import { getDashboardTenantContext, listContactsForTenant } from "@/server/dashboard";
import { PageSection } from "@/components/layout";
import { ListTableHeader, ListRowCard } from "@/components/layout";
import { DashboardPageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Button } from "@/components/ui";
import { ImportExportActions } from "@/components/dashboard/import-export-actions";
import { UserCircle } from "lucide-react";
import { formatDateTime as formatDate } from "@/lib/i18n/date";

const CONTACTS_LIMIT = 200;

export default async function DashboardContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { tenantId } = await getDashboardTenantContext();
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const contactsList = await listContactsForTenant(tenantId, {
    search,
    limit: CONTACTS_LIMIT,
  });

  return (
    <PageSection variant="plain" className="px-1 py-0 sm:px-2 md:px-2 md:pt-0 md:pb-0">
      <DashboardPageHeader
        title="Contatos"
        description="Lista de contatos consolidados por importação e interações."
        icon={UserCircle}
        badges={[`${contactsList.length} itens`]}
        actions={
          <>
            <ImportExportActions
              exportUrl="/api/dashboard/contacts/export"
              importUrl="/api/dashboard/contacts/import"
              templateUrl="/templates/modelo-contatos.csv"
              search={search}
              label="Contatos"
            />
            <form method="GET" action="/dashboard/contacts" className="flex gap-2">
              <Input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Nome, e-mail ou telefone"
                className="w-48 bg-brand-surface border-brand-border text-brand-text"
                aria-label="Buscar contatos"
              />
              <Button type="submit" variant="primary" size="sm" className="btn-cta-primary">
                Buscar
              </Button>
            </form>
          </>
        }
      />

      {contactsList.length === 0 ? (
        <EmptyState
          title={search ? "Nenhum contato encontrado" : "Nenhum contato ainda"}
          description={
            search
              ? "Tente ajustar seus critérios de busca."
              : "Contatos criados a partir de conversas ou importação aparecerão aqui."
          }
          icon={<UserCircle className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {contactsList.length >= CONTACTS_LIMIT && (
            <p className="mb-3 text-sm text-brand-muted">
              Mostrando até {CONTACTS_LIMIT} resultados. Use a busca para refinar.
            </p>
          )}

          <div className="hidden lg:grid">
            <ListTableHeader className="grid grid-cols-5 gap-4">
              <div>Nome</div>
              <div>E-mail</div>
              <div>Telefone</div>
              <div>Origem</div>
              <div>Atualizado em</div>
            </ListTableHeader>
          </div>

          {contactsList.map((contact) => (
            <ListRowCard
              key={contact.id}
              className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center"
            >
              <div className="font-medium text-brand-text">
                {contact.name ?? contact.email ?? contact.phone ?? contact.id}
              </div>
              <div className="text-sm text-brand-muted truncate" title={contact.email ?? ""}>
                {contact.email ?? "—"}
              </div>
              <div className="text-sm text-brand-muted">{contact.phone ?? "—"}</div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-text/5 px-2 py-0.5 text-xs font-medium text-brand-text border border-brand-text/10">
                  {contact.source}
                </span>
              </div>
              <div className="text-xs text-brand-muted">
                {formatDate(contact.updatedAt)}
              </div>
            </ListRowCard>
          ))}
        </div>
      )}
    </PageSection>
  );
}
