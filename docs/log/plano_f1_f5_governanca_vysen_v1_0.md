# Vysen / Observabilidade SaaS  
## Plano de Implantação F1→F5  
### Governança, Confiabilidade e Adoção Spec-Anchored  
**Versão:** 1.0  
**Data:** 15/04/2026

---

## 1. Resumo executivo

Este plano organiza os próximos passos do projeto sem reescrever a base existente e sem introduzir burocracia desnecessária. A leitura consolidada do repositório, da documentação e da auditoria feita no ambiente local aponta que o sistema já possui arquitetura suficiente para evoluir com disciplina, mas ainda precisa endurecer confiabilidade estrutural, autoridade documental e fronteiras críticas.

A ordem correta é: primeiro reduzir ambiguidade e risco operacional; depois aumentar velocidade com trilho. Em termos práticos, isso significa:

- **não** iniciar refactor amplo agora;
- **não** tentar “retrofitar SDD” no passado inteiro;
- **não** trocar stack por pureza metodológica;
- **sim** canonizar documentação;
- **sim** criar harness mínimo de confiança;
- **sim** fechar as fronteiras de tenant, auth/RBAC, integrações/workers e Vysen;
- **sim** adotar `spec/plan/validation` apenas para mudanças novas e relevantes;
- **sim** fazer refactor cirúrgico apenas onde o risco já foi comprovado.

---

## 2. Diagnóstico consolidado

### 2.1 O que já está bom e não deve ser quebrado
- Separação real entre `src/app`, `src/server`, `src/db`, `src/workers`, `docs` e `scripts`.
- Sessão opaca server-side e contexto tenant resolvido no backend.
- RBAC funcional e distinção entre áreas de dashboard e admin.
- Worker operacional cobrindo ingestão, sync, IA e follow-up.
- Base de segurança já preparada em camadas, com rollout controlado.
- Documentação forte o suficiente para servir de base a uma constitution enxuta.

### 2.2 Gaps prioritários
- **RLS e isolamento forte** ainda dependem de flag e de rollout cuidadoso nos workers.
- **Fila atual** possui risco de perda em crash por semântica de consumo/remoção.
- **CI** ainda não impõe gates mínimos de qualidade.
- **Testes automatizados** estão ausentes no núcleo mais sensível.
- **Drift documental** ainda existe em filas, migrações e regra de exposição de admin.
- **Observabilidade** existe, mas com fontes parcialmente inconsistentes.
- **processing_failures** aparenta estar subutilizado na prática.

### 2.3 Tese operacional aprovada
O projeto deve seguir um modelo de **governança incremental spec-anchored**, com esta prioridade:

1. Canonização documental  
2. Harness mínimo de confiança  
3. Travamento de fronteiras críticas  
4. Processo leve para mudanças novas  
5. Refactor cirúrgico apenas em hotspots comprovados

---

## 3. Princípios do plano

1. **O repositório atual é a fonte primária de verdade.**
2. **Não reescrever o passado como se tivesse nascido em SDD.**
3. **Confiabilidade vem antes de velocidade.**
4. **Toda mudança com alto blast radius precisa de validação explícita.**
5. **Spec-driven daqui para frente; não fanfic retroativa.**
6. **Não trocar tecnologia só para parecer mais “correto”.**
7. **Toda melhoria precisa reduzir risco, ambiguidade ou retrabalho.**

---

## 4. Visão geral das fases

| Fase | Nome | Objetivo principal | Horizonte | Nível |
|---|---|---|---|---|
| F1 | Canonização documental | Eliminar drift semântico e definir autoridade dos documentos | Imediato | Obrigatório |
| F2 | Harness mínimo | Impor gates básicos de qualidade e smoke tests do core | Imediato | Obrigatório |
| F3 | Fronteiras críticas | Endurecer tenant/auth/integrations/worker/Vysen com invariantes e rollout seguro | Curto prazo | Obrigatório |
| F4 | Processo spec-anchored | Padronizar mudanças novas com `spec`, `plan`, `validation` e `ADR` quando necessário | Curto prazo | Recomendado |
| F5 | Refactor cirúrgico | Atacar hotspots comprovados sem reescrever o projeto | Contínuo | Recomendado |

---

## 5. F1 — Canonização documental

### Objetivo
Definir qual documento manda em quê, corrigir contradições objetivas e criar uma base estável para revisão humana e análise por IA.

### Escopo
- Definir classes documentais: **foundation**, **constitution**, **operations**, **history**.
- Atualizar docs que hoje contradizem o runtime real.
- Alinhar `README`, `docs/` e `.cursor/rules`.

### Ações
- Confirmar `README.md` como visão curta do produto e onboarding.
- Confirmar `docs/PADRAO_DESENVOLVIMENTO.md` como **constitution v0**.
- Confirmar `docs/RESUMO_PROJETO.md` como foundation do sistema.
- Confirmar `CHANGELOG.md`, revisões e rollout docs como histórico operacional.
- Corrigir imediatamente:
  - menções a **BullMQ** se o runtime real usa fila Redis manual;
  - revisão de migrações parada em estado anterior;
  - regra de link admin/dashboard caso a decisão de produto atual seja outra.
- Criar uma **matriz de autoridade documental** simples dentro de `docs/`.

### Entregáveis
- Matriz de autoridade documental aprovada.
- Docs alinhadas ao runtime real em filas, migrações e regra de admin/dashboard.
- `.cursor/rules` coerente com a regra documental vigente.

### Critérios de aceite
- Nenhum documento canônico contradiz o comportamento real conhecido.
- Existe uma definição explícita de quais docs são normativas vs históricas.
- O time consegue responder “onde procuro a verdade sobre X?” sem ambiguidade.

### Não fazer agora
- Não mover todo o histórico de pastas.
- Não renomear metade dos arquivos só para “organizar”.
- Não transformar toda doc antiga em spec.

---

## 6. F2 — Harness mínimo de confiança

### Objetivo
Criar o menor conjunto possível de validações automáticas para impedir regressão estrutural óbvia.

### Escopo
- CI com `lint`, `typecheck` e `build`.
- Smoke tests dos fluxos com maior blast radius.
- Validação de ambiente crítico e sanity check de migrations.

### Ações
- Adicionar jobs de CI para:
  - `lint`
  - `typecheck`
  - `build`
- Adicionar smoke tests mínimos para:
  - autenticação;
  - resolução/troca de tenant;
  - boundary dashboard/admin;
  - ingestão de webhook;
  - heartbeat/readiness do worker.
- Padronizar scripts de execução local e CI.
- Validar presença e coerência de variáveis críticas de ambiente.
- Criar um check básico para estado de migrations.

### Entregáveis
- Pipeline de CI falha quando `lint`, `typecheck` ou `build` falharem.
- Smoke tests executáveis localmente e no CI.
- Checklist de ambiente crítico.

### Critérios de aceite
- Nenhuma mudança importante entra sem passar nesses gates.
- É possível validar rapidamente se auth/tenant/worker continuam íntegros.
- O time deixa de depender só de fluxo manual.

### Não fazer agora
- Não tentar cobrir tudo com testes.
- Não introduzir framework de teste gigante sem necessidade.
- Não adiar o CI esperando “a suíte perfeita”.

---

## 7. F3 — Fronteiras críticas

### Objetivo
Reduzir o risco sistêmico nos eixos que mais espalham dano quando erram.

### Fronteiras a endurecer
1. **Tenant context**
2. **Auth / sessão / RBAC**
3. **Integrações / webhooks / worker**
4. **Vysen / IA / telemetria / fallback**
5. **Segurança / PII / auditoria**

### Ações
- Formalizar invariantes por fronteira em checklist executável.
- Garantir que tenant continue vindo do backend/contexto de sessão.
- Validar boundaries entre dashboard e admin.
- Definir estratégia de rollout de **RLS end-to-end**, incluindo workers.
- Revisar fluxo de webhooks, idempotência, reprocessamento e visibilidade de falha.
- Garantir que Vysen tenha:
  - telemetria mínima;
  - timeout e fallback definidos;
  - isolamento por tenant;
  - trilha de auditoria suficiente.
- Unificar fontes de métricas operacionais quando houver duplicidade/inconsistência.

### Entregáveis
- Checklist de invariantes críticas.
- Plano de rollout seguro de RLS em staging e produção.
- Validação das regras de auth, tenant e integrações.
- Definição clara da telemetria mínima do Vysen.

### Critérios de aceite
- Nenhuma mudança de alta sensibilidade passa sem checar essas fronteiras.
- Existe plano seguro para ativar ou expandir enforcement de RLS.
- Observabilidade e falha operacional deixam de ter leituras contraditórias.

### Não fazer agora
- Não tentar resolver toda segurança do sistema de uma vez.
- Não abrir refactor amplo do worker antes de ter harness.
- Não migrar fila por impulso.

---

## 8. F4 — Processo leve spec-anchored

### Objetivo
Evitar novo drift nas mudanças futuras sem burocratizar ajustes pequenos.

### Regra de uso
- **Mudança pequena:** issue/checklist simples.
- **Mudança média:** `spec.md` + `plan.md` + `validation.md`.
- **Mudança grande ou arriscada:** `spec.md` + `plan.md` + `tasks.md` + `validation.md` + `ADR` quando necessário.

### Ações
- Criar templates curtos para:
  - `spec.md`
  - `plan.md`
  - `validation.md`
  - `adr.md`
- Definir gatilho de uso por porte/risco da mudança.
- Adicionar checklist de PR/revisão com foco em:
  - tenant
  - auth/RBAC
  - worker/integration
  - Vysen
  - segurança
- Adaptar o uso do Cursor para operar com:
  - contexto explícito;
  - escopo autorizado de arquivos;
  - proibições claras;
  - validação pós-diff.

### Entregáveis
- Templates publicados em `docs/`.
- Regra simples de quando usar cada artefato.
- Primeiro piloto usando o fluxo novo.

### Critérios de aceite
- Mudanças médias/grandes passam a nascer com intenção e validação explícitas.
- O time não precisa “adivinhar” se uma mudança exige spec.
- O processo não atrasa ajustes pequenos.

### Não fazer agora
- Não exigir spec para tudo.
- Não criar ritual pesado demais.
- Não tentar encaixar toda a história antiga no fluxo novo.

---

## 9. F5 — Refactor cirúrgico em hotspots

### Objetivo
Endurecer os pontos já comprovados como frágeis, sem reescrever o sistema inteiro.

### Hotspots prioritários
1. **Fila e retry**
   - reduzir risco de perda em crash;
   - melhorar recovery/requeue auditável;
   - decidir com dados se a fila atual continua suficiente.
2. **Observabilidade operacional**
   - consolidar métricas de worker/pipeline;
   - evitar leituras parciais;
   - dar destino útil a `processing_failures`.
3. **Vysen**
   - reduzir concentração excessiva de complexidade;
   - reforçar fallback, timeout, rastreio e custos;
   - organizar melhor as fronteiras com integrações e telemetria.

### Ações
- Só iniciar depois de F2 e F3 em nível aceitável.
- Priorizar refactor por risco real, não por gosto.
- Executar em lotes pequenos e verificáveis.

### Entregáveis
- Melhorias locais em hotspots com risco e retorno claros.
- Semântica de falha/reprocessamento mais robusta.
- Observabilidade operacional mais consistente.

### Critérios de aceite
- Cada refactor reduz risco ou custo operacional de forma mensurável.
- Nenhuma melhoria exige reescrever metade do sistema.
- O projeto termina mais previsível, não só mais “bonito”.

### Não fazer agora
- Não migrar para DDD por decreto.
- Não reestruturar toda a árvore `src/`.
- Não trocar stack por estética arquitetural.

---

## 10. Ordem prática sugerida

### Agora
- F1 completo
- F2 base de CI
- smoke tests mínimos

### Em seguida
- F3 com foco em tenant/auth/RLS/workers
- alinhamento operacional de observabilidade

### Depois
- F4 em mudanças novas
- piloto controlado de spec-anchored

### Contínuo
- F5 só em hotspots comprovados

---

## 11. O que não mexer agora

- Não reescrever a arquitetura atual.
- Não desmontar a separação dashboard/admin.
- Não forçar `src/domain` a virar centro do projeto antes da hora.
- Não trocar a stack de fila só por “pureza”.
- Não abrir refactor transversal de UI + server + worker ao mesmo tempo.
- Não usar IA como justificativa para pular validação.

---

## 12. Definição de pronto por fase

### F1 pronto quando
- docs canônicas estão explicitamente classificadas;
- contradições centrais foram corrigidas;
- `.cursor/rules` e docs normativas estão alinhadas.

### F2 pronto quando
- CI falha em regressão estrutural básica;
- smoke tests do core existem e rodam;
- ambiente crítico deixa de depender só de memória humana.

### F3 pronto quando
- tenant/auth/integration/Vysen têm invariantes explícitas;
- rollout de RLS está desenhado e validável;
- métricas operacionais críticas não se contradizem.

### F4 pronto quando
- há templates curtos no repositório;
- o time sabe quando usar cada um;
- pelo menos uma mudança relevante já passou por esse fluxo.

### F5 pronto quando
- os hotspots escolhidos foram tratados com ganho real;
- sem reescrita ampla;
- com menos risco operacional e mais previsibilidade.

---

## 13. Encerramento

Este plano assume uma postura deliberadamente pragmática: **preservar a base boa, corrigir as fragilidades reais e institucionalizar disciplina sem matar a velocidade**.

A ordem é parte do plano. Trocar a ordem destrói o benefício.

Se a execução seguir essa sequência, o projeto ganha:
- menos drift;
- mais previsibilidade;
- melhor uso do Cursor e da IA;
- mais segurança para crescer;
- menos chance de refactor caro por ansiedade metodológica.
