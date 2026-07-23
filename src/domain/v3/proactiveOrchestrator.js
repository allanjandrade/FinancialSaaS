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
  return money(monthData.cashExpenses) > 0
    || money(monthData.cardBill) > 0
    || (state.expenses || []).some((item) => money(item.amount) > 0)
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

  const wishlistTotal = activeItems(state.wishlist || [])
    .reduce((sum, item) => sum + money(item.value || item.currentPrice || item.targetPrice), 0)
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
