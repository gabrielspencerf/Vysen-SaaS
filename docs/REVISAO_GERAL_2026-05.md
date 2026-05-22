# Revisão geral 2026-05 — Observabilidade SaaS (Vysen)

> **Escopo**: auditoria profunda arquivo-por-arquivo de toda a aplicação, infra e documentação.
> **Data**: 2026-05-22 · **Branch**: `main` · **Versão atual no `package.json`**: `0.3.0` (CHANGELOG congelado em 2026-03-20, código já bem além disso).
> **Método**: 10 agentes paralelos cobrindo Auth/RBAC, API/Webhooks, Workers, DB, Integrações, Vysen, UI, Segurança, Infra/Deploy e Docs. Findings com `file:line` e severidade.
> **Severidades**: 🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Baixo / Informativo.

---

## 0. Sumário executivo

### Estado geral por domínio

| Domínio | Saúde | Observação curta |
|---|---|---|
| Auth/RBAC | 🟠 | Estrutura sólida (Argon2, CSRF, RLS opt-in), mas há falhas críticas no callback Google OAuth e ausência de rotação de sessão em `switchTenant`. |
| API/Webhooks | 🟠 | Pipeline de webhook bem desenhado (HMAC + replay store + RLS), porém **path traversal real** em tenant-assets e ausência total de validação Zod. |
| Workers/Filas | 🔴 | Implementação caseira sobre `BRPOP` (BullMQ instalado mas **não usado**); retry em `setTimeout` é perdido no SIGTERM; Chatwoot/WA Cloud invisíveis no admin. |
| DB/Migrations | 🔴 | **Duplicata 0004** quebra `drizzle-kit migrate` em DB virgem; scripts `ensure-*` são gambiarras tampando o sintoma; `users.email UNIQUE` global bloqueia white-label. |
| Integrações externas | 🟠 | SSRF e tokens criptografados ok, mas decrypt com fallback para texto puro, OAuth sem timeout/retry, e Meta CAPI envia token via query string. |
| Vysen Copilot | 🔴 | Cross-tenant leak potencial no filtro pgvector; `tenantDataTool` sempre executado; **sem rate-limit** no endpoint; fallback duplica custo. |
| UI Admin/Dashboard | 🟡 | Duplicação massiva entre new/edit (~500 LOC), fetchs sem AbortController, listas longas sem virtualização, mistura de design tokens. |
| Segurança/Hardening | 🔴 | **Zero headers** (sem CSP/HSTS/X-Frame), **zero Zod** em handlers, `stack.env` na worktree, redaction de log só cobre telefone. |
| Build/Deploy/Infra | 🔴 | Secrets em `environment:` no Swarm, `app_setup` corre em paralelo com app sem lock, Dockerfile sem HEALTHCHECK, GH Actions sem cache nem pin por SHA. |
| Documentação | 🟠 | ~56 docs, maioria congelada no commit inicial; drifts P0 da `REVISAO_COERENCIA_2026-04-26` continuam abertos; falta release 0.4.0 no CHANGELOG. |

### Top 12 achados críticos (consertar antes de qualquer go-live)

1. 🔴 **DB virgem não sobe**: migrations `0004_married_wasp.sql` e `0004_uazapi_webhook_and_conversations.sql` colidem (`_journal.json` registra ambos no idx 4-5). → renomear a segunda para `0004b_*` e auditar conflitos de objetos.
2. 🔴 **Path traversal em `/api/dashboard/tenant-assets/[id]/file`** (`route.ts:14-50`): `path.join(cwd, "uploads", relativeKey)` sem `resolve+startsWith` — qualquer `../` no `fileKey` lê arquivo arbitrário.
3. 🔴 **OAuth Google: sessão criada antes do gate `isSuperAdmin`** (`src/app/api/auth/google/callback/route.ts:79-91`) — sessão órfã é gravada antes do erro retornar.
4. 🔴 **OAuth state HMAC com fallback `"fallback"` literal** (`src/server/auth/google-oauth.ts:19`) — qualquer ambiente sem `GOOGLE_AUTH_STATE_SECRET`/`SESSION_SECRET` aceita state forjado.
5. 🔴 **Cross-tenant leak no pgvector** (`src/server/vysen/knowledge.ts:198-214`): `(tenantId::uuid IS NULL OR kd.tenant_id = tenantId)` deixa passar docs de outros tenants quando scope/tenant não casam.
6. 🔴 **Token Meta CAPI em query string** (`src/server/integrations/meta-ads/capi.ts:88`) — credencial em logs de proxy/CDN.
7. 🔴 **Vysen chat sem rate-limit e sem cap de prompt** (`src/app/api/dashboard/vysen/chat/route.ts:9-114`) — abuse trivial, custo OpenAI por usuário ilimitado.
8. 🔴 **Workers: retry com `setTimeout` (`runner.ts:242-247`) — perda total no SIGTERM**; `BRPOP` sem visibility timeout — crash mid-job perde job.
9. 🔴 **Decrypt de segredos com fallback para texto puro** (`evolution|uazapi|chatwoot|typebot/credentials.ts` / `validate.ts`): mascarar incidente de chave trocada.
10. 🔴 **Stack Swarm com secrets em `environment:`** (`docker-stack.swarm.yml:78-130`) — visíveis em `docker service inspect`. Placeholders idênticos em 3 blocos (web/worker/setup) — esquecer um = chave default.
11. 🔴 **Zero security headers no Next** (`next.config.ts:1-9`) — sem CSP/HSTS/X-Frame-Options/Referrer-Policy/Permissions-Policy.
12. 🔴 **Webhook Evolution permite bypass de HMAC em "dev"** (`src/server/integrations/evolution/validate.ts:60-67`) via `x-api-key` quando `NODE_ENV !== production` — `NODE_ENV` errado em staging exposto = bypass.

---

## 1. Auth, sessão e RBAC

### 🔴 Críticos

- **Sessão antes do gate em OAuth admin** — `src/app/api/auth/google/callback/route.ts:79-97`. `createSession()` corre antes de `isSuperAdmin()`. Caso negado, a sessão fica órfã no DB com `userId` e `lastActivityAt` preenchidos. Fix: ordenar checks antes de criar sessão; em erro, `invalidateSession(session.id)`.
- **State secret com fallback `"fallback"`** — `src/server/auth/google-oauth.ts:19`. Lance erro fatal no startup se `GOOGLE_AUTH_STATE_SECRET`/`SESSION_SECRET` faltarem.
- **OAuth sem PKCE e sem persistência de state** — callback (`callback/route.ts:46-91`). State HMAC tem TTL 15 min mas não é single-use. Fix: persistir state em tabela com `used_at`, ou nonce em cookie HttpOnly.
- **`switchTenant` sem rotação de token de sessão** — `src/server/tenancy/switch.ts:16-27`. Cookie capturado pré-troca continua válido após escalada de privilégio.

### 🟠 Altos

- `buildClearCookieHeader` sem `Secure`/`SameSite` (`src/server/auth/session.ts:206-208`) — clear pode não combinar com cookie original em navegadores estritos.
- `sameSite: isProd ? "lax" : "lax"` (`src/server/auth/config.ts:40`) — ternário inerte. GET com side-effects vira CSRF.
- **Timing oracle em login** (`src/app/api/auth/login/route.ts:74-77`): caminho "usuário inválido" sai sem chamar Argon2 (~50-200ms de diferença). Fix: hash dummy.
- **Sem rate-limit em `/api/auth/password-reset/confirm`**.
- `createMembership` aceita `roleSlug: "super_admin"` sem proteção extra (`src/server/admin/memberships.ts:104-154`).
- **OAuth Google não valida `id_token` via JWKS** — confia em `userinfo` e `email_verified`. Fix: assinatura do `id_token` + claims.

### 🟡 Médios / 🟢 Baixos

- Middleware checa só presença do cookie (ok, mas adicionar `Cache-Control: no-store` nas respostas autenticadas).
- `buildSetCookieHeader` ignora `opts.httpOnly` (hardcoded — ok mas inconsistente).
- CSRF sem checagem de `Origin/Referer` complementar (`src/server/security/csrf.ts:55-91`).
- Sliding window não estende `expires_at` (`session.ts:99-109`) — documentar.
- Reset não invalida outros tokens de reset não usados (`password-reset.ts:153`).
- Token de sessão usa SHA-256 cru; HMAC com `SESSION_SECRET` é melhor (`token.ts:11-20`).
- RBAC faz 2-3 round-trips por `hasPermission` — cachear na sessão.
- Sessão sem detecção de hijack (IP/UA registrados mas não verificados).

### Observação arquitetural

Bom: Argon2id, sessão opaca + hash no DB, RLS via `set_config` transacional. Disciplina total nos handlers admin (qualquer rota `/api/admin/*` sem `requireAdmin` é escalada).

---

## 2. API routes e webhooks

### 🔴 Críticos

- **Path traversal — Tenant-Asset** (`src/app/api/dashboard/tenant-assets/[id]/file/route.ts:14-50`): `path.join(cwd, "uploads", relativeKey)` sem validar destino. Fix: `path.resolve` + `startsWith(uploadDir + sep)`; gerar `fileKey` no backend (kind/uuid).
- **Replay store abre+fecha Redis por evento** (`src/server/security/webhook-replay.ts:23-33`). Sob carga, race entre clientes recém-conectados; custo enorme. Mesmo padrão em `whatsapp-cloud`, `google-ads/auth/callback/route.ts:110-119`. Fix: singleton.

### 🟠 Altos

- CSV import sem MIME real / sem proteção a formula injection (`leads/import/route.ts:53-66`, `contacts/import/route.ts:53-66`, e export simétrico em `leads/export/route.ts:49-58`). Strip de células iniciadas com `=,+,-,@`.
- Upload tenant-assets sem allowlist MIME e sem cap de tamanho (`tenant-assets/route.ts:54-83`). Combinado com path-traversal vira RCE potencial se algum endpoint servir como `text/html`.
- HMAC aceita **timestamps futuros** dentro de ±5 min (`webhook-signature.ts:50-54`). Use `now + smallSkew` como upper bound.
- **Chatwoot e WhatsApp HMAC sem timestamp** (`chatwoot/validate.ts:13-21`, `whatsapp-cloud/validate.ts:16-24`) — replay só mitigado pelo Redis TTL.
- **Webhook Evolution: fallback via `x-api-key` em dev** (`validate.ts:60-67`). Gating por flag explícita, não por `NODE_ENV`.
- Typebot path-2 (hash) precisa garantir `timingSafeEqual` no `verifyWebhookSecret`.
- **/api/health expõe estado interno** (heartbeat, idade do worker) sem auth (`health/route.ts:13-65`). Separar `/api/health` mínimo de `/api/health/details` autenticado.
- **/api/dashboard/vysen/chat sem rate-limit** — replicado em `/api/admin/vysen/chat`.

### 🟡 Médios

- Idempotência depende só de Redis; sem fallback DB se Redis cair (`webhook-replay.ts:24-33`). Persistir `externalEventId` com unique.
- Exports `/leads` e `/contacts` capam em 5000 sem paginação nem sinal de truncamento.
- Endpoint de mídia (`conversations/[id]/messages/[messageId]/media`) sem rate-limit por usuário/tenant; pode amplificar tráfego ao UAZAPI.
- `notifications/route.ts:11-49` retorna `schema_missing` com path/migration — vaza estrutura interna.
- `admin/integrations/typebot/metrics/sync:55-60` ecoa `err.message` cru.
- `admin/tenants` lista sem paginação.
- Sem optimistic lock em updates concorrentes (`updateFunnelStepForTenant`, `updateLeadForTenant`).
- `pagespeed/fetch` chama Google sem `AbortController`/timeout.

### 🟢 Baixos

- `webhook-request.ts:91-95` cai em 500 default para provider desconhecido.
- `google-ads/auth/callback/route.ts:36-46` redireciona com `error_description` no query — sanitizar.
- `whatsapp-cloud verifyHub` compara token com `!==` (não constant-time).
- `auth/login/route.ts:91-94` confia em `x-forwarded-for` sem allowlist do proxy.
- `admin/observability` sem `?since=` / paginação.

### Pontos positivos

Pipeline coerente em 5 provedores, `withWebhookRlsTransaction` força tenant lock após validação, `requireDashboardApiAuth` aplica CSRF + RBAC + RLS na mesma tx, SSRF mitigado em media route, tokens OAuth criptografados em DB.

---

## 3. Workers e filas

### Nota de arquitetura

**Não há BullMQ em uso.** `package.json` declara `bullmq@5.34`, mas o worker (`src/workers/runner.ts:80-82` + `src/workers/queue/client.ts:84-106`) é implementação caseira sobre `LPUSH`/`BRPOP`. Isso explica vários problemas abaixo (sem locks, sem visibility timeout, sem ack/nack, sem prioridade, sem delays nativos).

### 🔴 Críticos

- **Retry em `setTimeout`** (`runner.ts:242-247`) — handlers pendentes morrem no SIGTERM. Fix: ZADD em "delayed set" + scheduler dedicado (ou migrar para BullMQ).
- **`BRPOP` sem visibility timeout** (`queue/client.ts:97-106`) — job sai do Redis antes de processar; crash entre dequeue e `processedAt` perde job. Fix: `LMOVE`/`BRPOPLPUSH` para fila "processing" + reaper de stale.
- **Chatwoot e WhatsApp Cloud invisíveis no `admin/worker-pipeline`** (`src/server/admin/worker-pipeline.ts:14-31, 458-492`, interface `QueueDepths:370-387`). DLQ pode encher silenciosamente.
- **Concorrência efetiva = 1 por fila** (`loop*` em `runner.ts:354-372, 406-414, 545-583, 619-715`). Pico bloqueia backlog. Fix: N consumidores com semáforo, ou BullMQ `concurrency`.

### 🟠 Altos

- `enqueueDueFollowupsForTenant` (`src/server/followup/enqueue-due-followups.ts:11-27`): SETNX + EXPIRE não atômicos; lock só liberado por TTL. Fix: `SET k v EX 90 NX`.
- Backoff sem jitter (`queue/policy.ts:59-64`) — thundering herd em falha do OpenAI/Redis.
- Consumer faz `JSON.parse as JobPayload` sem schema (`queue/client.ts:105`). Payload corrompido derruba consumer; runner só loga.
- `enqueue` (`queue/client.ts:84-91`) sem `jobId` determinístico — sync `sync_google_ads_account`, `sync_meta_ads_account`, `sync_clarity_connection` podem rodar duplicado em paralelo.
- Webhooks abrem conexão Redis nova a cada evento (`integrations/*/ingest.ts`). Use singleton.
- `redis.quit()` fire-and-forget em `finally` (vários módulos). `await ... .catch(() => {})`.
- `recordProcessingFailure` insere `processing_failures` fora de `withWorkerAccessContext` (`runner.ts:149-176`). Com `SECURITY_ENFORCE_RLS=true` em modo `tenant`, falha silenciosa = telemetria de DLQ perdida.
- `/api/health` marca webapp 503 quando worker stale (`health/route.ts:53`). Em deploy split, isso droga tráfego HTTP por hiccup do worker. Separar readiness.

### 🟡 Médios

- Webhook secrets só checados no startup (`runner.ts:73-78`); rotação exige reboot.
- Logs não estruturados (`runner.ts:296, 307, 328…`) — `requestId`/`jobId`/`tenantId` não correlacionam.
- **DLQ sem UI/endpoint de inspeção/replay** — só `LPUSH` em `runner.ts:189`. Operacionalmente, "cemitério". Adicionar `GET/DELETE /api/admin/dlq/[queue]` + replay.
- Shutdown não drena consumers em curso (`runner.ts:738-750`). `Promise.allSettled(active)` com timeout.
- `maxRetriesPerRequest: null` no worker vs `2` no app (`runner.ts:80,82` vs `server/redis.ts:22`) — comportamento divergente.
- `enqueueConversationClassification` dispara N jobs por burst de mensagens (`processors/evolution|uazapi|chatwoot|whatsapp-cloud.ts`). Debounce 30 s ou dedup por conversa.

### 🟢 Baixos

- Worker e webapp compartilham `getDb()` (mesmo pool quando rodando no mesmo processo).
- `workers/jobs/stub.ts` morto.
- `workers/processors/index.ts` desatualizado (não re-exporta chatwoot/whatsapp-cloud).
- `numberOrNull(data.messageTimestamp)` duplicado em evolution/uazapi.
- Heartbeat sem identificação de instância (`readiness.ts:6`) — `worker:heartbeat:<podId>` permite detectar split-brain.

**Recomendação forte**: migrar de fato para BullMQ (já é dep) ou remover do `package.json` e estabilizar o stack caseiro com `LMOVE` + drain no SIGTERM + dedup de enqueue.

---

## 4. Camada de dados (Drizzle/PostgreSQL)

### 🔴 Críticos

- **Duplicata de migrations 0004** — `src/db/migrations/0004_married_wasp.sql` + `0004_uazapi_webhook_and_conversations.sql`. `_journal.json:36-46` registra ambas em idx 4 e 5 no mesmo timestamp. Em DB virgem hoje a 2ª falha (conflito em `uazapi_webhook_events` e CHECK `conversations_instance_check`). Por isso existem `scripts/ensure-*.ts`. **Fix imediato**: renomear `0004_uazapi_*` para `0004b_*` (ou remover, já que 0004_married_wasp cobre o conteúdo) e ajustar `_journal.json`.
- **`users.email UNIQUE` global** — `src/db/schema/auth/users.ts:9` / `0000:123`. Bloqueia white-label (mesmo email em tenants diferentes). Mover unicidade para `memberships(user_id, tenant_id)` ou criar `tenant_users`.

### 🟠 Altos

- `audit_logs.tenant_id` nullable + `ON DELETE SET NULL` (`0000:418,773`) — auditoria perde tenant após delete. Snapshot sem FK.
- `processing_failures.tenant_id` nullable + FK fraca (`0000:444,803`).
- `vysen_usage_events.tenant_id` nullable (`0015:3`) — telemetria de IA inviabilizada por cliente.
- `knowledge_documents/chunks/embeddings.tenant_id` nullable sem CHECK `(scope='global' ∧ tenant_id IS NULL) ∨ (scope='tenant' ∧ tenant_id IS NOT NULL)` (`0014`). Vetor de cross-tenant.
- Sem `pg_advisory_xact_lock` no migrate — múltiplas réplicas no Swarm racing.
- `0014_vysen_knowledge_pgvector.sql:5` faz `WHEN OTHERS THEN RAISE NOTICE` — silencia falha de extensão. Schema inconsistente sem erro.
- `0007:13` apaga linhas duplicadas de `pagespeed_results` na própria migra — destrutivo.
- `leads.status` sem `DEFAULT` (`0000:264`).
- `conversations_instance_check` reescrita 3x; DB que aplicou só 0004_married_wasp fica sem CHECK até 0019. 0019 faz `DROP IF EXISTS` antes — ok.
- **`db` export em `src/server/db/index.ts:69` é pool raiz sem RLS GUC**. Vários módulos (`server/auth/helpers.ts`, `server/privacy/cleanup-webhook-events.ts`, etc.) chamam `db.select` fora de `runWithRlsContext` e burlam RLS. Quando `SECURITY_ENFORCE_RLS=true` em prod, comportamento depende do call-site. Marcar como `unsafeRootDb` e auditar todos os call-sites.
- **Sem `statement_timeout` nem `idle_in_transaction_session_timeout`** (`src/server/db/index.ts:39-43`). Query pesada trava slot. Setar 30 s / 60 s.

### 🟡 Médios

- Falta índice por `(tenant_id, created_at DESC)` em `opportunities`, `products`, `complaints` etc.
- `opportunities.stage`, `complaints.status`, `followup_tasks.status` em `varchar` — diverge do padrão `pgEnum`.
- `ALTER TYPE ADD VALUE` em transação (0003/0004/0019) — funciona em PG14+, falha em <12.
- `app_global_config.value_plain` sem CHECK contra `value_encrypted` (`0002:5-7`) — permite ambos preenchidos.
- pgvector IVFFlat com `lists=100` (`0014:150`) — para <10k vetores pior que seq scan; >1M precisa `lists=√N`. **Trocar por HNSW**.
- Dimensão de embedding hardcoded 1536 (`0014:45`).
- `_journal.json:13` com timestamps fora de ordem.
- Sem `process.on('SIGTERM', () => sql.end())`.
- Seed pode rodar em prod com email default (`base1.ts:46-50`). Abortar se `NODE_ENV=production` e email padrão.

### 🟢 Baixos

- Timestamps com timezone consistentes, dinheiro em `numeric(12,2)`, UUID v4 — bom.
- Connection pool `max=12` em prod (24 conexões com worker) — documentar.

### Recomendação

1. Resolver dupla 0004 (P0).
2. `advisory_lock` + timeouts no Postgres.
3. Decidir política de `users.email` antes do white-label.
4. Eliminar `scripts/ensure-*` após estabilizar migrate.
5. Trocar IVFFlat por HNSW.

---

## 5. Integrações externas

### 🔴 Críticos

- **Token Meta CAPI em query string** (`src/server/integrations/meta-ads/capi.ts:88`) — mover para body POST ou `Authorization: Bearer`.
- **Decrypt com fallback para texto puro** (`evolution|uazapi/credentials.ts`, `chatwoot|typebot/validate.ts`): `try { decryptSecret } catch { return value }`. Mascarar incidente. Fix: lançar erro e bloquear uso; rodar migração de rotação.
- **OAuth Google/Meta sem timeout/retry/UA** (`google-ads/auth.ts:41,95,134`, `meta-ads/auth.ts:29,58`). `fetch` cru. Use `safeFetch` com timeout 10 s, retry exponencial em 429/5xx (Retry-After).
- **Chatwoot reusa `apiTokenEncrypted` como segredo HMAC** (`chatwoot/validate.ts:47,57`). Comprometer um expõe o outro. Coluna `webhook_secret_encrypted` dedicada.

### 🟠 Altos

- Log de `bodyPreview` pode capturar token via query (`evolution/client.ts:159,167`, `uazapi/client.ts:558,566`). Sanitize regex `token=|apikey=|bearer\s+...`.
- **Sem retry/backoff/circuit breaker em qualquer cliente** (`google-ads/client.ts`, `meta-ads/insights.ts:47`, `meta-ads/ad-accounts.ts:17`, `clarity/sync.ts:19`, `typebot/metrics.ts:34`). Util `withRetry`.
- Paginação Meta com `guard < 20` mas sem comparar `next === current` — possível loop.
- UAZAPI client tenta 8+ estratégias de auth (`uazapi/client.ts:260-359`). Fixar uma via `uazapiInstances.authMode`.
- Scopes OAuth Meta não-mínimos: `ads_management,business_management` para uso só de leitura. Use `ads_read`.
- Google Ads não persiste refresh token rotacionado nem trata `invalid_grant` (`google-ads/sync.ts:74-99`).
- Paridade UAZAPI vs Evolution: estados normalizados divergem (`evolution/reconnect.ts:31-48` vs `uazapi/reconnect.ts:55-77`). Normalizar para enum.
- Evolution validate aceita `x-api-key` em dev (mesmo achado em §2).

### 🟡 Médios

- Sem User-Agent identificável em nenhum cliente.
- `Promise.all` sem semáforo em health check de N instâncias (`evolution/client.ts:109`, `uazapi/client.ts:498`). `pLimit(5)`.
- Cast direto sem Zod em respostas externas (universal).
- `redis.quit()` sem await em pending Redis (`google-ads-pending.ts:39,64`, `meta-ads-pending.ts:40,60`, `evolution/ingest.ts:78`).
- Erros silenciados em pending Redis (`catch { return null }`).
- WhatsApp Cloud sem replay protection robusto.

### 🟢 Baixos

- `meta-ads/config.ts:171-177` reexporta `encryptClarityToken` — Clarity acoplado a `META_ADS_ENCRYPTION_KEY`. Chave própria.
- OpenAI `transcribe.ts:51`, `describe-image.ts:30` sem timeout — `AbortSignal.timeout(30_000)`.

### Pontos positivos

`safeFetch` com allowlist + DNS rebinding + bloqueio IP privado é sólido. Idempotência por unique constraint no ingest. Tokens em AES-256-GCM. State HMAC com TTL e nonce.

---

## 6. Vysen Copilot

### 🔴 Críticos

- **Cross-tenant leak no filtro pgvector** (`src/server/vysen/knowledge.ts:198-214`): `(tenantId::uuid IS NULL OR kd.tenant_id = tenantId)`. Separar branches: `scope='global' AND tenant_id IS NULL` vs `scope='tenant' AND tenant_id=$1`.
- **Sem rate-limit no `/api/dashboard/vysen/chat`** (route.ts:9-114). Custo OpenAI por usuário ilimitado.
- **Compliance/log**: `copilot.ts:484-496` não armazena prompt/resposta — impossível auditar prompt injection após o fato. Decisão consciente; documentar.

### 🟠 Altos

- **Prompt injection via KB**: `contextJson` injeta `references.excerpt` (doc tenant-controlado) no user message sem delimitador (`copilot.ts:235-249, 343-379`). Envolver em `<reference id=… untrusted="true">…</reference>` e instruir o system prompt.
- **`tenantDataTool` sempre executado** (`tenant-data-tool.ts:39-91`) — não é gated por function calling. Mesmo para "oi". Allowlist + on-demand.
- **Sem cap no tamanho de `question`** (`route.ts:26-29`). `slice(0, 4000)`.
- **Fallback de modelo duplica custo silenciosamente** (`copilot.ts:392-445`).
- **Agno provider sem auth/timeout/fallback** (`src/server/vysen/runtime/agno-provider.ts:14-36`). Header `X-Vysen-Token` + `AbortController(10s)` + try/catch para downgrade local.
- **PII/segredos não escrubados** antes de mandar pro modelo. Regex `sk-[A-Za-z0-9]{20,}`, CPF, email.

### 🟡 Médios

- `success=true` no log mesmo quando externa falhou (`copilot.ts:458,326`).
- `OPENAI_MODEL_THINKING/FAST` sem allowlist (admin pode setar `o1-pro` e estourar custos).
- `vysen_usage_events` sem particionamento por `created_at` (0015). Em milhões de linhas o índice fica caro. Adicionar `request_id` e `estimated_cost_usd`.
- `searchKnowledge` chama embedding a cada query sem cache (`knowledge.ts:60-88`).
- `request.signal` não é propagado para `AbortController` interno (`copilot.ts:394`) — cliente desconecta mas request continua até o fim.
- Provider runtime cacheado em módulo sem TTL (`runtime/index.ts:8-17`); flag flip exige restart.

### 🟢 Baixos

- `history` aceita 12 itens × 1800 chars (`copilot.ts:259-263`) — alto multiplicador.
- `knowledge_documents.content` sem retenção/expurgo nem `contains_pii`.
- Telemetria silencia erros (`vysen/usage.ts:36-67`) — `catch {}` sem trace.

---

## 7. UI admin/dashboard

### 🟠 Altos

- **Notifications page sem skeleton/retry** (`dashboard/notifications/page.tsx:107-114`).
- **Páginas new/edit duplicam ~500 LOC** (admin/integrations/evolution|uazapi|typebot + tenants new/edit). Extrair `IntegrationForm`, `TenantGovernanceFields`.
- **Fetchs sem `AbortController`** em todas as páginas new/edit (`evolution/new:30`, `uazapi/new:33`, `typebot/new:30`, `tenants/[id]/edit:46-103`, `evolution/[id]/edit:30-52`, `uazapi/[id]/edit`). Race ao trocar `id` rapidamente.
- **Sem virtualização em listas longas**: `dashboard/leads/page.tsx:108` (200 leads), `conversations-layout-client.tsx:142`. `react-window` ou `@tanstack/react-virtual` ≥100 itens.
- **Kanban sem teclado** (`leads-kanban-board.tsx:59`) — drag/drop sem `onKeyDown`/select fallback.

### 🟡 Médios

- Dashboard sidebar fetcha `/api/context/profile` a cada mount sem cache/SWR (`dashboard-sidebar.tsx:68`).
- `dashboard/settings/page.tsx:52-73` renderiza shell vazio antes do fetch resolver.
- Server pages aguardam dados sequenciais sem `<Suspense>` (`dashboard/leads/page.tsx:29`).
- Mutação POST sem CSRF token explícito — verificar se `csrf-fetch-bootstrap.tsx` patcha `fetch` global.
- Inputs de credenciais sem `autoComplete="new-password"` em evolution/uazapi/tenants edit.
- `integration-delete-button.tsx:37` usa `confirm()` nativo em vez do `AppDialog`.
- Mistura de tokens `brand-*` (custom) com `destructive` (shadcn) — pick one.
- `recharts` deve entrar só via lazy variant (`dashboard-charts-lazy.tsx`); verificar que `admin-global-insights-charts` também tem lazy.
- `lucide-react` em 10+ client files — ativar `modularizeImports`.
- `<img>` no `profile-avatar-section.tsx:112` em vez de `next/image`.

### 🟢 Baixos

- `NEXT_PUBLIC_AUTH_*` (client) e `AUTH_*` (server) podem driftar.
- `<a>` modal close sem `aria-label`/`aria-haspopup` em alguns lugares.
- Datas hardcoded `Intl.DateTimeFormat("pt-BR")` espalhadas. Helper único `formatDate(locale)`.
- Labels técnicos visíveis ao usuário (`external_id`, `webhook_url`, `api_key`).
- `dangerouslySetInnerHTML` injeta Clarity (`src/app/layout.tsx:57,73`) com env interpolado — validar regex no build.
- Heading sizes inconsistentes (`text-2xl`/`text-xl`/`text-lg` para mesma hierarquia).

---

## 8. Segurança e hardening

### 🔴 Críticos

- **Zero security headers** em `next.config.ts:1-9`. Adicionar `async headers()`:
  ```ts
  // CSP sem unsafe-inline/eval, frame-ancestors 'none'
  // HSTS max-age=63072000 includeSubDomains preload
  // X-Content-Type-Options nosniff
  // Referrer-Policy strict-origin-when-cross-origin
  // Permissions-Policy mínima
  ```
- **Zero Zod em handlers** (`package.json` não inclui zod). Adicionar e validar todo body de mutation.
- **`stack.env` listado no `git status`** — verificar `.gitignore` e `git rm --cached` se rastreado.
- **Sem rate-limit em `/api/dashboard/vysen/chat`** (já listado).

### 🟠 Altos

- CSRF cookie acessível por JS (double-submit). Adicionar Origin check complementar.
- `log-redact.ts:5-7` cobre só telefone — estender para e-mail, JWT, `sk-...`, cookies.
- Rate-limit confia em `x-forwarded-for` se `RATE_LIMIT_TRUSTED_PROXY_HOPS>0` — documentar valor de prod.
- Redis sem TLS/auth por padrão; forçar `rediss://` em prod.

### 🟡 Médios

- `SameSite=Lax` em sessão de 30 dias — considerar `strict` em rotas críticas.
- Cookie de sessão sem `Domain` explícito.
- `safeFetch` não bloqueia explicitamente AWS IMDS hostname (mas 169.254.169.254 está coberto via link-local).
- RLS é real mas opt-in; startup guard impõe em prod — manter disciplina nos call-sites de `db`.

### 🟢 Baixos / Informativo

- Versões: `argon2 0.41.1`, `bullmq 5.34`, `next 15.5.14`, `drizzle 0.45.1`, `nodemailer 8.0.2`. Sem CVE crítico conhecido no cutoff. Rodar `npm audit` regularmente.
- `productionBrowserSourceMaps` default `false` em Next 15 — ok.
- **`security-hardening.test.ts` cobre só ~20%** (SSRF, redact de telefone, HMAC). Não cobre CSRF, rate-limit, RLS, headers, secret-crypto, replay, startup-guards. Expandir.

---

## 9. Build, deploy e infra

### 🔴 Críticos

- **`app_setup` no Swarm corre em paralelo com app sem lock** (`docker-stack.swarm.yml:63-119`). Combine com migrations duplicadas (§4) → setup quebra em DB virgem. Transformar em job único (`condition: none`) ou rodar migration via job externo + `pg_advisory_lock`.
- **Secrets em `environment:` no Swarm** (`docker-stack.swarm.yml:78,80,81,124,127,129,130`). Migrar para `secrets:` com `*_FILE`.
- **Placeholders idênticos em 3 blocos** (`docker-stack.swarm.app-only.yml:17-32`). Consolidar via YAML anchors ou `env_file`.
- **BullMQ instalado mas não usado** (§3) — remover ou migrar.

### 🟠 Altos

- Dockerfile sem `HEALTHCHECK` (`Dockerfile:1-57`).
- Swarm sem `healthcheck` nem `update_config.order: start-first` — 502 do Traefik durante deploy.
- Worker em runtime via `tsx` (carrega TS sem compilar). Compilar com `tsc`/`tsup` no builder.
- **GitHub Actions sem pin por SHA** (`docker-image.yml:53,56,100,107`). Pinear `actions/checkout@<sha>` etc.
- Workflow sem `permissions:` mínimas no top-level.
- **Sem cache GHA no build** (`build-push-action` sem `cache-from`/`cache-to: type=gha`).
- **Tag `:latest` não publicada** mas compose/stack referenciam `:latest` → puxam imagem velha.
- Compose usa `postgres:16-alpine` mas Swarm usa `pgvector/pgvector:pg16` — unificar (a aplicação precisa de pgvector para Vysen).
- `app_web` no Swarm sem port mapping, depende de rede `CreativeLaneNet` externa (linha 244-245). Documentar.

### 🟡 Médios

- `wait-for-db.js` 60×2000ms = 120s default; Redis nunca aguardado — worker pode falhar.
- `.env.example` desatualizado: faltam `WAIT_FOR_DB_*`, `META_ADS_*`/`META_APP_SECRET`, `NEXT_PUBLIC_CLARITY_ID`, `OPENAI_MODEL_*`.
- `engines.node >=20` aceita Node 22 — preferir `20.x`/`>=20.10 <21`.

### 🟢 Baixos

- Build args com placeholders explícitos (`DATABASE_URL=postgresql://build:build@...`) — bom.
- Usuário não-root no container — ok.
- `npm ci` sem `--mount=type=cache,target=/root/.npm`.
- `next.config.ts` mínimo — sem `poweredByHeader: false`, sem `images.remotePatterns`.
- `docker-compose.yml:37` define `image:` E `build:` — ambíguo.
- Falta `dependabot.yml` / Renovate.
- `scripts/proxy/**` referenciado em escopo mas inexistente.

---

## 10. Documentação

### Resumo

~56 docs em `docs/`. **A maioria foi criada no commit inicial e nunca mais tocada.** Há um doc de meta-revisão excelente (`REVISAO_COERENCIA_DOCUMENTACAO_2026-04-26.md`) cujos achados P0/P1 **continuam abertos**.

### Drift vs código (confirmado)

| Item | Doc afirma | Código real |
|---|---|---|
| Migrations | `GETTING_STARTED.md` lista até `0003` | 22 arquivos, último `0019_chatwoot_whatsapp_cloud_channels.sql` |
| Rotas admin | `PADRAO_DESENVOLVIMENTO.md` fala só de `(admin)/admin/*` | Coexistem `(admin)`, `(superadmin)/superadmin/*` e `(company-admin)/admin/*` |
| Fila | CHANGELOG v0.1.0 e `package.json` declaram BullMQ | Nenhum `import` de bullmq; fila caseira sobre Redis |
| API envelope | `CONTRATO_API_WEBHOOKS.md` lista 7 rotas migradas | Dezenas em `/api/dashboard/*` continuam legadas |
| `MIGRATION_ORDER.md` | Descreve 0001–0007 por domínio | Real é 0000–0019 + duplicata `0004_*` |

### Redundância / contradição

- 6 docs `REVISAO_*` sem cronologia clara.
- 15 docs `BASE2_*` misturam "plano de etapa entregue" com "guia operacional vivo".
- 2 versões do plano F1–F5 (v1.0 + v1.1). Só v1.1 deveria ser canônica.
- 5 docs sobre deploy/Docker sem matriz indicando qual usar.

### Gaps

- Sem doc canônica para `(superadmin)` e `(company-admin)`.
- Sem doc operacional para Chatwoot e WhatsApp Cloud (paridade com `BASE2_META_ADS` / `BASE2_CLARITY`).
- Sem ADR de transição do envelope API.
- `docs/log/REGISTRO.md` com mojibake na linha 1.
- `docs/specs/` só tem templates — F4 nunca foi ativada.

### Estado dos planos

- **plano_f1_f5_v1.0**: superseded — arquivar.
- **plano_f1_f5_v1.1**: F1 parcial, F2 entregue (`ci:verify`, smokes), F3–F5 abertos.
- **PLANO_IMPLEMENTACAO_AGNO_VYSEN_2026-04**: Etapa 1 entregue, 2–6 pendentes.
- **PLANO_EXECUCAO_UX_SUPERADMIN_ADMIN_DASHBOARD_2026-04**: rotas existem mas docs não foram atualizados.
- **PLANO_LEADS_CONTATOS_OPORTUNIDADES / PLANO_NEGOCIO_METRICAS_ONBOARDING**: entregues no v0.2.0 — são histórico.

### Coerência com CHANGELOG

CHANGELOG v0.3.0 (2026-03-20) é coerente com `RELEASE_v0.3.0.md`, **mas o código avançou muito além**: Chatwoot+WA Cloud (migration 0019), Meta Ads + Clarity (0018), Vysen Agno runtime, RLS (0016/0017), api-contract envelope, smoke de canais — **nada disso está no CHANGELOG**. Falta entrada 0.4.0/unreleased.

### Recomendações

**Urgente (P0)**:
- `GETTING_STARTED.md` — referenciar dinamicamente `src/db/migrations/`.
- `PADRAO_DESENVOLVIMENTO.md` + `.cursor/rules/padrao-desenvolvimento.mdc` — adicionar `(superadmin)` e `(company-admin)`.
- `CHANGELOG.md` — abrir 0.4.0/unreleased; resolver menção a BullMQ.
- `package.json` — remover `bullmq` se sem uso (ou migrar).
- `RESUMO_PROJETO.md` — incluir Chatwoot/WA Cloud na seção 1.

**Consolidar/fundir**:
- `REVISAO_GERAL_2026-03` + `REVISAO_COMPLETA_APP_2026-03` → uma revisão histórica em `docs/log/`.
- Reescrever `db/MIGRATION_ORDER.md` para refletir inventário real 0000–0019.
- Promover `CONTRATO_API_WEBHOOKS.md` com checklist de rotas pendentes + ADR.

**Arquivar** (mover para `docs/log/` ou banner "histórico"):
- `plano_f1_f5_governanca_vysen.md` (v1.0).
- `PLANO_LEADS_CONTATOS_OPORTUNIDADES.md`, `PLANO_NEGOCIO_METRICAS_ONBOARDING.md`.
- 11× `BASE2_*` de etapas concluídas.
- `REVISAO_PAGINAS_E_TABELAS.md`.

**Escrever**:
- `BASE2_CHATWOOT.md` e `BASE2_WHATSAPP_CLOUD.md`.
- `SUPERADMIN_AREA.md` (3-way diff entre `(admin)`, `(superadmin)`, `(company-admin)`).
- `docs/specs/adr-api-envelope-transition.md`.

---

## 11. Roadmap recomendado (4 sprints)

### Sprint 1 — Estabilizar fundação (1-2 semanas)

**Banco**:
- Resolver duplicata 0004 (renomear ou consolidar).
- Adicionar `pg_advisory_lock` no migrate.
- `statement_timeout` + `idle_in_transaction_session_timeout`.
- Eliminar scripts `ensure-*` após validar migrate em DB virgem.

**Auth**:
- Reordenar gate `isSuperAdmin` antes de `createSession` no OAuth callback.
- Erro fatal se `GOOGLE_AUTH_STATE_SECRET`/`SESSION_SECRET` ausentes.
- Rotação de sessão em `switchTenant`.
- Hash dummy no caminho "usuário inválido" do login.

**Infra/Build**:
- `HEALTHCHECK` no Dockerfile.
- Decidir: remover BullMQ do `package.json` OU migrar workers (§3).
- Publicar `:latest` no CI; consolidar `pgvector/pgvector:pg16` em compose e stack.

### Sprint 2 — Hardening de borda (1 semana)

- `next.config.ts` com `headers()` (CSP/HSTS/etc).
- Adicionar Zod e validar bodies em `/api/auth`, `/api/webhooks`, `/api/dashboard/**` mutadores.
- Rate-limit no `/api/dashboard/vysen/chat` (+ admin gêmeo).
- Garantir `stack.env` no `.gitignore`.
- Estender `log-redact` para e-mail/JWT/tokens.
- Path traversal em tenant-assets (resolve + startsWith).

### Sprint 3 — Workers e Vysen (1-2 semanas)

- Migrar workers para BullMQ (ou estabilizar caseiro com `LMOVE`).
- DLQ com inspeção/replay no admin.
- Incluir Chatwoot/WA Cloud no snapshot do `worker-pipeline`.
- Singleton Redis em todas as ingestões (`integrations/*/ingest.ts`).
- Fixar cross-tenant leak no pgvector (`knowledge.ts:198-214`).
- `tenantDataTool` sob demanda + allowlist.
- Cap de prompt + PII scrub no Vysen chat.
- Particionar `vysen_usage_events` + adicionar `request_id`/`cost_usd`.

### Sprint 4 — UX e governança (1-2 semanas)

- Extrair formulários compartilhados (IntegrationForm, TenantGovernanceFields).
- AbortController em todos os fetchs new/edit + retry em loading errors.
- Virtualização em leads/conversations.
- `autoComplete="new-password"` em credenciais de integração.
- Atualização documental P0 (GETTING_STARTED, PADRAO, CHANGELOG 0.4.0, RESUMO).
- Arquivar planos concluídos em `docs/log/`.

---

## 12. Apêndice — Pontos positivos (não esquecer no caminho)

- **Pipeline de webhook robusto** com HMAC + replay store + RLS transaction em 5 provedores.
- **`safeFetch` sólido** (allowlist + DNS rebinding + bloqueio IP privado + redirect cap).
- **Argon2id + sessão opaca + hash no DB** + RLS via `set_config` transacional (`SET LOCAL`).
- **Tokens OAuth criptografados** (AES-256-GCM) + state HMAC com TTL e nonce.
- **Startup guards** em produção (`SECURITY_ENFORCE_RLS`, `SECURITY_ENFORCE_CSRF`, secrets obrigatórios).
- **Pipeline CI/smoke** (`npm run ci:verify` cobre lint/typecheck/build + smoke web/api/worker/channels).
- **Dockerfile multi-stage com usuário não-root** e `output: "standalone"`.
- **`requireDashboardApiAuth`** centraliza CSRF + RBAC + RLS numa única transação.
- **Idempotência por unique constraint** em raw events de cada ingestão.

---

> Esta revisão é um *snapshot* em 2026-05-22. Documentos posteriores que diferirem devem ser tratados como sucessores. Se um item desta lista for fechado, marque com link para o commit/PR correspondente — o ideal é que a próxima revisão (REVISAO_GERAL_2026-XX) seja construída por diff sobre este arquivo.
