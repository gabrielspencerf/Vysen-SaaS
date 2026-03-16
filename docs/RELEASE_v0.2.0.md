# Release v0.2.0

Data: 2026-03-16

## Escopo desta release

Esta release consolida melhorias de UX/UI no Dashboard e Admin, padronizacao de layout entre paginas, refinamento de temas dark/light, robustez de observabilidade, ajustes de setup local (Redis/migrations) e documentacao operacional.

## Principais mudancas

### 1) Visual e usabilidade (Dashboard/Admin)

- Padronizacao de secoes com `PageSection` em modo `plain` para cabecalhos (evitando "card dentro de card").
- Novo sistema visual reutilizavel:
  - `panel-lux` (cards com efeito glass leve),
  - `panel-mini` (blocos compactos),
  - `section-eyebrow` e `dashboard-chip` para hierarquia visual.
- Canvas do dashboard (`dashboard-canvas`) com ambiencia suave e movimento leve.
- Sidebar refinada:
  - largura reduzida (~15%),
  - avatar circular do logo,
  - bloco de tenant com nome de usuario (sem exibir permissao),
  - estado ativo/hover mais sutil no estilo light.
- Graficos:
  - barras estilo capsule,
  - variacao de intensidade nas barras,
  - remocao de sobreposicao/cursor opaco no tooltip.
- Landing page:
  - refinada para light mode com sombras e contraste mais suaves.

### 2) Tema (dark/light)

- Nova opcao em `Configuracoes` para alternar explicitamente entre tema `Escuro` e `Claro`.
- Persistencia e aplicacao imediata via `localStorage` (`ds-theme`) e `data-theme` no `html`.

### 3) Observabilidade e legibilidade

- Em `admin/observability`, status `ok/warn/error` com contraste adequado em light e dark.
- Fallback de observabilidade quando `REDIS_URL` nao esta definida, sem derrubar pagina.

### 4) Setup, ambiente e dados

- `GOOGLE_ADS_CONNECT_ENABLED` suportado em `env`.
- Inclusao de script de seguranca para schema:
  - `scripts/ensure-currency-code.ts`
  - comando `db:ensure-currency-code` no `package.json`
- Ajustes de migrations/journal e documentos de suporte:
  - `docs/db/REVISAO_ESTRUTURAL.md`
  - `docs/REDIS_WINDOWS.md`
  - atualizacoes em `docs/GETTING_STARTED.md` e `.env.example`.

### 5) Percepcao de performance

- Inclusao de `loading.tsx` para os segmentos:
  - `src/app/(dashboard)/dashboard/loading.tsx`
  - `src/app/(admin)/admin/loading.tsx`

## Revisao estrutural (checklist)

- Estrutura de rotas preservada (`/dashboard/*` e `/admin/*`).
- Sem alteracao de contratos de API existentes.
- Sem alteracao destrutiva em schema.
- Linter dos arquivos alterados: sem erros.
- Risco residual conhecido:
  - `npm run lint` usa `next lint` e abre prompt interativo neste ambiente; recomendado migrar para ESLint CLI para CI nao interativo.

## Validacao recomendada pos-release

1. Validar navegacao em dark/light:
   - Home, Leads, Conversas, Funnel, Google Ads, Configuracoes
   - Admin: Inicio, Integracoes, Observabilidade, Tenants, Usuarios
2. Validar troca de tema em `Configuracoes`.
3. Validar sidebars (avatar/logo, bloco tenant e estado ativo/hover).
4. Validar observabilidade com e sem `REDIS_URL`.
5. Executar migrations e seed conforme `docs/GETTING_STARTED.md` se ambiente novo.

## Notas de rollout

- Esta release e focada em UX/UI e robustez operacional.
- Nao exige migracao de dados manual alem do fluxo normal de `db:migrate`.
