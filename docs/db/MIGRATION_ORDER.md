# Ordem real das migrations

A pasta `src/db/migrations/` é a **fonte canônica**. Este documento reflete o
estado real do journal (`src/db/migrations/meta/_journal.json`) — não é mais
um "plano por domínio", e sim o histórico aplicado.

## Estado atual (até 2026-05)

| Idx | Tag | Conteúdo |
|---|---|---|
| 0 | `0000_concerned_blacklash` | Schema inicial completo (auth, integrations, raw-events, funnels-leads, conversations, snapshots, ai-alerts-audit). |
| 1 | `0001_google_ads_currency_code` | Coluna `currency_code` em `google_ads_accounts`. |
| 2 | `0002_app_global_config` | Tabela `app_global_config` (setup web criptografado). |
| 3 | `0003_hardening_integrations` | Hardening de integrações (UAZAPI, dedup raw events, Typebot metrics). |
| 4 | `0004_married_wasp` | user_profiles, complaints, onboarding, pagespeed, tenant_assets, uazapi_instances/webhook_events, contacts, opportunities, products + ALTERs em conversations (`evolution_instance_id` nullable + `uazapi_instance_id`, `contact_id`). |
| 5 | `0004b_uazapi_webhook_and_conversations` | (Era duplicata 0004 antes do rename em 2026-05.) CHECK constraint exclusiva Evolution/UAZAPI em conversations + indexes únicos parciais. |
| 6 | `0005_contacts_opportunities_user_profiles` | Reforço idempotente de objetos da 0004. |
| 7 | `0006_negocio_produtos_onboarding_pagespeed_reclamacoes` | Idem; também garante `products`/`onboarding_steps`/`pagespeed_results` em ambientes parciais. |
| 8 | `0007_pagespeed_metric_date_products_billing_mrr` | `pagespeed_results.metric_date`, `products.billing_*`, MRR. Limpa duplicatas existentes. |
| 9 | `0008_seed_onboarding_steps` | Seed dos passos de onboarding. |
| 10 | `0009_add_conversations_uazapi_instance_id` | Garantia idempotente que a coluna existe em DBs cuja 0004 aplicou parcial. |
| 11 | `0010_conversation_messages_sent_by_bot` | Coluna `sent_by_bot` em `conversation_messages`. |
| 12 | `0011_auth_password_reset_tokens` | Tabela `password_reset_tokens`. |
| 13 | `0012_uazapi_structured_credentials` | `uazapi_instances.token_encrypted` + `admin_token_encrypted`. |
| 14 | `0013_agent_notifications_followups` | `internal_notifications` + `followup_tasks`. |
| 15 | `0014_vysen_knowledge_pgvector` | `knowledge_documents/chunks/embeddings` (RAG via pgvector). |
| 16 | `0015_vysen_usage_events` | Telemetria do copiloto Vysen. |
| 17 | `0016_security_rls_tenant_policies` | Políticas RLS opt-in via `app.enforce_rls`. |
| 18 | `0017_tenant_role_permissions` | Overrides de permissão por tenant. |
| 19 | `0018_meta_ads_and_clarity` | Tabelas Meta Ads + Clarity (OAuth, accounts, snapshots, logs). |
| 20 | `0019_chatwoot_whatsapp_cloud_channels` | Canais nativos Chatwoot + WhatsApp Cloud (accounts, numbers, webhook_events, ALTER conversations CHECK quaternário). |
| 21 | `0020_leads_status_default` | `leads.status` ganhou `DEFAULT 'new'`. |
| 22 | `0021_knowledge_scope_check` | CHECK constraint `(scope='global' ∧ tenant_id NULL) ∨ (scope='tenant' ∧ tenant_id NOT NULL)` em knowledge_*. |
| 23 | `0022_vysen_usage_events_correlation` | `request_id` + `estimated_cost_usd` em vysen_usage_events; índice parcial. |
| 24 | `0023_knowledge_embeddings_hnsw` | Substitui IVFFlat por HNSW em knowledge_embeddings.embedding. |
| 25 | `0024_opportunity_complaint_enums` | `opportunities.stage` e `complaints.status` migrados para pgEnum. |
| 26 | `0025_operational_created_at_indexes` | Índices `(tenant_id, created_at DESC)` em complaints/contacts/opportunities/products. |

## Aplicar em produção

- **Single réplica**: `npm run db:migrate` direto.
- **Múltiplas réplicas no boot (Swarm/K8s)**: `npm run db:migrate:safe` — wrapper com
  `pg_advisory_lock(4242)` que serializa execução entre réplicas concorrentes.
  Os YAMLs do Swarm em `docker-stack.swarm*.yml` já chamam o wrapper.

## Convenções

- **Idempotência obrigatória** em toda migration nova: `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `ADD CONSTRAINT ... IF NOT EXISTS` via blocos
  `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL END $$;`.
- **Enums novos**: adicionar valores no FINAL do enum (ordem importa para upgrade
  de versões mais antigas do Postgres que não suportam reordenação).
- **Backfill antes de constraint**: ao adicionar NOT NULL / CHECK em coluna
  existente, primeiro UPDATE para preencher/normalizar valores; só então
  o ALTER. Ver `0024_opportunity_complaint_enums.sql` como referência.
- **`DEFAULT` + `ALTER COLUMN TYPE`**: PostgreSQL exige `DROP DEFAULT` antes do
  ALTER e re-aplicar com cast explícito depois.

## Verificações pós-geração

- **Índices únicos parciais**: confirmar `CREATE UNIQUE INDEX ... WHERE ...` em
  `leads` (3 índices), `ai_classifications` (1 índice), raw events (`*_dedup_unique`).
- **Enums**: todos os `CREATE TYPE ... AS ENUM` devem vir antes do primeiro uso.
- **NOTICEs de truncamento**: nomes de FK > 63 chars são truncados pelo
  Postgres — inofensivo. Ver `docs/log/REGISTRO.md` (entrada 1.10).

## Histórico de drift resolvido

- **2026-05** — Duplicata `0004_uazapi_webhook_and_conversations.sql` renomeada
  para `0004b_*` (mesmo conteúdo SQL — só a tag mudou). DB virgem agora aplica
  migrate sem ambiguidade. Detalhes em `docs/REVISAO_GERAL_2026-05.md`.
