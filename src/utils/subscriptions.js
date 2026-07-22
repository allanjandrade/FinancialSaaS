import { normalizeExternalUrl } from '@/utils/safe-url.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const SUBSCRIPTION_CATEGORIES = [
  'Streaming',
  'IA',
  'Software',
  'Mobilidade',
  'Educação',
  'Casa',
  'Telecom',
  'Saúde',
  'Outros',
]

export const SUBSCRIPTION_STATUSES = ['active', 'trial', 'paused', 'cancelled', 'expired']
export const SUBSCRIPTION_BILLING_CYCLES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom']

const STATUS_ALIASES = {
  ativa: 'active',
  ativo: 'active',
  active: 'active',
  trial: 'trial',
  teste: 'trial',
  'teste gratis': 'trial',
  'teste grátis': 'trial',
  free_trial: 'trial',
  pausada: 'paused',
  pausado: 'paused',
  paused: 'paused',
  cancelada: 'cancelled',
  cancelado: 'cancelled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  expirada: 'expired',
  expirado: 'expired',
  expired: 'expired',
}

const CYCLE_ALIASES = {
  semanal: 'weekly',
  weekly: 'weekly',
  quinzenal: 'biweekly',
  biweekly: 'biweekly',
  mensal: 'monthly',
  month: 'monthly',
  monthly: 'monthly',
  trimestral: 'quarterly',
  quarterly: 'quarterly',
  semestral: 'semiannual',
  semiannual: 'semiannual',
  anual: 'annual',
  annual: 'annual',
  yearly: 'annual',
  personalizado: 'custom',
  custom: 'custom',
}

const PAYMENT_ALIASES = {
  card: 'card',
  cartao: 'card',
  cartão: 'card',
  credit_card: 'card',
  credito: 'card',
  crédito: 'card',
  account: 'account',
  conta: 'account',
  bank_account: 'account',
  benefit: 'benefit',
  beneficio: 'benefit',
  benefício: 'benefit',
  other: 'other',
  outro: 'other',
}

const KNOWN_PROVIDERS = [
  'Netflix',
  'Amazon',
  'Prime',
  'Spotify',
  'OpenAI',
  'ChatGPT',
  'Claude',
  'Gemini',
  'Google One',
  'Google',
  'iCloud',
  'Apple',
  'Sem Parar',
  'Microsoft',
  'Adobe',
  'Disney',
  'HBO',
  'Max',
  'YouTube',
]

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, ' ')
}

function newId() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 11)
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function isoDate(value, fallback = todayIso()) {
  if (!value) return fallback
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString().split('T')[0]
}

function parseLocalDate(value) {
  const [year, month, day] = isoDate(value).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function formatIsoDate(date) {
  return date.toISOString().split('T')[0]
}

function addDays(dateString, days) {
  const date = parseLocalDate(dateString)
  date.setDate(date.getDate() + days)
  return formatIsoDate(date)
}

function addMonths(dateString, months) {
  const source = parseLocalDate(dateString)
  const day = source.getDate()
  const next = new Date(source.getFullYear(), source.getMonth() + months, 1, 12, 0, 0, 0)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  return formatIsoDate(next)
}

function dateDiffDays(from, to) {
  return Math.round((parseLocalDate(to) - parseLocalDate(from)) / DAY_MS)
}

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = formatIsoDate(new Date(year, month, 0, 12, 0, 0, 0))
  return { start, end }
}

function isSameMonth(dateString, year, month) {
  const [entryYear, entryMonth] = isoDate(dateString).split('-').map(Number)
  return entryYear === Number(year) && entryMonth === Number(month)
}

function normalizeStatus(value) {
  return STATUS_ALIASES[normalizeKey(value)] || 'active'
}

function normalizeCycle(value) {
  return CYCLE_ALIASES[normalizeKey(value)] || 'monthly'
}

function normalizePaymentMethodType(value) {
  return PAYMENT_ALIASES[normalizeKey(value)] || 'other'
}

function cycleMonths(subscription) {
  const interval = Math.max(1, Number(subscription.billing_interval || 1))
  const cycle = normalizeCycle(subscription.billing_cycle)
  if (cycle === 'weekly') return 12 / 52 * interval
  if (cycle === 'biweekly') return 12 / 26 * interval
  if (cycle === 'quarterly') return 3 * interval
  if (cycle === 'semiannual') return 6 * interval
  if (cycle === 'annual') return 12 * interval
  if (cycle === 'custom') return interval
  return interval
}

export function subscriptionMonthlyEquivalent(subscription) {
  const amount = number(subscription?.amount)
  if (amount <= 0) return 0
  return roundMoney(amount / cycleMonths(subscription || {}))
}

export function subscriptionAnnualized(subscription) {
  const amount = number(subscription?.amount)
  if (amount <= 0) return 0
  return roundMoney((amount / cycleMonths(subscription || {})) * 12)
}

export function advanceBillingDate(dateString, subscription) {
  const interval = Math.max(1, Number(subscription?.billing_interval || 1))
  const cycle = normalizeCycle(subscription?.billing_cycle)
  if (cycle === 'weekly') return addDays(dateString, 7 * interval)
  if (cycle === 'biweekly') return addDays(dateString, 14 * interval)
  if (cycle === 'quarterly') return addMonths(dateString, 3 * interval)
  if (cycle === 'semiannual') return addMonths(dateString, 6 * interval)
  if (cycle === 'annual') return addMonths(dateString, 12 * interval)
  if (cycle === 'custom') return addMonths(dateString, interval)
  return addMonths(dateString, interval)
}

export function sanitizeSubscription(input = {}) {
  const status = normalizeStatus(input.status)
  const billingCycle = normalizeCycle(input.billing_cycle || input.billingCycle)
  const now = new Date().toISOString()
  const paymentType = normalizePaymentMethodType(input.payment_method_type || input.paymentMethodType)
  return {
    id: input.id || newId(),
    user_id: input.user_id || input.userId || null,
    family_id: input.family_id || input.familyId || null,
    name: String(input.name || '').trim() || 'Assinatura',
    provider: String(input.provider || input.name || '').trim(),
    category: SUBSCRIPTION_CATEGORIES.includes(input.category) ? input.category : 'Outros',
    amount: roundMoney(input.amount),
    currency: input.currency || 'BRL',
    billing_cycle: billingCycle,
    billing_interval: Math.max(1, Number(input.billing_interval || input.billingInterval || 1)),
    next_billing_date: isoDate(input.next_billing_date || input.nextBillingDate),
    started_at: input.started_at || input.startedAt ? isoDate(input.started_at || input.startedAt) : null,
    ended_at: input.ended_at || input.endedAt ? isoDate(input.ended_at || input.endedAt) : null,
    status,
    payment_method_type: paymentType,
    account_id: input.account_id || input.accountId || null,
    card_id: input.card_id || input.cardId || null,
    is_essential: Boolean(input.is_essential ?? input.isEssential),
    reminder_days: Math.max(0, Number(input.reminder_days ?? input.reminderDays ?? 3)),
    notes: input.notes || '',
    url: normalizeExternalUrl(input.url),
    source: input.source || 'manual',
    auto_detect_rules: input.auto_detect_rules || input.autoDetectRules || {},
    created_at: input.created_at || input.createdAt || now,
    updated_at: input.updated_at || input.updatedAt || now,
    deleted_at: input.deleted_at || input.deletedAt || null,
  }
}

export function sanitizeSubscriptionCharge(input = {}) {
  return {
    id: input.id || newId(),
    subscription_id: input.subscription_id || input.subscriptionId,
    transaction_id: input.transaction_id || input.transactionId || null,
    charged_at: isoDate(input.charged_at || input.chargedAt),
    amount: roundMoney(input.amount),
    status: input.status || 'paid',
    created_at: input.created_at || input.createdAt || new Date().toISOString(),
  }
}

export function isForecastableSubscription(subscription) {
  if (!subscription || subscription.deleted_at) return false
  if (!['active', 'trial'].includes(normalizeStatus(subscription.status))) return false
  if (normalizeStatus(subscription.status) === 'trial' && number(subscription.amount) <= 0) return false
  return true
}

function nextOccurrenceOnOrAfter(subscription, dateString) {
  let candidate = isoDate(subscription.next_billing_date)
  let guard = 0
  while (dateDiffDays(candidate, dateString) > 0 && guard < 240) {
    candidate = advanceBillingDate(candidate, subscription)
    guard += 1
  }
  return candidate
}

export function projectSubscriptionCharges(subscription, { from, to }) {
  const item = sanitizeSubscription(subscription)
  if (!isForecastableSubscription(item)) return []
  const end = isoDate(to)
  let date = nextOccurrenceOnOrAfter(item, from)
  const charges = []
  let guard = 0
  while (dateDiffDays(date, end) >= 0 && guard < 120) {
    if (dateDiffDays(from, date) >= 0) {
      charges.push({
        subscription_id: item.id,
        name: item.name,
        provider: item.provider,
        category: item.category,
        amount: item.amount,
        date,
        payment_method_type: item.payment_method_type,
        account_id: item.account_id,
        card_id: item.card_id,
        is_essential: item.is_essential,
        billing_cycle: item.billing_cycle,
      })
    }
    date = advanceBillingDate(date, item)
    guard += 1
  }
  return charges
}

function chargesWithinDays(subscriptions, referenceDate, days) {
  const from = isoDate(referenceDate)
  const to = addDays(from, days)
  return subscriptions
    .flatMap((subscription) => projectSubscriptionCharges(subscription, { from, to })
      .map((charge) => ({
        ...charge,
        id: `${charge.subscription_id}:${charge.date}`,
        daysUntil: dateDiffDays(from, charge.date),
      })))
    .sort((a, b) => a.daysUntil - b.daysUntil || b.amount - a.amount)
}

function sameSource(subscription, expense = {}) {
  const paymentType = normalizePaymentMethodType(subscription.payment_method_type)
  if (paymentType === 'card') {
    const expenseCardId = expense.card_id || expense.cardId || expense.creditCardId || expense.sourceId
    return !subscription.card_id || !expenseCardId || subscription.card_id === expenseCardId
  }
  if (paymentType === 'account') {
    const expenseAccountId = expense.account_id || expense.accountId || expense.sourceId
    return !subscription.account_id || !expenseAccountId || subscription.account_id === expenseAccountId
  }
  return true
}

function providerScore(subscription, expense = {}) {
  const haystack = normalizeText(`${expense.description || ''} ${expense.provider || ''}`)
  const provider = normalizeText(subscription.provider)
  const name = normalizeText(subscription.name)
  if (!haystack) return 0
  if (provider && haystack.includes(provider)) return 40
  if (name && haystack.includes(name)) return 40
  const tokens = [...new Set(`${provider} ${name}`.split(' ').filter((token) => token.length >= 3))]
  const hits = tokens.filter((token) => haystack.includes(token)).length
  return hits ? Math.min(35, 14 + hits * 8) : 0
}

function amountScore(subscription, expense = {}) {
  const expected = number(subscription.amount)
  const actual = number(expense.amount)
  const diff = Math.abs(expected - actual)
  const tolerance = Math.max(2, expected * 0.08)
  if (diff <= 0.01) return 30
  if (diff <= tolerance) return 20
  return 0
}

function dateScore(subscription, expense = {}, referenceDate = todayIso()) {
  const expected = nextOccurrenceOnOrAfter(subscription, addDays(referenceDate, -7))
  const diff = Math.abs(dateDiffDays(expected, isoDate(expense.date || expense.charged_at || referenceDate)))
  if (diff <= 1) return 20
  if (diff <= 5) return 14
  if (diff <= 10) return 6
  return 0
}

function sourceScore(subscription, expense = {}) {
  return sameSource(subscription, expense) ? 10 : -25
}

export function reconcileSubscriptionCharge(subscriptions = [], expense = {}, referenceDate = todayIso(), existingCharges = []) {
  const candidates = subscriptions
    .map(sanitizeSubscription)
    .filter((subscription) => !subscription.deleted_at && ['active', 'trial'].includes(subscription.status))
    .filter((subscription) => !existingCharges.some((charge) => charge.transaction_id === expense.id && charge.subscription_id === subscription.id))
    .map((subscription) => {
      const score = providerScore(subscription, expense)
        + amountScore(subscription, expense)
        + dateScore(subscription, expense, referenceDate)
        + sourceScore(subscription, expense)
      return { subscription, score }
    })
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]
  if (!best || best.score < 55) {
    return { reconciled: false, score: best?.score || 0, subscriptionId: null, charge: null, subscription: null }
  }

  const chargedAt = isoDate(expense.date || expense.charged_at || referenceDate)
  let nextDate = isoDate(best.subscription.next_billing_date)
  let guard = 0
  while (dateDiffDays(nextDate, chargedAt) >= -1 && guard < 36) {
    nextDate = advanceBillingDate(nextDate, best.subscription)
    guard += 1
  }

  const charge = sanitizeSubscriptionCharge({
    subscription_id: best.subscription.id,
    transaction_id: expense.id || null,
    charged_at: chargedAt,
    amount: expense.amount ?? best.subscription.amount,
    status: 'paid',
  })

  return {
    reconciled: true,
    score: best.score,
    subscriptionId: best.subscription.id,
    charge,
    subscription: {
      ...best.subscription,
      next_billing_date: nextDate,
      updated_at: new Date().toISOString(),
    },
  }
}

function chargeLinkedToOccurrence(charge, occurrenceDate) {
  return Math.abs(dateDiffDays(charge.charged_at, occurrenceDate)) <= 6
}

function subscriptionForCharge(subscriptions, charge) {
  return subscriptions.find((subscription) => subscription.id === charge.subscription_id)
}

function paymentBucketForSubscription(subscription) {
  const type = normalizePaymentMethodType(subscription?.payment_method_type)
  if (type === 'card' || subscription?.card_id) return 'card'
  if (type === 'account' || subscription?.account_id) return 'account'
  return 'account'
}

function paymentBucketForExpense(expense = {}) {
  const text = normalizeText(`${expense.payment || ''} ${expense.sourceType || ''}`)
  if (text.includes('credito') || text.includes('credit card')) return 'card'
  if (expense.creditCardId || expense.card_id || expense.cardId) return 'card'
  return 'account'
}

export function buildSubscriptionMonthImpact(state = {}, { year, month }) {
  const subscriptions = (state.subscriptions || []).map(sanitizeSubscription)
  const charges = (state.subscriptionCharges || []).map(sanitizeSubscriptionCharge)
  const expenses = state.expenses || []
  const { start, end } = monthBounds(Number(year), Number(month))

  const projected = subscriptions.flatMap((subscription) =>
    projectSubscriptionCharges(subscription, { from: start, to: end }))

  const linkedCharges = charges.filter((charge) => isSameMonth(charge.charged_at, year, month) && ['paid', 'linked'].includes(charge.status))
  const linkedExpenses = expenses.filter((expense) => (
    expense.subscriptionId
    && isSameMonth(expense.date, year, month)
  ))

  const actualLinkedTotal = roundMoney(linkedExpenses.reduce((sum, expense) => sum + number(expense.amount), 0)
    + linkedCharges
      .filter((charge) => !linkedExpenses.some((expense) => expense.id === charge.transaction_id))
      .reduce((sum, charge) => sum + number(charge.amount), 0))

  const unmatchedProjected = projected.filter((projection) => !linkedCharges.some((charge) => (
    charge.subscription_id === projection.subscription_id && chargeLinkedToOccurrence(charge, projection.date)
  )))

  const forecastTotal = roundMoney(unmatchedProjected.reduce((sum, projection) => sum + number(projection.amount), 0))

  let cardForecast = 0
  let accountForecast = 0
  unmatchedProjected.forEach((projection) => {
    if (paymentBucketForSubscription(projection) === 'card') cardForecast += number(projection.amount)
    else accountForecast += number(projection.amount)
  })

  let cardActual = 0
  let accountActual = 0
  linkedExpenses.forEach((expense) => {
    if (paymentBucketForExpense(expense) === 'card') cardActual += number(expense.amount)
    else accountActual += number(expense.amount)
  })
  linkedCharges
    .filter((charge) => !linkedExpenses.some((expense) => expense.id === charge.transaction_id))
    .forEach((charge) => {
      const subscription = subscriptionForCharge(subscriptions, charge)
      if (paymentBucketForSubscription(subscription) === 'card') cardActual += number(charge.amount)
      else accountActual += number(charge.amount)
    })

  return {
    forecastTotal,
    actualLinkedTotal,
    reportExpenseTotal: roundMoney(forecastTotal + actualLinkedTotal),
    cardForecast: roundMoney(cardForecast),
    accountForecast: roundMoney(accountForecast),
    cardActual: roundMoney(cardActual),
    accountActual: roundMoney(accountActual),
    cardImpact: roundMoney(cardForecast + cardActual),
    accountImpact: roundMoney(accountForecast + accountActual),
    projectedCharges: unmatchedProjected,
    linkedCharges,
  }
}

function buildCategoryTotals(subscriptions) {
  const totals = new Map()
  subscriptions.forEach((subscription) => {
    const current = totals.get(subscription.category) || 0
    totals.set(subscription.category, roundMoney(current + subscriptionMonthlyEquivalent(subscription)))
  })
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }))
}

function detectDuplicateSubscriptions(subscriptions) {
  const rows = []
  for (let i = 0; i < subscriptions.length; i += 1) {
    for (let j = i + 1; j < subscriptions.length; j += 1) {
      const a = subscriptions[i]
      const b = subscriptions[j]
      const sameProvider = normalizeText(a.provider || a.name) === normalizeText(b.provider || b.name)
      const closeAmount = Math.abs(number(a.amount) - number(b.amount)) <= Math.max(2, number(a.amount) * 0.1)
      if (sameProvider || (closeAmount && normalizeText(a.name).split(' ').some((token) => token.length >= 4 && normalizeText(b.name).includes(token)))) {
        rows.push({ first: a, second: b, reason: sameProvider ? 'Mesmo fornecedor' : 'Nome e valor parecidos' })
      }
    }
  }
  return rows
}

function buildAlerts(activeSubscriptions, allSubscriptions, referenceDate, charges) {
  const alerts = []
  const next7 = chargesWithinDays(activeSubscriptions, referenceDate, 7)
  next7.forEach((charge) => {
    alerts.push({
      type: 'upcoming_charge',
      severity: charge.daysUntil <= 2 ? 'warning' : 'info',
      title: 'Cobrança próxima',
      description: `${charge.name} cobra ${formatMoney(charge.amount)} em ${charge.daysUntil} dia${charge.daysUntil === 1 ? '' : 's'}.`,
      subscriptionId: charge.subscription_id,
    })
  })

  activeSubscriptions
    .filter((subscription) => subscription.status === 'trial')
    .forEach((subscription) => {
      const daysUntil = dateDiffDays(referenceDate, subscription.next_billing_date)
      if (daysUntil >= 0 && daysUntil <= 14) {
        alerts.push({
          type: 'trial_ending',
          severity: 'warning',
          title: 'Teste grátis perto do fim',
          description: `${subscription.name} sai do teste em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}.`,
          subscriptionId: subscription.id,
        })
      }
    })

  activeSubscriptions
    .filter((subscription) => !subscription.is_essential && subscription.status === 'active')
    .forEach((subscription) => {
      alerts.push({
        type: 'dispensable_active',
        severity: 'opportunity',
        title: 'Assinatura dispensável ativa',
        description: `${subscription.name} custa ${formatMoney(subscriptionMonthlyEquivalent(subscription))}/mês equivalente.`,
        subscriptionId: subscription.id,
      })
    })

  activeSubscriptions
    .filter((subscription) => subscription.billing_cycle === 'annual')
    .forEach((subscription) => {
      const daysUntil = dateDiffDays(referenceDate, subscription.next_billing_date)
      if (daysUntil >= 0 && daysUntil <= 45) {
        alerts.push({
          type: 'annual_renewal',
          severity: 'warning',
          title: 'Renovação anual próxima',
          description: `${subscription.name} renova em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}.`,
          subscriptionId: subscription.id,
        })
      }
    })

  detectDuplicateSubscriptions(activeSubscriptions).forEach((duplicate) => {
    alerts.push({
      type: 'duplicate',
      severity: 'warning',
      title: 'Assinaturas parecidas',
      description: `${duplicate.first.name} e ${duplicate.second.name}: ${duplicate.reason.toLowerCase()}.`,
      subscriptionId: duplicate.first.id,
    })
  })

  const paidKeys = new Set((charges || []).map((charge) => `${charge.subscription_id}:${charge.charged_at}`))
  allSubscriptions
    .filter(isForecastableSubscription)
    .forEach((subscription) => {
      const expected = isoDate(subscription.next_billing_date)
      if (dateDiffDays(expected, referenceDate) > Number(subscription.reminder_days || 3) && !paidKeys.has(`${subscription.id}:${expected}`)) {
        alerts.push({
          type: 'missing_charge',
          severity: 'warning',
          title: 'Cobrança não encontrada',
          description: `${subscription.name} estava prevista para ${formatDate(expected)} e ainda não foi vinculada.`,
          subscriptionId: subscription.id,
        })
      }
    })

  return alerts.slice(0, 12)
}

export function buildSubscriptionSummary(state = {}, referenceDate = todayIso()) {
  const ref = isoDate(referenceDate)
  const allSubscriptions = (state.subscriptions || []).map(sanitizeSubscription)
  const active = allSubscriptions.filter(isForecastableSubscription)
  const charges = (state.subscriptionCharges || []).map(sanitizeSubscriptionCharge)
  const totalMonthly = roundMoney(active.reduce((sum, subscription) => sum + subscriptionMonthlyEquivalent(subscription), 0))
  const totalAnnualized = roundMoney(active.reduce((sum, subscription) => sum + subscriptionAnnualized(subscription), 0))
  const essentialMonthly = roundMoney(active
    .filter((subscription) => subscription.is_essential)
    .reduce((sum, subscription) => sum + subscriptionMonthlyEquivalent(subscription), 0))
  const dispensableMonthly = roundMoney(totalMonthly - essentialMonthly)
  const [year, month] = ref.split('-').map(Number)
  const monthImpact = buildSubscriptionMonthImpact({ ...state, subscriptions: allSubscriptions, subscriptionCharges: charges }, { year, month })
  const next7Days = chargesWithinDays(active, ref, 7)
  const next15Days = chargesWithinDays(active, ref, 15)
  const next30Days = chargesWithinDays(active, ref, 30)
  return {
    generatedAt: new Date().toISOString(),
    totalMonthly,
    totalAnnualized,
    essentialMonthly,
    dispensableMonthly,
    activeCount: active.length,
    pausedCount: allSubscriptions.filter((subscription) => subscription.status === 'paused' && !subscription.deleted_at).length,
    cancelledCount: allSubscriptions.filter((subscription) => subscription.status === 'cancelled' && !subscription.deleted_at).length,
    nextCharge: next30Days[0] || null,
    next7Days,
    next15Days,
    next30Days,
    categories: buildCategoryTotals(active),
    essential: active.filter((subscription) => subscription.is_essential),
    dispensable: active.filter((subscription) => !subscription.is_essential)
      .sort((a, b) => subscriptionMonthlyEquivalent(b) - subscriptionMonthlyEquivalent(a)),
    trialEndingSoon: active.filter((subscription) => subscription.status === 'trial' && dateDiffDays(ref, subscription.next_billing_date) <= 14),
    potentiallyCuttable: active.filter((subscription) => !subscription.is_essential)
      .sort((a, b) => subscriptionMonthlyEquivalent(b) - subscriptionMonthlyEquivalent(a)),
    duplicates: detectDuplicateSubscriptions(active),
    monthImpact,
    alerts: buildAlerts(active, allSubscriptions, ref, charges),
  }
}

export function pauseSubscription(subscription, referenceDate = todayIso()) {
  return {
    ...sanitizeSubscription(subscription),
    status: 'paused',
    updated_at: new Date(`${isoDate(referenceDate)}T12:00:00`).toISOString(),
  }
}

export function cancelSubscription(subscription, referenceDate = todayIso()) {
  return {
    ...sanitizeSubscription(subscription),
    status: 'cancelled',
    ended_at: isoDate(referenceDate),
    updated_at: new Date(`${isoDate(referenceDate)}T12:00:00`).toISOString(),
  }
}

export function softDeleteSubscription(subscription, referenceDate = todayIso()) {
  return {
    ...cancelSubscription(subscription, referenceDate),
    deleted_at: new Date(`${isoDate(referenceDate)}T12:00:00`).toISOString(),
  }
}

function knownProviderFromDescription(description) {
  const text = normalizeText(description)
  return KNOWN_PROVIDERS.find((provider) => text.includes(normalizeText(provider))) || ''
}

function recurringHistoryMatch(expenses, expense) {
  const description = normalizeText(expense.description)
  if (!description) return false
  const similar = (expenses || []).filter((entry) => {
    if (entry.id === expense.id) return false
    const sameDescription = normalizeText(entry.description).includes(description)
      || description.includes(normalizeText(entry.description))
    const closeAmount = Math.abs(number(entry.amount) - number(expense.amount)) <= Math.max(2, number(expense.amount) * 0.08)
    return sameDescription && closeAmount
  })
  return similar.length >= 2
}

export function suggestSubscriptionFromExpense(state = {}, expense = {}) {
  const provider = knownProviderFromDescription(expense.description)
  const existing = (state.subscriptions || []).map(sanitizeSubscription)
    .find((subscription) => {
      const target = normalizeText(`${subscription.provider} ${subscription.name}`)
      const description = normalizeText(expense.description)
      return target && description && (description.includes(target) || target.includes(description) || provider === subscription.provider)
    })

  if (existing) {
    return {
      shouldSuggest: true,
      action: 'link',
      provider: existing.provider || existing.name,
      subscriptionId: existing.id,
      confidence: 0.9,
      message: `Essa cobrança parece a assinatura ${existing.name}. Deseja vincular?`,
    }
  }

  const looksRecurring = Boolean(provider) || recurringHistoryMatch(state.expenses || [], expense)
  if (!looksRecurring || number(expense.amount) <= 0) {
    return { shouldSuggest: false, action: null, provider: '', confidence: 0, message: '' }
  }

  return {
    shouldSuggest: true,
    action: 'create',
    provider: provider || expense.description || 'Assinatura',
    confidence: provider ? 0.78 : 0.62,
    draft: sanitizeSubscription({
      name: provider || expense.description || 'Assinatura',
      provider: provider || expense.description || '',
      category: provider ? guessCategory(provider) : 'Outros',
      amount: expense.amount,
      billing_cycle: 'monthly',
      next_billing_date: advanceBillingDate(expense.date || todayIso(), { billing_cycle: 'monthly' }),
      started_at: expense.date || todayIso(),
      payment_method_type: paymentBucketForExpense(expense) === 'card' ? 'card' : 'account',
      card_id: expense.creditCardId || expense.card_id || expense.cardId || null,
      account_id: paymentBucketForExpense(expense) === 'account' ? expense.sourceId || null : null,
      source: 'suggested',
    }),
    message: 'Essa cobrança parece uma assinatura. Deseja vincular ou criar uma assinatura?',
  }
}

function guessCategory(provider) {
  const text = normalizeText(provider)
  if (/netflix|prime|disney|hbo|max|spotify|youtube/.test(text)) return 'Streaming'
  if (/openai|chatgpt|claude|gemini/.test(text)) return 'IA'
  if (/google|icloud|apple|microsoft|adobe/.test(text)) return 'Software'
  if (/sem parar|uber|99/.test(text)) return 'Mobilidade'
  return 'Outros'
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(number(value))
    .replace(/\s+/g, ' ')
}

function formatDate(value) {
  return parseLocalDate(value).toLocaleDateString('pt-BR')
}

function listNames(items) {
  if (!items.length) return 'nenhuma'
  return items.map((item) => item.name).join(', ')
}

function answerSavingsQuestion(question, summary) {
  const text = normalizeText(question)
  const selected = summary.dispensable.filter((subscription) => text.includes(normalizeText(subscription.name)) || text.includes(normalizeText(subscription.provider)))
  const targets = selected.length ? selected : summary.dispensable
  const monthly = roundMoney(targets.reduce((sum, subscription) => sum + subscriptionMonthlyEquivalent(subscription), 0))
  const annual = roundMoney(monthly * 12)
  return `Cancelando ${listNames(targets)}, a economia estimada seria ${formatMoney(monthly)}/mês ou ${formatMoney(annual)}/ano.`
}

export function answerSubscriptionQuestion(question = '', state = {}, referenceDate = todayIso()) {
  const text = normalizeText(question)
  const isSubscriptionQuestion = /assinatura|assinaturas|netflix|spotify|amazon|chatgpt|claude|gemini|icloud|sem parar|cortar|vencem|duplicada|fatura/.test(text)
  if (!isSubscriptionQuestion) return { handled: false, content: '' }

  const summary = buildSubscriptionSummary(state, referenceDate)
  const lines = [
    `Você possui ${formatMoney(summary.totalMonthly)}/mês em assinaturas, equivalente a ${formatMoney(summary.totalAnnualized)}/ano.`,
  ]

  if (/economizo|economia|cancelar/.test(text)) {
    lines.push(answerSavingsQuestion(question, summary))
  }

  if (/cortar|dispensavel|dispensaveis|dispensáveis/.test(text)) {
    if (summary.dispensable.length) {
      lines.push(`Potencial de corte: ${formatMoney(summary.dispensableMonthly)}/mês em assinaturas dispensáveis: ${listNames(summary.dispensable)}.`)
    } else {
      lines.push('Nenhuma assinatura dispensável ativa foi marcada no momento.')
    }
  }

  if (/vencem|vence|semana|proxima|próxima|proximas|próximas/.test(text)) {
    lines.push(summary.next7Days.length
      ? `Vencem nos próximos 7 dias: ${summary.next7Days.map((charge) => `${charge.name} (${formatMoney(charge.amount)})`).join(', ')}.`
      : 'Nenhuma assinatura vence nos próximos 7 dias.')
  }

  if (/duplicada|duplicadas|duplicidade/.test(text)) {
    lines.push(summary.duplicates.length
      ? `Possíveis duplicidades: ${summary.duplicates.map((item) => `${item.first.name} e ${item.second.name}`).join('; ')}.`
      : 'Nenhuma assinatura duplicada foi detectada pelos dados atuais.')
  }

  if (/fatura|cartao|cartão/.test(text)) {
    lines.push(`Impacto previsto em cartão no mês: ${formatMoney(summary.monthImpact.cardImpact)}.`)
  }

  return {
    handled: true,
    content: lines.join('\n'),
    facts: summary,
  }
}
