# Fluid Ledger Global Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the product-wide raised-card visual language with a continuous fluid ledger system across authenticated, public, pricing, auth and support/legal surfaces.

**Architecture:** First protect the desired outcome with visual contract tests. Then flatten global tokens and legacy surface classes so the whole product stops defaulting to floating cards. Finally introduce semantic ledger components and migrate the highest-visibility pages to rows, strips, rails and continuous sections.

**Tech Stack:** Vue 3, Vite, Vitest, scoped CSS, existing CSS tokens in `src/styles`, existing shared UI conventions.

---

## File Structure

- Create: `tests/unit/fluid-ledger-global.test.js`
  - Release-level contract for the global ledger language.
- Modify: `tests/unit/global-visual-system.test.js`
  - Update old card/surface expectations so they now assert flattened ledger defaults.
- Modify: `src/styles/tokens.css`
  - Add ledger surface tokens and flatten card shadows.
- Modify: `src/styles/main.css`
  - Change `.panel`, `.summary-card`, `.dashboard-panel`, `.app-card`, `.metric-card`, `.kpi-card` into ledger surfaces.
- Modify: `src/styles/layout.css`
  - Align `.app-card` and page shell spacing with ledger defaults.
- Create: `src/components/layout/LedgerPage.vue`
  - Page frame for continuous ledger pages.
- Create: `src/components/layout/LedgerSection.vue`
  - Divider-based section wrapper.
- Create: `src/components/layout/LedgerStrip.vue`
  - KPI/stat strip component.
- Create: `src/components/layout/LedgerTable.vue`
  - Divider-based table/list surface for ledger rows.
- Create: `src/components/layout/LedgerRail.vue`
  - Contextual side rail.
- Create: `src/components/layout/LedgerEmptyState.vue`
  - Empty state exception with flatter treatment.
- Modify: `src/views/Home.vue`
  - Dashboard/analysis migration to ledger root classes and stat strips.
- Modify: `src/views/Entries.vue`
  - Operation page migration away from panel/card clusters.
- Modify: `src/views/FinancialStructure.vue`
  - Accounts hub migration to ledger layout primitives.
- Modify: `src/views/Subscriptions.vue`
  - Subscription manager migration to ledger summary and row list language while preserving service identity tiles.
- Modify: `src/views/public/Landing.vue`
  - Public landing migration from card grid to institutional bands and preview ledger.
- Modify: `src/views/public/Pricing.vue`
  - Pricing migration from plan cards to comparison ledger.
- Modify: `src/views/Login.vue`
- Modify: `src/views/Signup.vue`
- Modify: `src/views/ForgotPassword.vue`
- Modify: `src/views/ResetPassword.vue`
- Modify: `src/views/AuthCallback.vue`
  - Auth pages migrate from floating card impression to split institutional surfaces.

---

### Task 1: Add Fluid Ledger Contract Tests

**Files:**
- Create: `tests/unit/fluid-ledger-global.test.js`
- Modify: `tests/unit/global-visual-system.test.js`

- [ ] **Step 1: Create the failing global ledger test**

Create `tests/unit/fluid-ledger-global.test.js`:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const blockFor = (source, selector) => {
  const selectorPattern = escapeRegex(selector)
  const rulePattern = new RegExp(`(?:^|[{}])\\s*([^{}]*${selectorPattern}[^{}]*)\\{([^{}]*)\\}`, 'g')
  const blocks = []
  let match

  while ((match = rulePattern.exec(source)) !== null) {
    blocks.push(`${match[1]} {${match[2]}}`)
  }

  return blocks.join('\n')
}

describe('fluid ledger global redesign', () => {
  it('defines ledger surface tokens and neutralizes raised card defaults', () => {
    const tokens = read('src/styles/tokens.css')
    const main = read('src/styles/main.css')
    const layout = read('src/styles/layout.css')

    expect(tokens).toContain('--surface-page:')
    expect(tokens).toContain('--surface-ledger:')
    expect(tokens).toContain('--surface-rail:')
    expect(tokens).toContain('--surface-muted:')
    expect(tokens).toContain('--divider:')
    expect(tokens).toContain('--divider-strong:')
    expect(tokens).toContain('--shadow-card: 0 0 0 1px transparent')
    expect(tokens).toContain('--shadow-card-hover: 0 0 0 1px transparent')

    expect(main).toContain('/* Fluid Ledger global surfaces */')
    expect(main).toContain('.panel,')
    expect(main).toContain('.summary-card,')
    expect(main).toContain('.dashboard-panel,')
    expect(main).toContain('.app-card')
    expect(main).toContain('background: var(--surface-ledger)')
    expect(main).toContain('box-shadow: none')
    expect(main).toContain('border-radius: var(--radius-sm)')

    for (const selector of ['.panel', '.summary-card', '.dashboard-panel', '.app-card', '.metric-card', '.kpi-card']) {
      const surfaceBlocks = blockFor(main, selector)
      expect(surfaceBlocks, `${selector} should not reintroduce raised motion`).not.toContain('transform: translateY(-')
      expect(surfaceBlocks, `${selector} should not reintroduce raised hover shadows`).not.toContain('box-shadow: var(--shadow-card-hover)')
    }

    expect(layout).toContain('background: var(--surface-ledger)')
    expect(layout).toContain('box-shadow: none')
  })

  it('provides semantic ledger layout primitives', () => {
    const files = [
      'src/components/layout/LedgerPage.vue',
      'src/components/layout/LedgerSection.vue',
      'src/components/layout/LedgerStrip.vue',
      'src/components/layout/LedgerTable.vue',
      'src/components/layout/LedgerRail.vue',
      'src/components/layout/LedgerEmptyState.vue',
    ]

    for (const file of files) {
      expect(exists(file), `${file} should exist`).toBe(true)
    }

    expect(read('src/components/layout/LedgerPage.vue')).toContain('class="ledger-page"')
    expect(read('src/components/layout/LedgerSection.vue')).toContain('class="ledger-section"')
    expect(read('src/components/layout/LedgerStrip.vue')).toContain('class="ledger-strip"')
    expect(read('src/components/layout/LedgerTable.vue')).toContain('class="ledger-table"')
    expect(read('src/components/layout/LedgerRail.vue')).toContain('class="ledger-rail"')
    expect(read('src/components/layout/LedgerEmptyState.vue')).toContain('class="ledger-empty-state"')
  })

  it('moves primary authenticated pages to ledger layout classes', () => {
    const pages = [
      'src/views/Home.vue',
      'src/views/Entries.vue',
      'src/views/FinancialStructure.vue',
      'src/views/Subscriptions.vue',
    ]

    for (const file of pages) {
      const source = read(file)
      expect(source, file).toContain('ledger-')
      expect(source, file).toContain('Ledger')
    }
  })

  it('moves public and auth pages to continuous institutional surfaces', () => {
    const pages = [
      'src/views/public/Landing.vue',
      'src/views/public/Pricing.vue',
      'src/views/Login.vue',
      'src/views/Signup.vue',
      'src/views/ForgotPassword.vue',
      'src/views/ResetPassword.vue',
      'src/views/AuthCallback.vue',
    ]

    for (const file of pages) {
      const source = read(file)
      expect(source, file).toContain('ledger-')
      expect(source, file).not.toContain('box-shadow: var(--shadow-card)')
    }
  })

  it('keeps cards only for explicit allowed exceptions', () => {
    const source = [
      read('src/views/Home.vue'),
      read('src/views/Entries.vue'),
      read('src/views/FinancialStructure.vue'),
      read('src/views/public/Landing.vue'),
      read('src/views/public/Pricing.vue'),
    ].join('\n')

    for (const selector of ['.panel', '.summary-card', '.dashboard-panel', '.app-card', '.metric-card', '.kpi-card', '.feature-card', '.trust-card', '.first-step-card']) {
      const surfaceBlocks = blockFor(source, selector)
      expect(surfaceBlocks, `${selector} should not lift static ledger surfaces`).not.toContain('transform: translateY(-')
      expect(surfaceBlocks, `${selector} should not use raised card hover shadows`).not.toContain('box-shadow: var(--shadow-card-hover)')
    }

    expect(source).not.toContain('grid-template-columns: repeat(auto-fit, minmax(230px, 1fr))')
  })
})
```

- [ ] **Step 2: Update the existing visual system contract**

In `tests/unit/global-visual-system.test.js`, replace the body of `centralizes authenticated page spacing, surfaces and legacy page heads` with:

```js
    expect(main).toContain('.route-view > :is(')
    expect(main).toContain('.page-head')
    expect(main).toContain('.section-title')
    expect(main).toContain('/* Fluid Ledger global surfaces */')
    expect(main).toContain('.panel,')
    expect(main).toContain('.app-card')
    expect(main).toContain('background: var(--surface-ledger)')
    expect(main).toContain('box-shadow: none')
    expect(pageShell).toContain('gap: var(--section-gap)')
    expect(pageShell).toContain('align-content: start')
    expect(pageHeader).toContain('background: transparent')
    expect(pageHeader).toContain('border-bottom: 1px solid var(--divider)')
```

In the same file, update the fallback page assertion:

```js
    expect(notFound).toContain('class="not-found-card"')
    expect(notFound).toContain('background: var(--surface-ledger)')
    expect(notFound).not.toContain('box-shadow: var(--shadow-card)')
```

- [ ] **Step 3: Run the new contracts and confirm failure**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js
```

Expected: FAIL because ledger tokens and components do not exist yet, and old surface CSS still uses raised card styling.

- [ ] **Step 4: Commit the failing tests**

Run:

```bash
git add tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js
git commit -m "test: define fluid ledger visual contract" -- tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js
```

Expected: one test commit.

---

### Task 2: Flatten Global Surface Tokens

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/main.css`
- Modify: `src/styles/layout.css`
- Test: `tests/unit/fluid-ledger-global.test.js`
- Test: `tests/unit/global-visual-system.test.js`

- [ ] **Step 1: Add ledger tokens to the light theme**

In `src/styles/tokens.css`, add after `--bg-glass` in `:root`:

```css
  --surface-page: var(--bg-shell);
  --surface-ledger: rgba(255, 255, 255, 0.72);
  --surface-rail: rgba(248, 251, 255, 0.82);
  --surface-muted: rgba(238, 244, 255, 0.62);
  --divider: rgba(148, 163, 184, 0.28);
  --divider-strong: rgba(100, 116, 139, 0.42);
```

- [ ] **Step 2: Flatten light theme card shadows and panel gradient**

In `src/styles/tokens.css`, replace the light theme shadow and panel lines with:

```css
  --shadow-card: 0 0 0 1px transparent;
  --shadow-card-hover: 0 0 0 1px transparent;
  --shadow-floating: 0 18px 52px -32px rgba(15, 23, 42, 0.48);
  --shadow-glow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  --focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.18);
  --gradient-panel: linear-gradient(180deg, var(--surface-ledger), var(--surface-ledger));
```

- [ ] **Step 3: Add ledger tokens to the dark theme**

In `src/styles/tokens.css`, add after dark `--bg-glass`:

```css
  --surface-page: var(--bg-shell);
  --surface-ledger: rgba(16, 27, 45, 0.72);
  --surface-rail: rgba(19, 32, 55, 0.78);
  --surface-muted: rgba(23, 36, 58, 0.66);
  --divider: rgba(148, 163, 184, 0.22);
  --divider-strong: rgba(148, 163, 184, 0.34);
```

- [ ] **Step 4: Flatten dark theme card shadows and panel gradient**

In `src/styles/tokens.css`, replace the dark shadow and panel lines with:

```css
  --shadow-card: 0 0 0 1px transparent;
  --shadow-card-hover: 0 0 0 1px transparent;
  --shadow-floating: 0 20px 58px -28px rgba(0, 0, 0, 0.82);
  --shadow-glow: 0 0 0 3px rgba(96, 165, 250, 0.22);
  --focus-ring: 0 0 0 3px rgba(96, 165, 250, 0.24);
  --gradient-panel: linear-gradient(180deg, var(--surface-ledger), var(--surface-ledger));
```

- [ ] **Step 5: Replace shared dashboard surface CSS**

In `src/styles/main.css`, replace the block starting at `/* Shared dashboard surfaces */` through the `.kpi-card:hover` rule with:

```css
/* Fluid Ledger global surfaces */
.panel,
.summary-card,
.dashboard-panel,
.app-card {
  position: relative;
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  box-shadow: none;
  overflow: hidden;
}

.panel::before,
.summary-card::before,
.dashboard-panel::before,
.app-card::before {
  display: none;
}

.metric-card,
.kpi-card {
  position: relative;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.money,
[data-money] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.panel {
  padding: var(--space-6);
}

.summary-card,
.dashboard-panel,
.app-card,
.metric-card,
.kpi-card {
  transition: border-color 0.16s ease, background 0.16s ease;
}

.summary-card:hover,
.dashboard-panel:hover,
.app-card:hover,
.metric-card:hover,
.kpi-card:hover {
  border-color: var(--divider-strong);
  box-shadow: none;
}
```

- [ ] **Step 6: Update page header divider token**

In `src/components/layout/PageHeader.vue`, replace:

```css
  border-bottom: 1px solid var(--border-color);
```

with:

```css
  border-bottom: 1px solid var(--divider);
```

- [ ] **Step 7: Update layout app-card defaults**

In `src/styles/layout.css`, replace `.app-card` with:

```css
.app-card {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  box-shadow: none;
  padding: var(--card-padding-desktop);
}
```

- [ ] **Step 8: Run focused visual tests**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js
```

Expected: FAIL only on missing ledger components and page migrations.

- [ ] **Step 9: Commit global token flattening**

Run:

```bash
git add src/styles/tokens.css src/styles/main.css src/styles/layout.css src/components/layout/PageHeader.vue
git commit -m "feat: flatten global surfaces for fluid ledger" -- src/styles/tokens.css src/styles/main.css src/styles/layout.css src/components/layout/PageHeader.vue
```

Expected: one styling foundation commit.

---

### Task 3: Add Ledger Layout Components

**Files:**
- Create: `src/components/layout/LedgerPage.vue`
- Create: `src/components/layout/LedgerSection.vue`
- Create: `src/components/layout/LedgerStrip.vue`
- Create: `src/components/layout/LedgerTable.vue`
- Create: `src/components/layout/LedgerRail.vue`
- Create: `src/components/layout/LedgerEmptyState.vue`
- Test: `tests/unit/fluid-ledger-global.test.js`

- [ ] **Step 1: Create `LedgerPage.vue`**

Create `src/components/layout/LedgerPage.vue`:

```vue
<template>
  <main class="ledger-page" :data-testid="testid || undefined">
    <header v-if="title || eyebrow || description || $slots.actions" class="ledger-page__header">
      <div>
        <p v-if="eyebrow" class="ledger-page__eyebrow">{{ eyebrow }}</p>
        <h1 v-if="title">{{ title }}</h1>
        <p v-if="description" class="ledger-page__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ledger-page__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </main>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-page {
  width: min(var(--content-max), 100%);
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--section-gap);
  margin: 0 auto;
  padding: var(--content-pad);
  background: transparent;
}

.ledger-page__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.1rem 0 1rem;
  border-bottom: 1px solid var(--divider);
}

.ledger-page__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.ledger-page h1 {
  margin: 0.12rem 0 0;
  color: var(--text-primary);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.ledger-page__description {
  max-width: 760px;
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: var(--page-subtitle-size);
  line-height: 1.5;
}

.ledger-page__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 720px) {
  .ledger-page {
    padding: 0.8rem;
  }

  .ledger-page__header {
    display: grid;
    align-items: stretch;
  }
}
</style>
```

- [ ] **Step 2: Create `LedgerSection.vue`**

Create `src/components/layout/LedgerSection.vue`:

```vue
<template>
  <section class="ledger-section" :class="{ 'ledger-section--divided': divided }" :data-testid="testid || undefined">
    <header v-if="title || eyebrow || description || $slots.actions" class="ledger-section__header">
      <div>
        <p v-if="eyebrow" class="ledger-section__eyebrow">{{ eyebrow }}</p>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description" class="ledger-section__description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ledger-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
  divided: { type: Boolean, default: true },
})
</script>

<style scoped>
.ledger-section {
  min-width: 0;
  display: grid;
  gap: 1rem;
  padding: 0;
  background: transparent;
}

.ledger-section--divided {
  padding-top: 1rem;
  border-top: 1px solid var(--divider);
}

.ledger-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.ledger-section__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.ledger-section h2,
.ledger-section__description {
  margin: 0;
}

.ledger-section h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-section__description {
  max-width: 680px;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.ledger-section__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
```

- [ ] **Step 3: Create `LedgerStrip.vue`**

Create `src/components/layout/LedgerStrip.vue`:

```vue
<template>
  <div class="ledger-strip" :data-testid="testid || undefined">
    <article
      v-for="item in items"
      :key="item.id || item.label"
      class="ledger-strip__item"
      :class="item.tone ? `is-${item.tone}` : ''"
    >
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
      <small v-if="item.hint">{{ item.hint }}</small>
    </article>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  background: var(--surface-muted);
}

.ledger-strip__item {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  border-right: 1px solid var(--divider);
}

.ledger-strip__item:last-child {
  border-right: 0;
}

.ledger-strip__item span,
.ledger-strip__item small {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.35;
}

.ledger-strip__item strong {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.ledger-strip__item.is-success strong {
  color: var(--income);
}

.ledger-strip__item.is-warning strong {
  color: var(--warning);
}

.ledger-strip__item.is-danger strong {
  color: var(--danger);
}

@media (max-width: 620px) {
  .ledger-strip {
    grid-template-columns: 1fr;
  }

  .ledger-strip__item {
    border-right: 0;
    border-bottom: 1px solid var(--divider);
  }

  .ledger-strip__item:last-child {
    border-bottom: 0;
  }
}
</style>
```

- [ ] **Step 4: Create `LedgerTable.vue`**

Create `src/components/layout/LedgerTable.vue`:

```vue
<template>
  <section class="ledger-table" :data-testid="testid || undefined">
    <header v-if="$slots.header || title" class="ledger-table__header">
      <slot name="header">
        <h2>{{ title }}</h2>
      </slot>
    </header>
    <div class="ledger-table__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-table {
  min-width: 0;
  display: grid;
  border-top: 1px solid var(--divider);
  background: transparent;
}

.ledger-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--divider-strong);
}

.ledger-table h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-table__body {
  display: grid;
  min-width: 0;
}

:deep(.ledger-row),
:deep(tr) {
  border-bottom: 1px solid var(--divider);
}
</style>
```

- [ ] **Step 5: Create `LedgerRail.vue`**

Create `src/components/layout/LedgerRail.vue`:

```vue
<template>
  <aside class="ledger-rail" :data-testid="testid || undefined" :aria-label="title || 'Contexto'">
    <header v-if="title || subtitle" class="ledger-rail__header">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>
    <slot />
  </aside>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-rail {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.9rem;
  padding-left: 1rem;
  border-left: 1px solid var(--divider);
  background: transparent;
}

.ledger-rail__header {
  display: grid;
  gap: 0.25rem;
}

.ledger-rail h2,
.ledger-rail p {
  margin: 0;
}

.ledger-rail h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
  line-height: 1.25;
}

.ledger-rail p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

@media (max-width: 980px) {
  .ledger-rail {
    padding-left: 0;
    padding-top: 1rem;
    border-left: 0;
    border-top: 1px solid var(--divider);
  }
}
</style>
```

- [ ] **Step 6: Create `LedgerEmptyState.vue`**

Create `src/components/layout/LedgerEmptyState.vue`:

```vue
<template>
  <section class="ledger-empty-state" :data-testid="testid || undefined">
    <component v-if="icon" :is="icon" :size="32" aria-hidden="true" />
    <div>
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot name="actions" />
  </section>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function, String], default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  testid: { type: String, default: '' },
})
</script>

<style scoped>
.ledger-empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 1px dashed var(--divider-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  text-align: center;
}

.ledger-empty-state svg {
  color: var(--accent);
}

.ledger-empty-state h2,
.ledger-empty-state p {
  margin: 0;
}

.ledger-empty-state h2 {
  color: var(--text-primary);
  font-size: var(--text-lg);
}

.ledger-empty-state p {
  max-width: 520px;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
}
</style>
```

- [ ] **Step 7: Run focused ledger tests**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js
```

Expected: FAIL only on page migrations.

- [ ] **Step 8: Commit ledger components**

Run:

```bash
git add src/components/layout/LedgerPage.vue src/components/layout/LedgerSection.vue src/components/layout/LedgerStrip.vue src/components/layout/LedgerTable.vue src/components/layout/LedgerRail.vue src/components/layout/LedgerEmptyState.vue
git commit -m "feat: add fluid ledger layout primitives" -- src/components/layout/LedgerPage.vue src/components/layout/LedgerSection.vue src/components/layout/LedgerStrip.vue src/components/layout/LedgerTable.vue src/components/layout/LedgerRail.vue src/components/layout/LedgerEmptyState.vue
```

Expected: component commit.

---

### Task 4: Migrate Primary Authenticated Surfaces

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `src/views/Entries.vue`
- Modify: `src/views/FinancialStructure.vue`
- Modify: `src/views/Subscriptions.vue`
- Test: `tests/unit/fluid-ledger-global.test.js`
- Test: existing page contract tests

- [ ] **Step 1: Import ledger primitives in primary pages**

Add these imports to each file listed in this task, keeping existing imports intact:

```js
import LedgerPage from '@/components/layout/LedgerPage.vue'
import LedgerSection from '@/components/layout/LedgerSection.vue'
import LedgerStrip from '@/components/layout/LedgerStrip.vue'
import LedgerTable from '@/components/layout/LedgerTable.vue'
import LedgerRail from '@/components/layout/LedgerRail.vue'
```

If a page does not use every imported component after the migration, remove unused imports before committing.

- [ ] **Step 2: Add ledger root classes while preserving old route/test classes**

Update the main root elements:

In `src/views/Home.vue`, make the root include:

```vue
<div class="premium-dashboard ledger-page-shell" data-testid="dashboard-page">
```

In `src/views/Entries.vue`, make the root include:

```vue
<div class="entries-view operation-shell ledger-page-shell">
```

In `src/views/FinancialStructure.vue`, make the root include:

```vue
<div class="structure-view ledger-page-shell">
```

In `src/views/Subscriptions.vue`, make the root include:

```vue
<div class="subscriptions-view ledger-page-shell">
```

- [ ] **Step 3: Add authenticated ledger CSS helper block to `src/styles/main.css`**

Add after the shared surface block:

```css
.ledger-page-shell {
  background: transparent;
}

.ledger-flow {
  display: grid;
  gap: var(--section-gap);
}

.ledger-band {
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  background: var(--surface-muted);
}

.ledger-row-list {
  display: grid;
  border-top: 1px solid var(--divider);
}

.ledger-row {
  display: grid;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--divider);
}

.ledger-stat-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  background: var(--surface-muted);
}

.ledger-stat-strip > * {
  min-width: 0;
  padding: 0.85rem 1rem;
  border-right: 1px solid var(--divider);
}

.ledger-stat-strip > *:last-child {
  border-right: 0;
}
```

- [ ] **Step 4: Convert local panel/card CSS in primary pages to ledger behavior**

In each primary page, replace local raised panel definitions that include this pattern:

```css
  background: var(--gradient-panel);
  box-shadow: var(--shadow-card);
```

with:

```css
  background: transparent;
  box-shadow: none;
```

For KPI/card row classes that currently use box shadows, replace:

```css
  box-shadow: var(--shadow-card);
```

with:

```css
  box-shadow: none;
```

For hover blocks that only lift static content, remove `transform: translateY(...)` and keep:

```css
  border-color: var(--divider-strong);
```

- [ ] **Step 5: Add page-specific ledger anchors**

Add these literal CSS class names to the pages so the release test has stable anchors:

In `src/views/Home.vue`, add to the main dashboard metric container:

```html
class="ledger-stat-strip dashboard-ledger-strip"
```

In `src/views/Entries.vue`, add to the rail metric container:

```html
class="ledger-stat-strip entries-ledger-strip"
```

In `src/views/FinancialStructure.vue`, add to `.accounts-layout`:

```html
class="accounts-layout ledger-workspace"
```

In `src/views/Subscriptions.vue`, add to the subscription list wrapper or nearest equivalent:

```html
class="ledger-row-list subscriptions-ledger-list"
```

Where a page already renders a transaction/account/subscription table or list, wrap that region with `LedgerTable` and keep the existing row markup inside the default slot.

- [ ] **Step 6: Preserve allowed card exceptions**

Do not remove product/service identity cards in `src/views/Subscriptions.vue`. Add this comment above the service card/list item block:

```vue
<!-- Fluid ledger exception: repeated service identity item with logo and contextual actions. -->
```

Expected: subscription service tiles can remain visually contained but should inherit flatter global treatment.

- [ ] **Step 7: Run authenticated page tests**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js tests/unit/dashboard-layout-contract.test.js tests/unit/entries-view-contract.test.js tests/unit/financial-accounts-components.test.js tests/unit/subscriptions-view.test.js
```

Expected: PASS for migrated page contracts. If a legacy test asserts `box-shadow: var(--shadow-card)` on a migrated static surface, update that assertion to `box-shadow: none` or a ledger class anchor in the same commit.

- [ ] **Step 8: Commit authenticated ledger migration**

Run:

```bash
git add src/styles/main.css src/views/Home.vue src/views/Entries.vue src/views/FinancialStructure.vue src/views/Subscriptions.vue tests/unit/fluid-ledger-global.test.js tests/unit/dashboard-layout-contract.test.js tests/unit/entries-view-contract.test.js tests/unit/financial-accounts-components.test.js tests/unit/subscriptions-view.test.js
git commit -m "feat: migrate primary app surfaces to fluid ledger" -- src/styles/main.css src/views/Home.vue src/views/Entries.vue src/views/FinancialStructure.vue src/views/Subscriptions.vue tests/unit/fluid-ledger-global.test.js tests/unit/dashboard-layout-contract.test.js tests/unit/entries-view-contract.test.js tests/unit/financial-accounts-components.test.js tests/unit/subscriptions-view.test.js
```

Expected: one authenticated app migration commit.

---

### Task 5: Migrate Public, Pricing and Auth Surfaces

**Files:**
- Modify: `src/views/public/Landing.vue`
- Modify: `src/views/public/Pricing.vue`
- Modify: `src/views/Login.vue`
- Modify: `src/views/Signup.vue`
- Modify: `src/views/ForgotPassword.vue`
- Modify: `src/views/ResetPassword.vue`
- Modify: `src/views/AuthCallback.vue`
- Test: `tests/unit/fluid-ledger-global.test.js`
- Test: `tests/unit/public-visual-contract.test.js`
- Test: `tests/unit/global-visual-system.test.js`

- [ ] **Step 1: Convert Landing feature cards into ledger rows**

In `src/views/public/Landing.vue`, replace:

```vue
    <section class="features" aria-label="Recursos principais">
      <article class="feature-card">
```

with:

```vue
    <section class="features ledger-public-section ledger-row-list" aria-label="Recursos principais">
      <article class="feature-card ledger-row">
```

Apply the `feature-card ledger-row` class to all feature articles in that section.

- [ ] **Step 2: Convert Landing trust cards into ledger rows**

In `src/views/public/Landing.vue`, replace each trust article class:

```vue
<article class="trust-card">
```

with:

```vue
<article class="trust-card ledger-row">
```

- [ ] **Step 3: Replace Landing card CSS with continuous public surfaces**

In `src/views/public/Landing.vue`, replace the CSS block that targets `.metric-card, .feature-card, .trust-card` with:

```css
.metric-card,
.feature-card,
.trust-card {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--public-border);
  border-bottom: 1px solid var(--public-border);
  background: rgba(255, 255, 255, 0.56);
}

.preview-grid .metric-card {
  padding: 0.85rem 1rem;
  border-right: 1px solid var(--public-border);
}

.preview-grid .metric-card:last-child {
  border-right: 0;
}

.feature-card,
.trust-card {
  padding: 1rem 0;
  border-bottom: 1px solid var(--public-border);
}
```

- [ ] **Step 4: Convert Pricing cards into a comparison ledger**

In `src/views/public/Pricing.vue`, change:

```vue
      <section class="plans" aria-label="Comparação de planos">
```

to:

```vue
      <section class="plans ledger-pricing-table" aria-label="Comparação de planos">
```

Change each plan article opening tag:

```vue
        <article>
```

to:

```vue
        <article class="ledger-pricing-row">
```

Keep the featured plan as:

```vue
        <article class="ledger-pricing-row featured">
```

- [ ] **Step 5: Replace Pricing plan card CSS**

In `src/views/public/Pricing.vue`, replace `.plans` and `article` CSS with:

```css
.plans {
  display: grid;
  margin-top: 1rem;
  border-top: 1px solid var(--public-border);
}

.ledger-pricing-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.32fr) minmax(220px, 0.5fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--public-border);
  background: transparent;
  box-shadow: none;
}

.ledger-pricing-row.featured {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--public-border));
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  box-shadow: none;
}
```

Add this responsive block:

```css
@media (max-width: 820px) {
  .ledger-pricing-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Add global auth ledger classes**

In `src/styles/main.css`, add after `.auth-shell--single`:

```css
.auth-page.ledger-auth-page {
  background: var(--public-page-bg);
}

.ledger-auth-page .auth-form-card,
.ledger-auth-page .auth-panel-card {
  border-radius: 0;
  box-shadow: none;
}

.ledger-auth-page .auth-form-card {
  border: 0;
  border-right: 1px solid var(--public-border);
  background: rgba(255, 255, 255, 0.72);
}

.ledger-auth-page .auth-panel-card {
  border: 0;
  background: transparent;
}

.ledger-auth-page .auth-proof-grid article {
  border-radius: 0;
  box-shadow: none;
}
```

- [ ] **Step 7: Add auth root ledger classes**

In each auth view root, preserve existing classes and add `ledger-auth-page`.

Example:

```vue
<main class="auth-page ledger-auth-page" data-testid="login-page">
```

Apply the same addition in:

- `src/views/Login.vue`
- `src/views/Signup.vue`
- `src/views/ForgotPassword.vue`
- `src/views/ResetPassword.vue`
- `src/views/AuthCallback.vue`

- [ ] **Step 8: Update public/auth tests**

In `tests/unit/public-visual-contract.test.js`, replace expectations that require card-like plan or auth surfaces with:

```js
    expect(landing).toContain('ledger-public-section')
    expect(landing).toContain('ledger-row-list')
    expect(pricing).toContain('ledger-pricing-table')
    expect(pricing).toContain('ledger-pricing-row')
    expect(login).toContain('ledger-auth-page')
```

In `tests/unit/global-visual-system.test.js`, keep auth class expectations but add:

```js
    expect(sharedStyles).toContain('.auth-page.ledger-auth-page')
    expect(sharedStyles).toContain('.ledger-auth-page .auth-form-card')
```

- [ ] **Step 9: Run public/auth focused tests**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js tests/unit/public-visual-contract.test.js tests/unit/global-visual-system.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit public/auth ledger migration**

Run:

```bash
git add src/styles/main.css src/views/public/Landing.vue src/views/public/Pricing.vue src/views/Login.vue src/views/Signup.vue src/views/ForgotPassword.vue src/views/ResetPassword.vue src/views/AuthCallback.vue tests/unit/fluid-ledger-global.test.js tests/unit/public-visual-contract.test.js tests/unit/global-visual-system.test.js
git commit -m "feat: migrate public and auth surfaces to fluid ledger" -- src/styles/main.css src/views/public/Landing.vue src/views/public/Pricing.vue src/views/Login.vue src/views/Signup.vue src/views/ForgotPassword.vue src/views/ResetPassword.vue src/views/AuthCallback.vue tests/unit/fluid-ledger-global.test.js tests/unit/public-visual-contract.test.js tests/unit/global-visual-system.test.js
```

Expected: one public/auth migration commit.

---

### Task 6: Cleanup, Regression and Build

**Files:**
- Modify: `tests/unit/fluid-ledger-global.test.js`
- Modify: any page contract test that still asserts raised static cards
- Test: full suite

- [ ] **Step 1: Scan for static surfaces still using raised card shadows**

Run:

```bash
rg -n "box-shadow: var\\(--shadow-card\\)|box-shadow: var\\(--shadow-card-hover\\)|transform: translateY\\(-" src/views src/components src/styles
```

Expected: remaining matches are limited to floating UI, modals, dropdowns, toasts, product/result tiles, or documented service/product identity exceptions.

- [ ] **Step 2: Add allowlist comments where card exceptions remain**

For each remaining acceptable static visual card in migrated pages, add one of these comments directly above the block:

```vue
<!-- Fluid ledger exception: repeated product/result tile. -->
```

```vue
<!-- Fluid ledger exception: modal or floating interaction surface. -->
```

```vue
<!-- Fluid ledger exception: repeated service identity item with logo and contextual actions. -->
```

- [ ] **Step 3: Add an additional shadow-only regression check**

This complements the scoped motion and hover-shadow checks in the Task 1 contract by adding a final shadow-only scan for static surfaces.

In `tests/unit/fluid-ledger-global.test.js`, add:

```js
  it('does not reintroduce raised-card shadows on static surfaces', () => {
    const source = [
      read('src/styles/main.css'),
      read('src/styles/layout.css'),
      read('src/views/Home.vue'),
      read('src/views/Entries.vue'),
      read('src/views/FinancialStructure.vue'),
      read('src/views/public/Landing.vue'),
      read('src/views/public/Pricing.vue'),
    ].join('\n')

    for (const selector of ['.panel', '.summary-card', '.dashboard-panel', '.metric-card', '.kpi-card']) {
      const surfaceBlocks = blockFor(source, selector)
      expect(surfaceBlocks, `${selector} should not use raised card shadows`).not.toContain('box-shadow: var(--shadow-card)')
    }
  })
```

- [ ] **Step 4: Run focused visual regression tests**

Run:

```bash
npm test -- --run tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js tests/unit/public-visual-contract.test.js tests/unit/dashboard-layout-contract.test.js tests/unit/operations-ui-upgrade.test.js tests/unit/financial-accounts-components.test.js tests/unit/subscriptions-view.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run:

```bash
npm test -- --run --reporter=dot
```

Expected: all tests pass. Existing Supabase connectivity guard tests may print simulated network errors to stderr; the command exit code is authoritative.

- [ ] **Step 6: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds and `scripts/generate-spa-route-fallbacks.js` reports generated route fallbacks.

- [ ] **Step 7: Commit cleanup and final contracts**

Run:

```bash
git add tests/unit/fluid-ledger-global.test.js tests/unit/global-visual-system.test.js tests/unit/public-visual-contract.test.js tests/unit/dashboard-layout-contract.test.js tests/unit/operations-ui-upgrade.test.js tests/unit/financial-accounts-components.test.js tests/unit/subscriptions-view.test.js src/views src/components src/styles
git commit -m "chore: harden fluid ledger visual contracts"
```

Expected: final hardening commit. Review `git status --short` before committing and do not add unrelated pre-existing dirty files.

---

## Self-Review

Spec coverage:

- Global card-heavy visual replacement: Tasks 1, 2 and 6.
- Entire product scope: Tasks 4 and 5 cover authenticated, public and auth surfaces.
- Near-total card elimination: Tasks 2, 4, 5 and 6 flatten defaults and add regression tests.
- Hybrid two-layer implementation: Task 2 handles global deframing, Task 3 adds semantic components, Tasks 4 and 5 migrate high-visibility pages.
- Exceptions: Tasks 4 and 6 document allowed exceptions.
- Accessibility: Task 3 includes semantic components, focus remains from global CSS, and responsive behavior is defined in components.
- Testing/build: Tasks 1 and 6 define focused, full and build verification.

Known constraints:

- Several source files are currently untracked in this repository. Use `git status --short -- <paths>` before each commit and add only paths listed in that task.
- Do not remove marketplace/product result tiles or subscription service identity tiles just to satisfy a string search; mark them as documented ledger exceptions and flatten their visual treatment.
- Do not rewrite financial stores, domain logic or route architecture for this visual release.
