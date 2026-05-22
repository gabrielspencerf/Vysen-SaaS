# Revisao Completa da Aplicacao (Marco 2026-03)

Documento consolidado da auditoria tecnica por eixo:

- UX e Front
- Banco
- Integracoes
- Seguranca
- Operacao e observabilidade

## 1) Resumo executivo

- O produto evoluiu bem em UX de onboarding e chat, mas ainda existe concentracao de complexidade no chat da Vysen.
- A camada de seguranca possui boas bases (RBAC, criptografia, validacao server-side), com dois pontos de atencao: rollout de RLS e CSRF em producao.
- Integracoes estao funcionais, mas a documentacao estava incompleta para Meta Ads, Clarity e Vysen Copilot.
- Copy PT-BR ainda apresentava inconsistencias de acentuacao e terminologia em fluxos recentes.

## 2) Matriz de achados por severidade

### Alta

- Chat da Vysen muito concentrado em um componente extenso, elevando risco de regressao em alteracoes pequenas.
- Overlays com camadas proximas (guia, drawer, chat), com potencial de sobreposicao confusa em mobile.

### Media

- Drawer mobile sem padrao completo de acessibilidade modal (foco inicial, ESC e retorno de foco).
- Guia de primeiro acesso sem semantica de dialogo.
- Middleware continha bloco de debug de runtime em producao.
- Mensagens de erro da API do chat retornavam detalhes internos em alguns cenarios.

### Baixa

- Inconsistencia de copy PT-BR (acentos e termos em fluxos de onboarding/chat).
- Mapa de endpoints de seguranca sem cobertura explicita de Meta, Clarity e Vysen.

## 3) Riscos residuais

- RLS ainda depende de rollout seguro por ambiente com validacao de consultas por tenant.
- CSRF precisa ser habilitado em producao com validacao dos fluxos de mutacao por cookie.
- Chat da Vysen segue com acoplamento elevado, mesmo com melhorias incrementais recentes.

## 4) Prioridades recomendadas (proxima iteracao)

1. Modularizar o chat da Vysen em blocos menores (shell, estado, voz, prompts, memoria).
2. Unificar contrato de overlays (z-index, acessibilidade, comportamento mobile).
3. Ligar `SECURITY_ENFORCE_RLS=true` e `SECURITY_ENFORCE_CSRF=true` por rollout controlado.
4. Manter governanca de copy com checklist PT-BR por PR.
5. Medir uso do Copilot por tenant (latencia, fallback, custo e taxa de sucesso).

## 5) Referencias de arquivos auditados

- `src/components/dashboard-vysen-chat-dock.tsx`
- `src/components/dashboard-first-access-guide.tsx`
- `src/components/mobile-sidebar-drawer.tsx`
- `src/server/vysen/copilot.ts`
- `src/app/api/dashboard/vysen/chat/route.ts`
- `src/app/api/admin/vysen/chat/route.ts`
- `src/middleware.ts`
- `src/server/db/access-context.ts`
- `src/db/migrations/0016_security_rls_tenant_policies.sql`
- `docs/GETTING_STARTED.md`
- `docs/CONFIG_CREDENTIALS.md`
- `docs/SECURITY_ENDPOINTS_MAP.md`
- `docs/RESUMO_PROJETO.md`
