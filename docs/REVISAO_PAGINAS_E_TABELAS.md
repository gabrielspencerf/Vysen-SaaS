# Revisão geral — Páginas novas e tabelas

Documento gerado para revisão das páginas do dashboard e do mapeamento com o banco de dados.

---

## 1. Páginas do dashboard (revisão)

| Rota | Arquivo | Tabelas usadas | Layout / componentes | Observações |
|------|---------|----------------|----------------------|-------------|
| `/dashboard` | `page.tsx` | — | Redireciona | OK |
| `/dashboard/home` | `home/page.tsx` | Várias (resumo) | PageSection, stats | OK |
| `/dashboard/leads` | `leads/page.tsx` | `leads` | PageSection, ListTableHeader, ListRowCard, EmptyState, ImportExportActions | OK |
| `/dashboard/leads/kanban` | `leads/kanban/page.tsx` | `leads` | PageSection, LeadsKanbanBoard (client) | OK; client faz PATCH para atualizar status |
| `/dashboard/leads/[id]` | `leads/[id]/page.tsx` | `leads`, lead_detail | PageSection | OK |
| `/dashboard/leads/[id]/edit` | `leads/[id]/edit/page.tsx` | `leads` | Formulário edição | OK |
| `/dashboard/contacts` | `contacts/page.tsx` | `contacts` | PageSection, ListTableHeader, ListRowCard, EmptyState, ImportExportActions | OK; depende de tabela `contacts` |
| `/dashboard/conversations` | `conversations/page.tsx` | `conversations`, `conversation_messages`, `evolution_instances`, `uazapi_instances` | PageSection, ListTableHeader, ListRowCard, EmptyState | OK; depende de `conversations.uazapi_instance_id` e `conversations.contact_id` |
| `/dashboard/conversations/[id]` | `conversations/[id]/page.tsx` | `conversations`, messages, contact | Detalhe da conversa | OK |
| `/dashboard/google-ads` | `google-ads/page.tsx` | `google_ads_accounts`, `campaign_snapshots`, attribution | PageSection, AdsSpendChart, ListRowCard, seção Planilha offline | OK |
| `/dashboard/google-ads/connect` | `google-ads/connect/page.tsx` | — | Fluxo OAuth | OK |
| `/dashboard/funnel` | `funnel/page.tsx` | `funnels`, `funnel_steps`, métricas | PageSection | OK |
| `/dashboard/products` | `products/page.tsx` | `products` | PageSection, StatsRow (MRR), ListTableHeader, ListRowCard, EmptyState, AddProductForm | OK |
| `/dashboard/complaints` | `complaints/page.tsx` | `complaints` | PageSection, ListTableHeader, ListRowCard, EmptyState, NewComplaintForm | OK |
| `/dashboard/onboarding` | `onboarding/page.tsx` | `onboarding_steps`, `tenant_onboarding_progress` | PageSection, OnboardingProgress (client) | OK |
| `/dashboard/pagespeed` | `pagespeed/page.tsx` | `tenants` (settings), `pagespeed_results` | PageSection, PageSpeedForm (client), PageSpeedResults (client) | OK; `pagespeed_results` tem `metric_date` (0007) |
| `/dashboard/settings` | `settings/page.tsx` | `users`, `user_profiles` (via API profile) | PageSection, Card, CompanyFilesSection (client) | OK; Configurações + Arquivos da empresa (usa `tenant_assets`) |
| `/dashboard/context` | `context/page.tsx` | tenants (membership) | Escolha de tenant | OK |

**Resumo páginas:** Todas usam `PageSection` ou layout equivalente, componentes de `@/components/layout` e `@/components/ui`. Nenhuma página nova deixa de seguir o padrão. A única página inteiramente client é `settings/page.tsx` (formulário de perfil + tema + CompanyFilesSection); o restante é server component com client apenas onde há interação (Kanban, formulários PageSpeed/onboarding).

---

## 2. Tabelas e migrações

Todas as tabelas usadas pelas páginas acima estão criadas em migrações. Ordem de criação:

| Migração | Tabelas / alterações |
|----------|----------------------|
| `0000_concerned_blacklash.sql` | tenants, users, sessions, memberships, roles, permissions, role_permissions, integrations, evolution_instances, google_ads_accounts, typebot_bots, evolution_webhook_events, google_ads_sync_logs, typebot_webhook_events, funnel_steps, funnels, lead_events, lead_sources, leads, utm_attributions, conversation_messages, conversations, bot_metrics_snapshots, campaign_snapshots, funnel_step_metrics_snapshot, instance_status_logs, ai_classifications, alerts, audit_logs, kpi_rules, processing_failures |
| `0001_google_ads_currency_code.sql` | Coluna `currency_code` em `google_ads_accounts` |
| `0002_app_global_config.sql` | `app_global_config` |
| `0003_hardening_integrations.sql` | Colunas em integrations; tabela `uazapi_instances` |
| `0004_uazapi_webhook_and_conversations.sql` | `uazapi_webhook_events`; coluna `uazapi_instance_id` em `conversations` |
| `0005_contacts_opportunities_user_profiles.sql` | `contacts`, `opportunities`, `user_profiles`; coluna `contact_id` em `conversations` |
| `0006_negocio_produtos_onboarding_pagespeed_reclamacoes.sql` | Colunas em `opportunities` (contact_started_at, contracted_model, job_value); `products`, `tenant_assets`, `onboarding_steps`, `tenant_onboarding_progress`, `pagespeed_results`, `complaints` |
| `0007_pagespeed_metric_date_products_billing_mrr.sql` | `metric_date` em `pagespeed_results`; colunas em `products` (billing_type, billing_interval) |
| `0008_seed_onboarding_steps.sql` | Seed de `onboarding_steps` |
| `0009_add_conversations_uazapi_instance_id.sql` | Garantia da coluna `uazapi_instance_id` em `conversations` (idempotente) |

**Dependências críticas para as páginas novas:**

- **Conversas:** `conversations.uazapi_instance_id` (0004 ou 0009), `conversations.contact_id` (0005).
- **Contatos:** tabela `contacts` (0005).
- **Onboarding:** `onboarding_steps`, `tenant_onboarding_progress` (0006); seed em 0008.
- **PageSpeed:** `pagespeed_results` com `metric_date` (0006 + 0007); URL da landing em `tenants.settings`.
- **Configurações / Arquivos da empresa:** `tenant_assets` (0006), `user_profiles` (0005).
- **Produtos / MRR:** `products` com `billing_type`, `billing_interval` (0006 + 0007).
- **Reclamações:** `complaints` (0006).
- **Leads/Kanban:** `leads` (0000).
- **Oportunidades:** `opportunities` (0005).

Se o banco em uso **não** tiver todas as migrações aplicadas (por exemplo outro host ou outro `DATABASE_URL`), podem ocorrer erros como:

- `não existe a coluna conversations.uazapi_instance_id`
- `não existe a relação 'contacts'`
- `não existe a relação 'opportunities'` ou `'user_profiles'`

---

## 3. Scripts de garantia (ensure)

Para o mesmo `DATABASE_URL` que a aplicação usa, existem scripts que criam tabelas/colunas ausentes de forma idempotente:

| Script | O que garante |
|--------|-------------------------------|
| `npx tsx scripts/ensure-uazapi-instance-id-column.ts` | Coluna `conversations.uazapi_instance_id` + FK + índice |
| `npx tsx scripts/ensure-contacts-table.ts` | Tabela `contacts` (e índices), coluna `conversations.contact_id` + FK + índice |
| `npx tsx scripts/ensure-currency-code.ts` | Coluna `google_ads_accounts.currency_code` |
| `npx tsx scripts/ensure-0005-remaining.ts` | Tabelas `opportunities` e `user_profiles` (+ colunas de negócio em opportunities) |
| `npx tsx scripts/ensure-products-table.ts` | Tabela `products` (+ billing_type, billing_interval) |
| `npx tsx scripts/ensure-0006-tables.ts` | Tabelas `onboarding_steps`, `tenant_onboarding_progress`, `pagespeed_results`, `complaints`, `tenant_assets` (+ seed onboarding) |

**Ordem recomendada** se aparecerem erros de relação/coluna: primeiro `ensure-contacts-table.ts` (contacts é referenciada por opportunities e por conversations.contact_id), depois `ensure-uazapi-instance-id-column.ts`. Se ainda faltar `opportunities` ou `user_profiles`, usar o script descrito na seção 4.

---

## 4. Script para opportunities e user_profiles

Foi adicionado o script `scripts/ensure-0005-remaining.ts`, que garante a existência das tabelas `opportunities` e `user_profiles` (e índices) quando a migração 0005 não foi aplicada no banco que a app usa. Uso:

```bash
npx tsx scripts/ensure-0005-remaining.ts
```

Execute com o mesmo `.env` (mesmo `DATABASE_URL`) da aplicação.

---

## 5. Checklist de nova tela (referência)

Para qualquer nova tela do dashboard, conferir:

- [ ] Página em `(dashboard)/dashboard/<nome>/page.tsx`.
- [ ] Uso de `getDashboardTenantContext()` e de funções de `@/server/dashboard`.
- [ ] Layout com `PageSection` e componentes de `@/components/layout` e `@/components/ui`.
- [ ] Tabelas/colunas usadas existem em alguma migração (ou em script ensure).
- [ ] Se a tela depender de tabela nova, criar migração ou ensure script e documentar aqui.

---

*Última revisão: março 2025.*
