# Redis no Windows — instalação e uso

O Redis é usado pelo projeto para **filas** (worker Typebot/Evolution/Google Ads), **rate-limit** e **observabilidade** (heartbeat do worker). Sem Redis, a app sobe, mas o worker não inicia e a página de Observabilidade mostra Redis/worker como indisponível.

---

## 1. Instalação (já feita neste projeto)

Foi instalado **Redis on Windows** (Microsoft Archive, versão 3.x) via **winget**:

```powershell
winget install Redis.Redis --accept-package-agreements --accept-source-agreements
```

- **Porta padrão:** 6379  
- **Pasta:** `C:\Program Files\Redis`  
- **Serviço:** `Redis` (inicia automaticamente com o Windows)

**Alternativa (Redis 7 compatível):** [Memurai Developer](https://www.memurai.com/) — parceiro oficial Redis para Windows. Se preferir, instale manualmente pelo site; use `REDIS_URL=redis://localhost:6379` da mesma forma.

---

## 2. Verificar e iniciar o serviço

No **PowerShell (como administrador)**:

```powershell
# Ver status
Get-Service Redis

# Iniciar (se parado)
Start-Service Redis
```

Ou em **Serviços** (`Win + R` → `services.msc`): procure **"Redis"** e inicie/reinicie.

---

## 3. Configurar o projeto

No `.env` na raiz do projeto, defina:

```env
REDIS_URL=redis://localhost:6379
```

Reinicie o **worker** (`npm run worker:dev`) para ele conectar ao Redis. A aplicação Next.js usa Redis sob demanda (webhooks, observabilidade); o worker exige `REDIS_URL` para subir.

---

## 4. Testar (após reiniciar o terminal)

Com o Redis no PATH (instalado pelo MSI):

```powershell
redis-cli ping
```

Resposta esperada: `PONG`.
