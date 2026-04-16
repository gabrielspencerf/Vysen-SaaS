# Observabilidade SaaS (Vysen)

Plataforma SaaS multi-tenant para operacao comercial e marketing, com foco em:

- observabilidade de leads e conversas;
- funil de vendas e analise de gargalos;
- integracoes com Google Ads, Meta Ads, Clarity, Typebot, Evolution e UAZAPI;
- apoio a decisao com Vysen Copilot.

Este repositorio contem app web (Next.js), APIs internas, worker assicrono e camada de dados (Drizzle + PostgreSQL).

## Stack principal

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- PostgreSQL + Drizzle ORM
- Redis + BullMQ (filas e jobs)
- Autenticacao por sessao (cookie opaco)

## Funcionalidades principais

- Multi-tenancy com RBAC (tenant, usuario, membership, permissoes)
- Dashboard com leads, conversas, funil e canais
- Area admin para tenants, usuarios e integracoes
- Ingestao de webhooks e processamento assincrono via worker
- Auditoria e notificacoes por tenant (com feature flags)
- Copilot Vysen com fallback de modelo e telemetria

## Estrutura do projeto

```txt
src/
  app/           # rotas UI e API (App Router)
  components/    # componentes reutilizaveis
  server/        # regras de negocio, auth, integracoes, seguranca
  db/            # schema, migrations e seeds
  workers/       # consumidores de fila e jobs
docs/            # documentacao tecnica e operacional
scripts/         # scripts utilitarios de ambiente/banco
```

## Como rodar localmente

### 1) Pre-requisitos

- Node.js >= 20
- PostgreSQL
- Redis (obrigatorio para worker e integracoes assincronas)

### 2) Instalar dependencias

```bash
npm install
```

### 3) Configurar ambiente

Copie `.env.example` para `.env` (ou `.env.local`) e preencha no minimo:

- `DATABASE_URL`
- `SESSION_SECRET`

Para worker/integracoes, configure tambem:

- `REDIS_URL`

### 4) Preparar banco

```bash
npm run db:migrate
npm run db:seed
```

### 5) Subir aplicacao

```bash
npm run dev
```

App local: `http://localhost:3000`

### 6) (Opcional) Subir worker em paralelo

```bash
npm run worker:dev
```

## Scripts uteis

- `npm run dev` - sobe app em modo desenvolvimento
- `npm run build` - build de producao
- `npm run start` - start de producao
- `npm run lint` - lint do projeto
- `npm run typecheck` - checagem TypeScript
- `npm run db:migrate` - aplica migrations
- `npm run db:seed` - popula dados iniciais
- `npm run db:studio` - abre Drizzle Studio

## Seguranca e boas praticas

- Nunca versione segredos reais em `.env` ou stacks Docker.
- Use placeholders em documentacao e exemplos.
- Mantenha validacoes e permissoes no servidor.
- Toda rota mutavel deve passar por guard de autenticacao/autorizacao.

## Documentacao recomendada

- `docs/GETTING_STARTED.md` - bootstrap detalhado
- `docs/CONFIG_CREDENTIALS.md` - mapa de credenciais e variaveis
- `docs/SECURITY_ENDPOINTS_MAP.md` - superficie de endpoints criticos
- `docs/VYSEN_COPILOT.md` - modelos, fallback e limites do copilot
- `docs/REVISAO_COMPLETA_APP_2026-03.md` - auditoria tecnica consolidada

## Status

Repositorio em evolucao continua com foco em:

- consistencia de UX dashboard/admin;
- robustez de seguranca por ambiente;
- escalabilidade de filas, ingestao e processamento de dados.
