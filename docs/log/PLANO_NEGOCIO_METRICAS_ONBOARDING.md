# Plano: Dados de negócio, ROAS/ROI, produtos, upload, onboarding, PageSpeed e reclamações

Documento de referência para as funcionalidades solicitadas. Implementação em fases.

---

## 1. Dados de negócio na oportunidade (e ROAS/ROI)

### Campos a adicionar em oportunidades (ou em negócio/deal)
- **Data de início de contato** (`contact_started_at`) — quando o primeiro contato comercial foi feito.
- **Modelo contratado** (`contracted_model`) — texto ou enum (ex.: plano básico, premium, sob medida).
- **Valor do trabalho** (`job_value`) — valor em moeda (ex.: BRL) para cálculo de receita.

### ROAS e ROI
- **ROAS** (Return on Ad Spend) = Receita atribuída ao canal / Custo em anúncios no período.
  - Receita: soma de `job_value` das oportunidades ganhas (stage = won) no período (ou atribuídas à campanha via atribuição).
  - Custo: soma do gasto em Google Ads (campanhas do tenant) no mesmo período — dados em `campaign_snapshots.metrics` (campo de custo quando disponível na sync) ou API Google Ads.
- **ROI** = (Receita - Custo) / Custo.
- **Onde exibir:** Dashboard (home ou seção “Performance”) com cards ou tabela resumindo ROAS/ROI por período; filtro por conta Google Ads ou global.

### Ordem sugerida
1. Adicionar em `opportunities`: `contact_started_at`, `contracted_model`, `job_value` (numeric).
2. Garantir que a sync de Google Ads preencha custo em `campaign_snapshots.metrics` (ou criar campo dedicado se necessário).
3. Servidor: função que calcula receita (soma job_value de oportunidades won no período) e custo (soma de métricas de campanhas); ROAS = receita/custo, ROI = (receita-custo)/custo.
4. UI: formulário de edição de oportunidade com esses campos; bloco na dashboard com ROAS/ROI (período selecionável).

---

## 2. Produtos e valor de ticket (MRR)

- **Aba/seção “Produtos”** no dashboard: listagem de produtos (ou serviços) do tenant com **valor de ticket** (preço unitário).
- **Modelo:** tabela `products` — tenant_id, name, description (opcional), unit_price, currency, **billing_type** (one_time | recurring), **billing_interval** (monthly | yearly; só para recurring), is_active, created_at, updated_at.
- **MRR (Monthly Recurring Revenue):** soma dos produtos ativos **recorrentes** convertidos a mensal: billing_interval = monthly → unit_price; yearly → unit_price/12. Exibido na página Produtos quando houver produtos recorrentes.
- **UI:** lista com coluna “Cobrança” (Pagamento único / Recorrente mensal / Recorrente anual); ao criar produto, escolher “Pagamento único” ou “Recorrente” e, se recorrente, intervalo (Mensal/Anual).
- **Ticket médio:** pode ser calculado como soma(job_value)/count(opportunities won) ou por produto quando houver vínculo oportunidade ↔ produto.

---

## 3. Upload de arquivos da empresa (logo, fotos)

- **Sessão no dashboard** (ex.: Configurações → Minha empresa ou “Arquivos da empresa”) onde o **cliente (tenant)** faz upload de:
  - **Logotipo** (logo da empresa).
  - **Fotos** (galeria ou fotos de referência da empresa).
- **Armazenamento:** arquivos em storage (filesystem local ou cloud, ex.: Vercel Blob / S3). Não armazenar binário no Postgres; apenas metadados.
- **Modelo:** tabela `tenant_assets` — tenant_id, kind (enum: logo | photo | document), file_key (path ou key no storage), display_name, content_type, file_size_bytes, created_at. Índice por tenant_id e kind.
- **API:** POST upload (multipart) → valida tipo/tamanho → grava no storage → insere linha em tenant_assets; GET lista ou serve URL assinada; DELETE remove arquivo e registro.
- **UI:** página ou seção com upload de logo (preview) e lista de fotos com opção de adicionar/remover.

---

## 4. Onboarding e conclusão por etapa

- **Onboarding** do tenant: conjunto de etapas (ex.: Conectar Google Ads, Cadastrar primeiro lead, Configurar perfil, etc.). O cliente marca cada parte como concluída.
- **Modelo:**
  - **onboarding_steps** — id, slug (único), name, description (opcional), sort_order. Dados mestres (globais).
  - **tenant_onboarding_progress** — tenant_id, onboarding_step_id, completed_at (null = não concluído). Um registro por tenant por etapa.
- **Regra:** conclusão = preencher completed_at (pode ser disparado por ação real, ex.: “Conectou conta Google Ads” ou manual “Marquei como concluído”).
- **UI:** página “Onboarding” ou bloco na home com lista de etapas; cada etapa com indicador (concluído / pendente) e botão “Marcar como concluído” quando aplicável; barra de progresso (ex.: 3/7 etapas).

---

## 5. PageSpeed (landing page do cliente)

- **Objetivo:** exibir dados de carregamento da **landing page do cliente** no dashboard, usando [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about) (lab + field quando disponível).
- **API Google:** [PageSpeed Insights API v5](https://developers.google.com/speed/docs/insights/v5/get-started) — `GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&key=API_KEY` (requer API key no Google Cloud).
- **Métricas:** FCP, LCP, CLS, INP (e TTFB experimental); classificação Good / Needs Improvement / Poor conforme thresholds do Web Vitals.
- **Modelo (histórico por data e dispositivo):**
  - Configuração: URL da landing por tenant (em `tenants.settings`, ex.: `landing_page_url`).
  - Tabela `pagespeed_results`: tenant_id, url, **strategy** (mobile | desktop = dispositivo), **metric_date** (date = dia do snapshot), result (jsonb), fetched_at. Índice por (tenant_id, metric_date, strategy) para **calendário e métricas diárias**. Unique (tenant_id, url, strategy, metric_date) = um snapshot por dia por URL por dispositivo; job faz upsert.
- **UI:** seção “Performance da landing” com **calendário interno**: filtrar por período, ver métricas por data e por dispositivo (mobile/desktop), trabalhar em conjunto com as métricas diárias (LCP, FCP, CLS, INP por dia).

---

## 6. Reclamações (feedback negativo do cliente)

- **Objetivo:** o **cliente (usuário do tenant)** pode registrar **reclamações** — pontos que não está gostando do serviço.
- **Modelo:** tabela `complaints` (ou `tenant_feedback`) — id, tenant_id, user_id (quem registrou), subject (opcional), body (texto), status (open | in_progress | closed), created_at, updated_at. Opcional: admin_id (quem está tratando) e resolved_at.
- **UI (dashboard):** seção “Reclamações” ou “Meu feedback”: listar reclamações do tenant; formulário para nova reclamação (assunto, texto); visualizar status.
- **Admin (opcional):** lista de reclamações de todos os tenants para acompanhamento e resposta; atualizar status.

---

## Ordem sugerida de implementação

1. **Schema e migração** — oportunidades (contact_started_at, contracted_model, job_value); products; tenant_assets; onboarding_steps + tenant_onboarding_progress; pagespeed_results; complaints.
2. **Oportunidades** — API PATCH para novos campos; UI de edição; depois cálculo ROAS/ROI (quando custo estiver disponível em campaign_snapshots ou API).
3. **Produtos** — CRUD API + aba Produtos no dashboard com valor de ticket.
4. **Upload de arquivos** — storage (local ou cloud), API upload/list/delete, UI em Configurações ou “Arquivos da empresa”.
5. **Onboarding** — seed de onboarding_steps; API para marcar etapa concluída; UI com lista e progresso.
6. **PageSpeed** — config landing URL; job ou endpoint que chama PageSpeed API e grava em pagespeed_results; UI com métricas e “Atualizar”.
7. **Reclamações** — API criar/listar; UI no dashboard; opcional: painel admin.

---

## Status de implementação

- **Schema e migração (0006):** Oportunidades (contact_started_at, contracted_model, job_value); products; tenant_assets; onboarding_steps + tenant_onboarding_progress; pagespeed_results; complaints.
- **Oportunidades:** API PATCH `/api/dashboard/opportunities/[id]` para atualizar stage, title, contactStartedAt, contractedModel, jobValue. Servidor: `listOpportunitiesForTenant`, `getOpportunityForTenant`, `updateOpportunityForTenant`.
- **Produtos:** CRUD (list + create); API GET/POST `/api/dashboard/products`; página **Produtos** no dashboard com lista e formulário de novo produto (nome, valor de ticket, descrição).
- **Reclamações:** API GET/POST `/api/dashboard/complaints`; página **Reclamações** no dashboard com lista e formulário para nova reclamação.
- **Pendente:** UI de edição de oportunidade (formulário com data início contato, modelo, valor); cálculo e exibição de ROAS/ROI na dashboard; upload de arquivos (tenant_assets); onboarding (seed de etapas + API + página); PageSpeed (config URL + chamada API + página).
- **ROAS/ROI:** Quando `campaign_snapshots.metrics` (ou API Google Ads) tiver custo disponível, implementar função que soma receita (job_value de oportunidades won) e custo no período e exibe ROAS/ROI.

## Referências

- [PageSpeed Insights – About](https://developers.google.com/speed/docs/insights/v5/about) — métricas (FCP, LCP, CLS, INP), Good/Needs Improvement/Poor.
- [PageSpeed Insights API – Get Started](https://developers.google.com/speed/docs/insights/v5/get-started) — acesso programático com API key.
