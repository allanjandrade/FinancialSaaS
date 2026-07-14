# Release 3.2.0 Integrated Premium UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the 3.2.0 premium integrated UX by unifying the authenticated shell, operational context, entries flow, financial structure hub, and shared visual contracts.

**Architecture:** Keep existing Vue/Pinia/domain logic intact and improve the presentation layer through shared components, view-model helpers inside views, and contract tests. The release concentrates changes in reusable UI primitives plus `Entries.vue` and `FinancialStructure.vue`, avoiding a store rewrite.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vite, Vitest, lucide-vue-next, existing CSS tokens in `src/styles`.

---

## File Structure

- Create: `src/components/layout/OperationalContextPanel.vue`
  - Shared right-side context panel for operational pages.
  - Accepts `title`, `subtitle`, `items`, `alerts`, `actions`, and `emptyMessage`.
- Modify: `src/components/ui/AppButton.vue`
  - Make destructive variant visually contained, align disabled/loading behavior, and preserve router-link support.
- Modify: `src/components/ui/AppBadge.vue`
  - Add explicit status-tone usage and stronger backgrounds without exposing technical labels.
- Modify: `src/components/ui/AppActionMenu.vue`
  - Add Escape key close, outside click containment, and `aria-haspopup`.
- Modify: `src/styles/main.css`
  - Reduce dependence on legacy button selectors by giving base components stronger shared visual contracts.
- Modify: `src/views/Entries.vue`
  - Keep OCR as primary CTA, remove redundant OCR/import cards, use `OperationalContextPanel`, and keep manual form secondary.
- Modify: `src/views/FinancialStructure.vue`
  - Keep accounts hub clean, use tabs and contextual form behavior, remove non-contextual family profile surfaces, and make secondary technical panels quieter.
- Modify: `src/router/navigation.js`
  - Keep the approved group order and labels, and preserve operation routes in `Operacao`.
- Test: `tests/unit/v3-2-integrated-premium-ux.test.js`
  - Release-level contract for shell, operational context, entries, accounts, and no raw technical labels.
- Test: `tests/unit/global-visual-system.test.js`
  - Extend shared button/card/badge contracts.
- Test: `tests/unit/operations-ui-upgrade.test.js`
  - Update entries/accounts expectations for 3.2.
- Test: `tests/unit/financial-accounts-components.test.js`
  - Keep account hub contracts aligned with new layout.

---

### Task 1: Add Release 3.2 Contract Tests

**Files:**
- Create: `tests/unit/v3-2-integrated-premium-ux.test.js`

- [ ] **Step 1: Write the failing release contract test**

Create `tests/unit/v3-2-integrated-premium-ux.test.js`:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, metaForPath } from '@/router/navigation.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('release 3.2 integrated premium UX', () => {
  it('keeps intelligence second and operation as the execution group', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'inicio',
      'inteligencia',
      'operacao',
      'configuracoes',
    ])

    const operation = NAV_GROUPS.find((group) => group.id === 'operacao')
    expect(operation.items.map((item) => item.path)).toEqual([
      '/entries',
      '/structure?tab=accounts',
      '/card',
      '/benefit',
      '/subscriptions',
      '/family',
    ])

    expect(metaForPath('/subscriptions').group).toBe(operation.label)
    expect(metaForPath('/family').group).toBe(operation.label)
    expect(metaForPath('/subscriptions').breadcrumb.at(0)).toBe(operation.label)
    expect(metaForPath('/family').breadcrumb.at(0)).toBe(operation.label)
  })

  it('uses the shared operational context panel in premium operation screens', () => {
    const panel = read('src/components/layout/OperationalContextPanel.vue')
    const entries = read('src/views/Entries.vue')
    const structure = read('src/views/FinancialStructure.vue')

    expect(panel).toContain('data-testid="operational-context-panel"')
    expect(panel).toContain('operational-context__item')
    expect(panel).toContain('operational-context__alert')
    expect(entries).toContain('import OperationalContextPanel')
    expect(entries).toContain('<OperationalContextPanel')
    expect(structure).toContain('import OperationalContextPanel')
    expect(structure).toContain('<OperationalContextPanel')
  })

  it('keeps OCR as the single primary entry action without redundant cards', () => {
    const entries = read('src/views/Entries.vue')

    expect(entries).toContain('data-testid="entry-ocr-primary-action"')
    expect(entries).toContain('Escanear documento (OCR)')
    expect(entries).toContain('openPrimaryOcr')
    expect(entries).toContain('manual-entry-disclosure')
    expect(entries).toContain('data-testid="entry-review-panel"')
    expect(entries).not.toContain('OCR e importacao')
    expect(entries).not.toContain('ocr-primary-card')
    expect(entries).not.toContain('entry-command-panel')
  })

  it('keeps accounts as a clean hub with tabs, empty guidance and contextual form', () => {
    const structure = read('src/views/FinancialStructure.vue')

    expect(structure).toContain('<AccountsTabs')
    expect(structure).toContain('<AccountsKpiCards')
    expect(structure).toContain('<AccountsTable')
    expect(structure).toContain('accounts-layout')
    expect(structure).toContain('form-hidden')
    expect(structure).toContain('Nenhuma conta cadastrada ainda')
    expect(structure).toContain('Adicionar conta')
    expect(structure).not.toContain('AccountsEntityBanner')
    expect(structure).not.toContain('Perfil Familiar')
  })

  it('does not expose raw technical labels in primary UX files', () => {
    const source = [
      read('src/views/Entries.vue'),
      read('src/views/FinancialStructure.vue'),
      read('src/views/Advisor.vue'),
      read('src/components/layout/OperationalContextPanel.vue'),
    ].join('\n')

    expect(source).not.toMatch(/>\\s*stable\\s*</i)
    expect(source).not.toMatch(/>\\s*undefined\\s*</i)
    expect(source).not.toMatch(/Cobertura 0,0x/)
  })
})
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm test -- --run tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: FAIL because `OperationalContextPanel.vue` does not exist yet.

- [ ] **Step 3: Commit the failing contract test**

Run:

```bash
git add tests/unit/v3-2-integrated-premium-ux.test.js
git commit -m "test: define v3.2 premium ux contract"
```

Expected: commit only the new test file.

---

### Task 2: Create the Operational Context Panel

**Files:**
- Create: `src/components/layout/OperationalContextPanel.vue`
- Test: `tests/unit/v3-2-integrated-premium-ux.test.js`

- [ ] **Step 1: Create the shared panel component**

Create `src/components/layout/OperationalContextPanel.vue`:

```vue
<template>
  <aside class="operational-context" data-testid="operational-context-panel" :aria-label="title">
    <header class="operational-context__header">
      <span v-if="eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>

    <div v-if="items.length" class="operational-context__items">
      <article v-for="item in items" :key="item.id || item.label" class="operational-context__item" :class="item.tone ? `is-${item.tone}` : ''">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small v-if="item.hint">{{ item.hint }}</small>
      </article>
    </div>

    <p v-else-if="emptyMessage" class="operational-context__empty">{{ emptyMessage }}</p>

    <div v-if="alerts.length" class="operational-context__alerts">
      <article v-for="alert in alerts" :key="alert.id || alert.title" class="operational-context__alert" :class="alert.tone ? `is-${alert.tone}` : ''">
        <strong>{{ alert.title }}</strong>
        <p>{{ alert.message }}</p>
      </article>
    </div>

    <div v-if="$slots.actions" class="operational-context__actions">
      <slot name="actions" />
    </div>
  </aside>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  emptyMessage: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  alerts: { type: Array, default: () => [] },
})
</script>

<style scoped>
.operational-context {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--gradient-panel);
  box-shadow: var(--shadow-card);
}

.operational-context__header {
  display: grid;
  gap: 0.25rem;
}

.operational-context__header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 850;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.operational-context__header h2,
.operational-context__header p,
.operational-context__alert p {
  margin: 0;
}

.operational-context__header h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.2;
}

.operational-context__header p,
.operational-context__item span,
.operational-context__item small,
.operational-context__empty,
.operational-context__alert p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.operational-context__items,
.operational-context__alerts {
  display: grid;
  gap: 0.65rem;
}

.operational-context__item,
.operational-context__alert {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-panel) 82%, var(--bg-hover));
}

.operational-context__item strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.operational-context__alert strong {
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.operational-context__item.is-success,
.operational-context__alert.is-success {
  border-color: color-mix(in srgb, var(--success) 28%, var(--border-color));
  background: var(--income-dim);
}

.operational-context__item.is-warning,
.operational-context__alert.is-warning {
  border-color: color-mix(in srgb, var(--warning) 28%, var(--border-color));
  background: var(--savings-dim);
}

.operational-context__item.is-danger,
.operational-context__alert.is-danger {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border-color));
  background: var(--expense-dim);
}

.operational-context__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
```

- [ ] **Step 2: Run the release contract**

Run:

```bash
npm test -- --run tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: FAIL now moves to missing imports/usages in views.

- [ ] **Step 3: Commit the panel component**

Run:

```bash
git add src/components/layout/OperationalContextPanel.vue
git commit -m "feat: add operational context panel"
```

Expected: one component committed.

---

### Task 3: Strengthen Shared UI Component Contracts

**Files:**
- Modify: `src/components/ui/AppButton.vue`
- Modify: `src/components/ui/AppBadge.vue`
- Modify: `src/components/ui/AppActionMenu.vue`
- Modify: `src/styles/main.css`
- Modify: `tests/unit/global-visual-system.test.js`

- [ ] **Step 1: Add failing assertions for component-first visual hierarchy**

Append to `tests/unit/global-visual-system.test.js` inside `describe('global visual system contract', ...)`:

```js
  it('anchors release 3.2 visual hierarchy in shared UI components', () => {
    const button = read('src/components/ui/AppButton.vue')
    const badge = read('src/components/ui/AppBadge.vue')
    const actionMenu = read('src/components/ui/AppActionMenu.vue')
    const main = read('src/styles/main.css')

    expect(button).toContain('.app-button--destructive')
    expect(button).toContain('background: var(--expense-dim)')
    expect(button).toContain('color: var(--danger)')
    expect(button).toContain('aria-busy')
    expect(badge).toContain('background: var(--income-dim)')
    expect(badge).toContain('background: var(--savings-dim)')
    expect(badge).toContain('background: var(--expense-dim)')
    expect(actionMenu).toContain('aria-haspopup="menu"')
    expect(actionMenu).toContain('@keydown.esc')
    expect(main).toContain('/* Release 3.2 component hierarchy */')
  })
```

- [ ] **Step 2: Run the visual system test and confirm it fails**

Run:

```bash
npm test -- --run tests/unit/global-visual-system.test.js
```

Expected: FAIL because component details and CSS anchor are not present.

- [ ] **Step 3: Update `AppButton.vue` destructive styling**

Replace the `.app-button--destructive` block and hover block with:

```css
.app-button--destructive {
  border-color: color-mix(in srgb, var(--danger) 36%, var(--border-color));
  background: var(--expense-dim);
  color: var(--danger);
  box-shadow: none;
}

.app-button--destructive:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--danger) 58%, var(--border-color));
  background: color-mix(in srgb, var(--danger) 13%, transparent);
  transform: translateY(-1px);
}
```

- [ ] **Step 4: Update `AppBadge.vue` tone backgrounds**

Replace tone blocks with:

```css
.app-badge--success {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border-color));
  background: var(--income-dim);
  color: var(--success);
}

.app-badge--warning {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--border-color));
  background: var(--savings-dim);
  color: var(--warning);
}

.app-badge--danger {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border-color));
  background: var(--expense-dim);
  color: var(--danger);
}

.app-badge--premium,
.app-badge--info {
  background: var(--blue-dim);
}
```

- [ ] **Step 5: Update `AppActionMenu.vue` accessibility**

Change the trigger to:

```vue
<AppIconButton :label="menuLabel" aria-haspopup="menu" :aria-expanded="open" @click="toggle" @keydown.esc="close">
  <MoreHorizontal :size="18" />
</AppIconButton>
```

Change the panel to:

```vue
<div v-if="open" class="app-action-menu__panel" role="menu" @keydown.esc="close">
```

- [ ] **Step 6: Add a release 3.2 anchor to `main.css`**

Add after `/* Unified action buttons */`:

```css
/* Release 3.2 component hierarchy */
.app-button,
.app-badge,
.app-action-menu__item {
  letter-spacing: 0;
}
```

- [ ] **Step 7: Run the visual system test**

Run:

```bash
npm test -- --run tests/unit/global-visual-system.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit shared component updates**

Run:

```bash
git add src/components/ui/AppButton.vue src/components/ui/AppBadge.vue src/components/ui/AppActionMenu.vue src/styles/main.css tests/unit/global-visual-system.test.js
git commit -m "feat: harden v3.2 visual component contracts"
```

Expected: shared component and test changes committed.

---

### Task 4: Refactor Entries Into a Premium Operational Flow

**Files:**
- Modify: `src/views/Entries.vue`
- Modify: `tests/unit/operations-ui-upgrade.test.js`
- Test: `tests/unit/v3-2-integrated-premium-ux.test.js`

- [ ] **Step 1: Add failing assertions for context panel and no duplicate OCR surfaces**

In `tests/unit/operations-ui-upgrade.test.js`, inside `brings entries and accounts navigation into the premium operations language`, add:

```js
    expect(entries).toContain('import OperationalContextPanel')
    expect(entries).toContain('<OperationalContextPanel')
    expect(entries).toContain('entriesContextItems')
    expect(entries).toContain('entriesContextAlerts')
    expect(entries).toContain('Importar extrato')
    expect(entries).not.toContain('OCR e importação')
    expect(entries).not.toContain('OCR e importacao')
```

- [ ] **Step 2: Run focused operation tests and confirm failure**

Run:

```bash
npm test -- --run tests/unit/operations-ui-upgrade.test.js tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: FAIL on missing panel import/usages.

- [ ] **Step 3: Import the shared context panel in `Entries.vue`**

Add with other component imports:

```js
import OperationalContextPanel from '@/components/layout/OperationalContextPanel.vue'
```

- [ ] **Step 4: Add entries context view-models**

Add near existing computed values in `Entries.vue`:

```js
const entriesContextItems = computed(() => [
  {
    id: 'month-balance',
    label: 'Saldo do período',
    value: formatCurrency(currentMonthNetTotal.value || 0),
    hint: 'Receitas menos despesas confirmadas',
    tone: currentMonthNetTotal.value >= 0 ? 'success' : 'danger',
  },
  {
    id: 'pending-review',
    label: 'Revisão pendente',
    value: reviewPanelOpen.value ? 'Aberta' : 'Sem pendências',
    hint: reviewPanelOpen.value ? 'Confira antes de salvar' : 'OCR e extratos ficam aqui',
    tone: reviewPanelOpen.value ? 'warning' : 'success',
  },
  {
    id: 'recent-count',
    label: 'Lançamentos recentes',
    value: String(visibleEntries.value.length || 0),
    hint: historySummary.value,
    tone: 'info',
  },
])

const entriesContextAlerts = computed(() => {
  const alerts = []
  if (!sourceOptions.value.length) {
    alerts.push({
      id: 'no-source',
      title: 'Cadastre uma origem financeira',
      message: 'Contas, cartões ou benefícios permitem classificar melhor cada lançamento.',
      tone: 'warning',
    })
  }
  if (entryType.value === 'expense' && subscriptionSuggestion.value?.shouldSuggest) {
    alerts.push({
      id: 'subscription-suggestion',
      title: 'Possível assinatura',
      message: subscriptionSuggestion.value.message,
      tone: 'info',
    })
  }
  return alerts
})
```

- [ ] **Step 5: Render `OperationalContextPanel` in the right column**

Inside `<aside class="side-stack">`, before the review panel, add:

```vue
<OperationalContextPanel
  title="Contexto operacional"
  subtitle="Resumo rápido para decidir a origem, revisar pendências e evitar lançamentos duplicados."
  :items="entriesContextItems"
  :alerts="entriesContextAlerts"
  empty-message="Cadastre sua primeira movimentação para ativar o contexto operacional."
/>
```

- [ ] **Step 6: Keep OCR/import/manual hierarchy explicit**

Ensure the hero action order is exactly:

```vue
<button
  type="button"
  class="primary-button compact-action ocr-hero-action"
  data-testid="entry-ocr-primary-action"
  :disabled="attachmentUploading"
  @click="openPrimaryOcr"
>
  <Paperclip :size="17" />
  Escanear documento (OCR)
</button>
<button type="button" class="secondary-button compact-action" data-testid="statement-import-section" @click="openStatementImport">
  <Upload :size="17" />
  Importar extrato
</button>
<button type="button" class="secondary-button compact-action" @click="openManualEntry('expense')">
  Lançar manualmente
</button>
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- --run tests/unit/operations-ui-upgrade.test.js tests/unit/v3-2-integrated-premium-ux.test.js tests/unit/entries-view-contract.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit entries upgrade**

Run:

```bash
git add src/views/Entries.vue tests/unit/operations-ui-upgrade.test.js
git commit -m "feat: refine entries premium operational flow"
```

Expected: entries and operation contract updates committed.

---

### Task 5: Refactor Financial Structure Into a Clean Hub

**Files:**
- Modify: `src/views/FinancialStructure.vue`
- Modify: `tests/unit/financial-accounts-components.test.js`
- Test: `tests/unit/v3-2-integrated-premium-ux.test.js`

- [ ] **Step 1: Add failing assertions for accounts context and quiet technical panels**

Append to `tests/unit/financial-accounts-components.test.js`:

```js
  it('uses the v3.2 operational context panel without reintroducing family profile noise', () => {
    const structure = fs.readFileSync('src/views/FinancialStructure.vue', 'utf8')

    expect(structure).toContain('import OperationalContextPanel')
    expect(structure).toContain('<OperationalContextPanel')
    expect(structure).toContain('financialContextItems')
    expect(structure).toContain('financialContextAlerts')
    expect(structure).toContain('technical-panel--secondary')
    expect(structure).not.toContain('Perfil Familiar')
    expect(structure).not.toContain('Test Family')
  })
```

- [ ] **Step 2: Run focused account tests and confirm failure**

Run:

```bash
npm test -- --run tests/unit/financial-accounts-components.test.js tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: FAIL on missing context panel import/usages.

- [ ] **Step 3: Import the context panel**

Add with other imports:

```js
import OperationalContextPanel from '@/components/layout/OperationalContextPanel.vue'
```

- [ ] **Step 4: Add financial hub context view-models**

Add near existing computed values:

```js
const financialContextItems = computed(() => [
  {
    id: 'accounts',
    label: 'Contas ativas',
    value: String(accounts.value.filter((account) => account.active !== false).length),
    hint: 'Origens disponiveis para lancamentos',
    tone: accounts.value.length ? 'success' : 'warning',
  },
  {
    id: 'cards',
    label: 'Cartões cadastrados',
    value: String(cards.value.length),
    hint: 'Usados na previsão de faturas',
    tone: cards.value.length ? 'info' : 'warning',
  },
  {
    id: 'benefits',
    label: 'Benefícios',
    value: String(benefits.value.length),
    hint: 'VA, VR e carteiras corporativas',
    tone: benefits.value.length ? 'success' : 'neutral',
  },
])

const financialContextAlerts = computed(() => {
  const alerts = []
  if (!accounts.value.length) {
    alerts.push({
      id: 'first-account',
      title: 'Comece pela conta principal',
      message: 'Ela organiza saldo, receitas e despesas antes de cartões e benefícios.',
      tone: 'warning',
    })
  }
  if (pendingAccounts.value.length) {
    alerts.push({
      id: 'pending-accounts',
      title: 'Pendências de cadastro',
      message: `${pendingAccounts.value.length} conta${pendingAccounts.value.length > 1 ? 's precisam' : ' precisa'} de revisão.`,
      tone: 'warning',
    })
  }
  return alerts
})
```

- [ ] **Step 5: Render the context panel for the accounts tab**

Inside the accounts tab layout, after `accounts-main`, add:

```vue
<OperationalContextPanel
  class="accounts-context-panel"
  title="Contexto financeiro"
  subtitle="Origens, pendências e próximas ações desta estrutura."
  :items="financialContextItems"
  :alerts="financialContextAlerts"
  empty-message="Adicione sua primeira conta para ativar o contexto financeiro."
/>
```

Update `.accounts-layout` to:

```css
.accounts-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.32fr) minmax(0, 0.68fr);
  gap: 1rem;
  align-items: start;
}

.accounts-layout.form-hidden {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.28fr);
}

.accounts-context-panel {
  position: sticky;
  top: calc(68px + 1rem);
}
```

If the form is visible, keep the panel below the main content on desktop by adding:

```css
.accounts-layout:not(.form-hidden) .accounts-context-panel {
  grid-column: 2;
}
```

- [ ] **Step 6: Mark technical panels as secondary**

For integrations, audit and pending sections, add class `technical-panel--secondary`:

```vue
<section v-if="activeTab === 'integrations'" class="panel corporate-panel technical-panel--secondary">
```

```vue
<section v-if="activeTab === 'audit'" class="panel corporate-panel technical-panel--secondary">
```

```vue
<section v-if="activeTab === 'pending'" class="panel corporate-panel technical-panel--secondary">
```

Add CSS:

```css
.technical-panel--secondary {
  border-style: dashed;
  background: color-mix(in srgb, var(--bg-panel) 76%, var(--bg-hover));
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- --run tests/unit/financial-accounts-components.test.js tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit accounts hub upgrade**

Run:

```bash
git add src/views/FinancialStructure.vue tests/unit/financial-accounts-components.test.js
git commit -m "feat: refine financial structure hub"
```

Expected: structure view and tests committed.

---

### Task 6: Shell, Navigation and Copy Guard

**Files:**
- Modify: `src/router/navigation.js`
- Modify: `src/components/Sidebar.vue`
- Modify: `tests/unit/navigation-contract.test.js`
- Test: `tests/unit/v3-2-integrated-premium-ux.test.js`

- [ ] **Step 1: Add route ID-based 3.2 assertions**

In `tests/unit/navigation-contract.test.js`, add:

```js
  it('keeps release 3.2 route hierarchy stable by group id', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'inicio',
      'inteligencia',
      'operacao',
      'configuracoes',
    ])

    const operation = NAV_GROUPS.find((group) => group.id === 'operacao')
    expect(operation.items.map((item) => item.path)).toEqual([
      '/entries',
      '/structure?tab=accounts',
      '/card',
      '/benefit',
      '/subscriptions',
      '/family',
    ])

    expect(metaForPath('/subscriptions').breadcrumb.at(0)).toBe(metaForPath('/family').breadcrumb.at(0))
    expect(groupForPath('/subscriptions')).toBe(groupForPath('/family'))
  })
```

- [ ] **Step 2: Run navigation tests**

Run:

```bash
npm test -- --run tests/unit/navigation-contract.test.js tests/unit/v3-2-integrated-premium-ux.test.js
```

Expected: PASS with the approved menu hierarchy.

- [ ] **Step 3: Remove stale mobile primary unused computed**

In `src/components/Sidebar.vue`, delete the unused computed block:

```js
const mobilePrimary = computed(() => [
  { label: 'Início', path: '/dashboard', icon: Home, active: () => ['Início'].includes(groupForPath(route.path)) },
  { label: 'Lançamentos', path: '/entries', icon: Receipt, active: () => isItemActive(route.path, '/entries') },
  { label: 'Planejamento', path: '/plan', icon: LineChart, active: () => groupForPath(route.path) === 'Planejamento' },
])
```

Keep `mobilePrimaryItems`.

- [ ] **Step 4: Run navigation and sidebar tests**

Run:

```bash
npm test -- --run tests/unit/navigation-contract.test.js tests/unit/sidebar-menu.test.js tests/unit/mobile-navigation.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit shell/navigation cleanup**

Run:

```bash
git add src/router/navigation.js src/components/Sidebar.vue tests/unit/navigation-contract.test.js
git commit -m "feat: stabilize v3.2 navigation hierarchy"
```

Expected: navigation contract and cleanup committed.

---

### Task 7: Final Regression, Build and Release Version

**Files:**
- Modify: `package.json`
- Modify: `tests/unit/v3-release-contract.test.js`
- Test: full suite

- [ ] **Step 1: Add version contract assertion**

Update `tests/unit/v3-release-contract.test.js` to expect 3.2.0:

```js
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
expect(packageJson.version).toBe('3.2.0')
```

If the file already has a package version assertion, replace only the expected version.

- [ ] **Step 2: Run version contract and confirm failure**

Run:

```bash
npm test -- --run tests/unit/v3-release-contract.test.js
```

Expected: FAIL while package version remains `3.1.0`.

- [ ] **Step 3: Bump package version**

Run:

```bash
npm version 3.2.0 --no-git-tag-version
```

Expected: `package.json` and `package-lock.json` root package versions are updated to `3.2.0`.

- [ ] **Step 4: Run focused release tests**

Run:

```bash
npm test -- --run tests/unit/v3-release-contract.test.js tests/unit/v3-2-integrated-premium-ux.test.js tests/unit/global-visual-system.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full unit suite**

Run:

```bash
npm test -- --run --reporter=dot
```

Expected: all tests pass. Existing tests may print simulated Supabase connectivity errors to stderr; treat the command exit code as authoritative.

- [ ] **Step 6: Run production build**

Run:

```bash
npm run build
```

Expected: build completes and `scripts/generate-spa-route-fallbacks.js` reports generated fallbacks.

- [ ] **Step 7: Commit release version and final contracts**

Run:

```bash
git add package.json package-lock.json tests/unit/v3-release-contract.test.js tests/unit/v3-2-integrated-premium-ux.test.js
git commit -m "chore: release v3.2.0 premium ux"
```

Expected: final release version commit. If `package-lock.json` was not modified, omit it from `git add`.

---

## Self-Review

Spec coverage:

- Shell premium integrado: Task 6.
- Lancamentos premium with OCR primary: Task 4.
- Contas e cartoes hub: Task 5.
- Design system foundation: Task 3.
- Operational context panel: Task 2, Task 4, Task 5.
- Tests and build: Task 1 and Task 7.

Known constraints:

- `Entries.vue` and `FinancialStructure.vue` are large files. Keep edits scoped to imports, computed view-models, layout composition and CSS blocks named in this plan.
- Do not change store calculations unless a test proves the view needs a different presentation value.
- Do not reintroduce a family profile card inside accounts.
- Do not create data automatically from OCR or import flows.
