# Vysen Copilot

Guia técnico e operacional do Copilot Vysen (dashboard e admin).

## 1. Escopo

O Vysen Copilot atua como analista de dados da operação:

- interpreta contexto de conversas, leads, funil e canais;
- gera diagnóstico e ações priorizadas;
- usa memória de conversas para continuidade.

## 2. Endpoints

- `POST /api/dashboard/vysen/chat`
- `POST /api/admin/vysen/chat`

Ambos devem exigir autenticação e escopo adequado (dashboard/admin).

## 3. Configuração de modelos

Variáveis recomendadas:

- `OPENAI_MODEL_THINKING` (modelo principal)
- `OPENAI_MODEL_FAST` (fallback)
- `OPENAI_MODEL_FALLBACK_ENABLED` (`true`/`false`)
- `OPENAI_THINKING_TIMEOUT_MS` (timeout do modelo principal)

Padrão operacional:

1. tentar modelo thinking;
2. em timeout/falha, fallback para modelo fast (quando habilitado);
3. registrar telemetria de uso/tokens/sucesso.

## 4. Segurança e privacidade

- Não retornar detalhes internos de erro no payload da API para frontend.
- Evitar exposição de segredos em logs.
- Manter filtros de tenant em dados contextuais.
- Priorizar respostas com linguagem acionável e sem vazamento de PII desnecessário.

## 5. Telemetria mínima

Registrar por evento:

- tenantId
- userId
- canal (`dashboard` ou `admin`)
- modelo usado (e fallback quando existir)
- tokens de prompt/completion/total
- sucesso/falha

## 6. Checklist antes de produção

- `OPENAI_API_KEY` válida e segura.
- Fallback e timeout testados.
- Fluxo de erro amigável validado no frontend.
- Custos monitorados por tenant.
