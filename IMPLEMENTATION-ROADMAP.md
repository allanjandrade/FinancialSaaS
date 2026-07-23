# 🚀 Roadmap de Implementação - Controle Financeiro v2

**Objetivo**: Transformar o app de Vanilla JS + CSS puro para uma arquitetura escalável, segura e com UX profissional.

**Status Atual**:
- ✅ Segurança: Gemini API key já removida do front-end
- ✅ CSS: `overflow-x: hidden` já implementado
- 🔴 Menu: Ainda há problemas com a navegação inferior
- 🔴 UX: Falta Skeleton Screens e feedback visual de carregamento

---

## 📋 Fase 1: Blindagem e Limpeza (Semana 1)

### 1.1 Segurança - Edge Function para IA ⚠️ CRÍTICO

**Problema Atual**:
- Gemini API key pode estar exposta
- Chamadas diretas ao Gemini são vulneráveis

**Solução**:
```bash
# Criar uma Edge Function no Supabase
supabase functions new ai-assistant --typescript
```

**Arquivo a Criar**: `supabase/functions/ai-assistant/index.ts`
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

Deno.serve(async (req) => {
  const { messages, conversationId } = await req.json();

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: "Você é um assistente financeiro experiente. Ajude o usuário com análises financeiras.",
    messages: messages,
  });

  return new Response(
    JSON.stringify({
      conversationId,
      response: response.content[0].type === "text" ? response.content[0].text : "",
      timestamp: new Date(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

**Mudança no Front-end** (`ai-conversations.js`):
```javascript
// ANTES (inseguro):
// const response = await fetch('https://api.anthropic.com/...');

// DEPOIS (seguro via Edge Function):
async sendMessage(userMessage, conversationId) {
  const response = await window.supabase.functions.invoke('ai-assistant', {
    body: {
      messages: this.messages,
      conversationId: conversationId,
    }
  });

  return response.data.response;
}
```

**Checklist**:
- [ ] Criar Edge Function no Supabase
- [ ] Adicionar chave Anthropic/OpenAI em `.env.local` (Supabase Secrets)
- [ ] Testar chamadas via `supabase.functions.invoke()`
- [ ] Remover qualquer referência a chaves de API do `index.html`

---

### 1.2 Layout - Eliminar Seta de Rolagem Horizontal

**Problema**: Elemento com `overflow-x: auto` causando seta de scroll

**Status**: ✅ Já parcialmente resolvido (`overflow-x: hidden` está em `styles.css`)

**Verificação Necessária**:
```css
/* Confirmar em styles.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  overflow-x: hidden; /* ✅ Já está */
}

/* Procurar por qualquer container com overflow-x: auto */
/* Se encontrado, substituir por overflow-x: hidden */
```

**Checklist**:
- [ ] Audit CSS: Procurar por `overflow-x: auto` e remover
- [ ] Testar em mobile: Não deve haver seta de rolagem

---

### 1.3 UX - Remover Menu Inferior Quebrado

**Problema Atual**:
- Menu inferior tem conflito de layout
- "Início" aparece duplicado

**Solução Proposta**:

**Opção A (Recomendada para Vanilla JS)**: Mobile Drawer (Gaveta Lateral)

```html
<!-- Adicionar em index.html -->
<div id="mobileDrawer" class="mobile-drawer" aria-hidden="true">
  <nav class="drawer-nav" aria-label="Navegação Móvel">
    <button class="drawer-item is-active" data-view="home">
      <i data-lucide="home"></i>
      <span>Início</span>
    </button>
    <button class="drawer-item" data-view="entries">
      <i data-lucide="dollar-sign"></i>
      <span>Lançar</span>
    </button>
    <button class="drawer-item" data-view="dashboard">
      <i data-lucide="bar-chart-3"></i>
      <span>Dashboard</span>
    </button>
    <button class="drawer-item" data-view="card">
      <i data-lucide="credit-card"></i>
      <span>Cartão</span>
    </button>
    <button class="drawer-item" data-view="benefit">
      <i data-lucide="utensils"></i>
      <span>Vale</span>
    </button>
    <button class="drawer-item" data-view="ai">
      <i data-lucide="bot"></i>
      <span>Assistente IA</span>
    </button>
    <hr class="drawer-divider">
    <button class="drawer-item" data-view="settings">
      <i data-lucide="settings"></i>
      <span>Configurações</span>
    </button>
    <button class="drawer-item logout" id="logoutButton">
      <i data-lucide="log-out"></i>
      <span>Sair</span>
    </button>
  </nav>
</div>

<!-- Overlay para fechar drawer ao clicar -->
<div id="drawerOverlay" class="drawer-overlay" aria-hidden="true"></div>
```

**CSS para Drawer** (`styles.css`):
```css
/* Mobile Drawer */
.mobile-drawer {
  position: fixed;
  left: -100%;
  top: 0;
  width: 70%;
  max-width: 300px;
  height: 100vh;
  background: var(--canvas);
  border-right: 1px solid var(--line);
  z-index: 999;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
}

.mobile-drawer.is-open {
  left: 0;
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 0;
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.drawer-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--ink);
}

.drawer-item.is-active {
  background: rgba(20, 184, 166, 0.1);
  border-left-color: var(--teal);
  color: var(--teal);
}

.drawer-divider {
  border: none;
  border-top: 1px solid var(--line);
  margin: 0.5rem 0;
}

.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.drawer-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* Botão Hambúrguer (mobile) */
.mobile-menu-button {
  display: none;
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: var(--ink);
  cursor: pointer;
  padding: 0.5rem;
  z-index: 1001;
}

@media (max-width: 768px) {
  .mobile-menu-button {
    display: block;
  }

  .app-shell {
    flex-direction: column;
  }

  .sidebar {
    display: none; /* Hide sidebar, use drawer instead */
  }
}
```

**JavaScript para Controlar Drawer** (`app.js`):
```javascript
// Adicionar ao initializeUI()
function initializeDrawer() {
  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  const mobileDrawer = document.querySelector("#mobileDrawer");
  const drawerOverlay = document.querySelector("#drawerOverlay");
  const drawerItems = mobileDrawer.querySelectorAll(".drawer-item");

  // Abrir drawer
  mobileMenuButton?.addEventListener("click", () => {
    mobileDrawer.classList.add("is-open");
    drawerOverlay.classList.add("is-open");
  });

  // Fechar drawer ao clicar no overlay
  drawerOverlay?.addEventListener("click", () => {
    mobileDrawer.classList.remove("is-open");
    drawerOverlay.classList.remove("is-open");
  });

  // Fechar drawer ao selecionar item
  drawerItems.forEach(item => {
    item.addEventListener("click", () => {
      mobileDrawer.classList.remove("is-open");
      drawerOverlay.classList.remove("is-open");
    });
  });
}

// Chamar após DOM estar pronto
document.addEventListener("DOMContentLoaded", initializeDrawer);
```

**Checklist**:
- [ ] Adicionar HTML do drawer em `index.html`
- [ ] Adicionar CSS do drawer em `styles.css`
- [ ] Implementar função `initializeDrawer()` em `app.js`
- [ ] Remover referências ao menu inferior antigo
- [ ] Testar em mobile: Hambúrguer deve abrir/fechar drawer

---

## 🎯 Fase 2: Organização de Fluxo (Semana 2)

### 2.1 UI/UX - Configurações com Tabs (Abas)

**Problema**: Página de configurações muito densa

**Solução**: Dividir em 3 abas
1. **Perfil** - Dados do usuário, visibilidade de saldo
2. **Família** - Membros, permissões, adicionar pessoas
3. **Documentação** - Links, guias, suporte

**HTML** (`index.html` - seção de configurações):
```html
<section id="settingsView" class="view hidden">
  <div class="settings-tabs">
    <button class="tab-button is-active" data-tab="profile">
      <i data-lucide="user"></i>
      <span>Perfil</span>
    </button>
    <button class="tab-button" data-tab="family">
      <i data-lucide="users"></i>
      <span>Família</span>
    </button>
    <button class="tab-button" data-tab="docs">
      <i data-lucide="book-open"></i>
      <span>Documentação</span>
    </button>
  </div>

  <!-- Tab: Perfil -->
  <div class="tab-content is-active" data-tab="profile">
    <h3>Configurações de Perfil</h3>
    <div class="settings-group">
      <label>
        <input type="checkbox" id="hideBalanceCheck" />
        Ocultar saldo na tela inicial
      </label>
      <p class="help-text">Seu saldo fica oculto até você clicar no olho</p>
    </div>
  </div>

  <!-- Tab: Família -->
  <div class="tab-content" data-tab="family">
    <h3>Gerenciar Família</h3>
    <div id="familyMembersList"></div>
    <button id="addFamilyMemberBtn" class="btn btn-primary">
      <i data-lucide="user-plus"></i> Adicionar Membro
    </button>
  </div>

  <!-- Tab: Documentação -->
  <div class="tab-content" data-tab="docs">
    <h3>Documentação e Suporte</h3>
    <ul class="docs-links">
      <li><a href="#" target="_blank">Como usar o Dashboard</a></li>
      <li><a href="#" target="_blank">Sincronização em Tempo Real</a></li>
      <li><a href="#" target="_blank">Privacidade e Segurança</a></li>
    </ul>
  </div>
</section>
```

**CSS para Tabs** (`styles.css`):
```css
.settings-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--line);
  margin-bottom: 2rem;
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--ink);
}

.tab-button.is-active {
  color: var(--teal);
  border-bottom-color: var(--teal);
}

.tab-content {
  display: none;
}

.tab-content.is-active {
  display: block;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.settings-group {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
}

.help-text {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 0.5rem;
}
```

**JavaScript para Tabs** (`app.js`):
```javascript
function initializeSettingsTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      // Remove active de todos
      tabButtons.forEach(b => b.classList.remove("is-active"));
      tabContents.forEach(c => c.classList.remove("is-active"));

      // Ativa selecionado
      button.classList.add("is-active");
      document.querySelector(`[data-tab="${tabName}"].tab-content`)
        ?.classList.add("is-active");
    });
  });
}
```

**Checklist**:
- [ ] Criar HTML das 3 abas em `index.html`
- [ ] Adicionar CSS em `styles.css`
- [ ] Implementar `initializeSettingsTabs()` em `app.js`
- [ ] Testar navegação entre abas

---

### 2.2 UX - Skeleton Screens (Loaders Profissionais)

**Problema**: Textos como "Carregando informações..." parecem amadores

**Solução**: Skeleton Screens com animação

**HTML** (`index.html`):
```html
<!-- Template para skeleton -->
<template id="skeletonTemplate">
  <div class="skeleton">
    <div class="skeleton-line"></div>
  </div>
</template>

<!-- Exemplo: Skeleton para lista de transações -->
<div id="recentList" class="recent-list">
  <!-- Será preenchido pelo JS -->
</div>
```

**CSS para Skeleton Screens** (`styles.css`):
```css
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.skeleton-line {
  height: 1rem;
  background: linear-gradient(
    90deg,
    var(--line) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    var(--line) 75%
  );
  background-size: 200% 100%;
  border-radius: 0.25rem;
  animation: shimmer 2s infinite;
}

.skeleton-line.wide {
  width: 100%;
}

.skeleton-line.narrow {
  width: 60%;
}

.skeleton-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
}

.skeleton-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    var(--line) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    var(--line) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

**JavaScript para Skeleton Loader** (`app.js`):
```javascript
function createSkeletonLoader(count = 3) {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-item";
    skeleton.innerHTML = `
      <div class="skeleton-avatar"></div>
      <div class="skeleton" style="flex: 1;">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line narrow"></div>
      </div>
    `;
    fragment.appendChild(skeleton);
  }

  return fragment;
}

// Uso ao carregar dados
async function loadRecentTransactions() {
  const container = document.querySelector("#recentList");

  // Mostrar skeleton
  container.innerHTML = "";
  container.appendChild(createSkeletonLoader(5));

  try {
    // Carregar dados
    const data = await supabase
      .from("transactions")
      .select()
      .order("date", { ascending: false })
      .limit(10);

    // Renderizar dados
    container.innerHTML = "";
    data.data.forEach(transaction => {
      container.appendChild(createTransactionElement(transaction));
    });
  } catch (error) {
    container.innerHTML = `<p class="error">Erro ao carregar: ${error.message}</p>`;
  }
}
```

**Checklist**:
- [ ] Adicionar CSS de skeleton em `styles.css`
- [ ] Criar função `createSkeletonLoader()` em `app.js`
- [ ] Substituir todos os "Carregando..." por skeleton screens
- [ ] Testar animação em diferentes velocidades de conexão

---

### 2.3 Limpeza - Remover "Início" Duplicado

**Problema**: Menu mostra "Início" duas vezes

**Solução**: Verificar `index.html` e remover duplicata

```html
<!-- VERIFICAR E REMOVER DUPLICATAS EM index.html -->
<!-- ANTES (ERRADO): -->
<nav class="nav">
  <button class="nav-item is-active" data-view="home">Início</button>
  <button class="nav-item is-active" data-view="home">Início</button>  <!-- ❌ Remover -->
</nav>

<!-- DEPOIS (CORRETO): -->
<nav class="nav">
  <button class="nav-item is-active" data-view="home">Início</button>
</nav>
```

**Checklist**:
- [ ] Audit `index.html`: Procurar por `data-view="home"` duplicado
- [ ] Remover linhas duplicadas
- [ ] Testar que botão "Início" aparece apenas uma vez

---

## 🚀 Fase 3: Escala (Futuro Próximo)

### 3.1 Arquitetura - Design Tokens e Tailwind CSS (Opcional, Futuro)

**Por que**: CSS atual é difícil de manter, inconsistências visuais

**Quando**: Após Fases 1 e 2 estarem estáveis

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Estrutura Proposta**:
```
src/
  styles/
    tokens.css       # Variáveis globais
    components/      # Componentes reutilizáveis
    utilities/       # Classes utilitárias
```

---

### 3.2 Framework - Migração para Vue.js (Futuro)

**Por que**: Eliminar "código espaguete" do Vanilla JS

**Quando**: Quando app atingir ~2000 linhas de JS

**Benefícios**:
- ✅ Gerenciamento automático de estado (sem bugs de "Início duplicado")
- ✅ Componentes reutilizáveis
- ✅ Melhor performance e organização

**Caminho Recomendado**:
```bash
# Iniciar migração gradual
npm install vue@3

# Converter modules/ para componentes Vue
# modules/dashboard.js → modules/DashboardComponent.vue
# modules/expenses.js → modules/ExpensesComponent.vue
```

---

## ✅ Checklist de Execução Completo

### Fase 1 (Semana 1)
- [ ] 1.1 - Edge Function para IA
  - [ ] Criar função em Supabase
  - [ ] Atualizar `ai-conversations.js`
  - [ ] Testar chamadas via `supabase.functions.invoke()`

- [ ] 1.2 - Layout
  - [ ] Confirmar `overflow-x: hidden` em `styles.css`
  - [ ] Procurar e remover qualquer `overflow-x: auto`

- [ ] 1.3 - Menu Drawer
  - [ ] Adicionar HTML em `index.html`
  - [ ] Adicionar CSS em `styles.css`
  - [ ] Implementar `initializeDrawer()` em `app.js`
  - [ ] Testar hambúrguer em mobile

### Fase 2 (Semana 2)
- [ ] 2.1 - Settings Tabs
  - [ ] Criar abas em `index.html`
  - [ ] Adicionar CSS
  - [ ] Implementar `initializeSettingsTabs()`
  - [ ] Testar navegação

- [ ] 2.2 - Skeleton Screens
  - [ ] Adicionar CSS de shimmer
  - [ ] Criar função `createSkeletonLoader()`
  - [ ] Substituir todos os "Carregando..."
  - [ ] Testar em conexão lenta

- [ ] 2.3 - Remover Duplicatas
  - [ ] Audit de duplicados em `index.html`
  - [ ] Remover "Início" duplicado
  - [ ] Testar visualmente

### Fase 3 (Futuro)
- [ ] 3.1 - Design Tokens + Tailwind (quando necessário)
- [ ] 3.2 - Migração para Vue.js (quando escala aumentar)

---

## 📊 Métricas de Sucesso

| Métrica | Atual | Meta |
|---------|-------|------|
| **Bugs de Navegação** | 2-3 | 0 |
| **Tempo de Carregamento** | ~2s | <1s |
| **UX Score (Lighthouse)** | ~60 | >90 |
| **Duplicatas de Menu** | Sim | Não |
| **Segurança (API Keys Expostas)** | Sim | Não |
| **Skeleton Screens** | Não | Sim (todos loaders) |

---

## 📞 Próximos Passos

1. **Revisar este documento** com o time
2. **Começar pela Fase 1** (é a mais crítica - segurança)
3. **Fazer commits pequenos** após cada checklist item
4. **Testar em mobile** continuamente
5. **Documentar novos padrões** conforme forem criados

---

**Última atualização**: 31 de Maio de 2026
**Status**: 🟢 Pronto para Implementação
