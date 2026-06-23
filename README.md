# Vysen SaaS

**Plataforma comercial multi-tenant com IA para equipes de vendas e marketing.**

Centralize leads, conversas, funil e integrações de mídia paga em uma única plataforma — com copiloto de IA, automação de follow-up e análise em tempo real.

---

## O que a Vysen resolve

| Problema | Como a Vysen resolve |
|---|---|
| Leads dispersos em vários canais | CRM unificado com importação CSV e webhooks de Typebot/WhatsApp |
| Perda de contexto nas conversas | Inbox centralizado com histórico e mídia (áudio/imagem) |
| Funil sem visibilidade | Kanban + etapas configuráveis + relatório de gargalos |
| Decisão lenta sem dados | Vysen Copilot: IA consultiva sobre a operação em tempo real |
| Campanhas sem atribuição | Integração nativa Google Ads + Meta Ads com CAPI offline |
| Equipe sem controle de acesso | RBAC por tenant: roles, permissões, auditoria por ação |

---

## Módulos principais

### CRM e funil
- Leads com status, funil, origem, produtos e histórico de eventos
- Funil configurável (etapas, ordem, nome) com kanban e relatório de conversão
- Contatos linkados a leads com importação e exportação CSV
- Oportunidades com valor e negociação

### Conversas e canais
- Inbox unificado: WhatsApp (Evolution API, UAZAPI, WhatsApp Cloud), Chatwoot
- Mensagens com áudio (transcrição via Whisper), imagens (descrição via Vision)
- Classificação automática de conversa por IA
- Configuração de instâncias por tenant com QR Code e status de conexão

### Vysen Copilot
- IA analítica sobre a operação: leads, funil, conversas, campanhas
- Memória de conversa por thread com resumo automático
- Contextos selecionáveis (geral, funil, Google Ads, Meta Ads, conversas)
- Modo rápido e modo thinking (raciocínio estendido)

### Integrações de mídia paga
- **Google Ads**: OAuth, sync de campanhas, conversões offline (GCLID)
- **Meta Ads**: OAuth, sync de insights, CAPI server-side, Pixel
- **Microsoft Clarity**: conexão e sync por tenant

### Follow-up automatizado
- Tarefas de follow-up agendadas por lead
- Motor de disparo configurável (intervalo, máximo de tentativas)
- Integração com agente de IA para geração de mensagem contextual

### Infraestrutura multi-tenant
- Isolamento por RLS (PostgreSQL Row-Level Security) com `SET LOCAL` por transação
- RBAC completo: tenant → membership → role → permissions
- Auditoria de ações por tenant (feature flag por plano)
- Notificações internas por tenant com histórico
- SMTP próprio por tenant para envio de e-mails

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js App Router (API Routes), Node.js 20+ |
| Banco de dados | PostgreSQL 16 + pgvector + Drizzle ORM |
| Cache/Filas | Redis + worker assíncrono próprio |
| IA | OpenAI (GPT-4o, Whisper, Vision) |
| Auth | Sessão por cookie opaco + RBAC |
| Segurança | SSRF guard, HMAC webhooks, AES-256-GCM, rate limit, dedup |
| Deploy | Docker + GHCR (`ghcr.io/gabrielspencerf/vysen-saas`) |

---

## Estrutura do repositório

```
src/
  app/              # UI e API Routes (Next.js App Router)
    (dashboard)/    # área do usuário tenant
    (superadmin)/   # área administrativa global
    api/            # endpoints REST por domínio
  components/       # componentes de UI reutilizáveis
  features/         # lógica de features complexas (chat, kanban)
  server/           # domínio de negócio, auth, integrações, segurança
  db/               # schema Drizzle, migrations, seeds
  workers/          # consumidores de fila assíncrona
docs/               # documentação técnica e operacional
scripts/            # utilitários de banco, smoke tests, deploy
```

---

## Como rodar localmente

### Pré-requisitos

- Node.js >= 20
- PostgreSQL 16
- Redis

### Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env.local
# Preencher DATABASE_URL, SESSION_SECRET, REDIS_URL

# 3. Banco de dados
npm run db:migrate
npm run db:seed

# 4. App
npm run dev          # http://localhost:3000

# 5. Worker (em paralelo, opcional)
npm run worker:dev
```

### Deploy com Docker

```bash
docker compose up -d
# ou usar a imagem pré-compilada: ghcr.io/gabrielspencerf/vysen-saas:latest
```

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Desenvolvimento local |
| `npm run build` | Build de produção |
| `npm run ci:verify` | Pipeline completo: lint + typecheck + testes + build + smokes |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emit |
| `npm run test` | Testes de segurança (Node test runner) |
| `npm run smoke:api` | Smoke estrutural de auth/tenant/webhooks |
| `npm run smoke:web` | Smoke estrutural de rotas e boundary web |
| `npm run smoke:worker` | Smoke de filas e readiness |
| `npm run smoke:channels` | Smoke de ingestão Chatwoot/WhatsApp Cloud |
| `npm run db:migrate` | Aplica migrations |
| `npm run db:seed` | Dados iniciais |
| `npm run db:studio` | Drizzle Studio |

---

## Documentação técnica

- [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) — bootstrap detalhado
- [`docs/CONFIG_CREDENTIALS.md`](docs/CONFIG_CREDENTIALS.md) — mapa de credenciais e variáveis
- [`docs/PADRAO_DESENVOLVIMENTO.md`](docs/PADRAO_DESENVOLVIMENTO.md) — padrões de código e arquitetura
- [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md) — deploy em VPS com Docker Swarm
- [`docs/REVISAO_GERAL_2026-06.md`](docs/REVISAO_GERAL_2026-06.md) — revisão técnica mais recente
