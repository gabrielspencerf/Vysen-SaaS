# Plano: Leads, Contatos, Oportunidades e funcionalidades relacionadas

Documento de referência para as funcionalidades solicitadas. Implementação em fases.

---

## 1. Modelo de dados: Contatos e Oportunidades

### Regras de negócio
- **Conversa** pode gerar um **novo contato** (quando não houver lead correspondente pelo número/email).
- Se o **contato** bater com um **lead** (mesmo telefone/email normalizado), é criada uma **nova oportunidade** (vínculo lead + contato + conversa).
- Pode existir **mais de uma oportunidade** com o mesmo contato ou mesmo lead (várias conversas/negócios).

### Entidades
| Entidade      | Descrição |
|---------------|-----------|
| **Lead**      | Já existe. Captado por formulário/Typebot/Evolution etc.; status (new, contacted, qualified, converted, lost, duplicate, bad_lead). |
| **Contato**   | Novo. Pessoa identificada por telefone/email (ex.: participante de conversa WhatsApp). Pode ser criado a partir de conversa ou importação manual. |
| **Oportunidade** | Novo. Vínculo entre lead e/ou contato com uma conversa ou “negócio”. Um lead/contato pode ter várias oportunidades (várias conversas, reabordagens). |

### Tabelas (resumo)
- **contacts** — tenant_id, name, email, phone, normalized_email, normalized_phone, source (conversation | manual | import), conversation_id (opcional), created_at, updated_at.
- **opportunities** — tenant_id, lead_id (opcional), contact_id (opcional), conversation_id (opcional), stage/status (ex.: qualificado, ganho, perdido), created_at, updated_at. Pelo menos um de lead_id ou contact_id; conversation_id opcional.

### Fluxo
1. Chega mensagem (Evolution/UAZAPI) → conversa criada com `external_id` (ex.: número WhatsApp).
2. Worker ou job: para a conversa, buscar contato por telefone normalizado (ou criar novo contato a partir do número).
3. Buscar lead com mesmo telefone/email normalizado. Se existir: criar oportunidade (lead_id + contact_id + conversation_id). Se não existir: apenas contato (e opcionalmente criar lead depois).
4. UI: aba **Contatos** (lista contatos); na conversa, mostrar contato vinculado e oportunidades; no lead, mostrar oportunidades e contatos vinculados.

---

## 2. Importação e exportação de planilhas (leads/contatos)

- **Exportar:** botão “Exportar” em Leads e em Contatos → gera CSV/Excel com colunas padrão (nome, e-mail, telefone, status, origem, datas, etc.).
- **Importar:** botão “Importar” → upload de arquivo (CSV/Excel); validação de colunas; criação/atualização de leads ou contatos conforme mapeamento.
- **Modelo padrão:** disponibilizar arquivo de exemplo (template) para download (ex.: `modelo-leads.csv`, `modelo-contatos.csv`) com cabeçalhos e uma linha de exemplo, e documentação em ajuda ou tooltip.

---

## 3. Google Ads — sub-sessão “Planilha offline” (leads qualificados)

- Dentro de **Dashboard → Google Ads**, criar sub-sessão (aba ou seção) para **upload de leads para o Google Ads** como conversões offline / leads qualificados.
- Google fornece formato específico (ex.: CSV com colunas como Email, Phone, Conversion Name, Conversion Time, Value). Objetivo: permitir exportar ou preencher planilha no formato esperado pelo Google e orientar o usuário a usar no Google Ads (ou, em versão futura, integrar via API de offline conversions).
- Incluir link/documento para o modelo oficial do Google quando aplicável.

---

## 4. Kanban de status dos leads

- Nova visualização (aba ou página) em **Leads**: **Kanban** com colunas por status (Novo, Contactado, Qualificado, Convertido, Perdido, Duplicado, Lead ruim).
- Cards por lead; arrastar e soltar para alterar status (persistir no backend).
- Filros opcionais (origem, período, funil) para refinar o quadro.

---

## 5. Calendário visual na dashboard

- **Calendário visual** na dashboard (home ou página dedicada): eventos, reuniões, tarefas ou “próximos passos” vinculados a leads/oportunidades (quando houver tabela de atividades).
- Todas as **visualizações de calendário** do app devem seguir o mesmo padrão de UX (componente de calendário único, acessível, responsivo).

---

## 6. Configuração do perfil mais completa

- **Perfil do usuário:** além de nome e e-mail, incluir: telefone, cargo/função, foto (avatar), fuso horário, e **dados da empresa** (nome da empresa, site, telefone, endereço, etc.) quando for o contexto do tenant ou do usuário logado.
- Tela **Configurações** (ou **Perfil**) com abas ou seções: Dados pessoais, Empresa, Aparência (já existe tema claro/escuro), Notificações (futuro).

---

## Ordem sugerida de implementação

1. **Modelo de dados** — contacts, opportunities; migração; ajustes em conversations (contact_id).
2. **Perfil completo** — tabela/campos de perfil (user + empresa); API; tela Configurações.
3. **Import/Export** — API e UI para leads (e depois contatos); templates de exemplo.
4. **Kanban de leads** — página/componente Kanban; API PATCH para status.
5. **Calendário** — componente de calendário; página na dashboard; UX unificada.
6. **Google Ads planilha offline** — sub-sessão; modelo e instruções.
7. **Lógica conversa → contato → oportunidade** — worker ou job que cria contato e, se houver match com lead, cria oportunidade.

Este documento será atualizado conforme as fases forem concluídas.
