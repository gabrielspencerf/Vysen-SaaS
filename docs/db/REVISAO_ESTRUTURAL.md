# Revisão de tabelas e consistência estrutural

Verificação periódica: schema Drizzle ↔ migrations ↔ journal.

---

## 1. Migrations e journal

| idx | Tag | Arquivo | Conteúdo |
|-----|-----|---------|----------|
| 0 | 0000_concerned_blacklash | 0000_concerned_blacklash.sql | Enums, auth (tenants, users, roles, permissions, role_permissions, memberships, sessions), integrations (integrations, google_ads_accounts, typebot_bots, evolution_instances), raw-events, funnels-leads, conversations, snapshots, ai-alerts-audit. |
| 1 | 0001_google_ads_currency_code | 0001_google_ads_currency_code.sql | ADD COLUMN currency_code em google_ads_accounts. |
| 2 | 0002_app_global_config | 0002_app_global_config.sql | CREATE TABLE app_global_config. |
| 3 | 0003_hardening_integrations | 0003_hardening_integrations.sql | provider_enum + 'uazapi'; typebot_bots (webhook_secret_encrypted, api_token_encrypted, metrics_api_base_url); CREATE TABLE uazapi_instances; índices únicos parciais dedup em typebot_webhook_events e evolution_webhook_events. |

Todos os arquivos em `src/db/migrations/*.sql` estão referenciados no `meta/_journal.json` na ordem acima. Nenhuma migration órfã.

---

## 2. Schema (tabelas) ↔ migrations

- **Auth:** tenants, users, roles, permissions, role_permissions, memberships, sessions — criados em 0000.
- **App:** app_global_config — 0002.
- **Integrations:** integrations, google_ads_accounts (base em 0000; currency_code em 0001), typebot_bots (base em 0000; colunas extras em 0003), evolution_instances (0000), uazapi_instances (0003).
- **Raw-events, funnels-leads, conversations, snapshots, ai-alerts-audit:** 0000.
- **Enums:** 0000 cria todos; 0003 adiciona valor 'uazapi' ao provider_enum. Alinhado com `src/db/enums.ts`.

---

## 3. Convenções verificadas

- PK: `id uuid` com `defaultRandom()`.
- Timestamps: `timestamp(6) with time zone`.
- Tabelas e colunas em snake_case no SQL; camelCase no schema Drizzle.
- FKs com ON DELETE cascade/set null conforme domínio.
- Índices únicos parciais (dedup) em typebot_webhook_events e evolution_webhook_events (0003).

---

## 4. Comando para aplicar tudo

```bash
npm run db:migrate
```

Garante que o banco está alinhado com as 4 migrations. Após alterações no schema, gerar nova migration com `npm run db:generate` e registrá-la no journal antes de rodar `db:migrate`.
