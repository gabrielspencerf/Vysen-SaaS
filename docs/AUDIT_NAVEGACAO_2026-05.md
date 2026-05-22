# Auditoria de navegação, login e funcionalidades operacionais — 2026-05

> Foco: **mapa de páginas**, **ações de login**, **direcionamento de botões**
> e **funcionalidades operacionais** (o que funciona, o que está stub,
> o que está quebrado).
> **Data**: 2026-05-22 · **Branch**: `main` (commit base `eac6a42`)

---

## 0. Sumário executivo

A revisão geral 2026-05 tratou bugs técnicos (auth, DB, workers, infra).
**Este audit foca em fluxos de navegação e completude funcional** — coisas
que passam typecheck mas confundem o usuário ou simplesmente não existem.

### Top achados acionáveis

🔴 **Críticos** (UX quebrada):
1. **`/admin-login` redireciona super_admin para `/admin`**, que é o hub da
   `(company-admin)` (visão de carteira), NÃO o hub `(superadmin)` (operação
   técnica). Super_admin precisa clicar num link "→ /superadmin" no header
   pra chegar onde quer. **Esperado**: redirect direto pra `/superadmin`.
2. **Super_admin que logar por `/login`** (e-mail normal) cai em `/dashboard`
   sem nenhum link visível pra área admin — fica preso.
3. **Middleware só valida presença de cookie**, não a role; layouts é que
   gatekeepam por permissão. Combina com (1) e (2) pra abrir buracos.

🟠 **Altos** (funcionalidade ausente):
4. **Sem CRUD completo de contatos no dashboard** — página é read-only;
   só dá pra criar via webhook ou import CSV.
5. **Sem botão "Nova oportunidade"** no `/dashboard/opportunities`; mesma
   limitação em leads (só import CSV ou webhook cria).
6. **Sem `DELETE` em `memberships`, `users`, `tenants`** — UI mostra mas
   não dá pra remover ninguém da plataforma; só edit.
7. **Sem editar Typebot** (só create + delete); UAZAPI/Evolution têm CRUD
   completo, Typebot fica incoerente.
8. **Sem configuração de SMTP no tenant** — SMTP global do `.env` é única
   opção; não há tela `settings/smtp`.

🟡 **Inconsistências e gaps menores**:
9. URL segment `/admin/*` compartilhado por **dois** grupos: `(admin)`
   legado (redirect-only) e `(company-admin)` (página real). Confusão de
   namespace recorrente.
10. Histórico do Vysen Copilot persiste só em `localStorage` — perde ao
    trocar de device ou limpar cache.
11. CTA da landing diz "Área do Cliente" mas leva pra `/login` — label
    deveria ser "Entrar" ou "Dashboard".

---

## 1. Mapa de páginas (snapshot 2026-05)

**70 páginas server-side** em 5 grupos:

### 1.1 Públicas (6)

| URL | Tipo | Função |
|---|---|---|
| `/` | server | Landing + CTAs |
| `/login` | client | Login usuário (form + Google OAuth) |
| `/admin-login` | client | Login super_admin |
| `/forgot-password` | client | Request reset |
| `/reset-password` | client | Confirmar token + nova senha |
| `/forbidden` | server | Error 403 |

### 1.2 Dashboard usuário (`(dashboard)/dashboard/*`) — 25 páginas

Hub redireciona (`/dashboard` → `/dashboard/context` ou `/dashboard/home`).
Áreas: **home**, **onboarding**, **leads** (lista, [id], edit, kanban),
**conversations** (lista, [id]), **opportunities** (lista, [id]),
**contacts**, **funnel** (visão, config), **products**, **complaints**,
**support**, **notifications**, **clarity**, **google-ads** (+ connect),
**meta-ads** (+ connect), **pagespeed**, **settings**, **settings/whatsapp**,
**context** (escolher tenant).

### 1.3 Admin legado (`(admin)/admin/*`) — 14 páginas, **quase todas redirects**

| URL | O que faz hoje |
|---|---|
| `/admin/tenants` (+ new, [id], [id]/edit) | redirect → `/superadmin/tenants/...` |
| `/admin/users` (+ new, [id]) | redirect → `/superadmin/users/...` |
| `/admin/agent` | redirect → `/superadmin/agent` |
| `/admin/observability` | redirect → `/superadmin/observability` |
| `/admin/worker-pipeline` | redirect → `/superadmin/worker-pipeline` |
| `/admin/integrations` (e sub-rotas) | redirect → `/superadmin/integrations/...` |
| `/admin/integrations/evolution/new` | **re-export** do (admin) (compartilha código) |
| `/admin/integrations/uazapi/new` | idem |
| `/admin/agency` | página real (portfolio agência) |

### 1.4 Superadmin (`(superadmin)/superadmin/*`) — 20 páginas (hub oficial)

`/superadmin` (hub com 6 cards) + tenants + users + agent (governança Vysen)
+ observability + worker-pipeline + integrations (Evolution/UAZAPI/Typebot
new+edit). Várias páginas são **re-export** das implementações em `(admin)`.

### 1.5 Company-admin (`(company-admin)/admin/*`) — 2 páginas

| URL | Função |
|---|---|
| `/admin` | "Admin da empresa" — visão resumida da carteira |
| `/admin/clients` | Lista de tenants gerenciados |

⚠️ **CONFLITO**: `/admin` aqui **sobrepõe** `(admin)/admin/` legado. Como `(admin)/admin/page.tsx` não existe (foi removido — ver `git status` original mostrando D), `/admin` resolve pra `(company-admin)/admin/page.tsx`. Funciona, mas é **frágil**: se alguém criar `(admin)/admin/page.tsx` novamente, ambíguo.

---

## 2. Fluxos de login — achados

### 2.1 🔴 `admin-login` → `/admin` cai no hub errado

`src/app/admin-login/page.tsx:55` faz `router.push("/admin")`. Resolve para
`(company-admin)/admin/page.tsx` (carteira). O super_admin **tinha**
expectativa de cair em `/superadmin` (hub técnico).

**Fix sugerido**: trocar `router.push("/admin")` por
`router.push("/superadmin")` em `admin-login/page.tsx:55`. Página
`(company-admin)/admin/page.tsx` deve ser acessível **só** para
`admin_tenant` (não super_admin) ou ter banner de boas-vindas explicando
a diferença.

### 2.2 🔴 Super_admin que entra por `/login` fica preso em `/dashboard`

O `POST /api/auth/login` retorna `{ ok, isSuperAdmin }`. Em `/login/page.tsx`
o cliente ignora `isSuperAdmin` e redireciona pra `from || "/dashboard"`. O
super_admin vê o dashboard normal, sem link "Ir para admin".

**Fix sugerido**:
- Em `/login/page.tsx`, após login bem-sucedido, **se** `isSuperAdmin === true`,
  oferecer toast "Você é admin global — ir para /superadmin" com link.
- Ou redirect automático condicional: super_admin sem tenant atual →
  `/superadmin`; super_admin com tenant → `/dashboard` + banner.

### 2.3 🟠 Sanitização inclui `/admin` no allowlist do usuário comum

`src/app/api/auth/login/route.ts` aceita `from` começando com `/dashboard`
**ou** `/admin`. Usuário comum loga com `?from=/admin/clients` e é
redirecionado — funciona porque `(company-admin)/admin/layout.tsx` exige
`ADMIN_ACCESS` e redireciona `/forbidden` se não tiver. Comportamento
**defesa em profundidade ok**, mas o allowlist deveria refletir intenção:
- `/login` allow: só `/dashboard/*`
- `/admin-login` allow: `/admin/*` + `/superadmin/*`

Hoje os dois compartilham o mesmo allowlist. Não é vulnerabilidade — só
UX inconsistente.

### 2.4 🟠 Middleware sem validação de role

`src/middleware.ts` só checa **presença de cookie**. Quem decide se a
sessão tem permissão são os layouts (`(admin)/layout.tsx`,
`(company-admin)/admin/layout.tsx`, `(superadmin)/layout.tsx`) via
`hasPermission(ADMIN_ACCESS)`.

Implicação: usuário comum **passa** o middleware ao acessar `/admin/*`;
layout então redireciona `/forbidden`. Funciona, mas:
- 1 round-trip extra (request → middleware ok → layout → /forbidden).
- Boundary depende de cada layout fazer o check certo. Já vimos
  `(admin)/layout.tsx` e `(company-admin)/admin/layout.tsx` checarem
  `ADMIN_ACCESS`; mas o check **não distingue** super_admin global de
  admin_tenant — ambos passam.

**Fix sugerido**: middleware pode opcionalmente decodificar o cookie e
fazer check leve de role pra `/admin/*` e `/superadmin/*`. Como o cookie é
opaco hoje (hash do token, não JWT), exigiria uma chamada DB no middleware
— custo alto. Alternativa: aceitar o status atual e documentar que
"layouts são a fonte de truth de role".

### 2.5 🟡 OAuth Google: relaxed mode aceita qualquer path interno

Quando `SECURITY_STRICT_REDIRECTS=false`, o `sanitizeOAuthRedirect()` aceita
qualquer path interno (sem `..` ou `://`). Default é **true** (seguro);
mas mantenha o flag default e barre o uso de `false` em produção via
startup-guard (já tem para outros flags).

### 2.6 🟡 Tenant ausente para usuário sem membership

`chooseInitialTenantId()` retorna `null` quando o usuário não tem nenhum
membership. Sessão é criada com `currentTenantId=null`. Navegação para
`/dashboard` redireciona para `/dashboard/context` (escolher tenant). Mas
**não há tenant para escolher** → loop visual onde o usuário não sabe o
que fazer.

**Fix sugerido**: se sessão tem 0 memberships ativos, redirect direto
para `/forbidden` ou página explicativa "Aguardando convite para tenant".

### 2.7 ✅ Funciona bem

- Password reset request + confirm (com rate-limit + token TTL).
- Logout limpa sessão + cookies + CSRF cookie + redirect 302.
- OAuth callback com state HMAC + TTL 15min + nonce.
- `switchTenant` rotaciona o token de sessão (fix de 2026-05).

---

## 3. Direcionamento de botões — achados

### 3.1 Links validados (✅ todos OK)

- CTAs da landing (`src/app/page.tsx`): `/login`, `/admin-login` existem.
- Botões "Cancelar" em forms new/edit → todos apontam para listagem
  correta (`/superadmin/tenants`, `/superadmin/users`, etc.).
- Sidebar dashboard (`dashboard-sidebar.tsx`): todos os hrefs apontam pra
  rotas existentes.
- Sidebar admin/superadmin (`admin-sidebar.tsx`): consistente — `variant`
  decide o destino base.
- External links (`https://ads.google.com`, docs) sempre com
  `rel="noopener noreferrer"`.

### 3.2 🟡 Inconsistência: `admin-login` aponta para o hub errado

Coberto em §2.1 — destino `/admin` vs esperado `/superadmin`.

### 3.3 🟡 CTA da landing: "Área do Cliente"

`src/app/page.tsx:87` — texto não é o esperado. "Área do Cliente" sugere
um portal de cliente externo; aqui é o **app do tenant** (dashboard do
usuário comum). Labels claros:
- "Entrar" / "Acessar dashboard" (para usuário comum)
- "Acesso administrador" (para super_admin, separado)

### 3.4 🟡 `/dashboard` vs `/dashboard/home` no sidebar

Sidebar aponta para `/dashboard/home`, mas `/dashboard` (sem `/home`) é um
redirect para escolher tenant ou ir pra home. Funciona, mas links
deveriam ser consistentes — sempre usar `/dashboard/home` (já é o caso).

---

## 4. Funcionalidades operacionais — gaps

Status legend: ✅ completa · 🟡 parcial · 🔴 stub/ausente

### 4.1 Auth do usuário

| Feature | Status | Onde / o que falta |
|---|---|---|
| Login (e-mail+senha) | ✅ | `src/app/login/page.tsx` |
| Login Google OAuth | ✅ | `/api/auth/google/start` + callback |
| Reset de senha | ✅ | forgot + reset pages |
| Logout (device atual) | ✅ | `POST /api/auth/logout` |
| **Cadastro público (signup)** | 🔴 | Não existe. Onboarding depende de superadmin criar via `POST /api/admin/users` |
| **Alterar senha logado** | 🔴 | `dashboard/settings/page.tsx` não tem campo de senha; `PATCH /api/context/profile` ignora |
| **Logout em todos os devices** | 🔴 | `invalidateAllSessionsForUser` existe no server mas não há rota nem botão |
| Editar perfil + avatar | ✅ | `dashboard/settings/page.tsx` + `tenant-assets` upload |

### 4.2 Tenant management (superadmin)

| Feature | Status | Notas |
|---|---|---|
| Listar tenants | ✅ | `/superadmin/tenants` |
| Criar tenant | ✅ | `POST /api/admin/tenants` |
| Editar tenant / ativar / desativar | ✅ | PATCH com `is_active` |
| Criar usuário | ✅ | `POST /api/admin/users` |
| Atribuir membership / role | ✅ | `POST /api/admin/memberships` |
| Listar membros do tenant | ✅ | `/superadmin/tenants/[id]` |
| **Remover membership / trocar role** | 🔴 | Rota `/api/admin/memberships/route.ts` só tem POST. UI não tem botão delete. |
| **Excluir tenant / excluir usuário** | 🔴 | Sem DELETE em `api/admin/tenants/[id]` nem `api/admin/users/[id]` |

### 4.3 Integrações

| Feature | Status | Notas |
|---|---|---|
| Listar integrações por tenant | ✅ | superadmin/integrations |
| CRUD Evolution | ✅ | new + edit + delete |
| CRUD UAZAPI | ✅ | new + edit + delete |
| Typebot | 🟡 | new + delete, **sem editar** (sem `typebot/[id]/edit/`) |
| **CRUD Chatwoot** | 🔴 | Schema OK, sem UI; provisionamento via SQL (ver `BASE2_CHATWOOT.md`) |
| **CRUD WhatsApp Cloud** | 🔴 | Idem Chatwoot |
| Reconectar WhatsApp via QR | ✅ | `dashboard/settings/whatsapp` |
| Sync Google Ads | 🟡 | depende `GOOGLE_ADS_CONNECT_ENABLED=true`; OAuth + sync OK quando ligado |
| Sync Meta Ads | 🟡 | idem flag |
| Sync Clarity | ✅ | `dashboard/clarity` |
| Status ao vivo da instância | ✅ | `/api/dashboard/integrations/messaging/[id]/status` |

### 4.4 Dashboard do tenant

| Feature | Status | Notas |
|---|---|---|
| Leads — listagem + busca | ✅ | `dashboard/leads` |
| Leads — kanban | ✅ | drag&drop + `<select>` acessível (2026-05) |
| Leads — editar | ✅ | `[id]/edit` |
| Leads — import/export CSV | ✅ | com cap `Content-Length` (2026-05) |
| **Leads — criar manualmente** | 🔴 | Sem botão "Novo lead"; só webhook/import |
| **Leads — excluir** | 🔴 | Sem DELETE em `api/dashboard/leads/[id]` |
| Oportunidades — listagem | 🟡 | sem "Nova oportunidade" no header |
| Oportunidades — editar | ✅ | `[id]/edit` |
| **Oportunidades — criar/excluir** | 🔴 | Sem POST/DELETE; só PATCH |
| Contatos — listagem | ✅ | read-only |
| Contatos — import/export | ✅ | CSV |
| **Contatos — criar/editar/excluir** | 🔴 | Página read-only; sem `[id]/edit` nem rota POST/DELETE |
| Conversas — listar + visualizar | ✅ | read-only (sem envio de mensagem do dashboard) |
| Funil — visualizar + configurar | ✅ | CRUD completo de funis |
| Produtos — CRUD | ✅ | `dashboard/products` |
| Notificações — listar + marcar como lidas | ✅ | `dashboard/notifications` (com skeleton+retry de 2026-05) |
| **Notificações — configurar regras** | 🔴 | Sem tela de config |

### 4.5 Vysen Copilot

| Feature | Status | Notas |
|---|---|---|
| Chat dashboard | ✅ | rate-limit 20/min + cap 4000 chars (2026-05) |
| Chat admin (analítico) | ✅ | `vysen-copilot-chat` |
| Knowledge base (admin) | ✅ | `admin-vysen-knowledge-manager` |
| **Histórico de conversas** | 🟡 | só `localStorage`; perde ao limpar cache / trocar device |
| Troca de área (contextArea) | ✅ | dropdown |

### 4.6 Settings do tenant

| Feature | Status | Notas |
|---|---|---|
| Dados básicos + timezone | ✅ | `PATCH /api/context/profile` |
| Avatar pessoal | ✅ | upload via `tenant-assets` |
| Logo + arquivos da empresa | ✅ | `company-files-section` |
| Auditoria (read) | ✅ | `audit-log-section` |
| **Configurar SMTP** | 🔴 | Não existe — SMTP global do env |
| **Configurar alertas / regras de notificação** | 🔴 | Não existe |
| Tema dark/light | ✅ | localStorage |

---

## 5. Recomendações ordenadas

### 5.1 Corrigir agora (low effort, high impact)

1. **`admin-login/page.tsx:55`**: trocar `router.push("/admin")` por
   `router.push("/superadmin")`.
2. **`login/page.tsx`**: após login, se `isSuperAdmin` e nenhum
   `?from=`, redirect para `/superadmin` (não `/dashboard`).
3. **`landing CTA`**: trocar "Área do Cliente" por "Entrar".
4. **Sanitização `from=`**: separar allowlist por origem (`/login` → só
   `/dashboard/*`; `/admin-login` → `/admin/*` + `/superadmin/*`).
5. **Tenant 0 memberships**: redirect explícito para `/forbidden` com
   mensagem "Aguardando convite" (em vez de loop pra `/dashboard/context`).

### 5.2 Próxima sprint de produto (médio esforço, alto valor)

6. **CRUD completo de contatos** no dashboard (criar/editar/excluir).
7. **Botão "Novo lead manual"** + DELETE de lead.
8. **Botão "Nova oportunidade"** + DELETE de oportunidade.
9. **DELETE/UPDATE de memberships** (UI + endpoint).
10. **Editar Typebot** (paridade com Evolution/UAZAPI).
11. **Logout em todos os devices** (endpoint + botão em settings).
12. **Alterar senha logado** (form em settings + PATCH em
    `/api/context/profile` ou nova rota).

### 5.3 Backlog (esforço maior)

13. **UI de cadastro de Chatwoot / WhatsApp Cloud** (paridade com Evolution).
14. **Cadastro público (signup)** — depende de decisão de produto sobre
    onboarding (invite-only vs self-serve).
15. **Histórico Vysen no servidor** (persistir threads + summaries em DB,
    não só localStorage).
16. **Config de SMTP por tenant** + tela de "alertas/regras de notificação".
17. **Excluir tenant / excluir usuário** (com cascade explícito e
    confirmação dupla).

### 5.4 Hardening (opcional, defesa em profundidade)

18. **Middleware com role check** leve via cookie (cache em memória do role
    por session token) — evita round-trip layout.
19. **Banner de boas-vindas** em `(company-admin)/admin` explicando que é
    o admin "da empresa" (carteira), não admin global.

---

## 6. Próximos passos

- Validar achados 5.1 (fixes pequenos) com produto.
- Decidir se 5.2 vira backlog de feature.
- Manter `docs/REVISAO_GERAL_2026-05.md` + `docs/REVISAO_FOLLOWUP_2026-05.md`
  + este audit como tripé canônico do estado 2026-05.
- Próxima auditoria de navegação: revisitar quando `(admin)` legado for
  retirado de fato e `(company-admin)`/`(superadmin)` ficarem
  definitivamente separados.

## Referências

- `src/app/(admin|superadmin|company-admin|dashboard)/`
- `src/middleware.ts`
- `src/app/api/auth/*`
- `src/app/login/page.tsx`, `admin-login/page.tsx`
- `docs/SUPERADMIN_AREA.md` (3-way diff atual)
- `docs/PLANO_EXECUCAO_UX_SUPERADMIN_ADMIN_DASHBOARD_2026-04.md` (plano de consolidação)
