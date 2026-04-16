# BASE2 Meta Ads

Guia operacional para conexão e sincronização de Meta Ads por tenant.

## 1. Objetivo

- Conectar contas Meta Ads no dashboard.
- Sincronizar snapshots para análise de desempenho.
- Garantir segurança de credenciais e consistência multi-tenant.

## 2. Variáveis de ambiente

- `META_ADS_CONNECT_ENABLED=true`
- `META_ADS_APP_ID`
- `META_ADS_APP_SECRET`
- `META_ADS_REDIRECT_URI` (ex.: `https://app.seudominio.com/api/meta-ads/auth/callback`)
- `META_ADS_ENCRYPTION_KEY` (32 bytes, hex/base64)
- `META_ADS_STATE_SECRET` (opcional; fallback em `SESSION_SECRET`)
- `META_GRAPH_API_VERSION` (opcional, padrão estável definido no código)

## 3. Fluxo de conexão

1. Usuário autenticado no tenant abre `Dashboard > Meta Ads`.
2. Clica em conectar conta.
3. OAuth redireciona para callback da aplicação.
4. Conta conectada é persistida no tenant atual.

## 4. Segurança

- Nunca armazenar segredo em texto puro no frontend.
- Tokens e segredos devem usar criptografia server-side.
- Restringir escopo por tenant em todas as queries.
- Validar `state` no OAuth para prevenir CSRF/open redirect.

## 5. Troubleshooting

- Erro de callback: conferir `META_ADS_REDIRECT_URI` no app Meta.
- Conta não aparece no dashboard: validar tenant atual e permissões.
- Falha de sync: checar worker/Redis e logs de filas.
