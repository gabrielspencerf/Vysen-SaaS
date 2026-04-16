# BASE2 Clarity

Guia operacional para conexão e sincronização de Microsoft Clarity por tenant.

## 1. Objetivo

- Conectar projeto Clarity ao tenant.
- Sincronizar snapshots para visualização no dashboard.
- Diferenciar claramente Clarity do site (tag) e Clarity de dados (API).

## 2. Variáveis de ambiente

- `CLARITY_CONNECT_ENABLED=true`
- `OPENAI_API_KEY` (opcional, apenas para recursos de IA relacionados)
- Outras variáveis de app (`DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`) precisam estar válidas.

Observação:

- `NEXT_PUBLIC_CLARITY_ID` representa script de telemetria no app/site.
- Conexão de dados de dashboard usa credenciais/tokens por tenant.

## 3. Fluxo de conexão

1. Usuário autenticado no tenant abre `Dashboard > Clarity`.
2. Informa dados de conexão do projeto.
3. Conexão é validada e armazenada para o tenant atual.
4. Sync de snapshots ocorre via worker/filas.

## 4. Segurança

- Isolamento de dados por tenant obrigatório.
- Segredos devem ser criptografados no backend.
- Mensagens de erro ao usuário devem ser amigáveis (sem vazar payload bruto).

## 5. Troubleshooting

- Sem dados no dashboard: checar worker e `REDIS_URL`.
- Erro de autenticação no Clarity: revisar token/projeto.
- Dados de tenant errado: validar contexto de sessão e filtros de tenant.
