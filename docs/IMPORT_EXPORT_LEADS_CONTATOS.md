# Importação e exportação de Leads e Contatos

## Modelo de planilha (template)

Use os arquivos de exemplo para importar leads ou contatos sem erros de formato:

- **Leads:** `/templates/modelo-leads.csv`
- **Contatos:** `/templates/modelo-contatos.csv`

### Colunas esperadas — Leads

| Coluna     | Obrigatório | Descrição |
|-----------|-------------|-----------|
| nome      | Não         | Nome do lead |
| email     | Não*        | E-mail (* ao menos um de email ou telefone) |
| telefone  | Não*        | Telefone com DDI (ex.: +5511999999999) |
| status    | Não         | new, contacted, qualified, converted, lost, duplicate, bad_lead. Padrão: new |
| origem    | Não         | Ex.: import, typebot, evolution. Padrão: import |
| observacoes | Não       | Texto livre (pode ser gravado em metadata) |

### Colunas esperadas — Contatos

| Coluna     | Obrigatório | Descrição |
|-----------|-------------|-----------|
| nome      | Não         | Nome do contato |
| email     | Não*        | E-mail (* ao menos um de email ou telefone) |
| telefone  | Não*        | Telefone com DDI |
| origem    | Não         | manual ou import. Padrão: import |
| observacoes | Não       | Texto livre |

### Regras

- Encoding recomendado: **UTF-8**.
- Separador: **vírgula** (CSV).
- Primeira linha: **cabeçalho** (nomes das colunas).
- Telefone: use formato com DDI (ex.: +5511999999999) para evitar duplicatas.
- E-mail: será normalizado (minúsculas, trim) para deduplicação.

## Exportação

- Na tela **Leads** ou **Contatos**, use o botão **Exportar** para baixar um CSV com os dados atuais do tenant (colunas alinhadas ao modelo acima).
- A exportação respeita filtros e busca da tela, quando implementado.

## Importação

- Na tela **Leads** ou **Contatos**, use o botão **Importar** e selecione um arquivo CSV.
- O sistema valida o cabeçalho e as linhas; erros são exibidos por linha. Linhas válidas são criadas (ou atualizadas, se a política for “atualizar por e-mail/telefone” quando implementado).

## API e UI

- **Exportar:** GET `/api/dashboard/leads/export` e GET `/api/dashboard/contacts/export` (query opcional `search`). Resposta: arquivo CSV com BOM UTF-8.
- **Importar:** POST `/api/dashboard/leads/import` e POST `/api/dashboard/contacts/import` com `multipart/form-data` (campo `file`). Resposta JSON: `{ created, skipped, errors }`.
- Nas telas **Leads** e **Contatos** do dashboard há botões **Exportar**, **Modelo** (download do template) e **Importar** (upload de CSV).
