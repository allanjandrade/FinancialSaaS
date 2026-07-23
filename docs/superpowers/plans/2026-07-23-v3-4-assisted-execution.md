# V3.4 Assisted Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Version 3.4 so proactive agenda actions open a guided assisted-execution drawer with diagnosis, contextual execution, confirmation, and safe store writes.

**Architecture:** Extend the pure V3.3 agenda with execution metadata, add a pure `actionExecution` domain module, render a reusable assisted drawer in the Command Center, and keep all real writes in explicit confirmed handlers. Route-only or broad workflows keep a clear fallback instead of duplicating full pages inside the drawer.

**Tech Stack:** Vue 3 Composition API, Pinia finance store, Vue Router, Vitest, existing V3 domain modules, existing `ConfirmModal`/button visual hierarchy.

---

## File Structure

- Create `src/domain/v3/actionExecution.js`: pure mapping from agenda item to executable descriptor, confirmation summary, and AI-safe facts.
- Modify `src/domain/v3/proactiveOrchestrator.js`: add `executionType`, `executionMode`, `requiresConfirmation`, `contextKey`, and optional `subscriptionId` to agenda items.
- Create `src/components/v3/AssistedActionDrawer.vue`: drawer shell, diagnosis, confirmation, success/error display, dynamic action panels.
- Create `src/components/v3/actions/IncomeActionForm.vue`: minimal first-income draft form.
- Create `src/components/v3/actions/OcrReviewAction.vue`: OCR/import fallback panel with route CTA.
- Create `src/components/v3/actions/SubscriptionActionPanel.vue`: upcoming subscription action draft.
- Create `src/components/v3/actions/SubscriptionCutReview.vue`: dispensable subscription cut/pause selector.
- Create `src/components/v3/actions/GoalActionForm.vue`: minimal planning-goal draft form.
- Modify `src/views/CommandCenter.vue`: open drawer for drawer-mode actions, navigate route-mode actions, and execute confirmed writes through existing finance store methods.
- Modify `src/api/financial-analyst.js` and `src/views/IntelligenceCenter.vue`: send assisted execution facts only as explanatory context.
- Modify `src/config/app-version.js`, `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `scripts/validate-v3-release.js`, `tests/unit/v3-release-contract.test.js`: release 3.4 metadata and validation.
- Create `docs/releases/RELEASE3_4_0.md`: release note.
- Create tests:
  - `tests/unit/v3-4-action-execution.test.js`
  - `tests/unit/v3-4-assisted-drawer-contract.test.js`
  - `tests/unit/v3-4-command-center-assisted-execution.test.js`
  - `tests/unit/v3-4-ai-assisted-execution.test.js`

---

### Task 1: Execution Metadata And Domain Contract

**Files:**
- Create: `tests/unit/v3-4-action-execution.test.js`
- Later implementation targets: `src/domain/v3/actionExecution.js`, `src/domain/v3/proactiveOrchestrator.js`

- [ ] **Step 1: Write the failing domain contract**

Create `tests/unit/v3-4-action-execution.test.js` with this complete content:

```js
import { describe, expect, it } from 'vitest'
import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'
import {
  buildAssistedExecution,
  buildExecutionConfirmation,
  executionFactsForAI,
} from '@/domain/v3/actionExecution.js'

const referenceDate = '2026-07-23'

function subscription(overrides = {}) {
  return {
    id: 'sub-netflix',
    name: 'Netflix',
    provider: 'Netflix',
    category: 'Streaming',
    amount: 39.9,
    billing_cycle: 'monthly',
    next_billing_date: '2026-07-25',
    status: 'active',
    is_essential: false,
    url: 'https://www.netflix.com/cancelplan',
    ...overrides,
  }
}

describe('V3.4 assisted execution domain', () => {
  it('adds execution metadata to proactive agenda items without breaking route fields', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: { incomes: [], expenses: [], planningGoals: [], subscriptions: [] },
      monthData: { incomeCash: 0, cashExpenses: 0, cardBill: 0, cashBalance: 0 },
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'setup' },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'first-income',
      route: '/entries',
      executionType: 'first-income',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'income',
    })
  })

  it('maps first income into a drawer execution with a confirmation summary', () => {
    const item = {
      key: 'first-income',
      type: 'setup',
      title: 'Cadastre sua primeira receita',
      description: 'Sem renda real, a agenda bloqueia capacidade de gasto.',
      route: '/entries',
      actionLabel: 'Cadastrar receita',
      priority: 'critical',
      executionType: 'first-income',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'income',
    }

    const execution = buildAssistedExecution(item, {
      state: { financialAccounts: [{ id: 'acc-1', name: 'Conta principal' }] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'first-income',
      mode: 'drawer',
      canWrite: true,
      requiresConfirmation: true,
      route: '/entries',
      actionLabel: 'Confirmar receita',
    })
    expect(execution.draftDefaults).toMatchObject({
      description: 'Receita mensal',
      amount: 0,
      date: referenceDate,
      sourceId: 'acc-1',
    })

    const confirmation = buildExecutionConfirmation(execution, {
      description: 'Salario',
      amount: 5000,
      date: referenceDate,
      sourceId: 'acc-1',
    })

    expect(confirmation).toMatchObject({
      title: 'Confirmar receita',
      confirmLabel: 'Salvar receita',
      destructive: false,
    })
    expect(confirmation.message).toContain('Salario')
    expect(confirmation.message).toContain('R$ 5.000,00')
  })

  it('maps upcoming subscription charges to safe subscription actions', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        incomes: [{ amount: 5000 }],
        expenses: [],
        planningGoals: [],
        subscriptions: [subscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1200, cardBill: 300, cashBalance: 3500 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [{ ...subscription(), daysUntil: 2 }],
        next30Days: [],
        alerts: [],
      },
      commandCenter: { mode: 'optimize' },
      referenceDate,
    })

    const charge = agenda.items.find((item) => item.type === 'subscription-charge')
    expect(charge).toMatchObject({
      executionType: 'subscription-charge',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'sub-netflix',
      subscriptionId: 'sub-netflix',
    })

    const execution = buildAssistedExecution(charge, {
      state: { subscriptions: [subscription()] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'subscription-charge',
      mode: 'drawer',
      canWrite: true,
      route: '/subscriptions',
    })
    expect(execution.target).toMatchObject({ id: 'sub-netflix', name: 'Netflix' })
    expect(execution.draftDefaults).toMatchObject({ action: 'pause', nextBillingDate: '2026-07-25' })
    expect(execution.externalUrl).toBe('https://www.netflix.com/cancelplan')
  })

  it('keeps OCR review as a drawer explanation with route fallback and no write authority', () => {
    const item = {
      key: 'review-ocr-1',
      type: 'pending-review',
      title: 'Revise 1 lancamento reconhecido',
      description: 'OCR precisa de revisao.',
      route: '/entries',
      actionLabel: 'Revisar agora',
      priority: 'high',
      executionType: 'review-ocr',
      executionMode: 'drawer',
      requiresConfirmation: false,
      contextKey: 'ocr-1',
      impactAmount: 1,
    }

    const execution = buildAssistedExecution(item, { state: {}, referenceDate })

    expect(execution).toMatchObject({
      type: 'review-ocr',
      mode: 'drawer',
      canWrite: false,
      fallbackRoute: '/entries',
      actionLabel: 'Abrir revisao',
      requiresConfirmation: false,
    })
  })

  it('builds a subscription cut review with monthly and annual savings', () => {
    const item = {
      key: 'cut-dispensable-subscriptions',
      type: 'optimization',
      title: 'Corte assinaturas dispensaveis',
      description: 'Ha economia recorrente disponivel.',
      route: '/subscriptions',
      actionLabel: 'Revisar cortes',
      priority: 'medium',
      executionType: 'cut-dispensable-subscriptions',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'subscriptions',
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    }

    const execution = buildAssistedExecution(item, {
      state: { subscriptions: [subscription(), subscription({ id: 'icloud', name: 'iCloud', amount: 14.9, is_essential: true })] },
      referenceDate,
    })

    expect(execution).toMatchObject({
      type: 'cut-dispensable-subscriptions',
      mode: 'drawer',
      canWrite: true,
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    })
    expect(execution.options).toHaveLength(1)
    expect(execution.options[0]).toMatchObject({ id: 'sub-netflix', name: 'Netflix', monthlyAmount: 39.9 })
  })

  it('exports compact execution facts for AI without mutation authority', () => {
    const execution = buildAssistedExecution({
      key: 'create-first-goal',
      type: 'planning',
      title: 'Crie uma meta norteadora',
      description: 'Uma meta transforma sobra em plano.',
      route: '/goals',
      actionLabel: 'Criar meta',
      priority: 'medium',
      executionType: 'create-first-goal',
      executionMode: 'drawer',
      requiresConfirmation: true,
      contextKey: 'goal',
    }, { state: {}, referenceDate })

    const facts = executionFactsForAI(execution)

    expect(facts).toEqual(expect.objectContaining({
      type: 'create-first-goal',
      mode: 'drawer',
      requiresConfirmation: true,
      canWrite: false,
      route: '/goals',
    }))
    expect(JSON.stringify(facts)).not.toMatch(/undefined|null|confirmMutation|writeHandler/)
  })
})
```

- [ ] **Step 2: Run the contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-4-action-execution.test.js --reporter=dot
```

Expected: FAIL because `@/domain/v3/actionExecution.js` does not exist and agenda items do not yet expose execution metadata.

- [ ] **Step 3: Commit the failing contract**

Run:

```powershell
git add tests/unit/v3-4-action-execution.test.js
git commit -m "test: define v3.4 assisted execution domain"
```

Expected: one failing contract test committed.

---

### Task 2: Pure Assisted Execution Domain

**Files:**
- Create: `src/domain/v3/actionExecution.js`
- Modify: `src/domain/v3/proactiveOrchestrator.js`
- Test: `tests/unit/v3-4-action-execution.test.js`

- [ ] **Step 1: Create the pure domain module**

Create `src/domain/v3/actionExecution.js` with this complete content:

```js
import { subscriptionMonthlyEquivalent } from '@/utils/subscriptions.js'

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((money(value) + Number.EPSILON) * 100) / 100
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(money(value))
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function activeSubscriptions(state = {}) {
  return (state.subscriptions || []).filter((item) => {
    const status = String(item?.status || 'active').toLowerCase()
    return !item.deleted_at && !['cancelled', 'canceled', 'paused', 'expired'].includes(status)
  })
}

function findSubscription(state = {}, item = {}) {
  const id = item.subscriptionId || item.contextKey || String(item.key || '').replace(/^subscription-/, '').split(':')[0]
  return (state.subscriptions || []).find((subscription) => subscription.id === id) || null
}

function normalizeExecutionType(item = {}) {
  if (item.executionType) return item.executionType
  if (item.key === 'first-income') return 'first-income'
  if (item.type === 'pending-review' || String(item.key || '').startsWith('review-')) return 'review-ocr'
  if (item.type === 'subscription-charge' || String(item.key || '').startsWith('subscription-')) return 'subscription-charge'
  if (item.key === 'cut-dispensable-subscriptions') return 'cut-dispensable-subscriptions'
  if (item.key === 'create-first-goal') return 'create-first-goal'
  return 'route-fallback'
}

function baseExecution(item = {}, type, referenceDate) {
  const mode = item.executionMode || (type === 'route-fallback' ? 'route' : 'drawer')
  return {
    id: item.key || type,
    type,
    mode,
    title: item.title || item.label || 'Acao assistida',
    description: item.description || item.detail || '',
    route: item.route || '',
    fallbackRoute: item.route || '',
    actionLabel: item.actionLabel || item.label || 'Continuar',
    priority: item.priority || 'medium',
    requiresConfirmation: Boolean(item.requiresConfirmation ?? mode === 'drawer'),
    canWrite: false,
    destructive: false,
    impactAmount: roundMoney(item.impactAmount),
    annualImpactAmount: roundMoney(item.annualImpactAmount),
    diagnosis: [],
    draftDefaults: {},
    options: [],
    target: null,
    externalUrl: '',
    referenceDate: referenceDate || todayIso(),
  }
}

export function buildAssistedExecution(item = {}, context = {}) {
  const state = context.state || {}
  const referenceDate = context.referenceDate || todayIso()
  const type = normalizeExecutionType(item)
  const execution = baseExecution(item, type, referenceDate)

  if (type === 'first-income') {
    return {
      ...execution,
      actionLabel: 'Confirmar receita',
      canWrite: true,
      requiresConfirmation: true,
      diagnosis: [
        'Receita principal ausente.',
        'Gasto seguro e previsoes avancadas ficam bloqueados ate existir renda real.',
      ],
      draftDefaults: {
        description: 'Receita mensal',
        type: 'Salario',
        amount: 0,
        date: referenceDate,
        sourceId: state.financialAccounts?.[0]?.id || '',
      },
    }
  }

  if (type === 'review-ocr') {
    return {
      ...execution,
      actionLabel: 'Abrir revisao',
      canWrite: false,
      requiresConfirmation: false,
      diagnosis: [
        `${Math.max(1, money(item.impactAmount))} lancamento reconhecido aguarda revisao.`,
        'OCR e importacoes precisam de conferencia antes de criar dados financeiros.',
      ],
      draftDefaults: {
        route: item.route || '/entries',
      },
    }
  }

  if (type === 'subscription-charge') {
    const subscription = findSubscription(state, item)
    return {
      ...execution,
      actionLabel: 'Confirmar ajuste',
      canWrite: Boolean(subscription),
      requiresConfirmation: true,
      target: subscription,
      externalUrl: subscription?.url || '',
      diagnosis: [
        `${subscription?.name || item.title || 'Assinatura'} tem cobranca proxima.`,
        `Impacto previsto: ${formatMoney(item.impactAmount || subscription?.amount)}.`,
      ],
      draftDefaults: {
        action: 'pause',
        nextBillingDate: subscription?.next_billing_date || item.dueDate || referenceDate,
      },
    }
  }

  if (type === 'cut-dispensable-subscriptions') {
    const options = activeSubscriptions(state)
      .filter((subscription) => !subscription.is_essential && !subscription.isEssential)
      .map((subscription) => ({
        id: subscription.id,
        name: subscription.name,
        provider: subscription.provider || subscription.name,
        monthlyAmount: subscriptionMonthlyEquivalent(subscription),
      }))
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)

    return {
      ...execution,
      actionLabel: 'Confirmar cortes',
      canWrite: options.length > 0,
      requiresConfirmation: true,
      options,
      diagnosis: [
        `${formatMoney(item.impactAmount)} por mes pode ser revisado em assinaturas dispensaveis.`,
        `${formatMoney(item.annualImpactAmount)} por ano de impacto potencial.`,
      ],
      draftDefaults: {
        action: 'pause',
        subscriptionIds: options.map((option) => option.id),
      },
    }
  }

  if (type === 'create-first-goal') {
    return {
      ...execution,
      actionLabel: 'Confirmar meta',
      canWrite: true,
      requiresConfirmation: true,
      diagnosis: [
        'Nenhuma meta ativa orienta a sobra do mes.',
        'Uma meta transforma margem em plano financeiro.',
      ],
      draftDefaults: {
        name: 'Reserva de emergencia',
        targetAmount: 3000,
        currentAmount: 0,
        targetDate: '',
        monthlyContribution: 300,
      },
    }
  }

  return {
    ...execution,
    mode: 'route',
    requiresConfirmation: false,
    canWrite: false,
    diagnosis: ['Esta acao abre a tela responsavel pelo fluxo completo.'],
  }
}

export function buildExecutionConfirmation(execution = {}, draft = {}) {
  if (execution.type === 'first-income') {
    return {
      title: 'Confirmar receita',
      message: `Salvar ${draft.description || 'Receita mensal'} de ${formatMoney(draft.amount)} em ${draft.date || execution.referenceDate}.`,
      confirmLabel: 'Salvar receita',
      destructive: false,
    }
  }

  if (execution.type === 'subscription-charge') {
    const name = execution.target?.name || 'assinatura'
    const action = draft.action || 'pause'
    const label = action === 'cancel'
      ? 'cancelar logicamente'
      : action === 'updateDate'
        ? `alterar vencimento para ${draft.nextBillingDate || execution.referenceDate}`
        : 'pausar'
    return {
      title: action === 'cancel' ? 'Confirmar cancelamento' : 'Confirmar ajuste',
      message: `Voce esta prestes a ${label} ${name}.`,
      confirmLabel: action === 'cancel' ? 'Cancelar assinatura' : 'Confirmar ajuste',
      destructive: action === 'cancel',
    }
  }

  if (execution.type === 'cut-dispensable-subscriptions') {
    const count = (draft.subscriptionIds || []).length
    const action = draft.action === 'cancel' ? 'cancelar logicamente' : 'pausar'
    return {
      title: 'Confirmar revisao de assinaturas',
      message: `Voce esta prestes a ${action} ${count} assinatura${count === 1 ? '' : 's'} dispensavel${count === 1 ? '' : 'is'}.`,
      confirmLabel: draft.action === 'cancel' ? 'Cancelar selecionadas' : 'Pausar selecionadas',
      destructive: draft.action === 'cancel',
    }
  }

  if (execution.type === 'create-first-goal') {
    return {
      title: 'Confirmar meta',
      message: `Criar meta ${draft.name || 'Meta'} com alvo de ${formatMoney(draft.targetAmount)}.`,
      confirmLabel: 'Criar meta',
      destructive: false,
    }
  }

  return {
    title: 'Confirmar acao',
    message: execution.description || 'Revise antes de continuar.',
    confirmLabel: execution.actionLabel || 'Confirmar',
    destructive: Boolean(execution.destructive),
  }
}

export function executionFactsForAI(execution = {}) {
  return {
    type: execution.type || '',
    mode: execution.mode || 'route',
    title: execution.title || '',
    route: execution.route || '',
    fallbackRoute: execution.fallbackRoute || '',
    actionLabel: execution.actionLabel || '',
    requiresConfirmation: Boolean(execution.requiresConfirmation),
    canWrite: false,
    destructive: Boolean(execution.destructive),
    impactAmount: money(execution.impactAmount),
    annualImpactAmount: money(execution.annualImpactAmount),
    diagnosis: (execution.diagnosis || []).slice(0, 4),
  }
}
```

- [ ] **Step 2: Extend the agenda item factory**

In `src/domain/v3/proactiveOrchestrator.js`, replace the `agendaItem` parameter list with this version:

```js
function agendaItem({
  key,
  type,
  title,
  description,
  route,
  actionLabel,
  priority,
  horizon,
  dueDate = null,
  impactAmount = 0,
  annualImpactAmount = 0,
  source = 'system',
  executionType = null,
  executionMode = null,
  requiresConfirmation = false,
  contextKey = null,
  subscriptionId = null,
}) {
  return {
    key,
    type,
    title,
    description,
    route,
    actionLabel,
    priority,
    horizon,
    dueDate,
    impactAmount: roundMoney(impactAmount),
    annualImpactAmount: roundMoney(annualImpactAmount),
    source,
    executionType,
    executionMode,
    requiresConfirmation,
    contextKey,
    subscriptionId,
  }
}
```

- [ ] **Step 3: Add execution metadata to agenda item creation**

In `src/domain/v3/proactiveOrchestrator.js`, update these `agendaItem` calls by adding the shown properties:

```js
// first-income item
executionType: 'first-income',
executionMode: 'drawer',
requiresConfirmation: true,
contextKey: 'income',
```

```js
// pending review item
executionType: 'review-ocr',
executionMode: 'drawer',
requiresConfirmation: false,
contextKey: review.id,
```

```js
// subscription charge item
executionType: 'subscription-charge',
executionMode: 'drawer',
requiresConfirmation: true,
contextKey: charge.subscription_id || charge.id,
subscriptionId: charge.subscription_id || charge.id,
```

```js
// cut-dispensable-subscriptions item
executionType: 'cut-dispensable-subscriptions',
executionMode: 'drawer',
requiresConfirmation: true,
contextKey: 'subscriptions',
```

```js
// hold-wishlist item
executionType: 'route-fallback',
executionMode: 'route',
requiresConfirmation: false,
contextKey: 'wishlist',
```

```js
// create-first-goal item
executionType: 'create-first-goal',
executionMode: 'drawer',
requiresConfirmation: true,
contextKey: 'goal',
```

```js
// weekly-review item
executionType: 'route-fallback',
executionMode: 'route',
requiresConfirmation: false,
contextKey: 'planning',
```

- [ ] **Step 4: Run the focused domain test**

Run:

```powershell
npm test -- --run tests/unit/v3-4-action-execution.test.js tests/unit/v3-proactive-orchestrator.test.js --reporter=dot
```

Expected: PASS for both files.

- [ ] **Step 5: Commit the pure domain implementation**

Run:

```powershell
git add src/domain/v3/actionExecution.js src/domain/v3/proactiveOrchestrator.js tests/unit/v3-4-action-execution.test.js
git commit -m "feat: add v3.4 assisted execution domain"
```

Expected: one domain module, agenda metadata changes, and the contract test committed.

---

### Task 3: Assisted Drawer UI Components

**Files:**
- Create: `src/components/v3/AssistedActionDrawer.vue`
- Create: `src/components/v3/actions/IncomeActionForm.vue`
- Create: `src/components/v3/actions/OcrReviewAction.vue`
- Create: `src/components/v3/actions/SubscriptionActionPanel.vue`
- Create: `src/components/v3/actions/SubscriptionCutReview.vue`
- Create: `src/components/v3/actions/GoalActionForm.vue`
- Create: `tests/unit/v3-4-assisted-drawer-contract.test.js`

- [ ] **Step 1: Write the failing drawer contract**

Create `tests/unit/v3-4-assisted-drawer-contract.test.js` with this complete content:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.4 assisted action drawer contract', () => {
  it('provides a focused drawer shell with diagnosis, execution, confirmation and success states', () => {
    const drawer = read('src/components/v3/AssistedActionDrawer.vue')

    expect(drawer).toContain('data-testid="v34-assisted-drawer"')
    expect(drawer).toContain('role="dialog"')
    expect(drawer).toContain('aria-modal="true"')
    expect(drawer).toContain('buildExecutionConfirmation')
    expect(drawer).toContain('activeStep')
    expect(drawer).toContain('confirmation')
    expect(drawer).toContain("emit('confirm'")
    expect(drawer).toContain("emit('route'")
    expect(drawer).toContain('@keydown.esc')
  })

  it('keeps each execution panel isolated by action type', () => {
    const drawer = read('src/components/v3/AssistedActionDrawer.vue')

    for (const token of [
      "import IncomeActionForm from '@/components/v3/actions/IncomeActionForm.vue'",
      "import OcrReviewAction from '@/components/v3/actions/OcrReviewAction.vue'",
      "import SubscriptionActionPanel from '@/components/v3/actions/SubscriptionActionPanel.vue'",
      "import SubscriptionCutReview from '@/components/v3/actions/SubscriptionCutReview.vue'",
      "import GoalActionForm from '@/components/v3/actions/GoalActionForm.vue'",
    ]) {
      expect(drawer).toContain(token)
    }

    expect(read('src/components/v3/actions/IncomeActionForm.vue')).toContain('data-testid="v34-income-action-form"')
    expect(read('src/components/v3/actions/OcrReviewAction.vue')).toContain('data-testid="v34-ocr-review-action"')
    expect(read('src/components/v3/actions/SubscriptionActionPanel.vue')).toContain('data-testid="v34-subscription-action-panel"')
    expect(read('src/components/v3/actions/SubscriptionCutReview.vue')).toContain('data-testid="v34-subscription-cut-review"')
    expect(read('src/components/v3/actions/GoalActionForm.vue')).toContain('data-testid="v34-goal-action-form"')
  })
})
```

- [ ] **Step 2: Run the drawer contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-4-assisted-drawer-contract.test.js --reporter=dot
```

Expected: FAIL because the drawer and action panels do not exist.

- [ ] **Step 3: Create `IncomeActionForm.vue`**

Create `src/components/v3/actions/IncomeActionForm.vue` with this complete content:

```vue
<template>
  <form class="action-form" data-testid="v34-income-action-form" @submit.prevent>
    <label>Descricao<input :value="draft.description" @input="patch({ description: $event.target.value })" /></label>
    <label>Valor<input :value="draft.amount" type="number" min="0" step="0.01" @input="patch({ amount: Number($event.target.value) })" /></label>
    <label>Data<input :value="draft.date" type="date" @input="patch({ date: $event.target.value })" /></label>
    <label>Tipo<input :value="draft.type" @input="patch({ type: $event.target.value })" /></label>
  </form>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const draft = props.modelValue
function patch(next) {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
</script>

<style scoped>
.action-form { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.35rem; color: var(--text-secondary); font-size: 0.78rem; font-weight: 800; }
input { width: 100%; min-height: 42px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); padding: 0 0.75rem; }
</style>
```

- [ ] **Step 4: Create `OcrReviewAction.vue`**

Create `src/components/v3/actions/OcrReviewAction.vue` with this complete content:

```vue
<template>
  <section class="route-action" data-testid="v34-ocr-review-action">
    <p>Revise OCR e importacoes na tela de lancamentos para evitar dados duplicados ou incorretos.</p>
    <button class="secondary-button" type="button" @click="emit('route', execution)">
      {{ execution.actionLabel || 'Abrir revisao' }}
    </button>
  </section>
</template>

<script setup>
defineProps({
  execution: { type: Object, required: true },
})
const emit = defineEmits(['route'])
</script>

<style scoped>
.route-action { display: grid; gap: 0.75rem; }
.route-action p { margin: 0; color: var(--text-secondary); line-height: 1.5; }
</style>
```

- [ ] **Step 5: Create `SubscriptionActionPanel.vue`**

Create `src/components/v3/actions/SubscriptionActionPanel.vue` with this complete content:

```vue
<template>
  <section class="subscription-action" data-testid="v34-subscription-action-panel">
    <div v-if="execution.target" class="target-row">
      <strong>{{ execution.target.name }}</strong>
      <span>{{ formatCurrency(execution.target.amount) }}</span>
    </div>
    <a v-if="execution.externalUrl" :href="execution.externalUrl" target="_blank" rel="noopener noreferrer">Abrir link do servico</a>
    <p v-else class="muted">Nenhum link de cancelamento cadastrado para este servico.</p>
    <label>Acao
      <select :value="draft.action" @change="patch({ action: $event.target.value })">
        <option value="pause">Pausar assinatura</option>
        <option value="cancel">Cancelar logicamente</option>
        <option value="updateDate">Alterar vencimento</option>
      </select>
    </label>
    <label v-if="draft.action === 'updateDate'">Novo vencimento
      <input :value="draft.nextBillingDate" type="date" @input="patch({ nextBillingDate: $event.target.value })" />
    </label>
  </section>
</template>

<script setup>
const props = defineProps({
  execution: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const draft = props.modelValue
function patch(next) {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.subscription-action { display: grid; gap: 0.75rem; }
.target-row { display: flex; justify-content: space-between; gap: 1rem; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; background: var(--bg-elevated); }
label { display: grid; gap: 0.35rem; color: var(--text-secondary); font-size: 0.78rem; font-weight: 800; }
select, input { min-height: 42px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); padding: 0 0.75rem; }
a { color: var(--accent); font-weight: 800; }
.muted { margin: 0; color: var(--text-secondary); }
</style>
```

- [ ] **Step 6: Create `SubscriptionCutReview.vue`**

Create `src/components/v3/actions/SubscriptionCutReview.vue` with this complete content:

```vue
<template>
  <section class="cut-review" data-testid="v34-subscription-cut-review">
    <div class="impact">
      <span>Economia potencial</span>
      <strong>{{ formatCurrency(execution.impactAmount) }}/mes</strong>
      <small>{{ formatCurrency(execution.annualImpactAmount) }}/ano</small>
    </div>
    <label>Acao
      <select :value="draft.action" @change="patch({ action: $event.target.value })">
        <option value="pause">Pausar selecionadas</option>
        <option value="cancel">Cancelar logicamente</option>
      </select>
    </label>
    <label v-for="option in execution.options" :key="option.id" class="check-row">
      <input type="checkbox" :checked="selected(option.id)" @change="toggle(option.id)" />
      <span>{{ option.name }}</span>
      <strong>{{ formatCurrency(option.monthlyAmount) }}</strong>
    </label>
  </section>
</template>

<script setup>
const props = defineProps({
  execution: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({ subscriptionIds: [] }) },
})
const emit = defineEmits(['update:modelValue'])
const draft = props.modelValue
function patch(next) {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
function selected(id) {
  return (props.modelValue.subscriptionIds || []).includes(id)
}
function toggle(id) {
  const current = props.modelValue.subscriptionIds || []
  patch({ subscriptionIds: selected(id) ? current.filter((item) => item !== id) : [...current, id] })
}
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.cut-review { display: grid; gap: 0.75rem; }
.impact, .check-row { border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); padding: 0.75rem; }
.impact { display: grid; gap: 0.2rem; }
.impact span, .impact small { color: var(--text-secondary); }
label { color: var(--text-secondary); font-size: 0.78rem; font-weight: 800; }
select { width: 100%; min-height: 42px; margin-top: 0.35rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); padding: 0 0.75rem; }
.check-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.55rem; align-items: center; }
</style>
```

- [ ] **Step 7: Create `GoalActionForm.vue`**

Create `src/components/v3/actions/GoalActionForm.vue` with this complete content:

```vue
<template>
  <form class="action-form" data-testid="v34-goal-action-form" @submit.prevent>
    <label>Nome<input :value="draft.name" @input="patch({ name: $event.target.value })" /></label>
    <label>Alvo<input :value="draft.targetAmount" type="number" min="0" step="0.01" @input="patch({ targetAmount: Number($event.target.value) })" /></label>
    <label>Valor atual<input :value="draft.currentAmount" type="number" min="0" step="0.01" @input="patch({ currentAmount: Number($event.target.value) })" /></label>
    <label>Prazo<input :value="draft.targetDate" type="date" @input="patch({ targetDate: $event.target.value })" /></label>
    <label>Aporte mensal<input :value="draft.monthlyContribution" type="number" min="0" step="0.01" @input="patch({ monthlyContribution: Number($event.target.value) })" /></label>
  </form>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const draft = props.modelValue
function patch(next) {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
</script>

<style scoped>
.action-form { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.35rem; color: var(--text-secondary); font-size: 0.78rem; font-weight: 800; }
input { width: 100%; min-height: 42px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); padding: 0 0.75rem; }
</style>
```

- [ ] **Step 8: Create `AssistedActionDrawer.vue`**

Create `src/components/v3/AssistedActionDrawer.vue` with this complete content:

```vue
<template>
  <Teleport to="body">
    <transition name="drawer">
      <div v-if="show && execution" class="assisted-layer" data-testid="v34-assisted-drawer" @click.self="emit('close')">
        <aside class="assisted-drawer" role="dialog" aria-modal="true" :aria-label="execution.title" @keydown.esc="emit('close')">
          <header>
            <div>
              <span>Execucao assistida</span>
              <h2>{{ execution.title }}</h2>
              <p>{{ execution.description }}</p>
            </div>
            <button type="button" aria-label="Fechar execucao assistida" @click="emit('close')">×</button>
          </header>

          <section class="diagnosis">
            <span>Diagnostico</span>
            <ul>
              <li v-for="line in execution.diagnosis" :key="line">{{ line }}</li>
            </ul>
          </section>

          <section v-if="activeStep === 'execute'" class="execution-step">
            <IncomeActionForm v-if="execution.type === 'first-income'" v-model="draft" />
            <OcrReviewAction v-else-if="execution.type === 'review-ocr'" :execution="execution" @route="emit('route', execution)" />
            <SubscriptionActionPanel v-else-if="execution.type === 'subscription-charge'" v-model="draft" :execution="execution" />
            <SubscriptionCutReview v-else-if="execution.type === 'cut-dispensable-subscriptions'" v-model="draft" :execution="execution" />
            <GoalActionForm v-else-if="execution.type === 'create-first-goal'" v-model="draft" />
            <p v-else class="empty">Esta acao sera aberta na tela responsavel.</p>
          </section>

          <section v-else-if="activeStep === 'confirmation'" class="confirmation-step">
            <span>Confirmacao</span>
            <h3>{{ confirmation.title }}</h3>
            <p>{{ confirmation.message }}</p>
            <p v-if="error" class="error">{{ error }}</p>
          </section>

          <section v-else class="success-step">
            <span>Concluido</span>
            <h3>Agenda atualizada</h3>
            <p>A acao foi aplicada. A Central de Comando vai recalcular as prioridades com os dados atualizados.</p>
          </section>

          <footer>
            <button class="secondary-button" type="button" @click="emit('close')">Fechar</button>
            <button v-if="activeStep === 'execute' && execution.mode === 'route'" class="primary-button" type="button" @click="emit('route', execution)">Abrir tela</button>
            <button v-else-if="activeStep === 'execute' && execution.canWrite" class="primary-button" type="button" @click="prepareConfirmation">Revisar confirmacao</button>
            <button v-else-if="activeStep === 'confirmation'" class="primary-button" :class="{ destructive: confirmation.destructive }" type="button" :disabled="submitting" @click="emit('confirm', { execution, draft, confirmation })">
              {{ submitting ? 'Salvando...' : confirmation.confirmLabel }}
            </button>
          </footer>
        </aside>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import IncomeActionForm from '@/components/v3/actions/IncomeActionForm.vue'
import OcrReviewAction from '@/components/v3/actions/OcrReviewAction.vue'
import SubscriptionActionPanel from '@/components/v3/actions/SubscriptionActionPanel.vue'
import SubscriptionCutReview from '@/components/v3/actions/SubscriptionCutReview.vue'
import GoalActionForm from '@/components/v3/actions/GoalActionForm.vue'
import { buildExecutionConfirmation } from '@/domain/v3/actionExecution.js'

const props = defineProps({
  show: Boolean,
  execution: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: '' },
  successToken: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'confirm', 'route'])
const activeStep = ref('execute')
const draft = ref({})
const confirmation = ref({})

watch(
  () => props.execution,
  (execution) => {
    activeStep.value = 'execute'
    draft.value = { ...(execution?.draftDefaults || {}) }
    confirmation.value = {}
  },
  { immediate: true },
)

watch(
  () => props.successToken,
  (value, oldValue) => {
    if (value && value !== oldValue) activeStep.value = 'success'
  },
)

function prepareConfirmation() {
  confirmation.value = buildExecutionConfirmation(props.execution, draft.value)
  activeStep.value = 'confirmation'
}
</script>

<style scoped>
.assisted-layer { position: fixed; inset: 0; z-index: 10020; display: flex; justify-content: flex-end; background: rgba(15, 23, 42, 0.36); }
.assisted-drawer { width: min(520px, 100vw); height: 100%; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 1rem; overflow: auto; border-left: 1px solid var(--divider); background: var(--surface-ledger); color: var(--text-primary); padding: 1rem; box-shadow: -18px 0 40px rgba(15, 23, 42, 0.18); }
header { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
header span, .diagnosis span, .confirmation-step span, .success-step span { color: var(--accent); font-size: var(--text-xs); font-weight: 900; letter-spacing: var(--eyebrow-letter-spacing); text-transform: uppercase; }
header h2 { margin: 0.2rem 0; font-size: 1.25rem; }
header p, .diagnosis li, .empty, .confirmation-step p, .success-step p { color: var(--text-secondary); line-height: 1.5; }
header button { width: 36px; height: 36px; border: 1px solid var(--border-color); border-radius: 999px; background: var(--bg-elevated); color: var(--text-primary); cursor: pointer; }
.diagnosis { border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-elevated); padding: 0.85rem; }
.diagnosis ul { margin: 0.5rem 0 0; padding-left: 1.1rem; }
.execution-step, .confirmation-step, .success-step { min-width: 0; display: grid; gap: 0.85rem; align-content: start; }
.error { color: var(--danger); }
footer { display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--border-color); padding-top: 1rem; }
.primary-button.destructive { background: var(--danger); }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.18s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
@media (max-width: 640px) {
  .assisted-drawer { width: 100vw; border-left: 0; }
}
</style>
```

- [ ] **Step 9: Run drawer contract**

Run:

```powershell
npm test -- --run tests/unit/v3-4-assisted-drawer-contract.test.js --reporter=dot
```

Expected: PASS.

- [ ] **Step 10: Commit drawer components**

Run:

```powershell
git add src/components/v3/AssistedActionDrawer.vue src/components/v3/actions/IncomeActionForm.vue src/components/v3/actions/OcrReviewAction.vue src/components/v3/actions/SubscriptionActionPanel.vue src/components/v3/actions/SubscriptionCutReview.vue src/components/v3/actions/GoalActionForm.vue tests/unit/v3-4-assisted-drawer-contract.test.js
git commit -m "feat: add v3.4 assisted action drawer"
```

Expected: drawer shell, action panels, and UI contract committed.

---

### Task 4: Command Center Assisted Execution Integration

**Files:**
- Modify: `src/views/CommandCenter.vue`
- Create: `tests/unit/v3-4-command-center-assisted-execution.test.js`

- [ ] **Step 1: Write the failing Command Center integration contract**

Create `tests/unit/v3-4-command-center-assisted-execution.test.js` with this complete content:

```js
import fs from 'node:fs'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommandCenter from '@/views/CommandCenter.vue'
import { useFinanceStore } from '@/stores/finance.js'

const read = (file) => fs.readFileSync(file, 'utf8')

function mountCommandCenter(seed = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  store.setActiveUser('v34-assisted-user')
  Object.assign(store.state, {
    settings: { selectedMonth: 7, year: 2026 },
    incomes: [],
    expenses: [],
    financialAccounts: [{ id: 'acc-1', name: 'Conta principal', balance: 0 }],
    creditCards: [],
    planningGoals: [],
    subscriptions: [],
    subscriptionCharges: [],
    wishlist: [],
    ...seed,
  })

  const push = vi.fn()
  const wrapper = mount(CommandCenter, {
    global: {
      plugins: [pinia],
      mocks: {},
      stubs: {
        PageShell: { template: '<main><slot name="actions" /><slot /></main>' },
        FinancialOSMap: true,
        AssistedActionDrawer: {
          props: ['show', 'execution', 'submitting', 'error', 'successToken'],
          emits: ['close', 'confirm', 'route'],
          template: '<aside v-if="show" data-testid="assisted-drawer-stub">{{ execution?.type }}</aside>',
        },
      },
      provide: {},
    },
  })
  wrapper.vm.$router = { push }
  return { wrapper, store, push }
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('V3.4 Command Center assisted execution integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T12:00:00.000Z'))
    localStorage.clear()
  })

  it('imports the drawer and execution domain instead of routing every action immediately', () => {
    const view = read('src/views/CommandCenter.vue')

    expect(view).toContain("import AssistedActionDrawer from '@/components/v3/AssistedActionDrawer.vue'")
    expect(view).toContain("import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'")
    expect(view).toContain('const selectedAssistedAction = ref(null)')
    expect(view).toContain('<AssistedActionDrawer')
    expect(view).toContain('@confirm="confirmAssistedAction"')
    expect(view).toContain('execution.mode === \\'drawer\\'')
  })

  it('opens the drawer for first income and only writes after confirmation', async () => {
    const { wrapper, store } = mountCommandCenter()

    await wrapper.get('[data-testid="v33-next-best-action"] button.primary-button').trigger('click')

    expect(wrapper.get('[data-testid="assisted-drawer-stub"]').text()).toContain('first-income')
    expect(store.state.incomes).toHaveLength(0)

    await wrapper.findComponent({ name: 'AssistedActionDrawer' }).vm.$emit('confirm', {
      execution: wrapper.vm.assistedExecution,
      draft: { description: 'Salario', amount: 5000, date: '2026-07-23', type: 'Salario', sourceId: 'acc-1' },
      confirmation: { title: 'Confirmar receita' },
    })

    expect(store.state.incomes).toHaveLength(1)
    expect(store.state.incomes[0]).toMatchObject({
      description: 'Salario',
      amount: 5000,
      date: '2026-07-23',
    })
  })
})
```

- [ ] **Step 2: Run the contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-4-command-center-assisted-execution.test.js --reporter=dot
```

Expected: FAIL because `CommandCenter.vue` does not import or render the assisted drawer yet.

- [ ] **Step 3: Update Command Center imports**

In `src/views/CommandCenter.vue`, change the Vue import and add these imports:

```js
import { computed, ref } from 'vue'
import AssistedActionDrawer from '@/components/v3/AssistedActionDrawer.vue'
import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
```

- [ ] **Step 4: Render the assisted drawer**

In `src/views/CommandCenter.vue`, insert this block before `</PageShell>`:

```vue
    <AssistedActionDrawer
      :show="Boolean(selectedAssistedAction)"
      :execution="assistedExecution"
      :submitting="assistedSubmitting"
      :error="assistedError"
      :success-token="assistedSuccessToken"
      @close="closeAssistedDrawer"
      @route="openAssistedRoute"
      @confirm="confirmAssistedAction"
    />
```

- [ ] **Step 5: Add assisted execution state and computed descriptor**

In `src/views/CommandCenter.vue`, place this after `const financeStore = useFinanceStore()`:

```js
const selectedAssistedAction = ref(null)
const assistedSubmitting = ref(false)
const assistedError = ref('')
const assistedSuccessToken = ref(0)
```

Place this immediately after the existing `const proactiveAgenda = computed(() => buildProactiveFinancialAgenda` block:

```js
const assistedExecution = computed(() => selectedAssistedAction.value
  ? buildAssistedExecution(selectedAssistedAction.value, {
    state: financeStore.state,
    subscriptionSummary: subscriptionSummary.value,
    referenceDate: dashboardReferenceDate.value,
  })
  : null)
```

- [ ] **Step 6: Replace `runAction` with drawer-aware routing**

Replace the existing `runAction` function in `src/views/CommandCenter.vue` with:

```js
function runAction(action) {
  if (!action) return
  const execution = buildAssistedExecution(action, {
    state: financeStore.state,
    subscriptionSummary: subscriptionSummary.value,
    referenceDate: dashboardReferenceDate.value,
  })
  if (execution.mode === 'drawer') {
    selectedAssistedAction.value = action
    assistedError.value = ''
    return
  }
  if (execution.route) router.push(execution.route)
}
```

- [ ] **Step 7: Add drawer route, close, and confirmed write handlers**

Add these functions below `runAction` in `src/views/CommandCenter.vue`:

```js
function closeAssistedDrawer() {
  selectedAssistedAction.value = null
  assistedSubmitting.value = false
  assistedError.value = ''
}

function openAssistedRoute(execution) {
  selectedAssistedAction.value = null
  if (execution?.fallbackRoute || execution?.route) router.push(execution.fallbackRoute || execution.route)
}

async function confirmAssistedAction({ execution, draft }) {
  if (!execution?.canWrite) return
  assistedSubmitting.value = true
  assistedError.value = ''
  try {
    if (execution.type === 'first-income') {
      financeStore.addIncome({
        description: draft.description,
        amount: Number(draft.amount || 0),
        date: draft.date || dashboardReferenceDate.value,
        type: draft.type || 'Salario',
        sourceType: SOURCE_TYPES.ACCOUNT,
        sourceId: draft.sourceId || financeStore.state.financialAccounts[0]?.id,
      })
    } else if (execution.type === 'subscription-charge') {
      applySubscriptionAction(execution.target?.id, draft)
    } else if (execution.type === 'cut-dispensable-subscriptions') {
      ;(draft.subscriptionIds || []).forEach((subscriptionId) => applySubscriptionAction(subscriptionId, draft))
    } else if (execution.type === 'create-first-goal') {
      financeStore.addPlanningGoal({
        name: draft.name,
        target_amount: Number(draft.targetAmount || 0),
        current_amount: Number(draft.currentAmount || 0),
        target_date: draft.targetDate || '',
        monthly_contribution: Number(draft.monthlyContribution || 0),
        status: 'active',
      })
    }
    assistedSuccessToken.value += 1
  } catch (error) {
    assistedError.value = error.message || 'Nao foi possivel aplicar esta acao.'
  } finally {
    assistedSubmitting.value = false
  }
}

function applySubscriptionAction(subscriptionId, draft = {}) {
  if (!subscriptionId) return null
  if (draft.action === 'cancel') return financeStore.cancelSubscription(subscriptionId, dashboardReferenceDate.value)
  if (draft.action === 'updateDate') {
    return financeStore.updateSubscription(subscriptionId, { next_billing_date: draft.nextBillingDate || dashboardReferenceDate.value })
  }
  return financeStore.pauseSubscription(subscriptionId)
}
```

- [ ] **Step 8: Run focused Command Center tests**

Run:

```powershell
npm test -- --run tests/unit/v3-4-command-center-assisted-execution.test.js tests/unit/v3-command-center-proactive.test.js tests/unit/v3-3-onboarding-mode.test.js --reporter=dot
```

Expected: PASS for all three files.

- [ ] **Step 9: Commit Command Center integration**

Run:

```powershell
git add src/views/CommandCenter.vue tests/unit/v3-4-command-center-assisted-execution.test.js
git commit -m "feat: wire assisted execution into command center"
```

Expected: Command Center drawer integration committed.

---

### Task 5: AI Assisted Execution Facts

**Files:**
- Modify: `src/api/financial-analyst.js`
- Modify: `src/views/IntelligenceCenter.vue`
- Create: `tests/unit/v3-4-ai-assisted-execution.test.js`

- [ ] **Step 1: Write the failing AI context contract**

Create `tests/unit/v3-4-ai-assisted-execution.test.js` with this complete content:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildAssistedExecution, executionFactsForAI } from '@/domain/v3/actionExecution.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.4 assisted execution AI context', () => {
  it('sends assisted execution facts as explanatory context only', () => {
    const analyst = read('src/api/financial-analyst.js')
    const intelligence = read('src/views/IntelligenceCenter.vue')

    expect(analyst).toContain("import { executionFactsForAI } from '@/domain/v3/actionExecution.js'")
    expect(analyst).toContain('assistedExecution = null')
    expect(analyst).toContain('v34Execution: assistedExecution ? executionFactsForAI(assistedExecution) : null')
    expect(intelligence).toContain("import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'")
    expect(intelligence).toContain('const assistedExecution = computed(() => buildAssistedExecution')
    expect(intelligence).toContain('assistedExecution: assistedExecution.value')
  })

  it('never exposes write handlers to AI facts', () => {
    const execution = buildAssistedExecution({
      key: 'first-income',
      title: 'Cadastre sua primeira receita',
      route: '/entries',
      executionType: 'first-income',
      executionMode: 'drawer',
      requiresConfirmation: true,
    }, { state: {}, referenceDate: '2026-07-23' })

    const facts = executionFactsForAI(execution)

    expect(facts.canWrite).toBe(false)
    expect(JSON.stringify(facts)).not.toMatch(/addIncome|pauseSubscription|cancelSubscription|updateSubscription/)
  })
})
```

- [ ] **Step 2: Run the AI contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-4-ai-assisted-execution.test.js --reporter=dot
```

Expected: FAIL because the analyst payload does not include V3.4 execution facts yet.

- [ ] **Step 3: Update `financial-analyst.js`**

Add this import:

```js
import { executionFactsForAI } from '@/domain/v3/actionExecution.js'
```

Change the function signature to:

```js
export async function explainFinancialAnalysis({ familyId, analysis, question, commandCenter = null, proactiveAgenda = null, assistedExecution = null }) {
```

Add this field after `v33Agenda` in the `facts` object:

```js
        v34Execution: assistedExecution ? executionFactsForAI(assistedExecution) : null,
```

- [ ] **Step 4: Update `IntelligenceCenter.vue`**

Add this import:

```js
import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'
```

Add this computed value after `proactiveAgenda`:

```js
const assistedExecution = computed(() => buildAssistedExecution(
  proactiveAgenda.value.nextBestAction,
  {
    state: financeStore.state,
    subscriptionSummary: subscriptionSummary.value,
    referenceDate: dashboardReferenceDate.value,
  },
))
```

Update the `explainFinancialAnalysis` call to include:

```js
      assistedExecution: assistedExecution.value,
```

- [ ] **Step 5: Run focused AI tests**

Run:

```powershell
npm test -- --run tests/unit/v3-4-ai-assisted-execution.test.js tests/unit/v3-ai-proactive-agenda.test.js tests/unit/v3-ai-command-integration.test.js --reporter=dot
```

Expected: PASS for all three files.

- [ ] **Step 6: Commit AI facts integration**

Run:

```powershell
git add src/api/financial-analyst.js src/views/IntelligenceCenter.vue tests/unit/v3-4-ai-assisted-execution.test.js
git commit -m "feat: send assisted execution facts to AI"
```

Expected: V3.4 AI context committed.

---

### Task 6: Release 3.4.0 Metadata And Validator

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/config/app-version.js`
- Modify: `scripts/validate-v3-release.js`
- Modify: `tests/unit/v3-release-contract.test.js`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/releases/RELEASE3_4_0.md`

- [ ] **Step 1: Update package version**

Run:

```powershell
npm version 3.4.0 --no-git-tag-version
```

Expected: `package.json` and `package-lock.json` root versions become `3.4.0`.

- [ ] **Step 2: Update runtime version config**

Replace `src/config/app-version.js` with:

```js
export const APP_VERSION = '3.4.0'
export const APP_RELEASE_CHANNEL = 'stable'
export const APP_RELEASE_DATE = '2026-07-23'
```

- [ ] **Step 3: Update release contract test**

In `tests/unit/v3-release-contract.test.js`, update version expectations from `3.3.0` to `3.4.0`.

Add these release-doc assertions after the 3.3 release doc assertions:

```js
    expect(exists('docs/releases/RELEASE3_4_0.md')).toBe(true)
    expect(read('docs/releases/RELEASE3_4_0.md')).toContain('# Release 3.4.0 - Execucao Assistida')
```

Update the README expectation to:

```js
    expect(readme).toContain('Versão atual: 3.4.0')
```

- [ ] **Step 4: Update `scripts/validate-v3-release.js`**

Set:

```js
const currentVersion = '3.4.0'
```

Add these assertions after the V3.3 proactive assertions:

```js
assert.ok(exists('src/domain/v3/actionExecution.js'), 'V3.4 assisted execution domain module is missing.')
const assistedExecution = read('src/domain/v3/actionExecution.js')
for (const token of ['buildAssistedExecution', 'buildExecutionConfirmation', 'executionFactsForAI']) {
  assert.ok(assistedExecution.includes(token), `V3.4 assisted execution is missing ${token}.`)
}
assert.ok(exists('src/components/v3/AssistedActionDrawer.vue'), 'V3.4 assisted drawer is missing.')
assert.ok(read('src/components/v3/AssistedActionDrawer.vue').includes('data-testid="v34-assisted-drawer"'), 'V3.4 assisted drawer test id is missing.')
for (const token of [
  "import AssistedActionDrawer from '@/components/v3/AssistedActionDrawer.vue'",
  "import { buildAssistedExecution } from '@/domain/v3/actionExecution.js'",
  '<AssistedActionDrawer',
  '@confirm="confirmAssistedAction"',
]) {
  assert.ok(commandCenterView.includes(token), `Command center is missing V3.4 token ${token}.`)
}
assert.ok(
  read('src/api/financial-analyst.js').includes('v34Execution: assistedExecution ? executionFactsForAI(assistedExecution) : null'),
  'Financial analyst must send V3.4 execution facts.'
)
assert.ok(exists('docs/releases/RELEASE3_4_0.md'), 'Release 3.4.0 document is missing.')
assert.ok(
  read('docs/releases/RELEASE3_4_0.md').includes('# Release 3.4.0 - Execucao Assistida'),
  'Release 3.4.0 document has the wrong heading.'
)
```

- [ ] **Step 5: Create release document**

Create `docs/releases/RELEASE3_4_0.md` with:

```md
# Release 3.4.0 - Execucao Assistida

## Objetivo

Transformar a agenda proativa em execucao guiada com diagnostico, formulario contextual, confirmacao explicita e retorno ao Command Center.

## Principais mudancas

- Novo dominio puro para execucao assistida em `src/domain/v3/actionExecution.js`.
- Agenda V3 passa a declarar metadata de execucao por item.
- Central de Comando abre drawer contextual para acoes executaveis.
- Acoes de receita, meta e assinatura exigem confirmacao antes de escrita.
- OCR/importacao usa fallback limpo para Lancamentos sem duplicar o fluxo completo.
- IA consultiva recebe fatos da execucao assistida sem autoridade de mutacao.

## Validacao esperada

- `npm test -- --run --reporter=dot`
- `npm run validate:v3-release`
- `npm run build`
```

- [ ] **Step 6: Update README and changelog**

In `README.md`, change the current version line to:

```md
**Versão atual: 3.4.0**
```

In `CHANGELOG.md`, add this entry above `## 3.3.0 - 2026-07-23`:

```md
## 3.4.0 - 2026-07-23

- Adicionada execucao assistida para prioridades da Central de Comando.
- Agenda proativa passa a carregar metadata de execucao segura.
- Drawer contextual guia receita inicial, metas e acoes de assinaturas com confirmacao.
- IA consultiva recebe contexto da execucao sem poder gravar dados.
- Metadata e validador de release atualizados para 3.4.0.

```

- [ ] **Step 7: Run focused release tests**

Run:

```powershell
npm test -- --run tests/unit/v3-release-contract.test.js tests/unit/v3-4-action-execution.test.js tests/unit/v3-4-assisted-drawer-contract.test.js tests/unit/v3-4-command-center-assisted-execution.test.js tests/unit/v3-4-ai-assisted-execution.test.js --reporter=dot
npm run validate:v3-release
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit release metadata**

Run:

```powershell
git add package.json package-lock.json src/config/app-version.js scripts/validate-v3-release.js tests/unit/v3-release-contract.test.js README.md CHANGELOG.md docs/releases/RELEASE3_4_0.md
git commit -m "chore: release v3.4.0 assisted execution"
```

Expected: release metadata committed.

---

### Task 7: Full Verification

**Files:**
- No source edits unless verification exposes a concrete defect.

- [ ] **Step 1: Run full unit suite**

Run:

```powershell
npm test -- --run --reporter=dot
```

Expected: all Vitest files pass. If `tests/unit/supabase-connectivity-guards.test.js` prints a simulated fetch error to stderr while exit code remains 0, treat it as expected test behavior.

- [ ] **Step 2: Run release validator**

Run:

```powershell
npm run validate:v3-release
```

Expected: output includes:

```text
Version 3.4.0 validation: PASS
```

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: Vite build exits 0 and postbuild prints:

```text
Generated SPA fallbacks for 63 routes.
```

- [ ] **Step 4: Confirm workspace cleanliness**

Run:

```powershell
git status --short
```

Expected: no output. If `dist/` exists after build, it remains ignored by `.gitignore` and must not appear in `git status --short`.

---

## Self-Review

- Spec coverage: execution metadata, assisted drawer, first income, OCR fallback, subscription actions, dispensable cuts, goal creation, AI facts, release metadata, and verification are covered by Tasks 1 through 7.
- Boundary check: execution decisions live in pure domain code; store writes stay in explicit Command Center handlers after confirmation.
- UI scope check: drawer shell owns flow; action panels own local draft input; pages are not duplicated.
- Safety check: no write happens on drawer open; OCR has no write authority; AI receives facts only.
- Test coverage: domain tests, UI contract tests, Command Center integration tests, AI context tests, release tests, full suite, validator, and build are included.
