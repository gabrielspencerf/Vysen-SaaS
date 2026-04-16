# Configuração de credenciais e primeiro teste E2E

Objetivo: organizar credenciais, IDs e segredos sem hardcode, e permitir o primeiro teste manual end-to-end.

---

## 1. Inventário: variáveis e credenciais

### 1.1 Globais da aplicação (.env.local / produção)

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `DATABASE_URL` | Sim | Conexão PostgreSQL (app + worker + seeds). |
| `REDIS_URL` | Sim | Filas (Typebot, Evolution, sync Google Ads). |
| `SESSION_SECRET` | Sim | Assinatura/validação de sessão e cookie. |
| `SESSION_COOKIE_NAME` | Não | Nome do cookie (padrão: `session`). |
| `NODE_ENV` | Não | `development` \| `production`. |
| `NEXT_PUBLIC_APP_URL` | Recomendado | URL base (redirects, OAuth, webhooks). |
| `OPENAI_API_KEY` | Recomendado | Copilot Vysen e transcrição/fluxos IA. |
| `OPENAI_MODEL_THINKING` | Não | Modelo principal para análises profundas do Vysen. |
| `OPENAI_MODEL_FAST` | Não | Modelo de fallback para respostas rápidas. |
| `OPENAI_MODEL_FALLBACK_ENABLED` | Não | Habilita fallback automático do modelo principal para o rápido. |
| `OPENAI_THINKING_TIMEOUT_MS` | Não | Timeout do modo thinking antes de fallback. |

### 1.2 Por tenant (banco de dados)

- **Tenants, users, memberships:** criados via Admin ou seed (Base 1).
- **Funis e etapas:** cadastrados no banco (por enquanto sem UI dedicada; usar SQL ou futura tela).
- Nenhum segredo sensível “por tenant” é guardado em .env; o que é por tenant fica no banco.

### 1.3 Por integração / conta conectada (banco de dados)

| Integração | Onde fica | O que é armazenado |
|------------|-----------|---------------------|
| **Google Ads** | `google_ads_accounts` | `external_id` (customer id), `refresh_token_encrypted`, `access_token_encrypted`, `token_expires_at`, `label`. Tokens criptografados com chave de .env (`GOOGLE_ADS_ENCRYPTION_KEY`). |
| **Meta Ads** | `meta_ads_accounts`, `meta_insight_snapshots` | Token de conta e snapshots de performance por tenant, com campos sensíveis criptografados. |
| **Clarity** | `clarity_connections`, `clarity_snapshots` | Credenciais de conexão e snapshots de uso/comportamento por tenant. |
| **Typebot** | `typebot_bots` (+ `integrations`) | `external_id`, `name`, `webhook_secret_hash`, `webhook_secret_encrypted`, `api_token_encrypted`, `metrics_api_base_url`. Webhook usa `typebot_bots.id` (UUID) na URL. |
| **Evolution** | `evolution_instances` (+ `integrations`) | `external_id`, `base_url`, `api_key_encrypted`, `instance_name`. Webhook usa `evolution_instances.id` (UUID) na URL. |
| **UAZAPI** | `uazapi_instances` (+ `integrations`) | `external_id`, `base_url`, `api_key_encrypted`, `instance_name`. |

Credenciais **globais** de cada integração (ex.: Client ID/Secret Google, developer token) vão em **.env**. Dados **por conta/bot/instância** (tokens, URL base, secret do webhook) vão no **banco** (ou, no caso do Typebot/Evolution, podem ser criados via seed opcional).

---

## 2. O que preencher manualmente agora

### 2.1 Para subir a aplicação e o worker

1. Copiar `.env.example` para `.env.local`.
2. Preencher obrigatórios:
   - `DATABASE_URL` (PostgreSQL).
   - `REDIS_URL` (Redis).
   - `SESSION_SECRET` (valor longo e aleatório).
3. Recomendado: `NEXT_PUBLIC_APP_URL` (ex.: `http://localhost:3000`).

### 2.2 Para criar o primeiro usuário e tenant (seed)

1. Definir no `.env.local`:
   - `SEED_ADMIN_PASSWORD` (obrigatória para o seed).
   - Opcional: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_TENANT_NAME`, `SEED_TENANT_SLUG`.
2. Rodar: `npm run db:seed` (ou equivalente). Isso cria roles, permissions, tenant de teste, usuário admin e membership.

### 2.3 Para conectar Google Ads (por tenant)

1. Em .env: preencher variáveis da seção Google Ads (ver `.env.example`):
   - `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REDIRECT_URI` (ou `NEXT_PUBLIC_APP_URL`).
   - `GOOGLE_ADS_ENCRYPTION_KEY` (32 bytes hex ou base64).
   - `GOOGLE_ADS_DEVELOPER_TOKEN`.
   - Opcional: `GOOGLE_ADS_STATE_SECRET`; `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (se MCC).
2. Na aplicação: fazer login, selecionar o tenant, ir em **Dashboard → Google Ads → Conectar**. Concluir OAuth e escolher a conta. A aplicação persiste a conta e os tokens (criptografados) no banco. **Nenhum dado de conta Google Ads vai em .env**; só as credenciais globais da aplicação.

### 2.4 Para Typebot (webhook + API de métricas)

1. **Cadastro recomendado:** Admin → Integrações → Conectar Typebot.
2. Configurar o webhook no Typebot com a URL gerada:  
   `https://<NEXT_PUBLIC_APP_URL>/api/webhooks/typebot/<typebot_bots.id>`.
3. Segurança recomendada de webhook:
   - Enviar `X-Webhook-Timestamp` e `X-Webhook-Signature` (HMAC SHA-256 em `timestamp.rawBody`).
   - Compatibilidade legada: `X-Webhook-Secret`.
4. Para API de métricas:
   - Configurar `api_token` e `metrics_api_base_url` no cadastro do bot (ou usar `TYPEBOT_API_BASE_URL` global).
   - Disparar sync em Admin → Integrações → “Sincronizar métricas Typebot”.

### 2.5 Para Evolution (webhook)

1. **Cadastro recomendado:** Admin → Integrações → Conectar Evolution API.
2. Configurar o webhook na Evolution com a URL gerada:  
   `https://<NEXT_PUBLIC_APP_URL>/api/webhooks/evolution/<evolution_instances.id>`.
3. Segurança recomendada:
   - Enviar `X-Webhook-Timestamp` e `X-Webhook-Signature` (HMAC SHA-256 em `timestamp.rawBody`).
   - Compatibilidade legada: `X-API-Key`.

### 2.6 Para UAZAPI (por tenant)

1. Cadastrar em Admin → Integrações → Conectar UAZAPI.
2. Informar `external_id`, `base_url` e `api_key` (opcional).
3. A instância passa a ser monitorada no painel de observabilidade admin.

---

## 3. Onde cada valor entra

| Tipo de dado | Onde entra | Exemplo |
|--------------|------------|---------|
| Connection string PostgreSQL | .env | `DATABASE_URL=postgresql://...` |
| Connection string Redis | .env | `REDIS_URL=redis://...` |
| Secret de sessão | .env | `SESSION_SECRET=...` |
| URL base da app | .env | `NEXT_PUBLIC_APP_URL=http://localhost:3000` |
| Client ID/Secret Google OAuth | .env | `GOOGLE_ADS_CLIENT_ID=...` |
| Chave de criptografia tokens Google | .env | `GOOGLE_ADS_ENCRYPTION_KEY=...` |
| Developer token / Login customer ID | .env | `GOOGLE_ADS_DEVELOPER_TOKEN=...` |
| Contas Google Ads (tokens, customer id) | Banco | Tabela `google_ads_accounts` (via UI Conectar) |
| Bots Typebot (external_id, nome, secret hash) | Banco | Tabela `typebot_bots` (via seed opcional ou insert manual) |
| Instâncias Evolution (external_id, base_url, etc.) | Banco | Tabela `evolution_instances` (via seed opcional ou insert manual) |
| Integração genérica (tenant ↔ recurso) | Banco | Tabela `integrations` (criada junto com typebot_bots/evolution_instances no seed) |

---

## 4. O que pode ser configurado pela UI e o que é só backend

| Item | UI | Só backend / .env |
|------|----|--------------------|
| Sessão, login, tenant | Sim (login, troca de tenant) | .env: SESSION_SECRET, etc. |
| Conta Google Ads | Sim (Dashboard → Google Ads → Conectar) | .env: credenciais OAuth e API |
| Conta Meta Ads | Sim (Dashboard → Meta Ads → Conectar) | .env: app id/secret, redirect e criptografia |
| Conexão Clarity | Sim (Dashboard → Clarity) | .env: chaves globais e conexão por tenant |
| Bot Typebot | Sim (Admin > Integrações) | Opcional via seed |
| Instância Evolution | Sim (Admin > Integrações) | Opcional via seed |
| Instância UAZAPI | Sim (Admin > Integrações) | Opcional via API admin |
| Funis e etapas | Sim (Dashboard > Funil > Configuração) | Banco por tenant |
| Vysen Copilot | Sim (chat dashboard/admin) | .env: OpenAI e política de modelos |
| Admin (tenants, usuários, memberships) | Sim (área /admin) | - |

---

## 5. Superfície atual para cadastrar integrações

| Integração | Cadastro na aplicação | Observação |
|------------|------------------------|------------|
| **Google Ads** | Sim. Dashboard (tenant) → Google Ads → botão Conectar → OAuth → escolher conta. | Conta e tokens salvos em `google_ads_accounts`. Não cria linha em `integrations` hoje (leitura é direto de `google_ads_accounts`). |
| **Meta Ads** | Sim. Dashboard (tenant) → Meta Ads → conexão OAuth da conta. | Conta e snapshots por tenant em tabelas próprias de Meta Ads. |
| **Clarity** | Sim. Dashboard (tenant) → Clarity → conectar projeto/token. | Snapshots por tenant e sync via worker. |
| **Typebot** | Sim. Admin → Integrações → Conectar Typebot. | Suporta webhook e token de métricas via API. |
| **Evolution** | Sim. Admin → Integrações → Conectar Evolution API. | Suporta webhook com assinatura HMAC (timestamp + signature). |
| **UAZAPI** | Sim. Admin → Integrações → Conectar UAZAPI. | Status operacional no painel de observabilidade. |

---

## 6. Caminho mínimo para testar (sem UI de cadastro Typebot/Evolution)

- **Google Ads:** preencher .env da seção Google Ads, rodar app, fazer login no tenant, Conectar conta pela UI.
- **Typebot:** preencher no .env as variáveis opcionais `SEED_TYPEBOT_EXTERNAL_ID`, `SEED_TYPEBOT_NAME`, `SEED_TYPEBOT_WEBHOOK_SECRET`. Rodar o seed (`npm run db:seed`); anotar a URL de webhook impressa no log e configurá-la no Typebot. (A URL só é impressa quando o bot é criado; se já existir registro com o mesmo tenant + external_id, o seed não duplica e não imprime. Nesse caso, consulte `typebot_bots.id` no banco.) Garantir que o worker está rodando e que `REDIS_URL` está definida.
- **Evolution:** preencher `SEED_EVOLUTION_EXTERNAL_ID`, `SEED_EVOLUTION_BASE_URL`, opcionalmente `SEED_EVOLUTION_INSTANCE_NAME`. Rodar o seed; anotar a URL de webhook impressa no log e configurá-la na Evolution. (Se a instância já existir, a URL não será impressa de novo; use `evolution_instances.id` no banco.) Worker rodando e Redis configurado.

Assim você evita hardcode, não expõe segredos na documentação (apenas placeholders no .env.example) e consegue fazer o primeiro teste E2E manual. Uma futura UI admin para “Adicionar bot Typebot” e “Adicionar instância Evolution” pode reutilizar a mesma lógica do seed (insert em `typebot_bots`/`evolution_instances` + `integrations`).
