# BASE2 WhatsApp Cloud

Guia operacional do canal nativo WhatsApp Cloud (Meta Graph API). Paridade
com `BASE2_META_ADS.md` para a área de mensageria.

> Schema, ingest e processador foram entregues na migration `0019_chatwoot_whatsapp_cloud_channels.sql`.

## 1. Objetivo

- Receber webhooks da Cloud API oficial (Meta) por `phone_number_id`.
- Materializar conversations + conversation_messages a partir de `messages`.
- Acknowledge `statuses` (sent / delivered / read / failed) — MVP marca
  processado, sem atualizar status na mensagem ainda.
- Enfileirar classify_conversation pós-mensagem (Vysen).
- Sem cadastro por UI hoje — provisionamento via API/script (ver §6).

## 2. Variáveis de ambiente

| Variável | Obrigatória | Para |
|---|---|---|
| `META_APP_SECRET` | **sim em produção** | Validar `x-hub-signature-256` HMAC. Verificada no startup-guard (`assertProductionRuntimeWebhookSecrets`). |
| `INTEGRATIONS_ENCRYPTION_KEY` | sim | Criptografar `access_token_encrypted` por número. |

Por **número** WhatsApp Cloud (linha `whatsapp_cloud_numbers`):
- `phone_number_id` (do Meta)
- `waba_id` (WhatsApp Business Account)
- `access_token_encrypted` (System User token criptografado)
- `webhook_verify_token` (string acordada para o GET de verificação)

## 3. Schema (entregue na 0019)

```
whatsapp_cloud_numbers (
  id, tenant_id, phone_number_id, waba_id, display_phone,
  access_token_encrypted, webhook_verify_token, label,
  last_synced_at, last_sync_error, created_at, updated_at,
  UNIQUE (tenant_id, phone_number_id)
)

whatsapp_cloud_webhook_events (
  id, tenant_id, whatsapp_cloud_number_id, external_event_id, event_type,
  payload, received_at, processed_at, processing_error,
  UNIQUE (tenant_id, whatsapp_cloud_number_id, external_event_id)  -- parcial WHERE NOT NULL
)
```

`conversations` ganhou `whatsapp_cloud_number_id` e o CHECK
`conversations_instance_check` aceita exatamente um dos 4 canais.

## 4. Fluxo de ingestão

```
Meta Cloud API
   │ GET (verify) ou POST (eventos) com x-hub-signature-256
   ▼
/api/webhooks/whatsapp-cloud/[numberId]/route.ts
   │
   ├── GET hub.mode=subscribe + hub.verify_token
   │   → verifyWhatsappCloudHub (compara com webhook_verify_token no DB)
   │   → retorna hub.challenge
   │
   └── POST messages | statuses
       ├── checkRateLimit("webhook:wa-cloud", 240/min)
       ├── max body 1MB
       ├── withWebhookRlsTransaction
       ├── validateWhatsappCloudWebhook (src/server/integrations/whatsapp-cloud/validate.ts)
       │     HMAC SHA256 do rawBody com META_APP_SECRET
       │     comparação via timingSafeEqual
       ├── parseWhatsappCloudWebhookBody (extrai external_event_id de messages[0].id ou statuses[0].id)
       ├── checkWebhookReplay (provider=whatsapp_cloud, janela 600s)
       │
       ▼
   ingestWhatsappCloudWebhook (src/server/integrations/whatsapp-cloud/ingest.ts)
       │ INSERT em whatsapp_cloud_webhook_events (dedup pela UNIQUE)
       │ enqueue via getSharedRedis
       │
       ▼ queue:raw:whatsapp-cloud
   processWhatsappCloudRaw (src/workers/processors/whatsapp-cloud.ts)
       │
       ├── messages → upsert conversation (external_id = wa_id) +
       │              upsert conversation_message (external_id = wamid)
       │              extrai contact via contacts[].profile.name
       │              direction = "in" (cliente → app)
       │              enqueueConversationClassification (dedup 30s)
       │
       └── statuses → marca processed_at (MVP sem update na mensagem)
```

## 5. Segurança

- **`META_APP_SECRET` obrigatório em produção**: startup-guard impede boot
  do worker sem o segredo. App web idem via `assertProductionRuntimeWebhookSecrets`.
- **HMAC `x-hub-signature-256`**: SHA256 do rawBody com `META_APP_SECRET`
  (compartilhado por todo o app Meta — não por número). Comparação
  `timingSafeEqual`.
- **Verify hub**: comparação `webhook_verify_token` do DB (decifrado se
  estiver criptografado — atualmente texto puro pequeno é aceito).
  ⚠️ Considerar `timingSafeEqual` aqui também (achado #24 do relatório
  geral; pendência baixa prioridade).
- **`tryDecryptStoredSecret`** bloqueia uso de `access_token_encrypted`
  inválido.
- **Replay**: Redis `SET NX EX 600` por `(provider, phone_number_id,
  fingerprint)`; fallback graceful se Redis cair.

## 6. Provisionamento de número (sem UI hoje)

Não há tela em `/admin/integrations/whatsapp-cloud/*` nem
`/superadmin/integrations/whatsapp-cloud/*`. Para cadastrar:

```sql
-- Após cifrar access_token via encryptSecretForStorage:
INSERT INTO whatsapp_cloud_numbers (
  tenant_id, phone_number_id, waba_id, display_phone,
  access_token_encrypted, webhook_verify_token, label
) VALUES (
  '<tenant uuid>', '<phone_number_id>', '<waba_id>', '+5511999999999',
  '<base64 ciphertext>', '<verify_token aleatorio>', 'Linha principal'
);
```

Tarefa aberta: criar form de cadastro com paridade Evolution/UAZAPI.

## 7. Configurar webhook no Meta Developer Portal

Para cada `phone_number_id`:

1. **Webhook URL**:
   `https://app.<dominio>/api/webhooks/whatsapp-cloud/<whatsapp_cloud_numbers.id>`
2. **Verify Token**: mesmo `webhook_verify_token` salvo no DB (campo é
   único por número).
3. **Subscribe fields**: `messages` (essencial), `message_template_status_update` (opcional).
4. **App Secret**: configurado via `META_APP_SECRET` env (uma vez por
   ambiente, **não por número**).

## 8. Tipos de mensagem suportados

Processados em `processWhatsappCloudRaw` (`extractWcMessageParts`):

- `text` → `body`
- `image` → caption + media_id (sem download de mídia ainda)
- `audio` → media_id (sem transcrição via Cloud API ainda; existe stub Whisper para Evolution/UAZAPI)
- `interactive` → button_reply / list_reply renderizados como texto
- `button` → reply.title
- `document` / `video` → texto curto com filename/media_id

Tipos não cobertos (`reaction`, `location`, `contacts`) caem em "Mensagem não suportada".

## 9. Observabilidade

- `/superadmin/worker-pipeline`: `queue:raw:whatsapp-cloud` +
  `queue:dlq:whatsapp-cloud` + `pending_whatsapp_cloud_raw`.
- Métricas Prometheus em `/api/metrics`:
  - `vysen_worker_jobs_processed_total{queue="queue:raw:whatsapp-cloud"}`
  - `vysen_worker_jobs_sent_to_dlq_total{queue="queue:raw:whatsapp-cloud"}`
- Logs JSON do worker com `queueName="queue:raw:whatsapp-cloud"`,
  `jobType="process_whatsapp_cloud_raw"`.

## 10. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| GET retorna 403 | `webhook_verify_token` não bate | Conferir token salvo no DB vs configurado no Meta. |
| POST 401 "Webhook signature headers ausentes" | Meta não está enviando `x-hub-signature-256` | App Secret não configurado no Dashboard Meta; revisar. |
| POST 403 "Assinatura inválida" | `META_APP_SECRET` diferente do app real | Conferir `META_APP_SECRET` no env contra o App ID correto. |
| Boot do worker falha com `META_APP_SECRET é obrigatório...` | Env ausente em produção | Setar via Docker secret + entrypoint (ou env direto se opcional ficar para depois). |
| Mensagens duplicadas | `external_event_id` (= `wamid`) ausente | Meta sempre manda `id` em `messages[]`; investigar payload anormal. |
| Statuses não atualizam mensagem | MVP intencional | Ver §4 — `statuses` apenas marcam processed; update da linha é futuro. |

## 11. Próximos passos (não cobertos)

- Cliente HTTP de saída (`POST /v17.0/<phone_number_id>/messages`) para
  enviar mensagens / templates / reações.
- Fetch de mídia (`GET /v17.0/<media_id>`) para audio (Whisper), image
  (Vision) — pattern paralelo ao que já existe para Evolution/UAZAPI.
- Atualizar `conversation_messages.status` a partir dos eventos `statuses`.
- Suporte a `message_template_status_update` (controle de templates aprovados).
- `timingSafeEqual` no verify token (hardening menor).
- UI de cadastro/edição.

## Referências

- `src/db/migrations/0019_chatwoot_whatsapp_cloud_channels.sql`
- `src/server/integrations/whatsapp-cloud/`
- `src/workers/processors/whatsapp-cloud.ts`
- `docs/REVISAO_GERAL_2026-05.md` (achados aplicados: `META_APP_SECRET`
  obrigatório em prod, decrypt blindado, replay graceful)
- Doc gêmeo: [`BASE2_CHATWOOT.md`](./BASE2_CHATWOOT.md)
