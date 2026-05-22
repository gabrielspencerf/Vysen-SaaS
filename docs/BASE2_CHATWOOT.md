# BASE2 Chatwoot

Guia operacional do canal nativo Chatwoot. Paridade com `BASE2_META_ADS.md`
e `BASE2_CLARITY.md` para a área de mensageria.

> Schema, ingest e processador foram entregues na migration `0019_chatwoot_whatsapp_cloud_channels.sql`.

## 1. Objetivo

- Ingerir webhooks da instância Chatwoot do tenant.
- Materializar conversations + conversation_messages a partir dos eventos.
- Enfileirar classify_conversation pós-mensagem (Vysen).
- Sem cadastro por UI hoje — provisionamento via API/script (ver §6).

## 2. Variáveis de ambiente

Não há variáveis globais Chatwoot. O segredo HMAC fica **por conta** na
tabela `chatwoot_accounts.api_token_encrypted` (criptografado AES-256-GCM
via `INTEGRATIONS_ENCRYPTION_KEY`).

## 3. Schema (entregue na 0019)

```
chatwoot_accounts (
  id, tenant_id, external_id, base_url, api_token_encrypted,
  inbox_id, label, last_synced_at, last_sync_error, created_at, updated_at,
  UNIQUE (tenant_id, external_id)
)

chatwoot_webhook_events (
  id, tenant_id, chatwoot_account_id, external_event_id, event_type,
  payload, received_at, processed_at, processing_error,
  UNIQUE (tenant_id, chatwoot_account_id, external_event_id)  -- parcial WHERE NOT NULL
)
```

`conversations` ganhou `chatwoot_account_id` e o CHECK `conversations_instance_check`
foi reescrito para aceitar exatamente um dos 4 canais (evolution / uazapi /
chatwoot / whatsapp_cloud).

## 4. Fluxo de ingestão

```
Chatwoot (instância do cliente)
   │ POST com x-chatwoot-signature
   ▼
POST /api/webhooks/chatwoot/[accountId]
   │ (src/app/api/webhooks/chatwoot/[accountId]/route.ts)
   │
   ├── checkRateLimit("webhook:chatwoot", 120/min)
   ├── max body 512KB
   ├── withWebhookRlsTransaction (bypass + lockToTenant após validar)
   ├── validateWebhookRequest("chatwoot", request, rawBody, accountId)
   │     → validateChatwootWebhook (src/server/integrations/chatwoot/validate.ts)
   │       HMAC SHA256 do rawBody com api_token decifrado (tryDecryptStoredSecret)
   │       comparação com timingSafeEqual
   ├── parseChatwootWebhookBody (extrai eventType + externalEventId)
   ├── checkWebhookReplay (provider=chatwoot, janela 600s)
   │
   ▼
ingestChatwootWebhook (src/server/integrations/chatwoot/ingest.ts)
   │ INSERT em chatwoot_webhook_events (dedup pela UNIQUE)
   │ enqueueWithDedup? não — enqueue simples via getSharedRedis
   │
   ▼ queue:raw:chatwoot
processChatwootRaw (src/workers/processors/chatwoot.ts)
   │
   ├── conversation_created → upsert em conversations
   ├── conversation_updated → patch em conversations (status, assigned)
   ├── message_created      → upsert em conversation_messages
   │     + resolve contact via contact_inbox.contact ou meta.sender
   │     + enqueueConversationClassification (dedup 30s)
   │
   └── outros tipos → marca processed_at sem efeito
```

## 5. Segurança

- **HMAC obrigatório em produção**: `env.isProduction && !apiToken` → 503 com
  `"Conta sem token configurado para validação HMAC do webhook"`.
- **Token rotação**: usar `INTEGRATIONS_ENCRYPTION_KEY` consistente entre
  setup/web/worker (Docker secrets garantem). Para rotacionar, criptografar
  novo token e atualizar `api_token_encrypted` na linha.
- **`tryDecryptStoredSecret` bloqueia uso** quando decrypt falha (chave
  trocada, payload corrompido). Antes de 2026-05, retornava ciphertext bruto.
- **Replay**: Redis `SET NX EX 600` por `(provider, accountId, fingerprint)`;
  fallback graceful se Redis cair (unique constraint do DB cobre).
- **Logs sanitizados**: `redactSensitiveLog` aplica nos previews de body
  antes de qualquer `console.log`.

## 6. Provisionamento de conta (sem UI hoje)

Hoje não há tela em `/admin/integrations/chatwoot/*` nem em
`/superadmin/integrations/chatwoot/*`. Para cadastrar uma conta Chatwoot:

```sql
-- Após gerar api_token_encrypted via encryptSecretForStorage:
INSERT INTO chatwoot_accounts (
  tenant_id, external_id, base_url, api_token_encrypted, inbox_id, label
) VALUES (
  '<tenant uuid>', '<id-na-chatwoot>', 'https://chatwoot.empresa.com',
  '<base64 ciphertext>', '<inbox_id ou NULL>', 'Conta principal'
);
```

Ou via API admin programática (não documentada). Tarefa aberta: criar
form em `(superadmin)/superadmin/integrations/chatwoot/new` paralela a
Evolution/UAZAPI/Typebot.

## 7. Webhook na instância Chatwoot

Configurar no Chatwoot do cliente (Configurações → Integrações → Webhooks):

- **URL**: `https://app.<dominio>/api/webhooks/chatwoot/<chatwoot_accounts.id>`
- **Eventos**: `conversation_created`, `conversation_updated`, `message_created`
- **Assinatura**: Chatwoot envia `x-chatwoot-signature` automaticamente quando
  você define o token (mesmo `api_token`).

## 8. Observabilidade

- Snapshot `/superadmin/worker-pipeline` mostra `queue:raw:chatwoot` e
  `queue:dlq:chatwoot` + `pending_chatwoot_raw` (eventos em staging sem
  `processed_at`).
- Métricas Prometheus em `/api/metrics`:
  - `vysen_worker_jobs_processed_total{queue="queue:raw:chatwoot"}`
  - `vysen_worker_jobs_sent_to_dlq_total{queue="queue:raw:chatwoot"}`
- Logs do worker em JSON com `queueName="queue:raw:chatwoot"`,
  `jobType="process_chatwoot_raw"`, `tenantId`, `rawEventId`.

## 9. Troubleshooting

| Sintoma | Causa provável | Diagnóstico |
|---|---|---|
| Webhook responde 401 "Webhook signature headers ausentes" | Chatwoot não está mandando `x-chatwoot-signature` | Conferir que o token foi setado nas configurações de Webhook no Chatwoot. |
| Webhook responde 403 "Assinatura inválida" | Token no Chatwoot ≠ `api_token` cifrado no DB | Re-cifrar e atualizar `api_token_encrypted`. |
| Webhook responde 503 "Conta sem token..." | `api_token_encrypted` nulo em produção | Persistir o token cifrado antes de habilitar o webhook. |
| Eventos em staging mas não processam | Worker stale ou fila travada | Ver `/superadmin/worker-pipeline`; `worker:heartbeat:<podId>` no Redis. |
| Conversa duplica em retry | Sem `external_event_id` no payload | Unique constraint cobre só quando `external_event_id` existe; Chatwoot envia em `id` raiz. |

## 10. Próximos passos (não cobertos)

- UI de cadastro/edição (paridade com Evolution/UAZAPI).
- Cliente HTTP de saída (enviar mensagem via Chatwoot API).
- Resync inicial de conversas existentes (importar histórico).

## Referências

- `src/db/migrations/0019_chatwoot_whatsapp_cloud_channels.sql`
- `src/server/integrations/chatwoot/`
- `src/workers/processors/chatwoot.ts`
- `docs/REVISAO_GERAL_2026-05.md` (achados de hardening aplicados)
- Doc gêmeo: [`BASE2_WHATSAPP_CLOUD.md`](./BASE2_WHATSAPP_CLOUD.md)
