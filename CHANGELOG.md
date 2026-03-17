# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [0.2.0] - 2025-03-17

### Adicionado

- **Dashboard usuário**
  - Contatos: listagem, import/export CSV.
  - Oportunidades: listagem e edição (estágio, título, valor, modelo contratado).
  - Produtos: listagem e CRUD.
  - Reclamações (complaints): listagem.
  - Onboarding: página e progresso por tenant.
  - PageSpeed: resultados e métricas.
  - Leads: kanban, edição de lead, configuração de funil (`funnel/config`).
  - Configurações: seção de arquivos da empresa.
- **Integrações**
  - UAZAPI: webhooks, ingestão de eventos, paridade com Evolution.
  - Migrations: tabelas `opportunities`, `contacts`, `products`, onboarding, pagespeed, complaints; coluna `uazapi_instance_id` em conversations.
- **UI / Design System**
  - Botões: pegada rounded-xl, variantes outline e tab (ativo/inativo).
  - Fundo granulado no dashboard (`.dashboard-grain`).
  - Botões do super admin padronizados com componente `Button`.
- **API**
  - Rotas em `/api/dashboard/` para oportunidades, contatos, produtos, etc.
  - Webhooks UAZAPI em `/api/webhooks/uazapi/`.

### Alterado

- Migration 0004 idempotente (enum, ADD COLUMN, DROP CONSTRAINT) para ambientes com schema parcial.
- Sidebar dashboard: item Oportunidades; referências visuais alinhadas ao design system.

### Documentação

- `PADRAO_DESENVOLVIMENTO.md`: estrutura de pastas atualizada (contacts, opportunities, products, complaints, onboarding, pagespeed, settings).
- Docs em `docs/`: planos de negócio, import/export, UAZAPI, revisão de páginas.

---

## [0.1.0] - inicial

- Next.js 15, React 19, Drizzle, Postgres, Redis, BullMQ.
- Áreas: landing, login, admin-login, dashboard (home, leads, conversas, Google Ads, funil), admin (integrations, observability, tenants, users).
- Design system CL (brand, sidebar ZincMail, layout Aura).

[0.2.0]: https://github.com/gabrielspencerf/observabilidade-saas/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gabrielspencerf/observabilidade-saas/releases/tag/v0.1.0
