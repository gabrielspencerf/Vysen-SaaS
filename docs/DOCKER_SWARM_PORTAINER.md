# Deploy na VPS com Docker Swarm + Portainer + Traefik

Este guia segue o padrao de stack que voce enviou (servicos separados, `deploy`, Traefik e rede externa).

Arquivo base da stack:

- `docker-stack.swarm.yml`
- `stack.env.example`
- `docker-stack.swarm.app-only.yml` (reusa Postgres/Redis ja existentes na rede externa)

---

## 1) Pre-requisitos na VPS

- Docker Engine com Swarm iniciado (`docker swarm init`).
- Portainer ligado ao endpoint Swarm.
- Traefik ja rodando na rede externa `CreativeLaneNet`.
- Volumes externos criados:

```bash
docker volume create app_postgres_data
docker volume create app_redis_data
```

---

## 2) Imagem da aplicacao (obrigatorio para Swarm)

Em Swarm, o deploy usa **imagem pronta** (nao usa `build` no stack). Se app_web/app_worker/app_setup ficam em **0/1**, quase sempre a imagem nao existe no node. Ver **docs/DEPLOY_STACK_PASSO_A_PASSO.md** para o fluxo completo.

Build no manager (recomendado para subir pela primeira vez):

```bash
gh repo clone gabrielspencerf/observabilidade-saas
cd observabilidade-saas
git checkout v0.2.0
docker build -t observabilidade-saas:v0.2.0 .
```

Ou via registry:

```bash
docker build -t SEU_USUARIO/observabilidade-saas:v0.2.0 .
docker push SEU_USUARIO/observabilidade-saas:v0.2.0
# Na VPS: docker pull ... e tag como observabilidade-saas:v0.2.0
```

---

## 3) Variaveis minimas da stack

No Portainer (Stack > Environment variables) ou em arquivo `.env`:

Voce tambem pode copiar o modelo pronto:

```bash
cp stack.env.example stack.env
```

```env
APP_IMAGE=observabilidade-saas:v0.2.0
APP_HOST=hub.creativelane.io
NEXT_PUBLIC_APP_URL=https://hub.creativelane.io
POSTGRES_PASSWORD=troque-por-um-valor-forte
SESSION_SECRET=troque-por-um-valor-longo-e-aleatorio
TZ=America/Sao_Paulo
```

Opcional (quando usar):

- `CONFIG_ENCRYPTION_KEY`
- `INTEGRATIONS_ENCRYPTION_KEY`
- `GOOGLE_ADS_*`
- `WEB_REPLICAS`, `WORKER_REPLICAS`, limites de CPU/memoria

---

## 4) Deploy no Portainer

1. **Stacks** -> **Add stack**
2. Nome: `observabilidade-saas`
3. Tipo: Swarm stack
4. Conteudo: cole `docker-stack.swarm.yml` (ou use Git repository)
5. Configure env vars da secao anterior
6. Deploy

### Opcao: app-only (sem subir Postgres/Redis)

Se sua VPS ja tem servicos compartilhados na `CreativeLaneNet` (por exemplo `postgres` e `redis`), use:

- `docker-stack.swarm.app-only.yml`

Essa versao sobe somente `app_web` e `app_worker`.

---

## 5) Setup inicial (uma vez)

Depois da stack subir:

### 5.1 Migrations

```bash
docker exec -it $(docker ps -q --filter name=app_web) npx drizzle-kit migrate
```

### 5.2 Seed (opcional)

Defina `SEED_ADMIN_PASSWORD` no ambiente da stack e rode:

```bash
docker exec -it $(docker ps -q --filter name=app_web) npx tsx scripts/db-seed.ts
```

---

## 6) Saude e verificacao

- App: `https://APP_HOST`
- Health: `https://APP_HOST/api/health`
- Worker: conferir logs do servico `app_worker`

---

## 7) Observacoes importantes

- **Nao commite segredos** no repositório (`.env`, senhas, tokens, chaves SMTP/OAuth).
- Como voce compartilhou exemplo com segredos reais no chat, recomendo **rotacionar todas as credenciais** expostas (SMTP, DB, encryption keys, tokens).
