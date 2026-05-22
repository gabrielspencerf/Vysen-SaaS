# Matriz de Autoridade Documental

Versao inicial para F1 (canonizacao documental). Este arquivo define onde cada tipo de verdade deve ser consultada primeiro.

## 1. Regras gerais

- Fonte primaria de verdade de comportamento sempre comecando por codigo em `src/`.
- Documento normativo nao pode contradizer comportamento confirmado em runtime sem registrar pendencia.
- Documento historico nao define regra atual; serve para contexto.
- Em caso de conflito entre docs normativas, prevalece a ordem desta matriz.

## 2. Classes documentais

- **Foundation**
  - Objetivo: explicar o sistema real, escopo e arquitetura atual.
  - Arquivo canonico: `docs/RESUMO_PROJETO.md`.
  - Apoio: `README.md` (visao curta e onboarding), `docs/REVISAO_GERAL_2026-05.md` (revisao mais recente — 80+ findings tratados). Historico arquivado em `docs/log/`.

- **Constitution**
  - Objetivo: padrao de desenvolvimento, convencoes e restricoes de implementacao.
  - Arquivo canonico: `docs/PADRAO_DESENVOLVIMENTO.md`.
  - Apoio: `docs/design-system/*`, `.cursor/rules/padrao-desenvolvimento.mdc`.

- **Operations**
  - Objetivo: operacao, deploy, seguranca operacional, setup e checklists.
  - Arquivos canonicos:
    - `docs/GETTING_STARTED.md`
    - `docs/DEPLOY_VPS.md`
    - `docs/SECURITY_ACCEPTANCE_CHECKLIST.md`
    - `docs/SECURITY_ENDPOINTS_MAP.md`
    - `docs/SECURITY_BASELINE_PRODUCAO.md`
    - `docs/db/REVISAO_ESTRUTURAL.md`

- **Architecture (adoção incremental)**
  - Objetivo: decisões estruturais, filas, contratos de API/webhook, observabilidade mínima e gates de IA/busca.
  - Arquivos canonicos:
    - `docs/ADOCAO_CHATWOOT_BASELINE_GAPS.md`
    - `docs/FILAS_SLO_RETRY_DLQ.md`
    - `docs/CONTRATO_API_WEBHOOKS.md`
    - `docs/EVENTOS_OBSERVABILIDADE_MINIMA.md`
    - `docs/FRONTEND_DATA_LAYER_INCREMENTAL.md`
    - `docs/AI_BUSCA_HIPOTESES_METRICAS.md`
    - `docs/SUPERADMIN_AREA.md` (3-way diff entre os grupos de rotas admin)
    - `docs/specs/adr-api-envelope-transition.md` (estado de migração para apiOk/apiError)
  - Revisão de coerência: `docs/REVISAO_COERENCIA_DOCUMENTACAO_2026-04-26.md`

- **Channels (mensageria e ads)**
  - Objetivo: guia operacional por canal (cadastro, webhook, processador, troubleshooting).
  - Arquivos canonicos:
    - `docs/BASE2_ETAPA2_EVOLUTION.md`
    - `docs/BASE2_ETAPA2_TYPEBOT.md`
    - `docs/UAZAPI_PARIDADE_EVOLUTION.md`
    - `docs/BASE2_CHATWOOT.md`
    - `docs/BASE2_WHATSAPP_CLOUD.md`
    - `docs/BASE2_META_ADS.md`
    - `docs/BASE2_CLARITY.md`
    - `docs/BASE2_GOOGLE_ADS_*.md`

- **History**
  - Objetivo: historico de mudancas, revisoes e incidentes.
  - Arquivos canonicos:
    - `CHANGELOG.md`
    - `docs/log/REGISTRO.md`
    - `docs/RELEASE_v0.2.0.md`
    - `docs/RELEASE_v0.3.0.md`
  - Arquivado em `docs/log/`: `REVISAO_GERAL_2026-03.md`, `REVISAO_COMPLETA_APP_2026-03.md`, `REVISAO_PAGINAS_E_TABELAS.md`, planos concluídos.

## 3. Ordem de consulta recomendada

1. Codigo real (`src/`, `scripts/`, `package.json`, CI/workflows).
2. Documento canonico da classe correspondente.
3. Checklist/operacao relacionada.
4. Historico (se necessario para contexto).

## 4. Pendencias conhecidas (F1 em andamento)

- Regra "nao exibir link Admin no dashboard" em `docs/PADRAO_DESENVOLVIMENTO.md` e `.cursor/rules/padrao-desenvolvimento.mdc` ainda diverge do comportamento atual no frontend do dashboard.
- `docs/PADRAO_DESENVOLVIMENTO.md` ainda descreve admin apenas em `(admin)/admin/*`; o canônico operacional migrou para `(superadmin)/superadmin/*` (ver `docs/REVISAO_COERENCIA_DOCUMENTACAO_2026-04-26.md`).
- `docs/GETTING_STARTED.md` lista migrations só até `0003`; o repositório possui migrations até `0019` — risco de setup incompleto.
- Contrato API envelope (`docs/CONTRATO_API_WEBHOOKS.md`) aplicado em parte; maioria das rotas `/api/dashboard/*` ainda usa formato legado.

## 5. Criterio de pronto de F1 para esta matriz

- Owners definidos para Foundation, Constitution, Operations e History.
- Conflitos criticos registrados com status (aberto/fechado).
- Referencia desta matriz incluida nas revisoes operacionais.
