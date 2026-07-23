# 📋 PIPELINE DE EXECUÇÃO OTIMIZADA (TOKEN-SAVING)

## 📌 DIRETRIZES GLOBAIS DE CONTEXTO (Zero Token Waste)
> **RESTRUTURAÇÃO DE CONTEXTO:** Proibido reescrever queries, regras de negócio ou lógica de dados existente durante refatorações visuais.
> **DESIGN TOKENS:** Dark Mode Nativo. Fontes: `DM Serif` (Títulos/Valores, peso controlado) | `Syne` (Labels/Textos). Paleta: `Ink`/`Gold` apenas em detalhes/border/ícones. Proibido layout Folio/Editorial.

---

## ⚡ FASE 1: ROLLBACK VISUAL E AJUSTE DE BASE
*Alvo: Sanar regressões estéticas e restaurar a integridade dos dados na UI.*
*Ferramenta: `uipro init --ai codex`*

- [ ] **M1.1 - Rollback Parcial de Estilo**
  - Executar rollback de estilo editorial em Dashboard/Relatórios.
  - Fix imediato de regressão de valores ($0,00 -> Dados Reais).
  - Garantir persistência de KPIs e Gráficos originais (sem conversão para listas).
- [ ] **M1.2 - Fix de Layout de Componentes Globais**
  - Travar Sidebar e Topbar (remover scroll horizontal/overflow).
  - Validar contraste Dark Mode (texto claro sobre fundo escuro).
  - Executar validação local: `npm run build && npm run test:cypress`.

---

## 🛠️ FASE 2: CORE B2B & SEGURANÇA (CONTAS FINANCEIRAS)
*Alvo: Infraestrutura, Banco de Dados, RLS e Tipagem.*
*Ferramenta: `codex exec`*

- [ ] **M2.1 - Estrutura de Dados & Multi-Tenant**
  - Criar/Validar `organization_id` / `entity_id` no Schema de Contas.
  - Aplicar Row Level Security (RLS) estrito no Supabase para isolamento de empresas.
- [ ] **M2.2 - RBAC & Controle de Acesso Server-Side**
  - Implementar Tipagem TS para Perfis: `Admin`, `Financeiro Sênior`, `Controller`, `Operador`, `Leitura`, `Auditor`.
  - Criar validação de rota e ações por role (ex: bloquear Sync para Leitura com Tooltip informativo).
- [ ] **M2.3 - Tabela de Auditoria (Logs)**
  - Estruturar tabela `financial_audit_logs`: `[user_id, action, target_account, old_value, new_value, ip_address, timestamp]`.
  - Trigger para registrar eventos automáticos (CRUD, Sync Error, CSV Import).

---

## 🎨 FASE 3: DASHBOARD DE TESOURARIA B2B
*Alvo: UI Corporativa de Alta Densidade e Fluxos Operacionais.*
*Ferramenta: `ui-ux-pro-max-skill`*

- [ ] **M3.1 - Cabeçalho Corporativo & Contexto**
  - Banner Superior: Razão Social, CNPJ, Seletor de Entidade Jurídica, Badge de Permissão do Usuário.
- [ ] **M3.2 - Cards de Saúde Financeira (KPIs do Topo)**
  - Renderizar: Saldo Consolidado, Disponível, A Compensar, % Sincronização, Alertas e Data Quality Score (Meta: 82%).
- [ ] **M3.3 - Abas com Badges Contadores**
  - Implementar abas: Contas (N), Cartões (N), Entidades (N), Integrações (N), Auditoria (N), Pendências (N).
- [ ] **M3.4 - Tabela Avançada de Contas**
  - Exibir: Nome (Destaque), Agência/Conta (Mono), CNPJ/Pix (Auxiliar), Status (Badge), Coluna Sincronização (Timestamp + Origem + Ação de Erro).
- [ ] **M3.5 - Action Bar & Processamento em Lote (Bulk)**
  - Botões de lote: Ativar/Desativar, Forçar Sync, Exportar. Fluxo CSV: Upload, Preview, Mapeamento e Rollback pré-confirmação.

---

## 🔮 FASE 4: INTELLIGENCE ENGINE (WISHLIST PREDITIVA)
*Alvo: Algoritmo de Custo de Oportunidade e Simulação.*
*Ferramenta: `codex exec` + `ui-ux-pro-max-skill`*

- [ ] **M4.1 - Motor de Cálculo e Scores**
  - Implementar processamento do Score de Prioridade ($S_{prior}$):
    $$priorityScore = (S_{need} \cdot 0.3) + (S_{urg} \cdot 0.2) + (S_{prac} \cdot 0.2) + (S_{fin} \cdot 0.15) + (S_{risk} \cdot 0.1) + (S_{pref} \cdot 0.05)$$
  - Injetar variáveis de input do caixa: Saldo Livre, Capacidade de Poupança, Comprometimento de Receita e Reserva Mínima.
- [ ] **M4.2 - Simulador de Impacto e Custo de Oportunidade**
  - Calcular impacto cruzado: Comprar Item A atrasa Item B em $X$ dias com base na capacidade de poupança atual.
  - Gerar output textual com tom de analista financeiro corporativo ("Comprar agora", "Adiar", "Baixo impacto, alto custo de oportunidade").
- [ ] **M4.3 - Interface da Fila de Decisão**
  - Grid de Ranking Recomendado de Compra com Alertas de Impacto Orçamentário.
  - Componente de interação: Botões "Simular Compra" e "Comparar com Outro Item".
  - Log de Histórico de Simulações para análise pós-fechamento do mês.

---

## 🧪 FASE 5: VALIDATION & COMPLIANCE
*Alvo: Garantia de entrega sem vazamento de dados ou quebras de layout.*
*Ferramenta: `codex exec`*

- [ ] **M5.1 - Testes Automatizados**
  - Escrever/Rodar testes unitários para o motor matemático da Wishlist.
  - Validar isolamento RLS multi-entidade.
  - Executar suíte completa Cypress Responsivo.