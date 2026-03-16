# Docker e deploy via Portainer

Este guia cobre: subir o projeto no **GitHub** e rodar a stack completa com **Docker** no **Portainer**.

Para ambiente com **Docker Swarm + Traefik** (modelo de stack com `deploy` e labels), use:

- `docs/DOCKER_SWARM_PORTAINER.md`
- `docker-stack.swarm.yml`

---

## 1. Subir o projeto no GitHub

1. **Crie um repositório** no GitHub (vazio, sem README).
2. **Não versionar segredos:** o `.gitignore` já ignora `.env`, `.env*.local` e `/pgdata`. Nunca commite senhas ou chaves.
3. **Primeiro push:**

   ```bash
   git init
   git add .
   git commit -m "chore: stack inicial com Docker e documentação"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```

4. **Recomendado:** use um `.env` só na máquina ou no Portainer; não inclua no repositório.

---

## 2. Stack Docker (compose)

A stack é composta por:

| Serviço   | Descrição                    | Porta (host) |
|-----------|------------------------------|---------------|
| `postgres`| PostgreSQL 16                | —             |
| `redis`   | Redis 7                      | —             |
| `app`     | Next.js (API + dashboard + admin) | 3000 (ou `APP_PORT`) |
| `worker`  | Consumidor das filas (Typebot, Evolution, Google Ads) | — |

Uma única **imagem** é usada para `app` e `worker`: o serviço `app` roda o servidor Next.js; o `worker` usa a mesma imagem com outro comando (`npx tsx src/workers/runner.ts`).

---

## 3. Variáveis de ambiente (Portainer / `.env`)

Copie o `.env.example` para `.env` e preencha pelo menos:

- **SESSION_SECRET** — obrigatório; use um valor longo e aleatório (ex.: `openssl rand -hex 32`).
- **POSTGRES_PASSWORD** — senha do Postgres (padrão no compose: `postgres`).
- **SEED_ADMIN_PASSWORD** — só se for rodar o seed para criar o primeiro admin (veja seção 5).

O `docker-compose.yml` monta automaticamente:

- **DATABASE_URL** = `postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/app`
- **REDIS_URL** = `redis://redis:6379`

Você pode definir no `.env` (ou no Portainer):

- **APP_PORT** — porta no host (padrão `3000`).
- **NEXT_PUBLIC_APP_URL** — URL pública da aplicação (ex.: `https://seu-dominio.com`).
- **INTEGRATIONS_ENCRYPTION_KEY** — se for cadastrar Evolution/UAZAPI/Typebot com API key/token (veja `docs/CONFIG_CREDENTIALS.md`).

---

## 4. Deploy no Portainer

### 4.1 Via Stack (recomendado)

1. No Portainer: **Stacks** → **Add stack**.
2. **Name:** por exemplo `observabilidade-saas`.
3. **Build method:** escolha **Git repository** e informe a URL do repositório (ex.: `https://github.com/SEU_USUARIO/SEU_REPO`) e o branch (ex.: `main`).
4. **Compose path:** `docker-compose.yml` (na raiz do repositório).
5. **Environment variables:** adicione as variáveis necessárias (ou use “Load variables from .env file” se o Portainer permitir upload). Mínimo: `SESSION_SECRET`, `POSTGRES_PASSWORD`; para seed: `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_EMAIL`.
6. **Deploy the stack.**

O Portainer fará o build da imagem a partir do Dockerfile e subirá `postgres`, `redis`, `app` e `worker`.

### 4.2 Via CLI (na própria VPS)

Se o repositório estiver clonado na VPS:

```bash
cd /caminho/do/repo
cp .env.example .env
# Edite .env: SESSION_SECRET, POSTGRES_PASSWORD, etc.
docker compose up -d
```

---

## 5. Setup inicial (migrations + seed) — uma vez

O banco `app` é criado pelo serviço Postgres ao subir. Falta aplicar as **migrations** e, se quiser, rodar o **seed** (primeiro tenant e usuário admin).

### Opção A: One-off (CLI na VPS ou Portainer Console)

Com acesso ao host onde o Docker está rodando:

```bash
# Migrations (uma vez)
docker compose exec app npx drizzle-kit migrate

# Seed — primeiro admin (uma vez; exige SEED_ADMIN_PASSWORD no .env)
docker compose exec app npx tsx scripts/db-seed.ts
```

Pelo **Portainer:** Containers → **app-web** → **Console** → Connect → digite os comandos acima. As variáveis do stack já estão no container.

### Opção B: Pela máquina local (apontando para a VPS)

Com Postgres exposto (ex.: porta 5432 mapeada no host):

```bash
# Na sua máquina, com .env apontando DATABASE_URL para a VPS
npm run db:migrate
npm run db:seed
```

---

## 6. Verificação

- **App:** `http://SEU_HOST:3000` (ou a URL configurada). Login admin: `/admin-login`.
- **Health:** `http://SEU_HOST:3000/api/health` — deve indicar `db`, `redis` e `worker` ok.

---

## 7. Resumo dos arquivos

| Arquivo               | Uso |
|-----------------------|-----|
| `Dockerfile`          | Build da imagem (Next.js standalone + worker com tsx). |
| `docker-compose.yml`  | Stack: postgres, redis, app, worker. |
| `.dockerignore`       | Reduz contexto de build (exclui node_modules, .env, .git). |
| `.env.example`        | Modelo de variáveis; copiar para `.env` e não versionar `.env`. |

Para detalhes de infra e variáveis em geral: `docs/DEPLOY_VPS.md` e `docs/CONFIG_CREDENTIALS.md`.
