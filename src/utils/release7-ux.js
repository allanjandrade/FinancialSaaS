import { SOURCE_TYPES } from '../constants/financial-structure.js'
import { computeConsolidatedPatrimony } from './financial-consolidation.js'

export const ONBOARDING_OBJECTIVES = [
  'organizar gastos',
  'sair do vermelho',
  'investir melhor',
  'controlar cartão',
  'planejar compras',
  'acompanhar família',
]

export const FIRST_STEPS_SECTIONS = [
  { key: 'income', label: 'Receita' },
  { key: 'expense', label: 'Despesa' },
  { key: 'goals', label: 'Metas' },
  { key: 'summary', label: 'Resumo' },
]

export const RISK_LABELS = {
  normal: 'Tudo certo',
  attention: 'Atenção',
  risk: 'Risco',
  critical: 'Crítico',
}

export function getInitialSetupStatus(state, calcMonth = () => ({})) {
  const selectedMonth = Number(state?.settings?.selectedMonth || new Date().getMonth() + 1)
  const month = calcMonth(selectedMonth) || {}
  const hasIncomeOrBalance = (state?.incomes || []).some((item) => Number(item.amount || 0) > 0)
    || (state?.financialAccounts || []).some((item) => Number(item.balance || 0) > 0)
    || (state?.benefitWallets || []).some((item) => Number(item.balance || 0) > 0)
  const hasAccountOrCard = Boolean((state?.financialAccounts || []).length || (state?.creditCards || []).length)
  const onboardingCompleted = Boolean(state?.settings?.onboardingCompletedAt)
  const hasEntryOrPlannedExpense = Boolean((state?.expenses || []).length || (state?.recurringRules || []).length || onboardingCompleted)
  const dashboardCalculable = hasIncomeOrBalance && hasAccountOrCard
  const checks = [
    { key: 'hasIncomeOrBalance', label: 'Receita ou saldo inicial', complete: hasIncomeOrBalance },
    { key: 'hasAccountOrCard', label: 'Conta ou cartão cadastrado', complete: hasAccountOrCard },
    { key: 'hasEntryOrPlannedExpense', label: 'Primeiro lançamento ou gasto previsto', complete: hasEntryOrPlannedExpense },
    { key: 'dashboardCalculable', label: 'Dashboard calculável', complete: dashboardCalculable },
  ]
  const completeCount = checks.filter((item) => item.complete).length
  return {
    checks,
    percent: Math.round((completeCount / checks.length) * 100),
    complete: completeCount === checks.length,
    month,
  }
}

export function getFirstStepsStatus(state = {}) {
  const hasIncome = (state?.incomes || []).some((item) => Number(item.amount || 0) > 0)
  const hasExpense = (state?.expenses || []).some((item) => Number(item.amount || 0) > 0)
    || (state?.recurringRules || []).some((item) => String(item?.status || 'active') !== 'cancelled')
    || (state?.subscriptions || []).some((item) => {
      const status = String(item?.status || 'active')
      return !item?.deleted_at && !['cancelled', 'canceled', 'paused', 'expired'].includes(status)
    })
  const hasGoal = (state?.planningGoals || []).some((goal) => String(goal?.status || 'active') !== 'cancelled')
  const hasSummaryReady = hasIncome && (hasExpense || hasGoal)
  const sections = FIRST_STEPS_SECTIONS.map((section) => ({
    ...section,
    complete: section.key === 'income'
      ? hasIncome
      : section.key === 'expense'
        ? hasExpense
        : section.key === 'goals'
          ? hasGoal
          : hasSummaryReady,
  }))
  const completeCount = [hasIncome, hasExpense].filter(Boolean).length

  return {
    hasIncome,
    hasExpense,
    hasGoal,
    hasSummaryReady,
    sections,
    completeCount,
    complete: completeCount === 2,
  }
}

export function needsOnboarding(state, calcMonth) {
  return !getInitialSetupStatus(state, calcMonth).complete
}

export function buildExecutiveSummary(state, calcMonth = () => ({})) {
  const monthNumber = Number(state?.settings?.selectedMonth || new Date().getMonth() + 1)
  const month = calcMonth(monthNumber) || {}
  const rawPatrimony = computeConsolidatedPatrimony(state || {}, month)
  const income = Number(month.incomeCash || 0)
  const benefitIncome = Number(month.vaIncome || 0)
  const cashExpenses = Number(month.cashExpenses || 0)
  const cardBill = Number(month.cardBill || 0)
  const availableCash = Number(rawPatrimony.bankBalance || 0)
  const needsIncomeSetup = income <= 0 && availableCash <= 0
  const safeToSpend = needsIncomeSetup
    ? 0
    : Math.max(0, availableCash + income - cashExpenses - cardBill)
  const cardRatio = income > 0 ? cardBill / income : 0
  const expenseRatio = income > 0 ? (cashExpenses + cardBill) / income : 0
  const benefitBalance = Number(rawPatrimony.vaBalance || 0) + Number(rawPatrimony.vrBalance || 0)
  const patrimony = {
    ...rawPatrimony,
    netPatrimony: Number(rawPatrimony.netPatrimony || 0) - benefitBalance - Number(rawPatrimony.corporateBalance || 0),
  }

  let risk = needsIncomeSetup ? 'attention' : 'normal'
  if (!needsIncomeSetup) {
    if (safeToSpend <= 0 || cardRatio >= 0.6 || expenseRatio >= 1) risk = 'critical'
    else if (cardRatio >= 0.4 || expenseRatio >= 0.85) risk = 'risk'
    else if (cardRatio >= 0.3 || expenseRatio >= 0.7) risk = 'attention'
  }

  const mainRisk = needsIncomeSetup
    ? 'Cadastre sua primeira receita para calcularmos sua capacidade segura de gastos.'
    : cardBill > 0 && cardRatio >= 0.3
      ? `Sua fatura já representa ${Math.round(cardRatio * 100)}% da renda.`
      : safeToSpend <= 0
        ? 'O saldo seguro está apertado para este mês.'
        : 'Nenhum risco crítico detectado.'

  const nextAction = needsIncomeSetup || !income
    ? 'Cadastrar receita mensal'
    : cardBill > 0 && cardRatio >= 0.3
      ? 'Revisar gastos no cartão'
      : !(state?.expenses || []).length
        ? 'Cadastrar primeira despesa'
        : 'Acompanhar próximos vencimentos'

  return {
    month,
    patrimony,
    safeToSpend,
    needsIncomeSetup,
    status: RISK_LABELS[risk],
    risk,
    mainRisk,
    nextAction,
    kpis: [
      { key: 'netWorth', label: 'Patrimônio líquido', value: patrimony.netPatrimony },
      { key: 'available', label: 'Saldo disponível', value: availableCash },
      { key: 'cardBill', label: 'Fatura aberta', value: cardBill },
      { key: 'monthProjection', label: 'Projeção do mês', value: income + benefitIncome - cashExpenses - cardBill },
      { key: 'benefits', label: 'VA/VR restante', value: benefitBalance },
      { key: 'alerts', label: 'Alertas ativos', value: (state?.priceMonitorAlerts || []).filter((item) => item.status === 'open').length },
    ],
  }
}

export function buildDemoFinanceState() {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  return {
    settings: {
      year: today.getFullYear(),
      selectedMonth: today.getMonth() + 1,
      hideBalance: false,
      emergencyReserveCurrent: 8200,
      emergencyReserveMinimum: 6000,
      onboardingCompletedAt: today.toISOString(),
    },
    family: { id: 'demo-family', name: 'Familia Demo' },
    familyMembers: [{ id: 'demo-member', name: 'Usuario Demo', role: 'administrator' }],
    financialAccounts: [
      { id: 'demo-account', name: 'Conta principal', type: 'Conta Corrente', balance: 4240 },
      { id: 'demo-investment', name: 'Reserva investida', type: 'Conta Investimento', balance: 8600 },
    ],
    creditCards: [
      { id: 'demo-card', name: 'Cartão principal', limit: 9000, availableLimit: 6120, closingDay: 20, dueDay: 8 },
    ],
    benefitWallets: [
      { id: 'demo-va', name: 'VA Demo', kind: 'va', balance: 640, monthlyRecharge: 900, memberId: 'demo-member' },
    ],
    incomes: [
      { id: 'demo-income', date: `${date}-05`, type: 'Salário', amount: 6200, sourceType: SOURCE_TYPES.ACCOUNT, sourceId: 'demo-account', familyMemberId: 'demo-member' },
      { id: 'demo-va-income', date: `${date}-05`, type: 'VA', amount: 900, sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: 'demo-va', familyMemberId: 'demo-member' },
    ],
    expenses: [
      { id: 'demo-rent', date: `${date}-07`, category: 'Moradia', description: 'Aluguel', payment: 'Pix', amount: 1800, paid: true, sourceType: SOURCE_TYPES.ACCOUNT, sourceId: 'demo-account' },
      { id: 'demo-market', date: `${date}-12`, category: 'Mercado', description: 'Supermercado', payment: 'VA', amount: 260, paid: true, sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: 'demo-va' },
      { id: 'demo-card-bill', date: `${date}-15`, category: 'Assinaturas', description: 'Servicos digitais', payment: 'Credito', amount: 2880, paid: false, sourceType: SOURCE_TYPES.CREDIT_CARD, sourceId: 'demo-card', creditCardId: 'demo-card' },
    ],
    wishlist: [
      { id: 'demo-wishlist', name: 'Notebook para trabalho', value: 4200, priceStatus: 'quoted', priority: 'Alta', category: 'Eletronicos' },
    ],
    priceMonitorAlerts: [
      { id: 'demo-alert', status: 'open', productName: 'Notebook para trabalho', message: 'Preço caiu 12% desde a última cotação.' },
    ],
    aiAlerts: [],
    recurringRules: [],
    internalTransfers: [],
  }
}

export function isDemoMode(route) {
  return String(route?.query?.demo || '') === '1'
}
