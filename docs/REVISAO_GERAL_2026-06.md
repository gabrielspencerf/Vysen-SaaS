# Revisão Geral — 2026-06-22

> **Snapshot de auditoria.** Sucede `docs/REVISAO_GERAL_2026-05.md` e `docs/REVISAO_FOLLOWUP_2026-05.md`. Documentos posteriores que diferirem devem ser tratados como sucessores deste.

## Metodologia

Auditoria multi-agente: **94 documentos** revisados individualmente (cada um cruzado contra o código real, não contra a própria narrativa) e **18 subsistemas de código** auditados em paralelo, seguidos de **verificação adversarial** de cada achado crítico/alto (um agente cético tentando refutar cada um). Achados refutados estão listados na §5 para que não voltem a ser perseguidos.

- Docs: 307 achados (7 crít, 65 altos, 108 médios, 127 baixos); 50 crít/altos verificados como reais, 1 refutado.
- Código: 99 achados (4 crít, 26 altos, ~38 médios, ~31 baixos); 13 crít/altos confirmados, 4 refutados.
- Baseline no início da auditoria: `tsc --noEmit` limpo; `eslint` 0 erros / 44 warnings (todos `no-unused-vars`).

**Correção pré-requisito já aplicada:** `package.json` tinha `next` rebaixado para `^9.3.3` (incompatível com App Router/React 19, build quebrado). Restaurado para `^15.5.14` (instalado 15.5.19) e `npm install` re-sincronizou o lockfile.

---

## 1. Sumário executivo

A disciplina de segurança da aplicação está acima da média (96 rotas com authz centralizado via `requireDashboardApiAuth`/`requireAdmin`, RLS+CSRF+RBAC, SQL parametrizado, Argon2id, mitigação de timing/enumeração no login, sem secrets hardcoded). Porém a auditoria confirmou **uma fragilidade arquitetural central**: o isolamento multi-tenant via Row Level Security é, na prática, decorativo. O isolamento real depende inteiramente de cláusulas `where(eq(tenantId))` escritas à mão em cada query — sem rede de segurança no nível do banco.

A documentação divergiu fortemente do código nos últimos ~3 meses: a maioria dos runbooks de deploy referencia arquivos/variáveis que não existem mais, e vários docs de RBAC descrevem um modelo de acesso que o código não implementa.

---

## 2. Código — Row Level Security é decorativo (🔴 prioridade máxima)

Três ângulos independentes, todos verificados, provam que o backstop de isolamento não protege as queries reais:

| # | Local | Constatação verificada |
|---|-------|------------------------|
| 1 | `src/server/dashboard/api-auth.ts:18` | `requireDashboardApiAuth` define os GUCs `app.current_tenant_id`/`app.enforce_rls` dentro de `runWithRlsContext`, mas **essa transação dá COMMIT quando a função de auth retorna**. Os handlers e os 26 services de dashboard chamam `getDb()` (pool root, sem transação no AsyncLocalStorage), então no momento da query `app.enforce_rls` está vazio e a policy da migration 0016 curto-circuita para `TRUE`. Mesmo com `SECURITY_ENFORCE_RLS=true`, o RLS oferece **zero isolamento** em toda a superfície `/api/dashboard`. |
| 2 | migrations `0019`, `0026`, `0027` | **Quatro tabelas criadas depois do rollout de RLS (0016) não têm policy alguma:** `chatwoot_accounts`, `whatsapp_cloud_numbers` (+ as `*_webhook_events`), `tenant_smtp_configs`, `vysen_chat_threads`. Todas guardam segredos por-tenant (`api_token_encrypted`, `access_token_encrypted`, `password_encrypted`, `webhook_verify_token`). O DO-block do 0016 só cobriu tabelas existentes naquele momento; o padrão de reaplicar RLS inline (como o 0018 faz) não foi seguido. |
| 3 | `src/workers/processors/*.ts:141` | Os processors carregam o raw event apenas por `rawEventId` e **nunca verificam `raw.tenantId === job.tenantId`** antes de escrever conversas/mensagens/contatos/leads. `WORKER_DB_ACCESS_MODE` default `off` + RLS off ⇒ nenhum guard no nível do banco. |

**Consequência:** um único filtro `tenantId` esquecido em qualquer query futura = leitura/escrita cross-tenant sem nenhuma rede de proteção.

**Correção recomendada:** executar o corpo do handler **dentro** de `runWithRlsContext` (para que `getDb()` retorne o cliente da transação com os GUCs vivos); adicionar migration aplicando `ENABLE/FORCE ROW LEVEL SECURITY` + `tenant_rls_policy` nas quatro tabelas órfãs; e nos workers afirmar `raw.tenantId === job.tenantId` antes de qualquer escrita. Alternativa honesta: assumir explicitamente "isolamento apenas na camada de aplicação" e remover a fachada de RLS — mas não deixar um guard que o startup exige e que nunca alcança as queries.

> Nota: o default fail-open por env (`SECURITY_ENFORCE_RLS` ausente) é **inalcançável em produção** porque `instrumentation.ts:8` chama `assertProductionSecurityBaseline()`, que aborta o boot. O problema real é o ângulo #1 (queries fora da transação), que torna o RLS inócuo independentemente da env.

---

## 3. Código — outros crít/altos confirmados

| Sev | Local | Problema | Correção |
|-----|-------|----------|----------|
| 🔴 alto | `src/server/integrations/meta-ads/capi.ts:76` | `action_source: "system"` não é valor válido da Conversions API da Meta (correto: `system_generated`). Toda conversão offline enviada via `/api/dashboard/meta-ads/capi/send` é rejeitada/degradada; a rota reporta sucesso por `events_received`, mascarando a falha. Atribuição de ads silenciosamente quebrada. | Usar `system_generated`. |
| 🔴 alto | `src/server/config/openai-agent.ts:281` | API key de OpenAI **por-tenant gravada em plaintext** no jsonb `tenants.settings` (`openai_agent_api_key`). A key global usa AES-256-GCM; a per-tenant ignora. Segredo de provider exposto at-rest. | Cifrar com `encryptSecretForStorage`; nunca ecoar de volta na config pública. |
| 🔴 alto | `src/server/tenancy/tenant-activity.ts:49` | Audit log só é gravado quando a flag `auditEnabled` do tenant está ligada (default off). SMTP e CRUD de integrações passam por aí ⇒ mutações admin **não auditadas** em qualquer tenant sem opt-in. | Gravar audit sempre para ações de mutação; só a notificação in-app deve depender da flag. Capturar `ip`/`userAgent` (hoje sempre NULL). |
| 🔴 alto | `src/server/followup/enqueue-due-followups.ts:17` | Lock `setnx` + `expire` não-atômico. Crash/throw entre as duas chamadas deixa a chave sem TTL ⇒ **followups daquele tenant param permanentemente**. | `redis.set(key, '1', 'EX', 90, 'NX')`. |
| 🔴 alto | `src/db/schema/.../conversation-messages.ts:43` | Sem índice único em `(conversationId, externalId)`. Dedup é SELECT-then-INSERT (TOCTOU); combinado com o reaper at-least-once ⇒ mensagem inserida em duplicata e `enqueueConversationClassification` dispara 2× (custo OpenAI duplicado). | Índice único parcial + `insert().onConflictDoNothing()`. |
| 🔴 alto | `src/workers/queue/client.ts:216` | Reaper: `BRPOPLPUSH` move o item para a lista `processing`, e só depois faz `ZADD` no tracker (erro engolido por `.catch()`). Crash no meio ⇒ job preso em `processing` para sempre; o reaper só varre o ZSET. Job perdido, sem retry/DLQ. | Tornar move+track atômico (Lua `LMOVE`+`ZADD`) ou o reaper também varrer a lista. |
| 🟠 alto | `src/config/env.ts:51` | `isProduction` é match exato de `"production"`. Staging/`NODE_ENV` ausente pula os guards de baseline (RLS/CSRF/plaintext/`META_APP_SECRET`). *(Verificação amenizou: perde-se a rede fail-fast de startup, não o enforcement em runtime — que usa flags independentes.)* | Introduzir `APP_ENV` explícito e tratar staging como equivalente a produção nos guards. |

---

## 4. Código — médios relevantes e dead code

- **Ações de escrita gated apenas por `DASHBOARD_READ`** (`clarity/connections`, `complaints`, `support`, `vysen/threads` PUT/DELETE): um papel read-only cria/deleta conexões e enfileira syncs. Exigir permissão de write.
- **Sem rate-limit em endpoints de PII/outbound em massa**: export de leads/contacts (CSV até 5000 linhas), `meta-ads/capi/send`, `google-ads/offline-conversions/export`, `pagespeed/fetch`, `clarity/sync`.
- **Open redirect via backslash** (`src/lib/security/redirect.ts:17`): `sanitizeInternalRedirect` bloqueia `//`, `://`, `..`, mas não `\`. Em modo relaxed (`SECURITY_STRICT_REDIRECTS=false`, default do rollout) `/\evil.com` passa.
- **`resolveSecret()` retorna ciphertext quando o decrypt falha** (`src/server/integrations/uazapi/client.ts:38`): viola a política fail-closed de segredos; em rotação de chave o ciphertext vira "segredo".
- **Chatwoot webhook usa `api_token` (credencial outbound) como segredo HMAC inbound** (`chatwoot/validate.ts:34`): modelo de chave incorreto.
- **`upsertVysenThread` IDOR/oracle** (`src/server/dashboard/vysen-threads.ts:138`): PUT-by-id faz UPDATE escopado e, se não casar, INSERT com o id do cliente ⇒ duplicate-key 500 não tratado = oráculo de existência cross-tenant. PUT que não casa deve retornar 404.
- **`consume*PendingConnection` GET+DEL não-atômico** (`meta-ads-pending.ts:43`, `google-ads-pending.ts:46`): usar `GETDEL`/Lua para garantir token de pending single-use sob concorrência.
- **Dead code:** todo o subsistema `src/server/vysen/runtime` + provider Agno não é consumido em lugar nenhum (a documentação vende "Agno runtime"). Crypto AES-256-GCM reimplementada 4× (`security/secret-crypto.ts`, `config/global.ts`, `integrations/google-ads/config.ts`, `integrations/meta-ads/config.ts`) — consolidar para que um fix de segurança se propague. Instrumentação de debug esquecida em páginas de produção (`agentDebugLog({runId:'admin-pages-styling'})` em `(superadmin)/superadmin/{users,tenants}/page.tsx:13`).
- **Duplicação de route group:** quase toda a árvore `(superadmin)` são shims `export { default } from '@/app/(admin)/...'`; os 3 layouts têm o mesmo gate de auth byte-a-byte. Eleva o risco de uma mudança de authz ser aplicada em uma cópia e esquecida em outra.

---

## 5. Achados refutados pela verificação adversarial (NÃO perseguir)

| Alegação | Por que foi refutada |
|----------|----------------------|
| "RLS fail-open por env default é explorável" | `instrumentation.ts:8` → `assertProductionSecurityBaseline()` aborta o boot em produção se `SECURITY_ENFORCE_RLS≠true`. É um default de rollout dev/test, gated. *(O problema real do RLS é a §2 #1, não a env.)* |
| "Uma misconfig de `NODE_ENV` liga rate-limit + CSRF + RLS + plaintext fail-open simultaneamente" | Só o rate-limit é causalmente ligado a `isDev`. CSRF/RLS dependem de `securityEnforceCsrf`/`securityEnforceRls` independentes; plaintext exige `SECURITY_ALLOW_PLAINTEXT_SECRETS=true` adicional. |
| "Typebot metrics sync = SSRF explorável por tenant-admin" | Write da config e trigger do sync exigem **super_admin** (`requireAdmin`), não tenant-admin. É gap de defense-in-depth, não escalada de privilégio. |
| "Flip de `SECURITY_ENFORCE_RLS` esconde linhas global de knowledge / quebra inserts" | As queries de knowledge rodam via `getDb()` no pool root, fora de qualquer `runWithRlsContext` ⇒ a policy permite tudo independentemente do flag. |
| (Docs) "`docker compose exec app npx drizzle-kit migrate` falha — drizzle-kit é devDependency" | `drizzle-kit` está em `dependencies` (`package.json:49`), preservado pelo `npm ci --omit=dev`. O comando funciona. |

---

## 6. Documentação — divergência código × doc

Status dos 94 docs: **32 current · 43 partially-stale · 11 obsolete · 5 stale · 3 aspirational**. Padrões dominantes:

### 6.1 🔴 RBAC documentado incorretamente (crítico)

`docs/SUPERADMIN_AREA.md` afirma que `(company-admin)/admin/*` é gated por papel `admin_tenant` com escopo limitado ao tenant atual. **Falso.** Os três route groups (`(admin)`, `(superadmin)`, `(company-admin)`) gateiam pelo mesmo `admin:access` global via `hasPermission(userId, null, ...)`. A migration de seed **nega** `admin:access` a `admin_tenant`, então esses usuários caem em `/forbidden`. A função `requireSuperAdmin` citada no doc **não existe** (é `requireAdmin`, e os layouts nem a chamam — usam `hasPermission` inline).

Pior: o código por trás de `(company-admin)` chama `getAgencyPortfolioData()`, que **agrega leads/conversas/oportunidades de todos os tenants sem filtro** (`src/server/admin/agency-dashboard.ts:56`). Hoje protegido pelo gate super_admin, mas se o gate for afrouxado para admitir `admin_tenant` (o passo óbvio dado o branding "Admin da empresa"), torna-se vazamento cross-tenant imediato. **Decidir a intenção do route group** e, se for tenant-scoped, reescrever a camada de dados para escopar por `tenantId`.

### 6.2 Snapshots de review apresentados como estado atual

- `docs/REVISAO_GERAL_2026-05.md` lista 12 críticos como abertos — **todos já corrigidos** (0004 dup → 0004b, path-traversal, ordem do gate OAuth, pgvector cross-tenant, token Meta CAPI no body, headers CSP, rate-limit do vysen chat). Falta banner "SUPERSEDED".
- `docs/REVISAO_COERENCIA_DOCUMENTACAO_2026-04-26.md` e `docs/REVISAO_UX_ESTRUTURAL_2026-04.md`: teses centrais já executadas (split de 3 camadas implementado; bullmq removido; matriz indexada).

### 6.3 🔴 Runbooks de deploy quebrados

- `docs/DOCKER_SWARM_PORTAINER.md` e `docs/DEPLOY_STACK_PASSO_A_PASSO.md` mandam colar `docker-stack.swarm.yml` / `docker-stack.swarm.app-only.yml` — **arquivos não existem no repo** (só `docker-compose.yml`/`.dev.yml`).
- `docs/DEPLOY_VPS.md` afirma "não há Dockerfile da aplicação" — existe (multi-stage na raiz).
- `docs/BACKUP_RESTORE_VPS.md`: exemplos usam `observabilidade-app-*`; nome real é `observabilidade-vysen-*` (`POSTGRES_DB=vysen`) ⇒ restore aponta arquivo inexistente.
- `docs/DOCKER_SWARM_PORTAINER.md`: clone usa `observabilidade-saas`; repo real é `Vysen-SaaS`. Volumes `app_postgres_data`/`app_redis_data` vs reais `vysen_postgres_data`/`vysen_redis_data`.
- `/api/health` documentado como expondo redis+worker+heartbeat; na verdade é DB-only (`{ok}`); redis/worker estão em `/api/health/details` (token `HEALTH_DETAILS_TOKEN`).

### 6.4 Variáveis de ambiente erradas/faltando (setup novo falha)

| Doc | Problema |
|-----|----------|
| `BASE2_GOOGLE_ADS_ETAPA1.md` | Diz `ENCRYPTION_KEY`; real é `GOOGLE_ADS_ENCRYPTION_KEY`. Falta `GOOGLE_ADS_DEVELOPER_TOKEN` (obrigatória; `getEnv` lança sem ela). |
| `CONFIG_CREDENTIALS.md` | Não cita `INTEGRATIONS_ENCRYPTION_KEY`/`CONFIG_ENCRYPTION_KEY` (Typebot/Evolution/UAZAPI quebram ao salvar segredo). |
| `POSTGRESQL_WINDOWS.md` | Omite `SEED_ADMIN_PASSWORD` (seed sai non-zero sem ela). |

### 6.5 Docs BASE2 descrevendo features antigas como atuais

`BASE2_CHATWOOT`/`BASE2_WHATSAPP_CLOUD` ("sem UI, use SQL INSERT" → CRUD completo existe, commit 13ae82c); `BASE2_DETALHE_LEAD_CONVERSATION` ("read-only" → tem edit/delete); `BASE2_GOOGLE_ADS_AUTH` (fluxo single-step → agora pending + tela de seleção); `BASE2_TELAS_OPERACIONAIS` (paths `(dashboard)/leads` → reais `(dashboard)/dashboard/leads`; `DashboardShell` com header → hoje é sidebar). `RESUMO_PROJETO` subdimensiona escopo (falta Contacts, Opportunities, Products, Complaints, PageSpeed, Onboarding, Kanban, funnel-config-by-UI).

### 6.6 Docs para arquivar em `docs/log/`

`BACKLOG_PRODUTO_2026-05` (3 itens todos implementados), `BASE2_HOME_HUB` (substituído por `BASE2_DASHBOARD_ANALYTICS`), `REVISAO_GERAL_2026-05`, `REVISAO_COERENCIA_2026-04-26`, `REVISAO_UX_ESTRUTURAL_2026-04`, `design-system/{paleta-cl,glass-effect,sidebar}`, `specs/canais-chatwoot-whatsapp-cloud/migration-{design,precheck}`, entre outros (16 no total).

---

## 7. Ordem de prioridade de correção

1. **RLS de verdade** (§2): handler dentro de `runWithRlsContext` + migration de policy nas 4 tabelas órfãs + check `raw.tenantId === job.tenantId` nos workers. *Maior risco de segurança.*
2. **Meta CAPI `system_generated`** (§3): conversões offline silenciosamente perdidas = impacto financeiro/atribuição.
3. **Segredos**: cifrar OpenAI key per-tenant; `uazapi resolveSecret` fail-closed; consolidar crypto 4×.
4. **Workers/filas**: índice único em `conversation_messages`; lock atômico em followup; reaper `LMOVE` atômico.
5. **Audit sempre grava** (independe de flag) + permissões de write nos endpoints de mutação.
6. **Documentação**: banners SUPERSEDED nos snapshots; corrigir runbooks de deploy e variáveis de env; arquivar os 16 docs obsoletos; reescrever RBAC em `SUPERADMIN_AREA.md`.

---

## Apêndice — cobertura

- **Docs auditados (94):** raiz (`README`, `CHANGELOG`), `docs/*`, `docs/db/*`, `docs/design-system/*`, `docs/log/*`, `docs/specs/*`, `docs/templates/*`.
- **Subsistemas de código (18):** `api-auth-webhooks`, `api-admin`, `api-dashboard`, `api-misc`, `ui-admin-groups`, `ui-dashboard`, `app-shell-middleware`, `server-security`, `server-auth-rbac-tenancy`, `server-integrations-messaging`, `server-integrations-ads`, `server-vysen`, `server-dashboard-logic`, `server-admin-rest`, `db-schema-migrations`, `workers`, `features-lib-config`, `components`.
