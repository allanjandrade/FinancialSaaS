export const PLANNING_GOAL_TYPES = Object.freeze([
  'reserva_emergencia',
  'compra_planejada',
  'quitar_divida',
  'investimento_mensal',
  'viagem',
  'entrada_bem',
  'reduzir_categoria',
])

export const PLANNING_GOAL_STATUSES = Object.freeze(['active', 'paused', 'completed', 'cancelled'])

export const BUDGET_CATEGORIES = Object.freeze([
  'Mercado',
  'Acougue',
  'Feira',
  'Moradia',
  'Transporte',
  'Saude',
  'Educacao',
  'Lazer',
  'Assinaturas',
  'Cartao',
  'Pets',
  'Outros',
])

export const PLANNING_AUTOMATION_TEMPLATES = Object.freeze([
  'goal_progress_behind',
  'budget_category_above_limit',
  'monthly_plan_risk',
  'purchase_now_viable',
  'investment_capacity_available',
])

const ESSENTIAL_CATEGORIES = new Set(['Mercado', 'Acougue', 'Feira', 'Moradia', 'Transporte', 'Saude'])

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function monthKey(dateString) {
  const [year, month] = String(dateString || '').split('-').map(Number)
  if (!year || !month) return 0
  return year * 100 + month
}

function selectedMonthKey(state) {
  return toNumber(state?.settings?.year) * 100 + toNumber(state?.settings?.selectedMonth)
}

function expenseKey(expense, state) {
  if (expense.cardCompetencyMonth && expense.cardCompetencyYear) {
    return toNumber(expense.cardCompetencyYear) * 100 + toNumber(expense.cardCompetencyMonth)
  }
  if (expense.payment === 'Credito' || expense.payment === 'Crédito') {
    const [year, month, day] = String(expense.date || '').split('-').map(Number)
    const closingDay = toNumber(state?.settings?.cardClosingDay, 1)
    const competency = new Date(year, month - 1 + (day <= closingDay ? 1 : 2), 1)
    return competency.getFullYear() * 100 + (competency.getMonth() + 1)
  }
  return monthKey(expense.date)
}

function isBenefitPayment(expense) {
  return ['VA', 'VR'].includes(expense?.payment)
}

function isCreditPayment(expense) {
  return expense?.payment === 'Credito' || expense?.payment === 'Crédito'
}

function isInternalTransfer(expense) {
  return Boolean(expense?.isInternalTransfer || expense?.transferGroupId || expense?.type === 'internal_transfer')
}

function categoryOf(expense) {
  const raw = expense?.category || 'Outros'
  if (raw === 'Açougue') return 'Acougue'
  if (raw === 'Saúde') return 'Saude'
  if (raw === 'Educação') return 'Educacao'
  return BUDGET_CATEGORIES.includes(raw) ? raw : 'Outros'
}

export function sanitizePlanningGoal(raw) {
  const type = PLANNING_GOAL_TYPES.includes(raw?.type) ? raw.type : 'compra_planejada'
  const status = PLANNING_GOAL_STATUSES.includes(raw?.status) ? raw.status : 'active'
  return {
    id: raw?.id || globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
    name: String(raw?.name || '').trim() || 'Meta sem nome',
    type,
    target_amount: Math.max(0, toNumber(raw?.target_amount ?? raw?.targetAmount)),
    current_amount: Math.max(0, toNumber(raw?.current_amount ?? raw?.currentAmount)),
    target_date: raw?.target_date || raw?.targetDate || '',
    monthly_contribution: Math.max(0, toNumber(raw?.monthly_contribution ?? raw?.monthlyContribution)),
    priority: Math.max(1, Math.min(5, Math.round(toNumber(raw?.priority, 3)))),
    status,
    created_at: raw?.created_at || new Date().toISOString(),
  }
}

export function sanitizeCategoryBudget(raw, state = {}) {
  const category = raw?.category === 'Açougue' ? 'Acougue' : raw?.category
  return {
    id: raw?.id || globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
    month_key: toNumber(raw?.month_key, selectedMonthKey(state)),
    category: BUDGET_CATEGORIES.includes(category) ? category : 'Outros',
    planned: Math.max(0, toNumber(raw?.planned)),
    created_at: raw?.created_at || new Date().toISOString(),
  }
}

export function buildBudgetRows(state, referenceDate = new Date()) {
  const key = selectedMonthKey(state)
  const budgets = Array.isArray(state?.categoryBudgets) ? state.categoryBudgets : []
  const expenses = (Array.isArray(state?.expenses) ? state.expenses : [])
    .filter((expense) => expenseKey(expense, state) === key)
    .filter((expense) => !isInternalTransfer(expense))
    .filter((expense) => !isBenefitPayment(expense))

  const day = Math.max(1, referenceDate.getDate())
  const daysInMonth = new Date(Math.floor(key / 100), key % 100, 0).getDate()

  return BUDGET_CATEGORIES.map((category) => {
    const planned = budgets.find((budget) => budget.month_key === key && budget.category === category)?.planned || 0
    const actual = expenses
      .filter((expense) => categoryOf(expense) === category)
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
    const projection = actual > 0 ? actual / day * daysInMonth : 0
    const percent_used = planned > 0 ? actual / planned : 0
    const historical_average = buildHistoricalAverage(state, category, key)
    const risk = planned > 0 && projection > planned ? 'overrun' : percent_used >= 0.85 ? 'attention' : 'ok'
    return {
      category,
      planned,
      actual,
      remaining: planned - actual,
      percent_used,
      projection,
      risk,
      historical_average,
    }
  })
}

function buildHistoricalAverage(state, category, currentKey) {
  const expenses = Array.isArray(state?.expenses) ? state.expenses : []
  const previous = expenses
    .filter((expense) => !isInternalTransfer(expense) && !isBenefitPayment(expense))
    .filter((expense) => expenseKey(expense, state) < currentKey)
    .filter((expense) => categoryOf(expense) === category)
  const byMonth = new Map()
  previous.forEach((expense) => {
    const key = expenseKey(expense, state)
    byMonth.set(key, (byMonth.get(key) || 0) + toNumber(expense.amount))
  })
  const values = [...byMonth.values()].slice(-3)
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildMonthlyPlan(state, referenceDate = new Date()) {
  const key = selectedMonthKey(state)
  const incomes = (Array.isArray(state?.incomes) ? state.incomes : []).filter((income) => monthKey(income.date) === key)
  const expenses = (Array.isArray(state?.expenses) ? state.expenses : [])
    .filter((expense) => expenseKey(expense, state) === key)
    .filter((expense) => !isInternalTransfer(expense))

  const income_cash = incomes
    .filter((income) => !['VA', 'VR'].includes(income.type))
    .reduce((sum, income) => sum + toNumber(income.amount), 0)
  const benefit_income = incomes
    .filter((income) => ['VA', 'VR'].includes(income.type))
    .reduce((sum, income) => sum + toNumber(income.amount), 0)
  const fixed_expenses = expenses
    .filter((expense) => expense.fixed || ESSENTIAL_CATEGORIES.has(categoryOf(expense)))
    .filter((expense) => !isCreditPayment(expense) && !isBenefitPayment(expense))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const variable_expenses = expenses
    .filter((expense) => !expense.fixed && !ESSENTIAL_CATEGORIES.has(categoryOf(expense)))
    .filter((expense) => !isCreditPayment(expense) && !isBenefitPayment(expense))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const projected_card_bill = expenses
    .filter(isCreditPayment)
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const benefit_spend = expenses
    .filter(isBenefitPayment)
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const active_goals = (Array.isArray(state?.planningGoals) ? state.planningGoals : [])
    .map(sanitizePlanningGoal)
    .filter((goal) => goal.status === 'active')
  const goal_contribution = active_goals.reduce((sum, goal) => sum + toNumber(goal.monthly_contribution), 0)
  const budgets = buildBudgetRows(state, referenceDate)
  const budget_risk_count = budgets.filter((budget) => ['attention', 'overrun'].includes(budget.risk)).length
  const safe_balance = income_cash - fixed_expenses - projected_card_bill - goal_contribution
  const free_amount_for_purchases = Math.max(0, safe_balance - variable_expenses)
  const month_risk = safe_balance < 0 || budget_risk_count >= 3
    ? 'critical'
    : budget_risk_count > 0 || projected_card_bill > income_cash * 0.35
      ? 'attention'
      : 'stable'

  return {
    month_key: key,
    income_cash,
    benefit_income,
    fixed_expenses,
    variable_expenses,
    projected_card_bill,
    benefit_spend,
    active_goals,
    recommended_contribution: recommendInvestmentContribution(state, referenceDate).safe_contribution,
    safe_balance,
    free_amount_for_purchases,
    month_risk,
    budgets,
    answers: {
      can_invest: safe_balance > 0 && month_risk !== 'critical',
      can_buy_small_items: free_amount_for_purchases > 0,
      needs_budget_adjustment: budget_risk_count > 0,
    },
  }
}

export function simulatePlannedPurchase(input, state, referenceDate = new Date()) {
  const amount = Math.max(0, toNumber(input?.amount))
  const installments = Math.max(1, Math.round(toNumber(input?.installments, 1)))
  const monthlyImpact = input?.payment_type === 'credit' ? amount / installments : amount
  const plan = buildMonthlyPlan(state, referenceDate)
  const goalConflict = plan.active_goals.some((goal) => goal.priority <= 2 && goal.monthly_contribution > 0 && monthlyImpact > goal.monthly_contribution)
  const categoryBudget = plan.budgets.find((budget) => budget.category === input?.category)
  const cardRisk = input?.payment_type === 'credit' && (plan.projected_card_bill + monthlyImpact) > plan.income_cash * 0.35

  let decision = 'can_buy_now'
  if (plan.safe_balance < 0 || amount > plan.free_amount_for_purchases * 1.5) decision = 'not_recommended'
  else if (cardRisk) decision = 'card_risk'
  else if (goalConflict) decision = 'goal_conflict'
  else if (categoryBudget && categoryBudget.planned > 0 && categoryBudget.actual + monthlyImpact > categoryBudget.planned) decision = 'only_if_adjust_budget'
  else if (amount > plan.free_amount_for_purchases) decision = 'wait'

  return {
    item_name: String(input?.item_name || '').trim(),
    amount,
    payment_type: input?.payment_type || 'cash',
    installments,
    category: input?.category || 'Outros',
    purchase_date: input?.purchase_date || referenceDate.toISOString().slice(0, 10),
    monthly_impact: monthlyImpact,
    decision,
    would_write_transaction: false,
    reasons: [
      `Saldo seguro antes da compra: ${plan.safe_balance.toFixed(2)}`,
      `Valor livre para compras: ${plan.free_amount_for_purchases.toFixed(2)}`,
      cardRisk ? 'Fatura projetada acima do limite conservador.' : null,
      goalConflict ? 'Compra compete com meta prioritária.' : null,
    ].filter(Boolean),
  }
}

export function recommendInvestmentContribution(state, referenceDate = new Date()) {
  const key = selectedMonthKey(state)
  const incomes = (Array.isArray(state?.incomes) ? state.incomes : []).filter((income) => monthKey(income.date) === key)
  const expenses = (Array.isArray(state?.expenses) ? state.expenses : [])
    .filter((expense) => expenseKey(expense, state) === key)
    .filter((expense) => !isInternalTransfer(expense))
  const incomeCash = incomes.filter((income) => !['VA', 'VR'].includes(income.type)).reduce((sum, income) => sum + toNumber(income.amount), 0)
  const cashExpenses = expenses.filter((expense) => !isCreditPayment(expense) && !isBenefitPayment(expense)).reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const cardBill = expenses.filter(isCreditPayment).reduce((sum, expense) => sum + toNumber(expense.amount), 0)
  const benefitRisk = expenses.filter(isBenefitPayment).reduce((sum, expense) => sum + toNumber(expense.amount), 0) > incomes.filter((income) => ['VA', 'VR'].includes(income.type)).reduce((sum, income) => sum + toNumber(income.amount), 0)
  const safeBalance = incomeCash - cashExpenses - cardBill
  const criticalCard = incomeCash > 0 && cardBill / incomeCash > 0.4
  const maximum = Math.max(0, safeBalance)
  const safe = safeBalance <= 0 || criticalCard || benefitRisk ? 0 : Math.floor(maximum * 0.35)
  const risk_level = safe === 0 ? 'high' : safe < maximum * 0.2 ? 'attention' : 'low'
  return {
    safe_contribution: safe,
    maximum_possible: maximum,
    risk_level,
    reasons: [
      safeBalance <= 0 ? 'Saldo seguro negativo.' : null,
      criticalCard ? 'Fatura do cartão em nível crítico.' : null,
      benefitRisk ? 'Risco em benefício essencial VA/VR.' : null,
      cashExpenses > incomeCash ? 'Despesas fixas/variáveis descobertas.' : null,
      safe > 0 ? 'Aporte conservador preserva caixa do mês.' : null,
    ].filter(Boolean),
  }
}

export function buildNarrativeReport(state, referenceDate = new Date()) {
  const plan = buildMonthlyPlan(state, referenceDate)
  const investment = recommendInvestmentContribution(state, referenceDate)
  return {
    source: 'deterministic',
    ai_language_polish_allowed: false,
    numbers: {
      income_cash: plan.income_cash,
      safe_balance: plan.safe_balance,
      free_amount_for_purchases: plan.free_amount_for_purchases,
      projected_card_bill: plan.projected_card_bill,
      safe_contribution: investment.safe_contribution,
    },
    paragraphs: [
      `Receita em dinheiro do mês: ${plan.income_cash.toFixed(2)}.`,
      `Saldo seguro após despesas, cartão e metas: ${plan.safe_balance.toFixed(2)}.`,
      `Valor livre para compras: ${plan.free_amount_for_purchases.toFixed(2)}.`,
      `Aporte conservador recomendado: ${investment.safe_contribution.toFixed(2)}.`,
    ],
  }
}
