# ADR: Transição para o envelope api-contract (`apiOk` / `apiError`)

**Status**: Aceito (em execução)
**Data**: 2026-05-22
**Contexto**: `docs/REVISAO_GERAL_2026-05.md` (achado API #15 – respostas
genéricas vs. envelope padronizado)

## Contexto

`src/server/http/api-contract.ts` define um envelope HTTP padronizado
(versão `2026-04-26`):

- **Sucesso**: `{ ok: true, data }`
- **Falha**: `{ ok: false, error: { code, message } }`
- Headers: `x-api-version`, `Retry-After`, `X-RateLimit-Remaining` etc.
- Para webhooks: `x-webhook-contract-version`, `x-webhook-idempotency-key`,
  `x-webhook-replay-window-seconds`.

Hoje, **cobertura ≈ 9%** (snapshot 2026-05):

| Área | Total rotas | Migradas | Status |
|---|---|---|---|
| Webhooks | 5 | 5 | ✅ 100% |
| Dashboard | 37 | 2 | ⚠️ 5% |
| Admin | 17 | 0 | ❌ 0% |
| Auth | 7 | 0 | ❌ 0% |
| Context | 3 | 0 | ❌ 0% |
| Integrations (ads OAuth/sync) | 8 | 0 | ❌ 0% |
| Health / Metrics | 3 | 0 | ❌ 0% |

Rotas legadas retornam `NextResponse.json({ error: "..." }, { status: 4xx })`
ou variantes ad-hoc. Cada cliente trata o erro de forma diferente.

## Decisão

**Migrar de forma incremental, sem big-bang**. Cada rota migra quando for
tocada por outro motivo, ou em lotes temáticos pequenos quando houver
prioridade explícita (ex.: padronizar resposta de 429 em todas as rotas
com rate-limit).

### Regras da transição

1. **Webhooks**: 100% migradas — manter. Qualquer webhook novo já nasce
   com envelope.
2. **`/api/dashboard/*`**: migrar prioritariamente — clientes (browser do
   dashboard) já consomem ambos os formatos com adapter pontual. Cada
   migração reduz adapter.
3. **`/api/admin/*`**: migrar em lote quando o painel admin tocar a rota.
4. **`/api/auth/*`**: deixar por último — payload de sucesso já varia (ex.:
   `{ ok, isSuperAdmin }`) e adapter no client é estável. Migrar quando
   houver mudança de comportamento (não por estética).
5. **`/api/context/*`**, `/api/google-ads/*`, `/api/meta-ads/*`,
   `/api/health/*`, `/api/metrics`: avaliar caso a caso.
   - `health` minimal continua `{ ok: bool }` simples (não vale envelope).
   - `metrics` é text/plain Prometheus — envelope não se aplica.

### Padrão da migração

```ts
// Antes
return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });

// Depois
import { apiError } from "@/server/http/api-contract";
return apiError("tenant_not_found", "Tenant não encontrado", { status: 404 });
```

```ts
// Antes
return NextResponse.json({ data: rows });

// Depois
import { apiOk } from "@/server/http/api-contract";
return apiOk({ data: rows });
```

Para rate-limit (429), padrão:

```ts
return apiError("rate_limited", "Muitas tentativas. Aguarde.", {
  status: 429,
  headers: {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Remaining": "0",
  },
});
```

## Consequências

### Positivas

- Cliente único pra todas as rotas (um `apiCall(url)` que trata envelope).
- Códigos de erro consultáveis em painel de observability (mesma string
  `error.code` aparece em logs, audit, métricas).
- Headers padronizados (Retry-After, rate-limit) sem repetir o boilerplate
  por rota.

### Negativas

- Versionamento: mudança de payload é breaking change → bump `x-api-version`.
  Hoje `2026-04-26`; quando consolidar Dashboard, bumpar.
- Centralizar erro de auth em `dashboardApiAuthErrorResponse` exige refator
  para usar `apiError` em vez de `NextResponse.json` direto.
- Adapter no client (browser) precisa ler ambos os formatos até cobertura ≈ 90%.

## Próximas rotas (lote sugerido)

Priorizar Dashboard porque tem mais volume e o adapter no client paga o
investimento:

**Lote 1 — Dashboard básico** (CRUD que já usa `requireDashboardApiAuth`):
- `dashboard/funnels/route.ts` (GET / POST)
- `dashboard/funnels/[id]/route.ts` (GET / PUT / DELETE)
- `dashboard/funnels/[id]/steps/route.ts`
- `dashboard/funnels/[id]/steps/[stepId]/route.ts`

**Lote 2 — Dashboard CRM**:
- `dashboard/products/route.ts`
- `dashboard/complaints/route.ts`
- `dashboard/leads/[id]/route.ts`
- `dashboard/leads/[id]/events/route.ts`

**Lote 3 — Admin core**:
- `admin/tenants/route.ts` (GET / POST)
- `admin/users/route.ts` (GET / POST)
- `admin/memberships/route.ts`

**Lote 4 — Admin integrations CRUD**:
- `admin/integrations/typebot/[id]/route.ts`
- `admin/integrations/evolution/[id]/route.ts`
- `admin/integrations/uazapi/[id]/route.ts`

**Auth fica deferido** até decisão de produto sobre formato do payload de
login (impacto direto no client adapter — atualmente espera
`{ ok, isSuperAdmin }`).

## Checklist por rota migrada

- [ ] `import { apiOk, apiError } from "@/server/http/api-contract"`
- [ ] Todos os `NextResponse.json({ error })` viraram `apiError(code, msg, { status })`
- [ ] Todos os `NextResponse.json(payload)` de sucesso viraram `apiOk(payload)`
- [ ] Códigos de erro (`code`) seguem snake_case curto (ex.: `tenant_not_found`,
      `rate_limited`, `invalid_payload`)
- [ ] Mensagens em pt-BR (user-facing) consistentes
- [ ] Headers especiais (Retry-After, etc.) passados via `opts.headers`
- [ ] Teste atualizado se a rota tinha cobertura
- [ ] Smoke estrutural atualizado se mencionar shape de erro

## Referências

- `src/server/http/api-contract.ts` — implementação canônica
- `docs/CONTRATO_API_WEBHOOKS.md` — contrato canônico (renomear/expandir
  para `CONTRATO_API.md` quando dashboard estiver coberto)
- `docs/REVISAO_GERAL_2026-05.md` (achado §2 — Médios) — drift atual
- `docs/REVISAO_FOLLOWUP_2026-05.md` §6 — ADR listado como remanescente

---

> Esta ADR é **viva**: ao migrar um lote, atualizar a tabela de cobertura
> em §Contexto e marcar o lote como concluído em §Próximas rotas.
