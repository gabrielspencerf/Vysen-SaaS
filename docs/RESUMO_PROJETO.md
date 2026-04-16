# Resumo geral do projeto

Visão específica do escopo, forma de execução, etapas, escalabilidade, segurança, estrutura futura e funcionalidade.

---

## 1. Escopo do projeto

**Nome / propósito:** Aplicação **observabilidade-saas** — SaaS multi-tenant para observabilidade operacional de leads, conversas, aquisição (Google Ads, Meta Ads, Clarity), funil e apoio de decisão com Vysen Copilot.

**Escopo atual:**

- **Multi-tenancy:** Tenants, usuários, memberships e roles (RBAC). Sessão com `current_tenant_id`; troca de tenant via API e UI.
- **Leads:** Ingestão via webhooks (Typebot, Evolution), deduplicação por tenant + email/telefone/source_external_id, UTM, eventos de jornada, funil e etapa atual.
- **Conversas:** Eventos Evolution (messages.upsert) viram conversas e mensagens; listagem e detalhe por tenant.
- **Google Ads:** OAuth por tenant, contas conectadas, sync de campanhas e métricas (snapshots), atribuição Ads → Leads (last-touch por campanha), CPL indicativo.
- **Meta Ads e Clarity:** conexão por tenant, snapshots de desempenho/comportamento, uso em dashboards e análises contextuais.
- **Funil:** Visão por tenant (volume por etapa, conversão, % do total, gargalo), filtro opcional por período (first_seen_at). Jornada do lead no detalhe (etapa atual + eventos com etapa). Qualidade de dados: processador Typebot preenche `current_funnel_step_id` e `lead_events.funnel_step_id` via criteria em `funnel_steps`.
- **Vysen Copilot:** assistente analista com memória de contexto, prompts orientados por objetivo e fallback de modelo para maior resiliência operacional.
- **Admin central:** CRUD de tenants, usuários e memberships; acesso por role `super_admin` (permission `admin:access`).
- **Integrações:** Cadastro de Typebot, Evolution e UAZAPI pela UI admin; cadastro Google Ads via OAuth no dashboard.
- **Observabilidade:** Painel admin com status de API/DB/Redis/worker, profundidade de filas e DLQ, status de instâncias Evolution/UAZAPI e erros recentes.
- **Worker & dados (admin):** Página `/admin/worker-pipeline` com mapa relacional (domínios de tabelas → núcleo Postgres/Redis/worker), métricas de fila/DLQ/heartbeat e pipelines HTTP → staging → fila → processador.
- **WhatsApp no dashboard:** Em Configurações, fluxo de status e QR para reconectar Evolution/UAZAPI (APIs em `/api/dashboard/integrations/messaging/*`).

**Fora do escopo atual (ou só preparado):** alerting externo (Pager/Slack), histórico temporal avançado do funil, múltiplos funis ativos com mapeamento por integração (parcialmente suportado no schema).

---

## 2. Forma como está sendo feito

- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Drizzle ORM + PostgreSQL, Redis (filas), Tailwind, argon2 para senha.
- **Arquitetura:**
  - **App:** `app/` — rotas (auth), (dashboard), (admin), `api/` (auth, admin, dashboard, webhooks, google-ads, meta-ads, etc.). Layouts por área; contexto de tenant sempre via `getDashboardTenantContext()` no server.
  - **Server:** `server/` — auth (sessão em DB, cookie opaco, hash do token), tenancy (membership, troca de tenant), rbac (roles/permissions, `hasPermission`), db (cliente Drizzle singleton), dashboard (leads, conversas, funil, analytics, attribution, google-ads), integrações (google-ads, typebot, evolution) com ingest + validação + parse.
  - **DB:** `db/schema/` — domínios (auth, integrations, raw-events, funnels-leads, conversations, snapshots, ai-alerts-audit); migrations em `db/migrations/`; seeds em `db/seeds/base1.ts`.
- **Workers:** Processo separado (`npm run worker:dev`), Redis, filas raw (Typebot, Evolution, UAZAPI), sync (Google Ads, Meta Ads, Clarity), `queue:ai:classification`, `queue:followup:due:tenant`, cada uma com DLQ e retry/backoff por tentativa.
- **Convenções:** Tenant nunca confiado do frontend; sempre do contexto de sessão. Queries sempre filtradas por `tenant_id`. Credenciais globais em .env; por conta/bot/instância no banco (tokens Google criptografados com AES-256-GCM). Sem hardcode de segredos; documentação com placeholders.

---

## 3. Etapas (bases e entregas)

**Base 1 (fundação):**

- Etapa 1: Estrutura de pastas, stack (Next, Drizzle, Redis), separação db/schema vs server/db.
- Etapa 2: .env.example, docker-compose (Postgres + Redis), health, worker stub.
- Etapa 3: Schema (tenants, users, roles, permissions, memberships, sessions), seed Base 1, migrations.
- Etapa 4: Auth server-side (sessão em tabela, cookie opaco, argon2), login/logout, proteção de rotas (middleware + layout).
- Etapa 5: Troca de tenant (API + contexto), escolha inicial de tenant.
- Etapa 6: Admin base (requireAdmin, RBAC admin:access), CRUD tenants/usuários/memberships, páginas admin.

**Base 2 (operacional e integrações):**

- Etapa 1: Webhooks Typebot e Evolution com rate-limit e validação de assinatura (`X-Webhook-Timestamp` + `X-Webhook-Signature`), ingest → raw events, enfileiramento Redis.
- Etapa 2 Typebot: Processador typebot raw → lead + lead_event (+ UTM), idempotência por (tenant, source_provider, source_external_id) e por (lead_id, _rawEventId).
- Etapa 2 Evolution: Processador evolution raw → conversations + conversation_messages (messages.upsert).
- Typebot API Metrics: sync de métricas de início/finalização/abandono para `bot_metrics_snapshots`.
- Google Ads: Auth OAuth (client/secret, encryption key, state assinado), contas em `google_ads_accounts`, sync de campanhas e métricas, dashboard Google Ads (contas, snapshots, disparo de sync).
- Home/hub: Resumo com analytics (totais Ads, top campanhas) e período.
- Telas operacionais: Leads e Conversas (listagem e detalhe por tenant).
- Atribuição Ads → Leads: last-touch por campanha, CPL indicativo, match por período e campanha.
- Funil e jornada: Visão de funil (volume, conversão, % total, gargalo), período opcional; jornada no detalhe do lead (etapa atual, eventos com etapa).
- Qualidade do funil: Resolução de etapa a partir de payload Typebot (funnel_steps.criteria), regra de avanço (não regredir), preenchimento de `current_funnel_step_id` e `lead_events.funnel_step_id`.
- Configuração: Inventário de credenciais, .env.example completo, CONFIG_CREDENTIALS.md, seed opcional Typebot/Evolution para primeiro teste E2E.

---

## 4. Escalabilidade

- **Tenant:** Todas as queries filtradas por `tenant_id`; índices por tenant nas tabelas principais (leads, conversations, raw events, snapshots). Um funil ativo por tenant na resolução de etapa (primeiro por nome); múltiplos funis possíveis no schema.
- **Volume:** Raw events append-only; processamento assíncrono (Redis). Idempotência nos processadores evita duplicação ao reprocessar. Listagens com limite (ex.: 200) e paginação onde há (ex.: snapshots, atribuição).
- **Worker:** Um processo hoje; filas separadas por tipo (typebot, evolution, google-ads). Escala horizontal possível com múltiplos workers e Redis (cada job consumido por um worker). Sem lock distribuído explícito; idempotência por chave de negócio.
- **Banco:** Conexão singleton no app (evita muitas conexões em dev/HMR). Migrations versionadas; schema por domínio para evolução controlada.
- **Limitações atuais:** Sem cache (Redis só filas); sem read replicas; período do funil baseado em first_seen_at (não em “entrada no funil”); um gargalo destacado por funil.

---

## 5. Segurança

- **Auth:** Sessão em tabela `sessions`; token opaco no cookie (nunca JWT); hash SHA-256 do token persistido; cookie HttpOnly, Secure em prod, SameSite=Lax, Path=/. Revogação imediata ao invalidar sessão ou limpar cookie.
- **Senha:** Argon2 (argon2id) para hash; nunca em log ou resposta.
- **Tenancy:** `current_tenant_id` só da sessão (server); rotas de dashboard/admin não aceitam tenant no body/path para escopo. APIs de listagem/detalhe usam `tenantId` do contexto.
- **RBAC:** Permissions por slug (admin:access, dashboard:read, leads:read/write, funnels:read/write, etc.); checagem por membership e role_permissions. Admin central exige `admin:access` (super_admin).
- **Webhooks:** Typebot e Evolution validam assinatura HMAC com timestamp (anti-replay) quando secret configurado; compatibilidade legada com `X-Webhook-Secret` (Typebot) e `X-API-Key` (Evolution).
- **Google Ads:** Tokens (refresh/access) criptografados com AES-256-GCM; chave em .env (GOOGLE_ADS_ENCRYPTION_KEY). State OAuth assinado com HMAC-SHA256 (GOOGLE_ADS_STATE_SECRET ou SESSION_SECRET), TTL 10 min.
- **Middleware:** Apenas presença do cookie em /dashboard e /admin; validação real da sessão em `getCurrentSession()` nos layouts/APIs. Rotas públicas: /, /login, /api/auth/*, /api/health; webhooks não exigem cookie.

---

## 6. Estrutura futura e funcionalidade

- **Schema já preparado:** `ai-alerts-audit` (ai_classifications, kpi_rules, alerts, audit_logs, processing_failures); snapshots (funnel_step_metrics_snapshot, instance_status_logs). Uso ainda mínimo ou planejado.
- **Domain:** Pasta `domain/` para regras de negócio isoladas de infra; uso atual reduzido; módulos podem crescer (ex.: regras de funil, atribuição, alertas).
- **UI:** Cadastro de funis e etapas por UI (hoje só visão e jornada); telas admin para “Adicionar bot Typebot” e “Adicionar instância Evolution” (lógica já coberta pelo seed opcional). Filtros e relatórios adicionais no dashboard.
- **Integrações:** Outras origens de lead (além de Typebot/Evolution) reutilizando padrão ingest → raw event → fila → processador. Criteria de funnel_steps extensível (novos campos de payload).
- **Analytics/atribuição:** Período configurável, mais métricas de conversão, tempo médio por etapa; possível histórico do funil (snapshots ou tabela de mudança de etapa).
- **IA/alertas:** Uso das tabelas de classificação, KPI e alertas; processamento assíncrono e notificações (fora do escopo atual).

---

## 7. Funcionalidade (resumo por área)

| Área | Funcionalidade |
|------|-----------------|
| **Login / sessão** | Login email/senha, logout, sessão com tenant atual, troca de tenant (API + switcher no header). |
| **Dashboard** | Início (resumo analytics, período), Leads (lista, busca, detalhe com UTM, eventos, conversas, funil/etapa), Conversas (lista, detalhe com mensagens), Google Ads (contas, sync, snapshots, atribuição Ads→Leads, CPL), Funil (volume por etapa, conversão, % total, gargalo, período), Configurações > Perfil. |
| **Admin** | Listar/criar/editar tenants, listar/criar usuários, listar/editar memberships, integrar Typebot/Evolution/UAZAPI, sincronizar métricas Typebot API e monitorar observabilidade operacional. |
| **Webhooks** | POST /api/webhooks/typebot/[botId], POST /api/webhooks/evolution/[instanceId]; validação, ingest, enfileiramento. |
| **Google Ads** | OAuth start/callback, complete (escolher conta), tokens em DB; sync por conta (API + job); listagem de contas e campanhas. |
| **Worker** | Consome filas Typebot, Evolution, Google Ads; processa raw → lead/event ou conversation/messages ou snapshots; heartbeat Redis. |
| **Config** | .env para app, DB, Redis, sessão, seed, Google Ads; Typebot/Evolution por registro no banco (seed opcional ou manual). |

Este documento serve como referência única para escopo, execução, etapas, escalabilidade, segurança e visão de evolução do projeto.
