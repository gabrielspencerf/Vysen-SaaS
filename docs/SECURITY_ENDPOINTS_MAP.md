# Security Endpoints Map

Mapa de superfícies críticas para rollout de segurança.

## 1) Auth e sessão

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/context/tenant`

## 2) Admin mutável (cookie auth + permissão)

- `POST /api/admin/integrations/*`
- `PATCH /api/admin/integrations/*`
- `DELETE /api/admin/integrations/*`
- `POST /api/admin/tenants`
- `PATCH /api/admin/tenants/[id]`
- `POST /api/admin/users`
- `POST /api/admin/memberships`

## 3) Dashboard mutável (cookie auth + tenant atual)

- `POST /api/dashboard/*` que cria/edita/deleta entidades
- Principais: leads import/export/patch, opportunities patch, funnels CRUD, products create, complaints create, tenant-assets upload/delete, notifications patch.
- `POST /api/dashboard/vysen/chat` (copilot do dashboard)

### 3.1) Integrações de mensagens (tenant — leitura / reconexão)

- `GET /api/dashboard/integrations/messaging` — lista instâncias Evolution/UAZAPI do tenant (sem segredos).
- `GET /api/dashboard/integrations/messaging/[instanceId]/status` — status amigável no JSON (`userMessage` em falha; sem vazar corpo bruto do provedor).
- `POST /api/dashboard/integrations/messaging/[instanceId]/connect` — obtém QR / reconexão; rate limit por usuário; respostas de erro com `userMessage`.

> A página admin **`/admin/worker-pipeline`** é apenas RSC (super_admin); não expõe API REST própria além do que o layout admin já protege.

## 4) Webhooks públicos

- `POST /api/webhooks/typebot/[botId]`
- `POST /api/webhooks/evolution/[instanceId]`
- `POST /api/webhooks/uazapi/[instanceId]`

## 5) Canais e ads (dashboard)

- `GET/POST /api/google-ads/*` (OAuth/sync)
- `GET/POST /api/meta-ads/*` (OAuth/sync/snapshots)
- `GET/POST /api/clarity/*` (conexão/sync/snapshots)

## 6) Admin (IA e integrações)

- `POST /api/admin/vysen/chat`
- `POST/PATCH/DELETE /api/admin/integrations/typebot/*`
- `POST/PATCH/DELETE /api/admin/integrations/evolution/*`
- `POST/PATCH/DELETE /api/admin/integrations/uazapi/*`

## 7) Regra obrigatória para novas rotas mutáveis

- Toda rota mutável em `/api/dashboard/*` deve usar `requireDashboardApiAuth(...)`.
- Toda rota mutável em `/api/admin/*` deve usar `requireAdmin(...)`.
- Rotas públicas (auth/webhook/health) devem ser explicitamente justificadas na documentação.

## 8) Controles por camada

- CSRF token: rotas mutáveis autenticadas por cookie.
- RLS context: `tenant_id` por request no servidor.
- Open redirect guard: login + OAuth.
- Anti-replay webhook: marcador de evento com TTL.
- Rate limit: buckets por rota sensível + IP confiável via proxy.
