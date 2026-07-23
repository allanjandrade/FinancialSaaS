import {
  ACCOUNT_TYPES,
  BENEFIT_PROVIDERS_VA,
  createOpenFinanceFields,
  newId,
  SOURCE_TYPES,
} from '@/constants/financial-structure.js'

export function ensureFinancialStructure(state) {
  const settings = state.settings || {}
  let changed = false

  if (!Array.isArray(state.familyMembers) || state.familyMembers.length === 0) {
    state.familyMembers = [
      { id: newId(), name: settings.primaryMemberName || 'Titular', role: 'adult' },
    ]
    changed = true
  }

  if (!Array.isArray(state.financialAccounts)) state.financialAccounts = []
  if (!Array.isArray(state.creditCards)) state.creditCards = []
  if (!Array.isArray(state.benefitWallets)) state.benefitWallets = []
  if (!Array.isArray(state.recurringIncomes)) state.recurringIncomes = []
  if (!Array.isArray(state.subscriptions)) state.subscriptions = []
  if (!Array.isArray(state.subscriptionCharges)) state.subscriptionCharges = []
  if (!Array.isArray(state.internalTransfers)) state.internalTransfers = []

  const primaryMember = state.familyMembers[0]
  state.benefitWallets = state.benefitWallets.map((wallet) => {
    const kind = normalizeBenefitKind(wallet)
    const next = {
      ...wallet,
      kind,
      name: wallet.name || benefitNameForKind(kind),
      balance: Number(wallet.balance || 0),
      openingBalance: Number(wallet.openingBalance ?? wallet.balance ?? 0),
      memberId: wallet.memberId || primaryMember.id,
      openFinance: wallet.openFinance || createOpenFinanceFields(),
    }
    if (!wallet.kind || !wallet.name || !wallet.memberId || !wallet.openFinance) changed = true
    return next
  })

  if (state.financialAccounts.length === 0) {
    state.financialAccounts.push({
      id: newId(),
      name: 'Conta principal',
      type: ACCOUNT_TYPES[0],
      bank: '',
      balance: Number(settings.emergencyReserveCurrent || 0),
      currency: 'BRL',
      openFinance: createOpenFinanceFields(),
      created_at: new Date().toISOString(),
    })
    changed = true
  }

  if (state.creditCards.length === 0 && (settings.cardLimit > 0 || settings.cardClosingDay)) {
    state.creditCards.push({
      id: newId(),
      name: 'Cartão principal',
      bank: '',
      brand: 'Visa',
      limit: Number(settings.cardLimit || 0),
      availableLimit: Number(settings.cardLimit || 0),
      closingDay: Number(settings.cardClosingDay || 1),
      dueDay: Number(settings.cardDueDay || 10),
      holderMemberId: primaryMember.id,
      color: '#6366f1',
      additionalHolders: [{ memberId: primaryMember.id, name: primaryMember.name, role: 'Titular' }],
      openFinance: createOpenFinanceFields(),
      created_at: new Date().toISOString(),
    })
    changed = true
  }

  const hasVa = state.benefitWallets.some((b) => b.kind === 'va')
  if (!hasVa) {
    state.benefitWallets.push({
      id: newId(),
      name: 'Vale Alimentação',
      provider: BENEFIT_PROVIDERS_VA[0],
      kind: 'va',
      balance: Number(settings.vaInitialBalance || 0),
      monthlyRecharge: 0,
      rechargeDay: 1,
      memberId: primaryMember.id,
      openFinance: createOpenFinanceFields(),
      created_at: new Date().toISOString(),
    })
    changed = true
  }

  state.expenses = (state.expenses || []).map((exp) => migrateExpenseSource(exp, state))
  state.incomes = (state.incomes || []).map((inc) => migrateIncomeSource(inc, state))

  return changed
}

function normalizeBenefitKind(wallet = {}) {
  const raw = String(wallet.kind || wallet.type || wallet.category || wallet.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (raw.includes('vr') || raw.includes('refeicao') || raw.includes('refeicoes')) return 'vr'
  if (raw.includes('corpor') || raw.includes('auxilio') || raw.includes('mobilidade') || raw.includes('cultura') || raw.includes('educacao')) return 'corporate'
  return 'va'
}

function benefitNameForKind(kind) {
  if (kind === 'vr') return 'Vale Refeicao'
  if (kind === 'corporate') return 'Beneficio corporativo'
  return 'Vale Alimentação'
}

function migrateExpenseSource(expense, state) {
  if (expense.sourceType && expense.sourceId) return expense

  const payment = expense.payment
  let sourceType = SOURCE_TYPES.ACCOUNT
  let sourceId = state.financialAccounts[0]?.id

  if (payment === 'Crédito' && state.creditCards[0]) {
    sourceType = SOURCE_TYPES.CREDIT_CARD
    sourceId = expense.creditCardId || state.creditCards[0].id
    return { ...expense, sourceType, sourceId, creditCardId: sourceId }
  }
  if (payment === 'VA') {
    const wallet = state.benefitWallets.find((b) => b.kind === 'va')
    if (wallet) return { ...expense, sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: wallet.id }
  }
  if (payment === 'VR') {
    const wallet = state.benefitWallets.find((b) => b.kind === 'vr')
    if (wallet) return { ...expense, sourceType: SOURCE_TYPES.BENEFIT_VR, sourceId: wallet.id }
  }
  if (payment === 'Dinheiro') {
    const cash = state.financialAccounts.find((a) => a.type === 'Dinheiro em Espécie')
    if (cash) return { ...expense, sourceType: SOURCE_TYPES.CASH, sourceId: cash.id }
  }

  return { ...expense, sourceType, sourceId }
}

function migrateIncomeSource(income, state) {
  if (income.sourceType && income.sourceId) return income
  const account = state.financialAccounts[0]
  if (!account) return income

  if (income.type === 'VA') {
    const w = state.benefitWallets.find((b) => b.kind === 'va')
    if (w) return { ...income, sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: w.id }
  }
  if (income.type === 'VR') {
    const w = state.benefitWallets.find((b) => b.kind === 'vr')
    if (w) return { ...income, sourceType: SOURCE_TYPES.BENEFIT_VR, sourceId: w.id }
  }

  return {
    ...income,
    sourceType: SOURCE_TYPES.ACCOUNT,
    sourceId: account.id,
    familyMemberId: income.familyMemberId || state.familyMembers[0]?.id,
  }
}
