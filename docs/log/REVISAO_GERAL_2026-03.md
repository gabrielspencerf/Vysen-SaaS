# Revisão geral da aplicação — março/2026

Documento de **changelog consolidado**, **segurança para versionamento (GitHub)** e **ponteiros** para variáveis, logs e documentação. Complementa [RELEASE_v0.2.0.md](RELEASE_v0.2.0.md), [RELEASE_v0.3.0.md](RELEASE_v0.3.0.md) e o que foi evoluído depois.

---

## 1. Resumo executivo

- **Produto:** Vysen / observabilidade-saas — multi-tenant (Postgres + Drizzle), filas Redis, worker Node separado, Next.js 15 App Router.
- **Áreas maduras:** Auth (sessão, RBAC, reset de senha, OAuth Google opcional), dashboard comercial, integrações admin (Typebot, Evolution, UAZAPI, Google Ads), webhooks com rate limit, observabilidade admin, mapa **Worker & dados** (filas + diagrama relacional), **reconexão WhatsApp** no dashboard (Evolution/UAZAPI com mensagens amigáveis de erro).
- **Segurança em camadas:** CSRF em mutações autenticadas, RLS opcional (`SECURITY_ENFORCE_RLS`), redirects restritos, segredos criptografados no banco, `.gitignore` para stacks Docker e `.env`.

---

## 2. Atualizações por área (consolidado)

### 2.1 Autenticação e conta

- Reset de senha (fluxo request/confirm), cookies, TTL configurável.
- Google OAuth (login) com flags de feature.
- “Lembrar de mim” com TTL estendido.
- Documentação: [AUTH_SMTP_OAUTH.md](AUTH_SMTP_OAUTH.md), [REVISAO_ACESSO_E_RBAC.md](REVISAO_ACESSO_E_RBAC.md).

### 2.2 Dashboard (tenant)

- Configurações: perfil, empresa, arquivos, tema dark/light.
- **WhatsApp:** `/dashboard/settings/whatsapp` — status de instância, QR/reconexão, cópias de erro **sem detalhe técnico** exposto ao usuário (`userMessage` no servidor).
- APIs: `GET/POST` em `/api/dashboard/integrations/messaging/*` (auth + `dashboard:read`, rate limit no connect).
- Canais: Google Ads, Meta, Clarity, atalho WhatsApp na sidebar.
- Suporte (chamados), notificações, Vysen/copilot conforme rotas existentes.

### 2.3 Admin (super_admin)

- Integrações com CRUD, observabilidade, agente/Vysen, **Worker e fluxo de dados** (`/admin/worker-pipeline`): métricas de fila/DLQ/heartbeat, mapa relacional (tabelas → núcleo), pipelines detalhados.
- UX alinhada a `DashboardPageHeader` + `max-w-7xl` como Observabilidade.

### 2.4 API e webhooks

- Webhooks públicos: Typebot, Evolution, UAZAPI (validação por instância, anti-replay onde aplicável).
- Rotas admin e dashboard documentadas em [SECURITY_ENDPOINTS_MAP.md](SECURITY_ENDPOINTS_MAP.md) (atualizado).

### 2.5 Worker e filas (Redis)

- Filas: raw Typebot/Evolution/UAZAPI; sync Google Ads, Meta Ads, Clarity; classificação IA; follow-up por tenant; DLQs espelhadas.
- Heartbeat Redis para painel de saúde.
- Processadores em `src/workers/processors/`; mapa canônico em `src/server/admin/worker-pipeline.ts`.

### 2.6 Banco de dados

- Migrations até **0018** (ex.: `0016_security_rls_tenant_policies`, `0017_tenant_role_permissions`, `0018_meta_ads_and_clarity`) — conferir `src/db/migrations/meta/_journal.json`.
- Schema modular em `src/db/schema/`.

### 2.7 Dependências relevantes

- `qrcode` (+ types) para geração de QR a partir do código retornado pela Evolution quando necessário.

---

## 3. Variáveis de ambiente

**Fonte única comentada:** [/.env.example](../.env.example) na raiz do repositório.

Categorias principais:

| Categoria | Exemplos | Notas |
|-----------|----------|--------|
| Core | `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `NODE_ENV` | Redis obrigatório para webhooks/worker/filas. |
| Segurança | `SECURITY_ENFORCE_RLS`, `SECURITY_ENFORCE_CSRF`, `RATE_LIMIT_TRUSTED_PROXY_HOPS` | Ver checklist em [SECURITY_ACCEPTANCE_CHECKLIST.md](SECURITY_ACCEPTANCE_CHECKLIST.md). |
| Criptografia | `CONFIG_ENCRYPTION_KEY`, `INTEGRATIONS_ENCRYPTION_KEY`, chaves Google/Meta Ads | Nunca commitar valores reais. |
| Features auth | `AUTH_*`, `NEXT_PUBLIC_AUTH_*` | UI espelha flags públicas. |
| Integrações | Google/Meta/Clarity/OpenAI/PageSpeed/SMTP | Ver comentários no `.env.example`. |
| Debug | `AGENT_DEBUG_INGEST_URL` | Opcional; se vazio, `agentDebugLog` não envia para terceiros. |

Arquivos **locais** que não devem ir ao Git: `.env`, `.env*.local`, `stack.env` (ver `.gitignore`).

---

## 4. Logs e telemetria

- **Console servidor:** erros operacionais (webhook, worker, integrações). Evitar logar corpo de request com tokens ou PII em produção.
- **`agentDebugLog`:** só envia HTTP se `AGENT_DEBUG_INGEST_URL` estiver definido; útil só em diagnóstico controlado.
- **Registro de problemas resolvidos:** [docs/log/REGISTRO.md](log/REGISTRO.md).

---

## 5. O que **não** versionar (segurança / infra)

Garantir antes de `git push` (principalmente repositório **público**):

| Item | Motivo |
|------|--------|
| `.env`, `.env.local`, `.env.production`, `stack.env` | Credenciais e segredos. |
| `docker-stack*.yml` com hosts/senhas reais | Regra do projeto: stacks com segredos só locais; templates sem segredos podem existir, mas o `.gitignore` atual ignora `docker-stack*.yml` — **não force commit** de stack preenchida. |
| `*.pem`, chaves privadas | Óbvio. |
| `/uploads` | Dados de clientes. |
| Dumps de banco (`*.dump`, `*.sql` com dados reais) | PII e segredos; adicionados padrões ao `.gitignore` para backups comuns. |
| `pgdata/` | Dados locais do Postgres. |

**Código:** fallback de `SMTP_FROM` em `mailer` quando a env não está definida: `hub@creativelane.io` (credenciais SMTP reais continuam no Portainer / `stack.env`).

**Documentação:** URL pública do app nos templates: `https://app.vysen.com.br`. SMTP de exemplo: `hub@creativelane.io` (mesmo remetente operacional). White-label: `TROCAR_*`; não commitar segredos.

---

## 6. Checklist rápido antes do push

- [ ] `git status` — nenhum `.env` ou `stack.env` listado.
- [ ] Nenhum arquivo novo com senha, API key ou token (buscar `sk-`, `BEGIN PRIVATE`, `postgresql://.*:.*@`).
- [ ] Stacks Docker usados na VPS **não** adicionados ao Git por engano.
- [ ] `npm run typecheck` e `npm run lint` (ou CI) passando em mudanças grandes.

---

## 7. Documentação atualizada nesta revisão

- Este arquivo: **`docs/REVISAO_GERAL_2026-03.md`**
- [SECURITY_ENDPOINTS_MAP.md](SECURITY_ENDPOINTS_MAP.md) — rotas dashboard messaging.
- [RESUMO_PROJETO.md](RESUMO_PROJETO.md) — escopo, workers, admin.
- [GETTING_STARTED.md](GETTING_STARTED.md) — link para esta revisão.
- [.env.example](../.env.example) e [stack.env.example](../stack.env.example) — exemplos anonimizados.
- [.gitignore](../.gitignore) — padrões extras para backups sensíveis.

---

## 8. Arquivos “antigos” ou candidatos a limpeza (sem remoção automática)

- **Manter:** migrations antigas (histórico), docs BASE2 (contexto de evolução).
- **Revisar manualmente:** duplicatas de documentação muito sobrepostas; scripts one-off em `scripts/` que não são mais usados (marcar no README ou remover em PR dedicado).
- **Não commitar:** qualquer `docker-stack` preenchido, exports de banco, credenciais de terceiros coladas em `.md` de debug.

---

## 9. Referência rápida de rotas novas relevantes

| Rota | Quem |
|------|------|
| `/dashboard/settings/whatsapp` | Usuário tenant |
| `GET /api/dashboard/integrations/messaging` | Tenant autenticado |
| `GET .../messaging/[id]/status` | Tenant autenticado |
| `POST .../messaging/[id]/connect` | Tenant autenticado + rate limit |
| `/admin/worker-pipeline` | `admin:access` (layout admin) |

---

*Última atualização deste documento: 2026-03-20.*
