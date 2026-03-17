# Debug: Webhook Evolution e conversas no dashboard

Se você configurou os eventos na Evolution mas as mensagens não aparecem em **Conversas**, siga este checklist.

## 1. URL do webhook

- A URL deve ser **exatamente** a que aparece na aba **Admin → Integrações**, na tabela "Instâncias Evolution cadastradas", coluna **URL do webhook**.
- Ela tem o formato: `https://seu-dominio/api/webhooks/evolution/{UUID}`. O `{UUID}` é o ID interno da instância no hub (não use nome da instância nem external_id).
- Na Evolution, use **uma única URL** (não use "webhook por eventos" que adiciona sufixos ao path). Ative o evento **MESSAGES_UPSERT** (e opcionalmente **SEND_MESSAGE**).

## 2. Observabilidade: últimos eventos

- Em **Admin → Observabilidade**, role até **"Últimos eventos Evolution (webhook)"**.
- **Se a lista estiver vazia:** a Evolution não está chamando o hub (URL errada, evento não habilitado ou rede/firewall).
- **Se aparecerem eventos com "Pendente":** o worker não está processando a fila. Verifique se o serviço **worker** está rodando (Docker/PM2) e se usa o mesmo **REDIS_URL** da API.
- **Se aparecer "Erro: ...":** o payload não está no formato esperado ou há falha no processamento; use a mensagem de erro para corrigir ou reportar.

## 3. Worker e Redis

- O hub grava cada evento em `evolution_webhook_events` e enfileira um job na fila Redis **queue:raw:evolution**.
- O **worker** (script `npm run worker:dev` ou serviço worker no Docker) consome essa fila e cria/atualiza `conversations` e `conversation_messages`.
- Se o worker não estiver rodando, os eventos ficam "Pendente" e as conversas não são criadas.

## 4. Eventos suportados

O worker processa apenas eventos de mensagem, normalizados para:

- `messages.upsert` (ou `MESSAGES_UPSERT`)
- `send.message` (ou `SEND_MESSAGE`)

Outros eventos (ex.: `CONNECTION_UPDATE`, `QRCODE_UPDATED`) são marcados como processados mas **não** geram conversas.

## 5. Erros recentes

Em **Observabilidade → Erros recentes**, aparecem falhas de processamento (Typebot, Evolution, Worker). Erros da Evolution indicam problema ao processar um evento (ex.: payload inválido).
