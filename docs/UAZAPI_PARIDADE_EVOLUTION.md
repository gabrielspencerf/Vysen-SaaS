# UAZAPI em paridade com Evolution

A integração UAZAPI foi alinhada ao mesmo fluxo da Evolution: webhook → eventos brutos → fila → worker → conversas e mensagens no dashboard.

## O que foi implementado

### 1. Banco de dados (migração `0004_uazapi_webhook_and_conversations.sql`)
- **Tabela `uazapi_webhook_events`**: eventos brutos do webhook UAZAPI (espelho de `evolution_webhook_events`).
- **Tabela `conversations`**: passa a aceitar **Evolution ou UAZAPI**:
  - `evolution_instance_id` e `uazapi_instance_id` (um dos dois obrigatório, outro nulo).
  - Constraint de checagem e índices únicos parciais por provedor.

**Aplicar a migração:** executar o SQL em `src/db/migrations/0004_uazapi_webhook_and_conversations.sql` no banco (ou via ferramenta de migrations do projeto).

### 2. Webhook
- **POST `/api/webhooks/uazapi/[instanceId]`**  
  - `instanceId` = UUID da instância em `uazapi_instances.id`.
  - Validação por UUID; corpo JSON; rate limit; gravação em `uazapi_webhook_events` e enfileiramento.

### 3. Formato do payload (compatível com Evolution)
O parser aceita o mesmo formato usado na Evolution:
- `event` (ou `type`) = tipo do evento.
- `data.key` com `remoteJid`, `id` (ou `messageId`), `fromMe`.
- `data.message` com texto (`conversation`, `extendedTextMessage.text`) ou mídia (`audioMessage`, `imageMessage` com `caption` opcional).

Eventos de mensagem tratados: `messages.upsert`, `messages_upsert`, `send.message`, `send_message` (normalizados para minúsculas com ponto).

### 4. Worker
- Fila **queue:raw:uazapi** e DLQ **queue:dlq:uazapi**.
- Processador `processUazapiRaw`: lê evento, cria/atualiza conversa por `(tenant_id, uazapi_instance_id, external_id)` e insere mensagem (texto, áudio, imagem com legenda).  
- **Áudio/imagem:** por enquanto só persiste legenda; transcrição/descrição (Whisper/Vision) pode ser adicionada quando houver endpoint de mídia UAZAPI documentado.

### 5. Dashboard
- **Conversas:** listagem e detalhe consideram conversas de **Evolution e UAZAPI** (left join em ambas as tabelas de instância; nome da instância preenchido conforme o provedor).
- **Detalhe do lead:** “Conversas vinculadas” mostra conversas de ambos os provedores.

### 6. Admin
- **Integrações:** tabela de instâncias UAZAPI com coluna **URL do webhook** (igual à Evolution), no formato `[APP_URL]/api/webhooks/uazapi/{id}`.
- **Observabilidade:** filas **UAZAPI** e **DLQ UAZAPI** exibidas nas métricas de fila.

## Configuração na UAZAPI

1. Em **Admin → Integrações**, copie a **URL do webhook** da instância UAZAPI (com o UUID).
2. Na UAZAPI, configure o webhook com essa URL e envie eventos no formato compatível (ex.: `event` + `data.key` + `data.message`).
3. Garanta que o **worker** está rodando (mesmo processo que processa Evolution/Typebot) para que os jobs da fila UAZAPI sejam processados.

## Resumo de paridade

| Recurso                    | Evolution | UAZAPI |
|---------------------------|-----------|--------|
| Webhook por instance ID   | Sim       | Sim    |
| Eventos brutos em tabela   | Sim       | Sim    |
| Fila + worker              | Sim       | Sim    |
| Conversas + mensagens      | Sim       | Sim    |
| Listagem no dashboard      | Sim       | Sim    |
| Transcrição áudio (Whisper)| Sim       | Não*   |
| Descrição imagem (Vision)  | Sim       | Não*   |

\* Pode ser adicionado quando houver API UAZAPI para obter mídia (equivalente ao getBase64FromMediaMessage da Evolution).
