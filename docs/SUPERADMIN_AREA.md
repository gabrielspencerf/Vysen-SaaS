# Área administrativa — comparação 3-way

Existem **três grupos de rotas** server-side em `src/app/` que coexistem
hoje, com URL segments que se sobrepõem em parte. Este documento explica
**quem é quem**, qual é o estado de migração, e como decidir onde
escrever código novo.

## 1. Os três grupos

| Grupo (App Router) | URL segment | Quem acessa | Status |
|---|---|---|---|
| `(admin)` | `/admin/*` | `super_admin` global | **LEGADO** — em consolidação com `(superadmin)` |
| `(superadmin)` | `/superadmin/*` | `super_admin` global | **Futuro** — hub consolidado |
| `(company-admin)` | `/admin/*` (sobrepõe!) | Admin de **um tenant** específico | **Estável** — escopo limitado ao tenant atual |

> **Atenção — URL segment compartilhado**: `/admin/*` é segmento usado pelas
> pastas `(admin)` e `(company-admin)`. O **middleware** roteia por
> sessão/role: `super_admin` global cai em `(admin)`/`(superadmin)`; admin
> de tenant cai em `(company-admin)`.

## 2. Mapa de rotas (snapshot 2026-05)

| Página | `(admin)` legado | `(superadmin)` | `(company-admin)` |
|---|---|---|---|
| Hub / page.tsx | ✓ (`/admin`) | ✓ (`/superadmin`) | parcial |
| `agency` | ✓ | – | – |
| `agent` | ✓ | ✓ | – |
| `integrations` (evolution/typebot/uazapi) | ✓ | ✓ | – |
| `observability` | ✓ | ✓ | – |
| `tenants` | ✓ | ✓ | – |
| `users` | ✓ | ✓ | – |
| `worker-pipeline` | ✓ | ✓ | – |
| `clients` | – | – | ✓ (`/admin/clients`) |

Sempre confirmar via `ls src/app/(admin)/admin/` etc. — o mapa muda
conforme migração avança.

## 3. Como o middleware roteia

`src/middleware.ts`:

- `/` → landing pública.
- `/login` → após sucesso → `/dashboard`.
- `/admin-login` → após sucesso → `/admin` (para `super_admin`) ou
  `/superadmin` quando o front desejar levar direto pro hub novo.
- Middleware **não diferencia role** entre `(admin)` e `(superadmin)`: ambos
  exigem `super_admin` global (permissão `admin:access` sem tenant).
- `(company-admin)` é gated pelo handler/page individual (`requireAdmin`
  por tenant) — não pela presença na sessão de `super_admin`.

## 4. Shells e layouts

| Grupo | Layout | Shell variant | Vysen |
|---|---|---|---|
| `(admin)` | `src/app/(admin)/layout.tsx` | `AdminShell variant="superadmin"` | mostra (técnica) |
| `(superadmin)` | `src/app/(superadmin)/layout.tsx` | `AdminShell variant="superadmin"` | mostra (técnica) |
| `(company-admin)` | `src/app/(company-admin)/admin/layout.tsx` | `AdminShell variant="admin"` | **não** mostra |

`AdminShell` (`src/components/admin-shell.tsx`) parametriza nav/sidebar pelo
`variant` — `superadmin` tem o catálogo completo de integrações e
observabilidade; `admin` (tenant) tem só os itens operacionais do tenant.

## 5. RBAC

| Role | Acessa |
|---|---|
| `super_admin` global | `(admin)` + `(superadmin)` + qualquer `(company-admin)` |
| `admin_tenant` (membership) | `(company-admin)` do **seu** tenant apenas |
| Demais roles | nenhuma área admin |

Verificação no servidor:
- `requireSuperAdmin` em `src/server/admin/*` para rotas `(admin)`/`(superadmin)`.
- `requireDashboardApiAuth` + check de papel admin no tenant atual para `(company-admin)`.
- API routes em `/api/admin/*` exigem `ADMIN_ACCESS` (global).

## 6. Plano de consolidação (em andamento)

Referência: `docs/PLANO_EXECUCAO_UX_SUPERADMIN_ADMIN_DASHBOARD_2026-04.md`.

| Etapa | Estado | Notas |
|---|---|---|
| 1 — Separar `superadmin` (infra) de `admin` (tenant) | **Em curso** | Pastas existem; migração de páginas individual. |
| 2 — Shell próprio do `(company-admin)` | **Feito** | `variant="admin"` ativo, sem Vysen. |
| 3 — Vysen técnica → superadmin / analítica → admin | **Pendente** | Hoje ambas usam mesma Vysen. |
| 4 — Dashboard cliente (extensão `(company-admin)`) | **Pendente** | `/admin/clients` recém-criado. |
| 5 — Descontinuar `(admin)` legado | **Pendente** | Após migrar todas as páginas para `(superadmin)`. |

## 7. Decisão: onde escrever página nova?

```
É operação que afeta múltiplos tenants ou plataforma (super_admin)?
   sim → escrever em (superadmin)/superadmin/<feature>/
   não → segue

É operação dentro do escopo do tenant atual (admin do tenant)?
   sim → escrever em (company-admin)/admin/<feature>/
   não → segue

É operação que ainda só existe em (admin) legado e que vai ser
descontinuada?
   sim → portar para (superadmin) antes de mexer
```

⚠️ **NÃO** crie página nova em `(admin)` legado. Toda página nova de
super_admin vai em `(superadmin)`.

## 8. Login flow

- **Usuário comum**: `/login` (form em `src/app/login/page.tsx`) → POST
  `/api/auth/login` → cookie de sessão + CSRF → redirect `/dashboard`.
- **Super_admin**: `/admin-login` (form em `src/app/admin-login/page.tsx`)
  → mesmo `POST /api/auth/login` → após gate `isSuperAdmin`, redirect
  `/admin` ou `/superadmin`.
- **Google OAuth**: `/api/auth/google/start?from=<rota>&isAdmin=<bool>`
  → callback gate `isSuperAdmin` antes de `createSession` (fix 2026-05).
- **Admin de tenant**: chega via `/login` normal; rotas `(company-admin)`
  exigem que ele tenha role admin **no** tenant atual.

## 9. Antipadrões observados

- **Duplicação new/edit**: páginas em `(admin)/admin/integrations/evolution|uazapi|typebot/new`
  e `/[id]/edit` divergem só em poucos campos — refator para
  `IntegrationForm({ mode })` está aberto.
- **Link admin no sidebar do dashboard**: não fazer. O dashboard do usuário
  comum não deve ter link visível para `/admin` ou `/superadmin`.
- **`super_admin` global sem auditoria**: `createMembership` aceita
  `super_admin` sem proteção extra. Antes de promover, registrar manualmente
  em `audit_logs`.

## 10. Próximos passos

- Concluir Etapa 1 → portar páginas individuais do `(admin)` legado para
  `(superadmin)` quando elas forem tocadas.
- Etapa 3: separar Vysen técnica (superadmin) de Vysen analítica
  (company-admin).
- Atualizar `docs/PADRAO_DESENVOLVIMENTO.md` (já reflete os 3 grupos, mas
  exemplos de página nova ainda citam só `(dashboard)`/`(admin)`).
- Quando Etapa 5 fechar, remover `(admin)/` e adicionar nota em
  `docs/log/` arquivando essa decisão.

## Referências

- `src/app/(admin)/`, `src/app/(superadmin)/`, `src/app/(company-admin)/`
- `src/middleware.ts`
- `src/components/admin-shell.tsx`
- `docs/PADRAO_DESENVOLVIMENTO.md` (visão canônica)
- `docs/PLANO_EXECUCAO_UX_SUPERADMIN_ADMIN_DASHBOARD_2026-04.md` (etapas)
