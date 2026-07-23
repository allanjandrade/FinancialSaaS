const ESSENTIAL_CATEGORIES = new Set(['Mercado', 'Acougue', 'Feira', 'Moradia', 'Transporte', 'Saude', 'Educacao'])

export const SCENARIO_TYPES = Object.freeze(['conservative', 'probable', 'critical'])
export const ADVISOR_FEEDBACK_VALUES = Object.freeze(['useful', 'not_useful', 'too_conservative', 'too_aggressive'])

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDate(value) {
  const parsed = value instanceof Date ? value : new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function dateKey(date) {
  const parsed = parseDate(date)
  return parsed.getFullYear() * 100 + parsed.getMonth() + 1
}

function selectedMonthKey(state, referenceDate = new Date()) {
  const settings = state?.settings || {}
  return toNumber(settings.year, parseDate(referenceDate).getFullYear()) * 100
    + toNumber(settings.selectedMonth, parseDate(referenceDate).getMonth() + 1)
}

function monthDays(monthKey) {
  return new Date(Math.floor(monthKey / 100), monthKey % 100, 0).getDate()
}

function dayOfMonth(referenceDate, key) {
  const parsed = parseDate(referenceDate)
  const parsedKey = parsed.getFullYear() * 100 + parsed.getMonth() + 1
  return parsedKey === key ? Math.max(1, parsed.getDate()) : monthDays(key)
}

function expenseMonthKey(expense, state) {
  if (expense?.cardCompetencyMonth && expense?.cardCompetencyYear) {
    return toNumber(expense.cardCompetencyYear) * 100 + toNumber(expense.cardCompetencyMonth)
  }
  return dateKey(expense?.date)
}

function incomeMonthKey(income) {
  return dateKey(income?.date)
}

function isInternalTransfer(entry) {
  return Boolean(entry?.isInternalTransfer || entry?.transferGroupId || entry?.type === 'internal_transfer')
}

function isBenefit(entry) {
  return ['VA', 'VR'].includes(entry?.payment || entry?.type)
}

function isCredit(entry) {
  return entry?.payment === 'Credito' || entry?.payment === 'Crédito'
}

function categoryOf(expense) {
  const raw = String(expense?.category || 'Outros')
  if (raw === 'Açougue') return 'Acougue'
  if (raw === 'Saúde') return 'Saude'
  if (raw === 'Educação') return 'Educacao'
  return raw || 'Outros'
}

function currentCashIncomes(state, key) {
  return (Array.isArray(state?.incomes) ? state.incomes : [])
    .filter((income) => incomeMonthKey(income) === key)
    .filter((income) => !isBenefit(income))
}

function currentCashExpenses(state, key) {
  return (Array.isArray(state?.expenses) ? state.expenses : [])
    .filter((expense) => expenseMonthKey(expense, state) === key)
    .filter((expense) => !isInternalTransfer(expense))
    .filter((expense) => !isBenefit(expense))
}

function sum(entries, selector = (entry) => entry.amount) {
  return entries.reduce((total, entry) => total + toNumber(selector(entry)), 0)
}

function historyByCategory(state, category, currentKey) {
  const totals = new Map()
  ;(Array.isArray(state?.expenses) ? state.expenses : [])
    .filter((expense) => !isInternalTransfer(expense) && !isBenefit(expense))
    .filter((expense) => categoryOf(expense) === category)
    .forEach((expense) => {
      const key = expenseMonthKey(expense, state)
      if (key >= currentKey) return
      totals.set(key, (totals.get(key) || 0) + toNumber(expense.amount))
    })
  return [...totals.entries()].sort(([a], [b]) => a - b).slice(-3).map(([, value]) => value)
}

export function forecastCategorySpending(state, referenceDate = new Date()) {
  const key = selectedMonthKey(state, referenceDate)
  const day = dayOfMonth(referenceDate, key)
  const days = monthDays(key)
  const expenses = currentCashExpenses(state, key)
  const budgets = Array.isArray(state?.categoryBudgets) ? state.categoryBudgets : []
  const categories = new Set([
    ...expenses.map(categoryOf),
    ...budgets.filter((budget) => toNumber(budget.month_key) === key).map((budget) => budget.category),
  ])

  return [...categories].sort().map((category) => {
    const actual = sum(expenses.filter((expense) => categoryOf(expense) === category))
    const projected = actual > 0 ? actual / day * days : 0
    const planned = toNumber(budgets.find((budget) => toNumber(budget.month_key) === key && budget.category === category)?.planned)
    const history = historyByCategory(state, category, key)
    const historicalAverage = history.length ? sum(history, (value) => value) / history.length : 0
    const reference = planned || historicalAverage
    const overrunAmount = reference > 0 ? projected - reference : 0
    const overrunRatio = reference > 0 ? projected / reference : 0
    const risk = reference > 0 && projected > reference * 1.15
      ? 'critical'
      : reference > 0 && projected > reference
        ? 'attention'
        : 'ok'
    return {
      category,
      actual: round(actual),
      projected: round(projected),
      planned: round(planned),
      historicalAverage: round(historicalAverage),
      overrunAmount: round(overrunAmount),
      overrunRatio: round(overrunRatio, 4),
      risk,
    }
  })
}

export function projectMonthEnd(state, referenceDate = new Date()) {
  const key = selectedMonthKey(state, referenceDate)
  const incomes = currentCashIncomes(state, key)
  const expenses = currentCashExpenses(state, key)
  const confirmedIncome = sum(incomes)
  const confirmedExpenses = sum(expenses)
  const cardBill = sum(expenses.filter(isCredit))
  const fixedExpenses = sum(expenses.filter((expense) => expense.fixed || ESSENTIAL_CATEGORIES.has(categoryOf(expense))))
  const variableSpent = Math.max(0, confirmedExpenses - fixedExpenses)
  const day = dayOfMonth(referenceDate, key)
  const days = monthDays(key)
  const projectedVariable = variableSpent > 0 ? variableSpent / day * days : 0
  const categoryForecasts = forecastCategorySpending(state, referenceDate)
  const budgetDrivenProjection = sum(categoryForecasts, (item) => item.projected)
  const projectedExpenses = Math.max(confirmedExpenses, fixedExpenses + projectedVariable, budgetDrivenProjection)
  const projectedBalance = confirmedIncome - projectedExpenses
  const confidence = round(Math.min(0.95, Math.max(0.35, (day / days) * 0.45 + Math.min(1, expenses.length / 12) * 0.35 + (confirmedIncome > 0 ? 0.2 : 0))), 2)

  return {
    monthKey: key,
    confirmedIncome: round(confirmedIncome),
    confirmedExpenses: round(confirmedExpenses),
    fixedExpenses: round(fixedExpenses),
    projectedExpenses: round(projectedExpenses),
    projectedCardBill: round(cardBill),
    projectedBalance: round(projectedBalance),
    confidence,
    warnings: [
      confirmedIncome <= 0 ? 'Renda em dinheiro nao cadastrada para o periodo.' : null,
      day < 10 ? 'Projecao ainda no inicio do mes.' : null,
    ].filter(Boolean),
  }
}

export function calculateSafeInvestmentCapacity(state, referenceDate = new Date()) {
  const projection = projectMonthEnd(state, referenceDate)
  const reserveTarget = Math.max(0, toNumber(state?.settings?.minimumReserve, projection.confirmedIncome * 0.3))
  const accounts = Array.isArray(state?.financialAccounts) ? state.financialAccounts : []
  const cashBalance = sum(accounts.filter((account) => !account.isInvestment), (account) => account.balance)
  const activeGoals = (Array.isArray(state?.planningGoals) ? state.planningGoals : []).filter((goal) => goal.status !== 'completed' && goal.status !== 'cancelled')
  const goalCommitment = sum(activeGoals, (goal) => goal.monthly_contribution ?? goal.monthlyContribution)
  const capacityBeforeRisk = Math.max(0, cashBalance + projection.projectedBalance - reserveTarget - goalCommitment)
  const riskDiscount = projection.confidence < 0.65 ? 0.5 : projection.projectedBalance < 0 ? 0.2 : 0.35
  const safeCapacity = Math.floor(capacityBeforeRisk * riskDiscount)

  return {
    cashBalance: round(cashBalance),
    reserveTarget: round(reserveTarget),
    goalCommitment: round(goalCommitment),
    safeCapacity: round(safeCapacity),
    maximumCapacity: round(capacityBeforeRisk),
    riskLevel: safeCapacity <= 0 ? 'high' : projection.projectedBalance < 0 ? 'attention' : 'low',
    reasons: [
      `Fechamento previsto: R$ ${projection.projectedBalance.toFixed(2)}.`,
      `Reserva preservada: R$ ${reserveTarget.toFixed(2)}.`,
      goalCommitment > 0 ? `Metas do mes preservadas: R$ ${round(goalCommitment).toFixed(2)}.` : null,
    ].filter(Boolean),
  }
}

export function simulateScenario(state, scenario = 'probable', referenceDate = new Date()) {
  const multipliers = {
    conservative: { expense: 1.08, income: 0.98 },
    probable: { expense: 1, income: 1 },
    critical: { expense: 1.22, income: 0.9 },
  }
  const selected = multipliers[scenario] ? scenario : 'probable'
  const projection = projectMonthEnd(state, referenceDate)
  const projectedIncome = projection.confirmedIncome * multipliers[selected].income
  const projectedExpenses = projection.projectedExpenses * multipliers[selected].expense
  const projectedBalance = projectedIncome - projectedExpenses
  return {
    scenario: selected,
    projectedIncome: round(projectedIncome),
    projectedExpenses: round(projectedExpenses),
    projectedBalance: round(projectedBalance),
    risk: projectedBalance < 0 ? 'critical' : projectedBalance < projectedIncome * 0.08 ? 'attention' : 'stable',
  }
}

export function buildPredictiveSnapshot(state, referenceDate = new Date()) {
  const categories = forecastCategorySpending(state, referenceDate)
  const projection = projectMonthEnd(state, referenceDate)
  const investment = calculateSafeInvestmentCapacity(state, referenceDate)
  const scenarios = SCENARIO_TYPES.map((scenario) => simulateScenario(state, scenario, referenceDate))
  const overrunRisks = categories.filter((category) => category.risk !== 'ok').sort((a, b) => b.overrunAmount - a.overrunAmount)
  const mainRisk = overrunRisks[0]
    ? `${overrunRisks[0].category} pode passar do limite.`
    : projection.projectedBalance < 0
      ? 'Fechamento do mes pode ficar negativo.'
      : 'Nenhum risco critico no momento.'
  return {
    source: 'deterministic',
    generatedAt: new Date().toISOString(),
    categories,
    projection,
    investment,
    scenarios,
    overrunRisks,
    summary: {
      projectedClosing: projection.projectedBalance,
      safeInvestmentCapacity: investment.safeCapacity,
      mainRisk,
    },
    forbiddenActions: {
      automaticFinancialWrite: false,
      aiGeneratedNumbers: false,
      cardLimitAsCash: false,
      benefitsAsNetWorth: false,
    },
  }
}

export function buildCutRecommendations(snapshot) {
  const risks = Array.isArray(snapshot?.overrunRisks) ? snapshot.overrunRisks : []
  return risks.slice(0, 3).map((risk) => {
    const cutAmount = Math.max(0, risk.projected - Math.max(risk.planned || 0, risk.historicalAverage || 0))
    return {
      category: risk.category,
      suggestedCut: round(cutAmount),
      priority: risk.risk === 'critical' ? 'high' : 'medium',
      reason: `${risk.category} esta projetada acima da referencia deterministica.`,
    }
  })
}

export function buildAdvisorReport(state, referenceDate = new Date()) {
  const snapshot = buildPredictiveSnapshot(state, referenceDate)
  const recommendations = buildCutRecommendations(snapshot)
  const likely = snapshot.scenarios.find((item) => item.scenario === 'probable')
  return {
    source: 'deterministic',
    aiMayExplainOnly: true,
    snapshot,
    recommendations,
    narrative: [
      `Fechamento provavel do mes: R$ ${snapshot.projection.projectedBalance.toFixed(2)}.`,
      `Capacidade segura de investimento: R$ ${snapshot.investment.safeCapacity.toFixed(2)}.`,
      `Cenario provavel: ${likely?.risk || 'stable'}.`,
      recommendations.length
        ? `Principal corte sugerido: ${recommendations[0].category}, R$ ${recommendations[0].suggestedCut.toFixed(2)}.`
        : 'Nao ha corte obrigatorio pelos calculos atuais.',
    ],
  }
}

export function validateAdvisorFeedback(input = {}) {
  const recommendationId = String(input.recommendation_id || input.recommendationId || '').trim()
  const value = String(input.feedback || '').trim()
  if (!recommendationId) throw new Error('recommendation_id obrigatorio')
  if (!ADVISOR_FEEDBACK_VALUES.includes(value)) throw new Error('feedback invalido')
  return {
    recommendation_id: recommendationId,
    feedback: value,
    notes: String(input.notes || '').slice(0, 500),
  }
}
