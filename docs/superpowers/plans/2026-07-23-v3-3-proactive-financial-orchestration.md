# Release 3.3.0 Proactive Financial Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build release 3.3.0 as a proactive financial orchestration layer that turns existing finance data into a prioritized agenda, next best action, AI-ready facts, and short first-steps flow.

**Architecture:** Add a pure domain module under `src/domain/v3/proactiveOrchestrator.js` that consumes existing state snapshots, subscription summaries, command-center output, and optional pending review data. The UI reads that pure output through focused V3 components, while the AI analyst receives the same facts to explain recommendations without duplicating rules.

**Tech Stack:** Vue 3, Pinia, Vue Router, Vitest, Vite, existing V3 domain modules, existing subscription and financial intelligence utilities.

---

## File Structure

- Create `src/domain/v3/proactiveOrchestrator.js`: pure orchestration rules for first steps, agenda items, blockers, prioritized alerts, and AI facts.
- Create `tests/unit/v3-proactive-orchestrator.test.js`: domain contract for agenda priority, missing income, upcoming subscriptions, pending OCR/import review, dispensable subscriptions, and AI facts.
- Create `src/components/v3/NextBestAction.vue`: present the highest-priority action and blockers without adding another large card grid.
- Create `src/components/v3/FinancialAgenda.vue`: render agenda groups as a fluid list grouped by horizon.
- Create `src/components/v3/FirstStepsStrip.vue`: compact first-steps progression for users without minimum data.
- Modify `src/views/CommandCenter.vue`: consume the proactive agenda and render the new components.
- Create `tests/unit/v3-command-center-proactive.test.js`: static and domain-backed contract for Command Center integration.
- Modify `src/api/financial-analyst.js`: include agenda facts in AI payload.
- Modify `src/views/IntelligenceCenter.vue`: compute the proactive agenda and pass it to the analyst API.
- Create `tests/unit/v3-ai-proactive-agenda.test.js`: AI integration contract.
- Create `tests/unit/v3-3-onboarding-mode.test.js`: first-steps and empty-state contract.
- Modify `package.json`, `package-lock.json`, `src/config/app-version.js`, `scripts/validate-v3-release.js`, `README.md`, `CHANGELOG.md`.
- Create `docs/releases/RELEASE3_3_0.md`.
- Modify `tests/unit/v3-release-contract.test.js`: version contract for 3.3.0.

---

### Task 1: Proactive Agenda Domain Contract

**Files:**
- Create: `tests/unit/v3-proactive-orchestrator.test.js`
- Later implementation target: `src/domain/v3/proactiveOrchestrator.js`

- [ ] **Step 1: Write the failing domain contract**

Create `tests/unit/v3-proactive-orchestrator.test.js` with this complete content:

```js
import { describe, expect, it } from 'vitest'
import {
  buildFirstStepsChecklist,
  buildProactiveFinancialAgenda,
  v33AgendaFactsForAI,
} from '@/domain/v3/proactiveOrchestrator.js'

const referenceDate = '2026-07-23'

const baseState = {
  settings: { year: 2026, selectedMonth: 7 },
  incomes: [],
  expenses: [],
  financialAccounts: [],
  creditCards: [],
  planningGoals: [],
  subscriptions: [],
  wishlist: [],
  importSessions: [],
}

function monthlySubscription(overrides = {}) {
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
    ...overrides,
  }
}

describe('V3.3 proactive financial agenda', () => {
  it('prioritizes missing income before spending recommendations', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: baseState,
      monthData: { incomeCash: 0, cashExpenses: 0, cardBill: 0, cashBalance: 0 },
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'setup', actions: [] },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'first-income',
      title: 'Cadastre sua primeira receita',
      route: '/entries',
      priority: 'critical',
      horizon: 'today',
    })
    expect(agenda.blockers).toContainEqual(expect.objectContaining({
      key: 'missing-income',
      route: '/entries',
    }))
    expect(agenda.blockedMetrics).toEqual(['safe-spend', 'purchase-capacity', 'advanced-forecast'])
    expect(agenda.items[0].key).toBe('first-income')
  })

  it('shows upcoming subscription charges in the next seven days', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1500, cardBill: 600, cashBalance: 3200 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [monthlySubscription()],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })

    expect(agenda.items).toContainEqual(expect.objectContaining({
      key: 'subscription-sub-netflix',
      type: 'subscription-charge',
      title: 'Netflix vence em 2 dias',
      route: '/subscriptions',
      dueDate: '2026-07-25',
      impactAmount: 39.9,
      horizon: 'next7',
    }))
    expect(agenda.grouped.next7.map((item) => item.key)).toContain('subscription-sub-netflix')
  })

  it('raises pending OCR or statement review above optimization advice', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1200, cardBill: 300, cashBalance: 3500 },
      pendingReviews: [{ id: 'ocr-1', kind: 'ocr', count: 1 }],
      subscriptionSummary: { totalMonthly: 0, next7Days: [], next30Days: [], alerts: [] },
      commandCenter: { mode: 'operate', actions: [] },
      referenceDate,
    })

    expect(agenda.nextBestAction).toMatchObject({
      key: 'review-ocr-1',
      title: 'Revise 1 lancamento reconhecido',
      route: '/entries',
      priority: 'high',
      horizon: 'today',
    })
    expect(agenda.alerts[0].key).toBe('review-ocr-1')
  })

  it('calculates dispensable subscription savings with monthly and annual impact', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 4500, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 4500, cashExpenses: 1800, cardBill: 700, cashBalance: 2600 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })

    expect(agenda.items).toContainEqual(expect.objectContaining({
      key: 'cut-dispensable-subscriptions',
      type: 'optimization',
      title: 'Corte assinaturas dispensaveis',
      route: '/subscriptions',
      impactAmount: 39.9,
      annualImpactAmount: 478.8,
    }))
    expect(agenda.impact).toMatchObject({
      avoidableMonthly: 39.9,
      avoidableAnnual: 478.8,
    })
  })

  it('exports compact facts for AI without raw technical labels', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        ...baseState,
        incomes: [{ id: 'inc-1', amount: 5000, date: '2026-07-01' }],
        subscriptions: [monthlySubscription()],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1500, cardBill: 600, cashBalance: 3200 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [monthlySubscription()],
        next30Days: [monthlySubscription()],
        alerts: [],
      },
      commandCenter: { mode: 'optimize', actions: [] },
      referenceDate,
    })
    const facts = v33AgendaFactsForAI(agenda)

    expect(facts.nextBestAction).toMatchObject({
      key: expect.any(String),
      title: expect.any(String),
      route: expect.any(String),
      priority: expect.any(String),
    })
    expect(facts.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(facts)).not.toMatch(/stable|undefined|null/)
  })

  it('builds a short first-steps checklist for new users', () => {
    const steps = buildFirstStepsChecklist(baseState)

    expect(steps).toEqual([
      expect.objectContaining({ key: 'first-income', label: 'Cadastrar receita', route: '/entries', status: 'current' }),
      expect.objectContaining({ key: 'first-expense', label: 'Registrar despesa', route: '/entries', status: 'locked' }),
      expect.objectContaining({ key: 'first-goal', label: 'Criar meta', route: '/goals', status: 'locked' }),
      expect.objectContaining({ key: 'review-month', label: 'Revisar resumo', route: '/dashboard', status: 'locked' }),
    ])
  })
})
```

- [ ] **Step 2: Run the contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-proactive-orchestrator.test.js --reporter=dot
```

Expected: FAIL with module resolution error for `@/domain/v3/proactiveOrchestrator.js`.

- [ ] **Step 3: Commit the failing contract**

Run:

```powershell
git add tests/unit/v3-proactive-orchestrator.test.js
git commit -m "test: define v3.3 proactive agenda contract"
```

Expected: one test file committed.

---

### Task 2: Pure Proactive Orchestrator

**Files:**
- Create: `src/domain/v3/proactiveOrchestrator.js`
- Test: `tests/unit/v3-proactive-orchestrator.test.js`

- [ ] **Step 1: Create the pure domain module**

Create `src/domain/v3/proactiveOrchestrator.js` with this complete content:

```js
import { subscriptionMonthlyEquivalent } from '@/utils/subscriptions.js'

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 }
const horizonRank = { today: 0, next7: 1, month: 2, later: 3 }

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((money(value) + Number.EPSILON) * 100) / 100
}

function activeItems(items = []) {
  return items.filter((item) => {
    const status = String(item?.status || 'active').toLowerCase()
    return !item?.deleted_at && !['cancelled', 'canceled', 'paused', 'expired', 'done', 'completed'].includes(status)
  })
}

function parseDate(value) {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function daysUntil(dateValue, referenceDate) {
  const date = parseDate(dateValue)
  const reference = parseDate(referenceDate)
  if (!date || !reference) return null
  return Math.round((date.getTime() - reference.getTime()) / 86400000)
}

function horizonFor(days) {
  if (days == null) return 'later'
  if (days <= 0) return 'today'
  if (days <= 7) return 'next7'
  if (days <= 31) return 'month'
  return 'later'
}

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
  }
}

function sortAgenda(items = []) {
  return [...items].sort((a, b) => {
    const priority = priorityRank[a.priority] - priorityRank[b.priority]
    if (priority !== 0) return priority
    const horizon = horizonRank[a.horizon] - horizonRank[b.horizon]
    if (horizon !== 0) return horizon
    return money(b.impactAmount) - money(a.impactAmount)
  })
}

function groupAgenda(items = []) {
  return {
    today: items.filter((item) => item.horizon === 'today'),
    next7: items.filter((item) => item.horizon === 'next7'),
    month: items.filter((item) => item.horizon === 'month'),
    later: items.filter((item) => item.horizon === 'later'),
  }
}

function hasIncome(state = {}, monthData = {}) {
  return money(monthData.incomeCash) > 0 || (state.incomes || []).some((item) => money(item.amount) > 0)
}

function hasExpense(state = {}, monthData = {}) {
  return money(monthData.cashExpenses) > 0 || money(monthData.cardBill) > 0 || (state.expenses || []).some((item) => money(item.amount) > 0)
}

function hasGoal(state = {}) {
  return activeItems(state.planningGoals || []).length > 0
}

function pendingReviewRows(state = {}, pendingReviews = []) {
  const explicit = Array.isArray(pendingReviews) ? pendingReviews : []
  const persisted = Array.isArray(state.pendingReviews) ? state.pendingReviews : []
  const importSessions = (state.importSessions || [])
    .filter((session) => ['pending', 'pending_review', 'review'].includes(String(session?.status || '').toLowerCase()))
    .map((session) => ({
      id: session.id,
      kind: session.type || 'statement',
      count: session.summary?.createCount || session.summary?.totalRows || 1,
    }))
  return [...explicit, ...persisted, ...importSessions].filter((item) => item?.id)
}

function nextCharges(subscriptionSummary = {}, state = {}, referenceDate) {
  const fromSummary = [
    ...(subscriptionSummary.next7Days || []),
    ...(subscriptionSummary.next15Days || []),
    ...(subscriptionSummary.next30Days || []),
  ]
  const fromState = activeItems(state.subscriptions || [])
  const byId = new Map()
  ;[...fromSummary, ...fromState].forEach((item) => {
    const id = item.id || item.subscription_id || `${item.name}-${item.next_billing_date}`
    if (!id || byId.has(id)) return
    const days = item.daysUntil ?? daysUntil(item.next_billing_date || item.dueDate, referenceDate)
    if (days == null || days > 31) return
    byId.set(id, { ...item, id, daysUntil: days })
  })
  return [...byId.values()]
}

function dispensableMonthly(state = {}, subscriptionSummary = {}) {
  if (money(subscriptionSummary.dispensableMonthly) > 0) return roundMoney(subscriptionSummary.dispensableMonthly)
  return roundMoney(activeItems(state.subscriptions || [])
    .filter((item) => !item.is_essential && !item.isEssential)
    .reduce((sum, item) => sum + subscriptionMonthlyEquivalent(item), 0))
}

export function buildFirstStepsChecklist(state = {}, monthData = {}) {
  const incomeDone = hasIncome(state, monthData)
  const expenseDone = hasExpense(state, monthData)
  const goalDone = hasGoal(state)
  const summaryDone = incomeDone && (expenseDone || goalDone)
  return [
    { key: 'first-income', label: 'Cadastrar receita', route: '/entries', status: incomeDone ? 'done' : 'current' },
    { key: 'first-expense', label: 'Registrar despesa', route: '/entries', status: !incomeDone ? 'locked' : expenseDone ? 'done' : 'current' },
    { key: 'first-goal', label: 'Criar meta', route: '/goals', status: !incomeDone || !expenseDone ? 'locked' : goalDone ? 'done' : 'current' },
    { key: 'review-month', label: 'Revisar resumo', route: '/dashboard', status: summaryDone ? 'done' : 'locked' },
  ]
}

export function buildProactiveFinancialAgenda({
  state = {},
  monthData = {},
  subscriptionSummary = {},
  commandCenter = {},
  pendingReviews = [],
  referenceDate = new Date().toISOString().slice(0, 10),
} = {}) {
  const items = []
  const blockers = []
  const firstSteps = buildFirstStepsChecklist(state, monthData)
  const incomeReady = hasIncome(state, monthData)

  if (!incomeReady) {
    blockers.push({
      key: 'missing-income',
      title: 'Receita ausente',
      description: 'Cadastre sua renda principal para liberar gasto seguro, previsoes e recomendacoes confiaveis.',
      route: '/entries',
      actionLabel: 'Cadastrar receita',
    })
    items.push(agendaItem({
      key: 'first-income',
      type: 'setup',
      title: 'Cadastre sua primeira receita',
      description: 'Sem renda real, a agenda bloqueia capacidade de gasto e projecoes avancadas.',
      route: '/entries',
      actionLabel: 'Cadastrar receita',
      priority: 'critical',
      horizon: 'today',
      source: 'first-steps',
    }))
  }

  pendingReviewRows(state, pendingReviews).forEach((review) => {
    const count = Math.max(1, Number(review.count || 1))
    items.push(agendaItem({
      key: `review-${review.id}`,
      type: 'pending-review',
      title: `Revise ${count} lancamento${count === 1 ? '' : 's'} reconhecido${count === 1 ? '' : 's'}`,
      description: 'OCR e importacoes precisam de revisao antes de criar dados financeiros.',
      route: '/entries',
      actionLabel: 'Revisar agora',
      priority: 'high',
      horizon: 'today',
      impactAmount: count,
      source: review.kind || 'review',
    }))
  })

  nextCharges(subscriptionSummary, state, referenceDate).forEach((charge) => {
    const days = Number(charge.daysUntil)
    const name = charge.name || charge.provider || 'Assinatura'
    const dueDate = charge.next_billing_date || charge.dueDate || null
    items.push(agendaItem({
      key: `subscription-${charge.id}`,
      type: 'subscription-charge',
      title: `${name} vence ${days <= 0 ? 'hoje' : `em ${days} dia${days === 1 ? '' : 's'}`}`,
      description: `Cobranca prevista de ${name}. Revise forma de pagamento e necessidade antes do vencimento.`,
      route: '/subscriptions',
      actionLabel: 'Gerenciar assinatura',
      priority: days <= 3 ? 'high' : 'medium',
      horizon: horizonFor(days),
      dueDate,
      impactAmount: charge.amount,
      source: 'subscriptions',
    }))
  })

  const avoidableMonthly = dispensableMonthly(state, subscriptionSummary)
  if (avoidableMonthly > 0 && incomeReady) {
    items.push(agendaItem({
      key: 'cut-dispensable-subscriptions',
      type: 'optimization',
      title: 'Corte assinaturas dispensaveis',
      description: `Ha ${roundMoney(avoidableMonthly).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por mes em servicos marcados como dispensaveis.`,
      route: '/subscriptions',
      actionLabel: 'Revisar cortes',
      priority: commandCenter.mode === 'protect' ? 'high' : 'medium',
      horizon: 'month',
      impactAmount: avoidableMonthly,
      annualImpactAmount: avoidableMonthly * 12,
      source: 'subscriptions',
    }))
  }

  const wishlistTotal = activeItems(state.wishlist || []).reduce((sum, item) => sum + money(item.value || item.currentPrice || item.targetPrice), 0)
  if (wishlistTotal > 0 && (commandCenter.mode === 'protect' || money(monthData.cashBalance) < 0)) {
    items.push(agendaItem({
      key: 'hold-wishlist',
      type: 'risk-control',
      title: 'Segure compras da wishlist',
      description: 'Compras planejadas devem esperar ate o fluxo do mes voltar a zona segura.',
      route: '/purchases',
      actionLabel: 'Revisar wishlist',
      priority: 'high',
      horizon: 'month',
      impactAmount: wishlistTotal,
      source: 'wishlist',
    }))
  }

  if (incomeReady && !hasGoal(state)) {
    items.push(agendaItem({
      key: 'create-first-goal',
      type: 'planning',
      title: 'Crie uma meta norteadora',
      description: 'Uma meta transforma sobra em plano e reduz decisoes financeiras soltas.',
      route: '/goals',
      actionLabel: 'Criar meta',
      priority: hasExpense(state, monthData) ? 'medium' : 'low',
      horizon: 'month',
      source: 'goals',
    }))
  }

  if (!items.length) {
    items.push(agendaItem({
      key: 'weekly-review',
      type: 'maintenance',
      title: 'Revise sua semana financeira',
      description: 'Acompanhe vencimentos, metas e margem antes de assumir novos compromissos.',
      route: '/plan',
      actionLabel: 'Abrir planejamento',
      priority: 'low',
      horizon: 'next7',
      source: 'cadence',
    }))
  }

  const sorted = sortAgenda(items)
  const impact = {
    avoidableMonthly,
    avoidableAnnual: roundMoney(avoidableMonthly * 12),
    totalPrioritizedImpact: roundMoney(sorted.reduce((sum, item) => sum + money(item.impactAmount), 0)),
  }

  return {
    nextBestAction: sorted[0],
    items: sorted,
    agendaItems: sorted,
    grouped: groupAgenda(sorted),
    blockers,
    blockedMetrics: blockers.length ? ['safe-spend', 'purchase-capacity', 'advanced-forecast'] : [],
    firstSteps,
    impact,
    alerts: sorted.filter((item) => ['critical', 'high'].includes(item.priority)),
  }
}

export function v33AgendaFactsForAI(agenda = {}) {
  const cleanItem = (item = {}) => ({
    key: item.key || '',
    type: item.type || '',
    title: item.title || '',
    priority: item.priority || 'low',
    horizon: item.horizon || 'later',
    route: item.route || '',
    actionLabel: item.actionLabel || '',
    impactAmount: money(item.impactAmount),
    annualImpactAmount: money(item.annualImpactAmount),
    dueDate: item.dueDate || '',
  })
  return {
    nextBestAction: agenda.nextBestAction ? cleanItem(agenda.nextBestAction) : null,
    items: (agenda.items || []).slice(0, 8).map(cleanItem),
    blockers: (agenda.blockers || []).map((blocker) => ({
      key: blocker.key || '',
      title: blocker.title || '',
      route: blocker.route || '',
      actionLabel: blocker.actionLabel || '',
    })),
    impact: {
      avoidableMonthly: money(agenda.impact?.avoidableMonthly),
      avoidableAnnual: money(agenda.impact?.avoidableAnnual),
      totalPrioritizedImpact: money(agenda.impact?.totalPrioritizedImpact),
    },
  }
}
```

- [ ] **Step 2: Run the focused domain test**

Run:

```powershell
npm test -- --run tests/unit/v3-proactive-orchestrator.test.js --reporter=dot
```

Expected: PASS for `tests/unit/v3-proactive-orchestrator.test.js`.

- [ ] **Step 3: Run related V3 command tests**

Run:

```powershell
npm test -- --run tests/unit/v3-command-center.test.js tests/unit/v3-command-center-deep.test.js tests/unit/v3-operating-system.test.js --reporter=dot
```

Expected: PASS for existing V3 command-center behavior.

- [ ] **Step 4: Commit the domain module**

Run:

```powershell
git add src/domain/v3/proactiveOrchestrator.js tests/unit/v3-proactive-orchestrator.test.js
git commit -m "feat: add v3.3 proactive agenda domain"
```

Expected: one domain module and one contract test committed.

---

### Task 3: Command Center Proactive UI

**Files:**
- Create: `src/components/v3/NextBestAction.vue`
- Create: `src/components/v3/FinancialAgenda.vue`
- Modify: `src/views/CommandCenter.vue`
- Create: `tests/unit/v3-command-center-proactive.test.js`

- [ ] **Step 1: Write the failing Command Center integration test**

Create `tests/unit/v3-command-center-proactive.test.js` with this complete content:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 proactive command center UI', () => {
  it('renders next best action and financial agenda from the proactive orchestrator', () => {
    const commandCenter = read('src/views/CommandCenter.vue')

    expect(commandCenter).toContain("import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(commandCenter).toContain("import NextBestAction from '@/components/v3/NextBestAction.vue'")
    expect(commandCenter).toContain("import FinancialAgenda from '@/components/v3/FinancialAgenda.vue'")
    expect(commandCenter).toContain('const proactiveAgenda = computed(() => buildProactiveFinancialAgenda')
    expect(commandCenter).toContain('<NextBestAction')
    expect(commandCenter).toContain('<FinancialAgenda')
  })

  it('keeps the agenda visual as a list instead of another card grid', () => {
    const agenda = read('src/components/v3/FinancialAgenda.vue')
    const nextAction = read('src/components/v3/NextBestAction.vue')

    expect(agenda).toContain('data-testid="v33-financial-agenda"')
    expect(agenda).toContain('v33-agenda-list')
    expect(agenda).toContain('v33-agenda-item')
    expect(agenda).not.toContain('grid-template-columns: repeat(3')

    expect(nextAction).toContain('data-testid="v33-next-best-action"')
    expect(nextAction).toContain('emit(')
    expect(nextAction).toContain('blockers')
  })
})
```

- [ ] **Step 2: Run the UI contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-command-center-proactive.test.js --reporter=dot
```

Expected: FAIL because the new components and imports are not present.

- [ ] **Step 3: Create `NextBestAction.vue`**

Create `src/components/v3/NextBestAction.vue` with this complete content:

```vue
<template>
  <section class="next-best-action" data-testid="v33-next-best-action">
    <div class="next-best-action__copy">
      <span>Melhor proxima acao</span>
      <h2>{{ action?.title || 'Complete a base financeira' }}</h2>
      <p>{{ action?.description || 'Cadastre receita, primeira despesa e meta para ativar recomendacoes confiaveis.' }}</p>
    </div>

    <div class="next-best-action__side">
      <button class="primary-button" type="button" @click="emit('run', action)">
        {{ action?.actionLabel || 'Comecar agora' }}
        <ArrowRight />
      </button>
      <div v-if="blockers.length" class="next-best-action__blockers">
        <strong>Dados pendentes</strong>
        <button v-for="blocker in blockers" :key="blocker.key" type="button" @click="emit('run', blocker)">
          {{ blocker.title }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ArrowRight } from 'lucide-vue-next'

defineProps({
  action: { type: Object, default: null },
  blockers: { type: Array, default: () => [] },
})

const emit = defineEmits(['run'])
</script>

<style scoped>
.next-best-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, auto);
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--divider-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: clamp(1rem, 2vw, 1.35rem);
}

.next-best-action__copy {
  display: grid;
  gap: 0.35rem;
}

.next-best-action__copy span,
.next-best-action__blockers strong {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.next-best-action__copy h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
}

.next-best-action__copy p {
  max-width: 820px;
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.next-best-action__side {
  display: grid;
  gap: 0.65rem;
  justify-items: end;
}

.next-best-action__side .primary-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.next-best-action__side svg {
  width: 16px;
}

.next-best-action__blockers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.next-best-action__blockers strong {
  width: 100%;
  text-align: right;
}

.next-best-action__blockers button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}

@media (max-width: 760px) {
  .next-best-action {
    grid-template-columns: 1fr;
  }

  .next-best-action__side {
    justify-items: stretch;
  }

  .next-best-action__blockers,
  .next-best-action__blockers strong {
    justify-content: flex-start;
    text-align: left;
  }
}
</style>
```

- [ ] **Step 4: Create `FinancialAgenda.vue`**

Create `src/components/v3/FinancialAgenda.vue` with this complete content:

```vue
<template>
  <section class="financial-agenda" data-testid="v33-financial-agenda">
    <header>
      <div>
        <span>Agenda financeira</span>
        <h2>Prioridades do periodo</h2>
      </div>
      <strong>{{ totalItems }}</strong>
    </header>

    <div class="v33-agenda-list">
      <article v-for="group in visibleGroups" :key="group.key" class="agenda-group">
        <h3>{{ group.label }}</h3>
        <button
          v-for="item in group.items"
          :key="item.key"
          class="v33-agenda-item"
          :class="item.priority"
          data-testid="v33-agenda-item"
          type="button"
          @click="emit('run', item)"
        >
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <em>{{ item.actionLabel }}</em>
        </button>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  groups: {
    type: Object,
    default: () => ({ today: [], next7: [], month: [], later: [] }),
  },
})

const emit = defineEmits(['run'])

const groupLabels = [
  { key: 'today', label: 'Hoje' },
  { key: 'next7', label: 'Proximos 7 dias' },
  { key: 'month', label: 'Este mes' },
  { key: 'later', label: 'Depois' },
]

const visibleGroups = computed(() => groupLabels
  .map((group) => ({ ...group, items: props.groups[group.key] || [] }))
  .filter((group) => group.items.length))

const totalItems = computed(() => visibleGroups.value.reduce((sum, group) => sum + group.items.length, 0))
</script>

<style scoped>
.financial-agenda {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  overflow: hidden;
}

.financial-agenda header {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.financial-agenda header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.financial-agenda header h2 {
  margin: 0.12rem 0 0;
  font-size: 1.05rem;
}

.financial-agenda header strong {
  color: var(--accent);
  font-size: 1.6rem;
}

.v33-agenda-list {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.agenda-group {
  display: grid;
  gap: 0.5rem;
}

.agenda-group h3 {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.v33-agenda-item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: center;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: inherit;
  padding: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.v33-agenda-item.critical {
  border-left-color: var(--expense);
}

.v33-agenda-item.high {
  border-left-color: var(--warning);
}

.v33-agenda-item span {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.v33-agenda-item small {
  color: var(--text-secondary);
  line-height: 1.45;
}

.v33-agenda-item em {
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
  padding: 0.32rem 0.6rem;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .v33-agenda-item {
    grid-template-columns: 1fr;
  }

  .v33-agenda-item em {
    justify-self: start;
  }
}
</style>
```

- [ ] **Step 5: Modify `CommandCenter.vue` imports**

In `src/views/CommandCenter.vue`, add these imports with the existing V3 imports:

```js
import NextBestAction from '@/components/v3/NextBestAction.vue'
import FinancialAgenda from '@/components/v3/FinancialAgenda.vue'
import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'
```

- [ ] **Step 6: Add the proactive agenda computed value**

In `src/views/CommandCenter.vue`, place this computed value after the existing `command` computed:

```js
const proactiveAgenda = computed(() => buildProactiveFinancialAgenda({
  state: financeStore.state,
  monthData: monthData.value,
  subscriptionSummary: subscriptionSummary.value,
  commandCenter: command.value,
  referenceDate: dashboardReferenceDate.value,
}))
```

- [ ] **Step 7: Render the proactive blocks below the hero**

In `src/views/CommandCenter.vue`, insert this block immediately after the closing `</section>` for `.command-hero`:

```vue
    <NextBestAction
      :action="proactiveAgenda.nextBestAction"
      :blockers="proactiveAgenda.blockers"
      @run="runAction"
    />

    <FinancialAgenda
      :groups="proactiveAgenda.grouped"
      @run="runAction"
    />
```

- [ ] **Step 8: Run focused UI tests**

Run:

```powershell
npm test -- --run tests/unit/v3-command-center-proactive.test.js tests/unit/v3-proactive-orchestrator.test.js --reporter=dot
```

Expected: PASS for both files.

- [ ] **Step 9: Run existing V3 route and UX contracts**

Run:

```powershell
npm test -- --run tests/unit/v3-command-center-route.test.js tests/unit/v3-dashboard-command-center.test.js tests/unit/v3-2-integrated-premium-ux.test.js --reporter=dot
```

Expected: PASS for existing route and visual hierarchy contracts.

- [ ] **Step 10: Commit the Command Center UI integration**

Run:

```powershell
git add src/components/v3/NextBestAction.vue src/components/v3/FinancialAgenda.vue src/views/CommandCenter.vue tests/unit/v3-command-center-proactive.test.js
git commit -m "feat: surface proactive agenda in command center"
```

Expected: proactive Command Center UI committed.

---

### Task 4: AI Agenda Facts Integration

**Files:**
- Modify: `src/api/financial-analyst.js`
- Modify: `src/views/IntelligenceCenter.vue`
- Create: `tests/unit/v3-ai-proactive-agenda.test.js`

- [ ] **Step 1: Write the failing AI integration contract**

Create `tests/unit/v3-ai-proactive-agenda.test.js` with this complete content:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildProactiveFinancialAgenda, v33AgendaFactsForAI } from '@/domain/v3/proactiveOrchestrator.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 proactive agenda AI integration', () => {
  it('sends proactive agenda facts through the financial analyst API', () => {
    const analyst = read('src/api/financial-analyst.js')
    const intelligence = read('src/views/IntelligenceCenter.vue')

    expect(analyst).toContain("import { v33AgendaFactsForAI } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(analyst).toContain('proactiveAgenda = null')
    expect(analyst).toContain('v33Agenda: proactiveAgenda ? v33AgendaFactsForAI(proactiveAgenda) : null')

    expect(intelligence).toContain("import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'")
    expect(intelligence).toContain('const proactiveAgenda = computed(() => buildProactiveFinancialAgenda')
    expect(intelligence).toContain('proactiveAgenda: proactiveAgenda.value')
  })

  it('keeps agenda facts compact and grounded in real agenda items', () => {
    const agenda = buildProactiveFinancialAgenda({
      state: {
        incomes: [{ amount: 5000, date: '2026-07-01' }],
        expenses: [],
        subscriptions: [{
          id: 'sub-1',
          name: 'Netflix',
          amount: 39.9,
          billing_cycle: 'monthly',
          next_billing_date: '2026-07-25',
          status: 'active',
          is_essential: false,
        }],
      },
      monthData: { incomeCash: 5000, cashExpenses: 1000, cardBill: 500, cashBalance: 3500 },
      subscriptionSummary: {
        totalMonthly: 39.9,
        dispensableMonthly: 39.9,
        next7Days: [{
          id: 'sub-1',
          name: 'Netflix',
          amount: 39.9,
          next_billing_date: '2026-07-25',
          daysUntil: 2,
        }],
        next30Days: [],
        alerts: [],
      },
      commandCenter: { mode: 'optimize' },
      referenceDate: '2026-07-23',
    })
    const facts = v33AgendaFactsForAI(agenda)

    expect(facts.nextBestAction.title).toBeTruthy()
    expect(facts.items.some((item) => item.route === '/subscriptions')).toBe(true)
    expect(facts.impact.avoidableMonthly).toBe(39.9)
  })
})
```

- [ ] **Step 2: Run the AI contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-ai-proactive-agenda.test.js --reporter=dot
```

Expected: FAIL because `financial-analyst.js` and `IntelligenceCenter.vue` do not yet pass `proactiveAgenda`.

- [ ] **Step 3: Modify `financial-analyst.js` imports**

In `src/api/financial-analyst.js`, add this import next to the existing V3 import:

```js
import { v33AgendaFactsForAI } from '@/domain/v3/proactiveOrchestrator.js'
```

- [ ] **Step 4: Modify `explainFinancialAnalysis` signature and payload**

In `src/api/financial-analyst.js`, change the function signature to:

```js
export async function explainFinancialAnalysis({ familyId, analysis, question, commandCenter = null, proactiveAgenda = null }) {
```

In the `facts` object, add the V3.3 agenda facts directly after `v3Command`:

```js
        v3Command: commandCenter ? v3CommandFactsForAI(commandCenter) : null,
        v33Agenda: proactiveAgenda ? v33AgendaFactsForAI(proactiveAgenda) : null,
```

- [ ] **Step 5: Modify `IntelligenceCenter.vue` imports and computed values**

In `src/views/IntelligenceCenter.vue`, add this import:

```js
import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'
```

Place this computed value after the existing `v3Command` computed:

```js
const proactiveAgenda = computed(() => buildProactiveFinancialAgenda({
  state: financeStore.state,
  monthData: monthData.value,
  subscriptionSummary: subscriptionSummary.value,
  commandCenter: v3Command.value,
  referenceDate: dashboardReferenceDate.value,
}))
```

- [ ] **Step 6: Pass proactive agenda to the analyst request**

In `src/views/IntelligenceCenter.vue`, update the `explainFinancialAnalysis` call inside `requestExplanation` to include:

```js
      proactiveAgenda: proactiveAgenda.value,
```

The object passed to `explainFinancialAnalysis` must contain these adjacent keys:

```js
      commandCenter: v3Command.value,
      proactiveAgenda: proactiveAgenda.value,
```

- [ ] **Step 7: Run focused AI tests**

Run:

```powershell
npm test -- --run tests/unit/v3-ai-proactive-agenda.test.js tests/unit/v3-ai-command-integration.test.js --reporter=dot
```

Expected: PASS for both AI integration contracts.

- [ ] **Step 8: Commit AI agenda integration**

Run:

```powershell
git add src/api/financial-analyst.js src/views/IntelligenceCenter.vue tests/unit/v3-ai-proactive-agenda.test.js
git commit -m "feat: send proactive agenda facts to AI"
```

Expected: AI integration committed.

---

### Task 5: First Steps Strip and Onboarding Contract

**Files:**
- Create: `src/components/v3/FirstStepsStrip.vue`
- Modify: `src/views/CommandCenter.vue`
- Create: `tests/unit/v3-3-onboarding-mode.test.js`

- [ ] **Step 1: Write the failing first-steps contract**

Create `tests/unit/v3-3-onboarding-mode.test.js` with this complete content:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFirstStepsChecklist } from '@/domain/v3/proactiveOrchestrator.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 operational first steps', () => {
  it('renders a compact first-steps strip in the command center', () => {
    const component = read('src/components/v3/FirstStepsStrip.vue')
    const commandCenter = read('src/views/CommandCenter.vue')

    expect(component).toContain('data-testid="v33-first-steps"')
    expect(component).toContain('Primeiros passos')
    expect(component).toContain('step.status')
    expect(commandCenter).toContain("import FirstStepsStrip from '@/components/v3/FirstStepsStrip.vue'")
    expect(commandCenter).toContain('<FirstStepsStrip')
    expect(commandCenter).toContain(':steps="proactiveAgenda.firstSteps"')
  })

  it('locks later steps until the user creates the minimum financial base', () => {
    const steps = buildFirstStepsChecklist({
      incomes: [],
      expenses: [],
      planningGoals: [],
    })

    expect(steps.map((step) => step.status)).toEqual(['current', 'locked', 'locked', 'locked'])
  })
})
```

- [ ] **Step 2: Run the first-steps contract and confirm failure**

Run:

```powershell
npm test -- --run tests/unit/v3-3-onboarding-mode.test.js --reporter=dot
```

Expected: FAIL because `FirstStepsStrip.vue` does not exist and `CommandCenter.vue` does not render it.

- [ ] **Step 3: Create `FirstStepsStrip.vue`**

Create `src/components/v3/FirstStepsStrip.vue` with this complete content:

```vue
<template>
  <section class="first-steps" data-testid="v33-first-steps">
    <header>
      <span>Primeiros passos</span>
      <strong>{{ doneCount }}/{{ steps.length }}</strong>
    </header>

    <div class="first-steps__rail">
      <button
        v-for="step in steps"
        :key="step.key"
        type="button"
        :disabled="step.status === 'locked'"
        :class="step.status"
        @click="emit('run', step)"
      >
        <i />
        <span>{{ step.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
})

const emit = defineEmits(['run'])

const doneCount = computed(() => props.steps.filter((step) => step.status === 'done').length)
</script>

<style scoped>
.first-steps {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  padding: 1rem;
}

.first-steps header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.first-steps header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.first-steps header strong {
  color: var(--text-primary);
}

.first-steps__rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.first-steps__rail button {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}

.first-steps__rail button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.first-steps__rail button.current {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border-color));
  color: var(--accent);
}

.first-steps__rail button.done {
  border-color: color-mix(in srgb, var(--income) 40%, var(--border-color));
  color: var(--income);
}

.first-steps__rail i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: currentColor;
}

@media (max-width: 760px) {
  .first-steps__rail {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 4: Render first steps in `CommandCenter.vue`**

In `src/views/CommandCenter.vue`, add this import:

```js
import FirstStepsStrip from '@/components/v3/FirstStepsStrip.vue'
```

Insert this block between `NextBestAction` and `FinancialAgenda`:

```vue
    <FirstStepsStrip
      v-if="proactiveAgenda.firstSteps.some((step) => step.status !== 'done')"
      :steps="proactiveAgenda.firstSteps"
      @run="runAction"
    />
```

- [ ] **Step 5: Run focused first-steps tests**

Run:

```powershell
npm test -- --run tests/unit/v3-3-onboarding-mode.test.js tests/unit/v3-proactive-orchestrator.test.js --reporter=dot
```

Expected: PASS for first-steps and orchestrator contracts.

- [ ] **Step 6: Commit first-steps UI**

Run:

```powershell
git add src/components/v3/FirstStepsStrip.vue src/views/CommandCenter.vue tests/unit/v3-3-onboarding-mode.test.js
git commit -m "feat: add v3.3 operational first steps"
```

Expected: first-steps strip committed.

---

### Task 6: Release 3.3.0 Metadata and Validator

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/config/app-version.js`
- Modify: `scripts/validate-v3-release.js`
- Modify: `tests/unit/v3-release-contract.test.js`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/releases/RELEASE3_3_0.md`

- [ ] **Step 1: Update version through npm**

Run:

```powershell
npm version 3.3.0 --no-git-tag-version
```

Expected: `package.json` and `package-lock.json` root versions become `3.3.0`.

- [ ] **Step 2: Update runtime version config**

Replace the complete content of `src/config/app-version.js` with:

```js
export const APP_VERSION = '3.3.0'
export const APP_RELEASE_CHANNEL = 'stable'
export const APP_RELEASE_DATE = '2026-07-23'
```

- [ ] **Step 3: Update `tests/unit/v3-release-contract.test.js`**

In `tests/unit/v3-release-contract.test.js`, update the describe title and expected version/date strings:

```js
describe('Version 3.3.0 release contract', () => {
```

The metadata expectations must be:

```js
    expect(pkg.version).toBe('3.3.0')
    expect(lock.version).toBe('3.3.0')
    expect(lock.packages[''].version).toBe('3.3.0')
```

The runtime expectations must be:

```js
    expect(appVersion).toContain("APP_VERSION = '3.3.0'")
    expect(appVersion).toContain("APP_RELEASE_CHANNEL = 'stable'")
    expect(appVersion).toContain("APP_RELEASE_DATE = '2026-07-23'")
```

In the validator and documentation trail test, change the version assertion to:

```js
    expect(read('scripts/validate-v3-release.js')).toContain("const currentVersion = '3.3.0'")
```

Add this release-doc assertion after the existing 3.2 assertion:

```js
    expect(exists('docs/releases/RELEASE3_3_0.md')).toBe(true)
    expect(read('docs/releases/RELEASE3_3_0.md')).toContain('# Release 3.3.0 - Orquestracao Financeira Proativa')
```

Change the README version assertion to:

```js
    expect(readme).toContain('Versao atual: 3.3.0')
```

- [ ] **Step 4: Update `scripts/validate-v3-release.js`**

In `scripts/validate-v3-release.js`, set:

```js
const currentVersion = '3.3.0'
```

In the runtime config token loop, replace the release date token with:

```js
  "APP_RELEASE_DATE = '2026-07-23'",
```

Add these V3.3 assertions after the existing V3 operating-system assertions:

```js
assert.ok(exists('src/domain/v3/proactiveOrchestrator.js'), 'V3.3 proactive orchestrator module is missing.')
const proactiveOrchestrator = read('src/domain/v3/proactiveOrchestrator.js')
for (const token of [
  'buildProactiveFinancialAgenda',
  'buildFirstStepsChecklist',
  'v33AgendaFactsForAI',
]) {
  assert.ok(proactiveOrchestrator.includes(token), `V3.3 proactive orchestrator is missing ${token}.`)
}

for (const file of [
  'src/components/v3/NextBestAction.vue',
  'src/components/v3/FinancialAgenda.vue',
  'src/components/v3/FirstStepsStrip.vue',
]) {
  assert.ok(exists(file), `${file} is missing.`)
}
const proactiveCommandCenter = read('src/views/CommandCenter.vue')
for (const token of [
  "import { buildProactiveFinancialAgenda } from '@/domain/v3/proactiveOrchestrator.js'",
  '<NextBestAction',
  '<FinancialAgenda',
  '<FirstStepsStrip',
]) {
  assert.ok(proactiveCommandCenter.includes(token), `Command center is missing ${token}.`)
}
const proactiveAnalyst = read('src/api/financial-analyst.js')
assert.ok(
  proactiveAnalyst.includes('v33Agenda: proactiveAgenda ? v33AgendaFactsForAI(proactiveAgenda) : null'),
  'Financial analyst must send V3.3 agenda facts.'
)
```

In the release docs assertions, add:

```js
assert.ok(exists('docs/releases/RELEASE3_3_0.md'), 'Release 3.3.0 document is missing.')
assert.ok(
  read('docs/releases/RELEASE3_3_0.md').includes('# Release 3.3.0 - Orquestracao Financeira Proativa'),
  'Release 3.3.0 document has the wrong heading.'
)
```

- [ ] **Step 5: Create the 3.3.0 release document**

Create `docs/releases/RELEASE3_3_0.md` with this complete content:

```md
# Release 3.3.0 - Orquestracao Financeira Proativa

## Objetivo

Transformar a Central de Comando em uma camada proativa que prioriza agenda, melhor proxima acao, bloqueios de dados, alertas e fatos explicaveis pela IA.

## Principais mudancas

- Novo orquestrador puro em `src/domain/v3/proactiveOrchestrator.js`.
- Agenda financeira agrupada por horizonte: hoje, proximos 7 dias, este mes e depois.
- Melhor proxima acao calculada com prioridade, motivo, impacto e rota.
- Primeiro fluxo operacional para usuarios sem dados minimos.
- Central de Comando com componentes V3.3 dedicados para acao, agenda e primeiros passos.
- IA consultiva recebendo fatos da agenda para explicar o que fazer primeiro com dados reais.
- Validador de release atualizado para 3.3.0.

## Validacao esperada

- `npm test -- --run --reporter=dot`
- `npm run validate:v3-release`
- `npm run build`
```

- [ ] **Step 6: Update README and changelog**

In `README.md`, replace the current version line with:

```md
Versao atual: 3.3.0
```

In `CHANGELOG.md`, add this entry above `## 3.2.0 - 2026-07-14`:

```md
## 3.3.0 - 2026-07-23

- Adicionada orquestracao financeira proativa para agenda, melhor proxima acao e bloqueios.
- Central de Comando passa a exibir agenda por horizonte e primeiros passos operacionais.
- IA consultiva recebe fatos da agenda V3.3 para explicar recomendacoes com dados reais.
- Metadata e validador de release atualizados para 3.3.0.

```

- [ ] **Step 7: Run focused release validation**

Run:

```powershell
npm test -- --run tests/unit/v3-release-contract.test.js tests/unit/v3-command-center-proactive.test.js tests/unit/v3-ai-proactive-agenda.test.js tests/unit/v3-3-onboarding-mode.test.js --reporter=dot
npm run validate:v3-release
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit release metadata**

Run:

```powershell
git add package.json package-lock.json src/config/app-version.js scripts/validate-v3-release.js tests/unit/v3-release-contract.test.js README.md CHANGELOG.md docs/releases/RELEASE3_3_0.md
git commit -m "chore: release v3.3.0 proactive orchestration"
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

Expected: all Vitest files pass. If `tests/unit/supabase-connectivity-guards.test.js` prints a simulated fetch error to stderr while exit code remains 0, treat that as expected test behavior.

- [ ] **Step 2: Run release validator**

Run:

```powershell
npm run validate:v3-release
```

Expected: output includes:

```text
Version 3.3.0 validation: PASS
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

- Spec coverage: agenda, next best action, AI facts, prioritized alerts, onboarding first steps, release metadata, validation, and build are covered by Tasks 1 through 7.
- Boundary check: the orchestration logic is isolated in a pure domain module and does not rewrite the finance store.
- UI scope check: Command Center receives the new behavior through focused V3 components instead of another broad visual pass.
- Test coverage: each behavior has a focused contract plus full suite and build verification.
- Risk control: every task ends with a focused test command and commit.
