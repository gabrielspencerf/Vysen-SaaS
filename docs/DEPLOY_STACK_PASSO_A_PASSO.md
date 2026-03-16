# Deploy da stack — passo a passo (Portainer / Swarm)

O stack usa a imagem **ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0**. O Swarm/Portainer **só consegue puxar** se a imagem estiver publicada num registry (GHCR, Docker Hub, etc.). Build local na VPS não é puxado automaticamente.

---

## 1. Publicar a imagem (uma vez) — para o Portainer puxar

O YML já aponta para o **GitHub Container Registry (GHCR)**. É preciso fazer build e push dessa imagem.

### 1.1 No seu PC (ou CI)

```bash
gh repo clone gabrielspencerf/observabilidade-saas
cd observabilidade-saas
git checkout v0.2.0
```

Login no GHCR (use um Personal Access Token com permissão `read:packages` e `write:packages`):

```bash
echo SEU_TOKEN_GITHUB | docker login ghcr.io -u gabrielspencerf --password-stdin
```

Build e push:

```bash
docker build -t ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0 .
docker push ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0
```

Se o repositório do pacote no GitHub for **privado**, na VPS você também precisará fazer login no GHCR (com um token que tenha `read:packages`) antes do deploy, para o Swarm conseguir puxar.

### 1.2 Alternativa: build na VPS e imagem local

Se não quiser usar registry, na VPS:

```bash
gh repo clone gabrielspencerf/observabilidade-saas
cd observabilidade-saas
git checkout v0.2.0
docker build -t ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0 .
```

Aí a imagem fica local e o stack usa o mesmo nome; não haverá pull. Nesse caso você precisa **alterar o YML** para usar `observabilidade-saas:v0.2.0` (sem `ghcr.io/...`) ou manter o nome da imagem igual ao do build acima.

Recomendado: publicar no GHCR e deixar o stack com `ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0` para o Portainer puxar sozinho.

---

## 2. Volumes (stack completa)

Se for usar `docker-stack.swarm.yml`:

```bash
docker volume create app_postgres_data
docker volume create app_redis_data
```

---

## 3. Subir a stack no Portainer

1. **Stacks** → **Add stack** (ou edite a existente).
2. **Nome da stack:** exatamente `observabilidade`.
3. Cole o conteúdo de `docker-stack.swarm.yml` (ou use repositório Git).
4. Se a imagem no GHCR for **privada**: no host da VPS, antes do deploy, faça `docker login ghcr.io` (com token que tenha `read:packages`).
5. Deploy. O Swarm vai **puxar** `ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0` ao subir os serviços.

---

## 4. Ver o erro (quando ainda fica 0/1)

No servidor:

```bash
docker service ps observabilidade_app_web --no-trunc
```

No Portainer: serviço → **Tasks** → tarefa em falha → mensagem.

Erros comuns:
- **"no such image"** ou **"pull access denied"** → imagem não publicada no registry ou VPS sem login no GHCR (imagem privada).
- **"connection refused"** ao postgres/redis → conferir nome da stack `observabilidade` e hostnames no YML.

---

## 5. Resumo

| Objetivo | Ação |
|----------|------|
| Portainer **puxar** a imagem | Publicar em registry (ex.: `docker push ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0`) e usar esse nome no YML. |
| Imagem **privada** no GHCR | Na VPS: `docker login ghcr.io` com token que tenha `read:packages`. |
| Não usar registry | Build na VPS com o **mesmo** nome usado no YML (ex.: `docker build -t ghcr.io/gabrielspencerf/observabilidade-saas:v0.2.0 .`). |
