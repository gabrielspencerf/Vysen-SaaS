# Subir a aplicação e testes práticos

Este documento descreve o que é necessário para rodar a aplicação localmente e iniciar os testes práticos. A estrutura (schema, migrations, seed, auth, dashboard, admin) está pronta para uso.

---

## Conclusão da revisão

**Sim, já é possível iniciar os testes práticos e subir a aplicação**, desde que:

1. PostgreSQL esteja rodando e o banco exista.
2. As variáveis obrigatórias estejam definidas em `.env` ou `.env.local`.
3. As migrations tenham sido aplicadas e o seed executado (para ter usuário e tenant).

Redis é **opcional** para o fluxo básico (login e navegação). **Redis é obrigatório** para workers, webhooks (Typebot/Evolution), observabilidade operacional e alguns endpoints administrativos com rate-limit.

---

## Pré-requisitos

- **Node.js** >= 20 (ver `package.json` → engines).
- **PostgreSQL** (qualquer versão compatível com o schema).
- **npm** (ou pnpm/yarn).

Obrigatório para webhooks e Google Ads (opcional só para login/dashboard/admin):

- **Redis** — obrigatório para: filas do worker, ingest de webhooks (Typebot/Evolution/UAZAPI) e fluxos de sync (Google Ads, Meta Ads e Clarity). Sem Redis, essas funcionalidades não funcionam.

---

## Passo a passo

### 1. Variáveis de ambiente

Crie `.env` na raiz do projeto (ou `.env.local`; o Next.js carrega ambos). O script de seed usa `dotenv/config`, que lê `.env` por padrão.

**Mínimo para subir a app e testar login/dashboard:**

```env
# Obrigatório
DATABASE_URL=postgresql://usuario:senha@localhost:5432/vysen
SESSION_SECRET=uma-string-longa-aleatoria

# Opcional (padrões)
NODE_ENV=development
SESSION_COOKIE_NAME=session
```

**Para rodar o seed (criar usuário e tenant de teste):**

```env
# Além de DATABASE_URL e SESSION_SECRET
SEED_ADMIN_PASSWORD=suasenha
# Opcional: SEED_ADMIN_EMAIL=admin@example.com  SEED_ADMIN_NAME=Super Admin
# Opcional: SEED_TENANT_NAME=Tenant de Teste  SEED_TENANT_SLUG=tenant-teste
```

Exemplo completo de referência: `.env.example`.

### 2. Banco de dados

- Crie o banco no PostgreSQL (ex.: `createdb app` ou pelo cliente).
- Garanta que `DATABASE_URL` aponte para esse banco.

### 3. Migrations

Aplique as migrations (tabelas e enums):

```bash
npm run db:migrate
```

Ou, em desenvolvimento, se preferir sincronizar o schema direto sem arquivos de migration:

```bash
npm run db:push
```

Migrations existentes na pasta `src/db/migrations/`:

- `0000_concerned_blacklash.sql` — schema inicial (auth, integrations, raw-events, funnels-leads, conversations, snapshots, ai-alerts-audit).
- `0001_google_ads_currency_code.sql` — coluna `currency_code` em `google_ads_accounts`.
- `0002_app_global_config.sql` — tabela `app_global_config` (setup web).
- `0003_hardening_integrations.sql` — hardening e integrações (UAZAPI, dedup raw events, campos de segurança/metrics Typebot).

### 4. Seed (usuário e tenant iniciais)

Cria roles, permissions, tenant de teste e usuário admin com membership:

```bash
npm run db:seed
```

Exige `SEED_ADMIN_PASSWORD` (e opcionalmente `SEED_ADMIN_EMAIL`, `SEED_TENANT_NAME`, etc.). Idempotente: pode rodar mais de uma vez sem duplicar dados.

### 5. Subir a aplicação

```bash
npm run dev
```

A app estará em `http://localhost:3000` (ou na porta que o Next mostrar no terminal).

---

## Verificações rápidas

| Ação | Como verificar |
|------|----------------|
| App no ar | Abrir `http://localhost:3000` — landing com "Entrar na minha conta" e "Acesso administrador". |
| Banco/infra ok | `GET http://localhost:3000/api/health` — resposta 200 com `{ "ok": true, "db": "ok", "redis": "ok", "worker": "ok" }`. |
| Login usuário | "Entrar na minha conta" → `/login`; email e senha do seed → redireciona para `/dashboard`. |
| Login admin | "Acesso administrador" → `/admin-login`; só usuário super_admin entra; redireciona para `/admin`. |
| Dashboard | Após login usuário: `/dashboard` → `/dashboard/context` (escolher tenant) ou `/dashboard/home`. Sidebar com Início, Comercial (Leads, Oportunidades, Produtos, Reclamações), Canais (Google Ads, Meta Ads, Clarity, WhatsApp) e Funil. |
| Admin | Após login admin: `/admin` (hub Integrações, Observabilidade, Tenants, Usuários), incluindo integração UAZAPI e sync de métricas Typebot API. |

---

## O que funciona sem Redis

- Home, login, logout, sessão.
- Dashboard (home, leads, conversas, funis, contexto de tenant).
- Admin (tenants, usuários, memberships).
- API de contexto (tenants, troca de tenant).
- Health check.

Redis **não** é importado no startup da aplicação; só é usado quando alguma rota ou job chama `createRedisClient()`. Portanto, não definir `REDIS_URL` não impede a app de subir.

## O que exige Redis

- **Worker** (`npm run worker:dev`): filas Redis + retry/backoff + DLQ.
- **Google Ads:** callback OAuth (`/api/google-ads/auth/callback`), sync (`/api/google-ads/sync/[accountId]`), estado pendente.
- **Meta Ads:** callbacks e sync de snapshots/eventos por filas (`queue:meta-ads:*`).
- **Clarity:** sync de snapshots por filas (`queue:clarity:*`).
- **Webhooks:** ingest de Typebot e Evolution (enfileiramento de jobs).

Para testes que envolvam apenas login, dashboard e admin, **Redis pode ficar em branco**.

**Observabilidade (Admin):** a página **Admin > Observabilidade** abre mesmo sem `REDIS_URL`. Sem Redis configurado, os indicadores de Redis, worker e filas aparecem como indisponíveis (erro / missing / profundidade 0). Para ver filas e heartbeat do worker, configure `REDIS_URL`.

---

## Outras variáveis (opcionais para testes iniciais)

- **CONFIG_ENCRYPTION_KEY:** Necessária apenas se o setup web gravar valores sensíveis em `app_global_config`. Para apenas subir e testar telas, pode omitir.
- **BOOTSTRAP_SUPER_ADMIN_***:** Documentado em `docs/SETUP_BOOTSTRAP_ARCHITECTURE.md`; o seed Base 1 já cria o admin com `SEED_ADMIN_*`. O bootstrap é uma alternativa “uma vez” quando não há super_admin; para testes, o seed é suficiente.
- **GOOGLE_ADS_*:** Só necessárias para conectar contas Google Ads e sync; não bloqueiam subir a app.
- **NEXT_PUBLIC_APP_URL:** Útil para redirects e OAuth; em dev local pode ser `http://localhost:3000`.

---

## Resumo

1. **Estrutura:** Pronta (schema, migrations, seed, auth, dashboard, admin, design system doc).
2. **Para subir:** `.env` com `DATABASE_URL` e `SESSION_SECRET`; banco criado; `db:migrate` (ou `db:push`); `db:seed` com `SEED_ADMIN_PASSWORD`; `npm run dev`.
3. **Testes práticos:** Login, seleção de tenant, dashboard home, leads, conversas, funis, admin — todos utilizáveis sem Redis. Para workers e integrações (Google Ads, webhooks), configure Redis e as variáveis correspondentes.

Se algo falhar (migration, seed ou health), verifique os erros no terminal e a conectividade com o PostgreSQL; a mensagem costuma indicar o próximo passo.

---

## Padrão de desenvolvimento

Para desenvolver novas telas, componentes ou alterar o front, use o **documento canônico** [docs/PADRAO_DESENVOLVIMENTO.md](PADRAO_DESENVOLVIMENTO.md). Ele define:

- Rotas e sessões (usuário vs admin, entradas de login).
- Estrutura de pastas e onde colocar páginas e componentes.
- Uso obrigatório do Design System (`src/components/ui/`, `src/components/layout/`, sidebar, shells).
- Checklists para nova tela e novo componente.
- Referências (design-system, patterns, code-and-implementation).

O Design System está em [docs/design-system/](design-system/); o mapeamento código ↔ doc em [docs/design-system/code-and-implementation.md](design-system/code-and-implementation.md).

---

## Solução de problemas

### Erro: "não existe a relação uazapi_instances" (sessão super admin)

**Sintoma:** Ao acessar Admin (super admin), a tela quebra com `PostgresError: relation "uazapi_instances" does not exist`.

**Causa:** A tabela `uazapi_instances` é criada pela migration `0003_hardening_integrations.sql`. Se as migrations não foram aplicadas até essa versão (banco novo só com 0000, ou migrations rodadas antes de 0003 existir), a tabela não existe e a página Admin > Integrações falha ao carregar estatísticas e listagens (Typebot, Evolution, **UAZAPI**, Google Ads).

**Solução:** Aplicar todas as migrations no banco em uso:

```bash
npm run db:migrate
```

Confirme que `DATABASE_URL` no `.env` aponta para o mesmo banco que a aplicação usa. Após a execução, a tabela `uazapi_instances` e os índices/constraints da 0003 estarão criados; recarregue a página do admin.

**Referência:** Schema em `src/db/schema/integrations/uazapi-instances.ts`; migration em `src/db/migrations/0003_hardening_integrations.sql`; uso em `src/server/admin/integrations-stats.ts` e página `src/app/(admin)/admin/integrations/page.tsx`. Documentação de credenciais: [CONFIG_CREDENTIALS.md](CONFIG_CREDENTIALS.md).

### Erro: "não existe a coluna currency_code" (Google Ads / dashboard)

**Sintoma:** Ao acessar a área Google Ads no dashboard (ou listagem de contas/snapshots), a tela quebra com `PostgresError: column "currency_code" does not exist`.

**Causa:** A coluna `currency_code` na tabela `google_ads_accounts` é criada pela migration `0001_google_ads_currency_code.sql`. Essa migration não estava listada no journal do Drizzle (`src/db/migrations/meta/_journal.json`), então `npm run db:migrate` não a aplicava.

**Solução (escolha uma):**

1. **Rodar todas as migrations:** `npm run db:migrate` (a 0001 adiciona a coluna).
2. **Se o erro persistir** (ex.: migration já marcada como aplicada mas coluna ausente), rode o script que aplica só essa coluna: `npm run db:ensure-currency-code`. Ele executa `ALTER TABLE google_ads_accounts ADD COLUMN IF NOT EXISTS currency_code varchar(8)` usando o `DATABASE_URL` do `.env`.

Recarregue a página do Google Ads no dashboard após aplicar.

---

### Erro: "REDIS_URL não definida" na página Observabilidade

**Sintoma:** Ao abrir Admin > Observabilidade, a página quebra com `REDIS_URL não definida. Configure em .env.local`.

**Causa:** A observabilidade consulta Redis para métricas de filas e heartbeat do worker. O código antigo lançava erro ao não encontrar `REDIS_URL`.

**Solução (escolha uma):**

1. **Configurar Redis:** Defina `REDIS_URL` no `.env` ou `.env.local` (ex.: `redis://localhost:6379`) para ver filas e status do worker na página.
2. **Usar sem Redis:** Na versão atual, a página de Observabilidade **abre mesmo sem REDIS_URL**: Redis, worker e filas aparecem como indisponíveis; o restante (DB, integrações, erros recentes) é exibido normalmente. Atualize o código se ainda vir o erro.

---

## Revisão geral, changelog e segurança no Git

Para visão consolidada das evoluções recentes, variáveis de ambiente, logs, o que **não** versionar e checklist antes de push ao GitHub, use **[docs/REVISAO_GERAL_2026-03.md](REVISAO_GERAL_2026-03.md)**.

---

## Log de erros e soluções

Problemas encontrados durante o projeto (inicialização, ambiente, build, runtime) estão documentados em **[docs/log/](log/)**. Ao resolver um erro novo, vale registrar em [docs/log/REGISTRO.md](log/REGISTRO.md) para referência futura.
