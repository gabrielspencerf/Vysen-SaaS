# Backlog de produto — 2026-05

Itens identificados na auditoria de navegação (`AUDIT_NAVEGACAO_2026-05.md`)
que **não foram implementados nesta sessão** porque dependem de decisão de
produto ou de refator desproporcional ao valor imediato. Cada item lista o
contexto, escopo provável e por quê foi deferido.

## 1. Configuração de SMTP por tenant

**Hoje**: SMTP global lido do `.env` (`SMTP_HOST`, `SMTP_USERNAME`,
`SMTP_PASSWORD` etc.). Todo tenant manda e-mail (reset de senha, welcome,
notificação) pelo mesmo remetente.

**Por que deferido**:
- Decisão de produto: SMTP por tenant implica que cada tenant precisa
  configurar SPF/DKIM no domínio dele e gerenciar bounces. Não é decisão
  trivial de produto/UX.
- Esforço: nova tabela `tenant_smtp_credentials` (host, port, user,
  encrypted_password, sender_email, reply_to), tela de CRUD em
  `dashboard/settings/smtp/`, refator do mailer para escolher transport
  por `tenantId`, fallback para SMTP global se tenant não configurou.

**Quando faz sentido implementar**:
- Quando houver requisito de white-label real (cliente quer enviar pelo
  domínio dele, não pelo nosso).
- Ou quando deliverability ficar limitada pelo remetente único.

**Esboço de implementação** (referência futura):
- Migration: `tenant_smtp_credentials` com `tenant_id UNIQUE`, `host`,
  `port`, `secure`, `username`, `password_encrypted`, `sender_email`,
  `reply_to`, `verified_at`, timestamps.
- API: `GET/PATCH /api/dashboard/settings/smtp`, `POST .../verify` (envia
  e-mail de teste).
- UI: aba "SMTP" em `/dashboard/settings`, formulário com botão "testar".
- Server mailer: `getMailer(tenantId)` consulta tabela; cache em memória
  por tenant (TTL 5min); fallback para SMTP global se ausente ou
  `verified_at IS NULL`.

## 2. UI de cadastro de Chatwoot / WhatsApp Cloud

**Hoje**: schema OK (migration `0019_chatwoot_whatsapp_cloud_channels.sql`),
webhook + ingest + processador completos. Provisionamento é via SQL
manual ou script de seed (documentado em `BASE2_CHATWOOT.md` §6 e
`BASE2_WHATSAPP_CLOUD.md` §6).

**Por que deferido**:
- Não bloqueia operação atual (provisionamento operacional).
- Forms exigem manipulação cuidadosa de tokens criptografados
  (`tryDecryptStoredSecret` na leitura, `encryptSecretForStorage` na
  escrita), validações específicas (Chatwoot exige `base_url` + token API,
  WhatsApp Cloud exige `phone_number_id` + `waba_id` + `access_token` +
  `webhook_verify_token`).
- Esforço comparável a Evolution/UAZAPI (que têm new + [id]/edit pages
  cada, ~150-200 LOC por canal).

**Quando faz sentido**:
- Quando houver onboarding self-service de cliente com WhatsApp/Chatwoot.
- Ou quando o operador precisar mexer com frequência (>1x/semana).

**Esboço**:
- Páginas:
  - `(superadmin)/superadmin/integrations/chatwoot/new/page.tsx`
  - `(superadmin)/superadmin/integrations/chatwoot/[id]/edit/page.tsx`
  - Análogos para `whatsapp-cloud`.
- Rotas API:
  - `POST /api/admin/integrations/chatwoot` + `PATCH/DELETE [id]`
  - Idem WhatsApp Cloud.
- Server services: `createChatwootAccount(input)`,
  `updateChatwootAccount(input)`, `deleteChatwootAccount(id)` em
  `src/server/admin/integrations-create.ts` (etc.).
- Padrão: paridade com Evolution/UAZAPI já existentes (`new/page.tsx`
  com form básico + tenant select; `edit/page.tsx` com AbortController
  + autoComplete=new-password nos secrets).

## 3. Histórico do Vysen Copilot persistido no servidor

**Hoje**: `localStorage` no client (`features/vysen-chat/use-vysen-chat.ts`
linhas 121, 228). Histórico de conversa, summaries de threads anteriores
e contexto selecionado ficam só no device — perde ao limpar cache, trocar
de browser/device, ou usar incógnito.

**Por que deferido**:
- Não bloqueia uso atual no MVP. Usuário típico não percebe.
- Refator não-trivial: criar tabelas `vysen_threads`, `vysen_messages`,
  `vysen_thread_contexts`, migração de dados, sincronização cliente/servidor,
  decisão sobre retention (vai junto com `vysen_usage_events`?).
- Decisão de produto: até quando guardar? Pode ter PII? Quem pode acessar
  (RBAC + tenant scope)?

**Quando faz sentido**:
- Quando usuário pedir "ver histórico anterior" entre devices.
- Ou quando análise de uso do copilot virar prioridade (usar threads como
  dataset).

**Esboço**:
- Migration: 3 tabelas com `tenant_id`, `user_id`, índices por tenant +
  created_at, FK cascata.
- API:
  - `GET /api/dashboard/vysen/threads?limit=20` — lista threads recentes
    do usuário no tenant atual.
  - `POST /api/dashboard/vysen/threads` — cria thread.
  - `GET /api/dashboard/vysen/threads/[id]` — mensagens da thread.
  - `POST /api/dashboard/vysen/threads/[id]/messages` — anexa mensagem
    (substitui localStorage push).
  - `DELETE /api/dashboard/vysen/threads/[id]` — apaga.
- Hook `use-vysen-chat.ts`: trocar `localStorage` por chamadas a essas
  rotas, manter fallback localStorage como cache offline.
- Retention: aplicar mesma política de `vysen_usage_events` (90 dias
  default; `VYSEN_THREADS_RETENTION_DAYS`).
- LGPD: documentar no `RESUMO_PROJETO.md` que histórico contém
  conversas privadas do usuário com o copilot.

## Critério de priorização

Use estes 3 itens quando:
- **Negócio** pedir explicitamente (white-label, deliverability, cross-device).
- **Operação** exigir (>1x/semana de provisionamento manual).
- **Compliance** virar requisito (LGPD/GDPR auditoria de conversas).

Sem esses gatilhos, manter na lista mas não atacar — o ROI é baixo.

## Itens NÃO deferidos (implementados em 2026-05)

Para contraste, foram entregues nesta sessão:

- Alterar senha logado + logout em todos os devices.
- CRUD completo de leads / contatos / oportunidades (criar, editar, excluir).
- PATCH/DELETE memberships (trocar role, remover).
- Editar Typebot (paridade com Evolution/UAZAPI).
- 5 fixes prioritários de navegação (admin-login → /superadmin, etc.).

Ver `AUDIT_NAVEGACAO_2026-05.md` §5.1 + §5.2 e commit `0d568c6` + os do
lote final (CRUD completo).
