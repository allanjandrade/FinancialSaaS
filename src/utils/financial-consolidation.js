import { SOURCE_TYPES } from '../constants/financial-structure.js'

const CATEGORY_SOURCE_RULES = [
  { categories: ['Mercado', 'Açougue'], sourceType: SOURCE_TYPES.BENEFIT_VA, payment: 'VA' },
  { categories: ['Restaurante', 'Delivery'], sourceType: SOURCE_TYPES.BENEFIT_VR, payment: 'VR' },
  { categories: ['Combustível'], sourceType: SOURCE_TYPES.ACCOUNT, payment: 'Pix' },
]

export function suggestExpenseSource(state, { category, amount = 0 }) {
  const rule = CATEGORY_SOURCE_RULES.find((r) => r.categories.includes(category))
  const suggestions = []

  const vaWallets = (state.benefitWallets || []).filter((b) => b.kind === 'va')
  const vrWallets = (state.benefitWallets || []).filter((b) => b.kind === 'vr')
  const accounts = state.financialAccounts || []
  const cards = state.creditCards || []

  function pushSuggestion(sourceType, walletOrAccount, payment, reason, preferred = false) {
    const balance = Number(walletOrAccount.balance ?? walletOrAccount.availableLimit ?? 0)
    const limit = Number(walletOrAccount.limit ?? 0)
    const available = sourceType === SOURCE_TYPES.CREDIT_CARD
      ? Number(walletOrAccount.availableLimit ?? limit)
      : balance

    suggestions.push({
      sourceType,
      sourceId: walletOrAccount.id,
      payment,
      label: walletOrAccount.name,
      available,
      sufficient: available >= amount,
      reason,
      preferred,
    })
  }

  if (rule?.sourceType === SOURCE_TYPES.BENEFIT_VA && vaWallets[0]) {
    pushSuggestion(SOURCE_TYPES.BENEFIT_VA, vaWallets[0], 'VA', `${category}: usar VA`, true)
  }
  if (rule?.sourceType === SOURCE_TYPES.BENEFIT_VR && vrWallets[0]) {
    pushSuggestion(SOURCE_TYPES.BENEFIT_VR, vrWallets[0], 'VR', `${category}: usar VR`, true)
  }
  if (rule?.sourceType === SOURCE_TYPES.ACCOUNT && accounts[0]) {
    pushSuggestion(SOURCE_TYPES.ACCOUNT, accounts[0], 'Pix', `${category}: pagar pela conta`, true)
  }

  vaWallets.forEach((w) => pushSuggestion(SOURCE_TYPES.BENEFIT_VA, w, 'VA', 'Saldo VA disponível'))
  vrWallets.forEach((w) => pushSuggestion(SOURCE_TYPES.BENEFIT_VR, w, 'VR', 'Saldo VR disponível'))
  accounts.forEach((a) => pushSuggestion(SOURCE_TYPES.ACCOUNT, a, 'Pix', 'Saldo bancário'))
  cards.forEach((c) => pushSuggestion(SOURCE_TYPES.CREDIT_CARD, c, 'Crédito', 'Limite do cartão'))

  const seen = new Set()
  const unique = suggestions.filter((s) => {
    const key = `${s.sourceType}-${s.sourceId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const sufficient = unique.filter((s) => s.sufficient)
  const best = sufficient.find((s) => s.preferred) || sufficient[0] || null

  return { best, alternatives: unique.slice(0, 5) }
}

export function computeConsolidatedPatrimony(state, monthCalc = {}) {
  const accounts = state.financialAccounts || []
  const cards = state.creditCards || []
  const benefits = state.benefitWallets || []

  const bankBalance = accounts
    .filter((a) => a.type !== 'Conta Investimento')
    .reduce((s, a) => s + Number(a.balance || 0), 0)

  const investments = accounts
    .filter((a) => a.type === 'Conta Investimento')
    .reduce((s, a) => s + Number(a.balance || 0), 0)

  const vaBalance = benefits.filter((b) => b.kind === 'va').reduce((s, b) => s + Number(b.balance || 0), 0)
  const vrBalance = benefits.filter((b) => b.kind === 'vr').reduce((s, b) => s + Number(b.balance || 0), 0)
  const corporateBalance = benefits.filter((b) => b.kind === 'corporate').reduce((s, b) => s + Number(b.balance || 0), 0)

  const cardLimits = cards.reduce((s, c) => s + Number(c.limit || 0), 0)
  const cardAvailable = cards.reduce((s, c) => s + Number(c.availableLimit ?? (c.limit || 0)), 0)
  const cardBill = Number(monthCalc.cardBill || 0)

  const cash = Number(monthCalc.cashBalance || 0)
  const emergencyReserve = Number(state.settings?.emergencyReserveCurrent || 0)

  const netPatrimony = bankBalance + investments + vaBalance + vrBalance + corporateBalance + emergencyReserve

  return {
    bankBalance,
    investments,
    vaBalance,
    vrBalance,
    corporateBalance,
    cardLimits,
    cardAvailable,
    cardBill,
    cashFlowMonth: cash,
    emergencyReserve,
    netPatrimony,
    sections: [
      { label: 'Contas', value: bankBalance },
      { label: 'Investimentos', value: investments },
      { label: 'VA', value: vaBalance },
      { label: 'VR', value: vrBalance },
      { label: 'Benefícios corporativos', value: corporateBalance },
      { label: 'Reserva de emergência', value: emergencyReserve },
    ],
  }
}

export function computeRealCashFlow(state, monthCalc) {
  const patrimony = computeConsolidatedPatrimony(state, monthCalc)
  return {
    availableCash: patrimony.bankBalance,
    benefits: patrimony.vaBalance + patrimony.vrBalance + patrimony.corporateBalance,
    creditLimits: patrimony.cardAvailable,
    investments: patrimony.investments,
    note: 'Limites de crédito não compõem patrimônio líquido.',
  }
}

export function computeFamilyFinancialCenter(state, month) {
  const members = state.familyMembers || []
  const key = state.settings.year * 100 + month

  function monthKeyFromDate(dateString) {
    const [y, m] = dateString.split('-').map(Number)
    return y * 100 + m
  }

  return members.map((member) => {
    const incomes = (state.incomes || []).filter(
      (i) => i.familyMemberId === member.id && monthKeyFromDate(i.date) === key,
    )
    const incomeTotal = incomes.reduce((s, i) => s + Number(i.amount || 0), 0)

    const vaWallets = (state.benefitWallets || []).filter((b) => b.kind === 'va' && b.memberId === member.id)
    const vrWallets = (state.benefitWallets || []).filter((b) => b.kind === 'vr' && b.memberId === member.id)

    return {
      memberId: member.id,
      name: member.name,
      incomeTotal,
      vaBalance: vaWallets.reduce((s, w) => s + Number(w.balance || 0), 0),
      vrBalance: vrWallets.reduce((s, w) => s + Number(w.balance || 0), 0),
    }
  })
}

export function recommendPurchaseSource(state, item, analysis) {
  const amount = Number(item?.value || 0)
  const category = item?.category || 'Outros'
  const suggestion = suggestExpenseSource(state, { category, amount })

  if (suggestion.best?.sourceType === SOURCE_TYPES.BENEFIT_VA && suggestion.best.sufficient) {
    return {
      canBuy: analysis.buyTodayRecommended,
      recommendedLabel: suggestion.best.label,
      payment: 'VA',
      installments: null,
      impact: analysis.riskLabel,
      message: `Utilize saldo disponível no VA (${formatMoney(suggestion.best.available)}). Evite usar crédito.`,
    }
  }

  if (suggestion.best?.sourceType === SOURCE_TYPES.CREDIT_CARD && analysis.impactIndex <= 60) {
    const card = state.creditCards.find((c) => c.id === suggestion.best.sourceId)
    const inst = analysis.installments?.find((i) => i.impact === 'Baixo') || analysis.installments?.[2]
    return {
      canBuy: true,
      recommendedLabel: card?.name || 'Cartão',
      payment: 'Crédito',
      installments: inst?.label || '6x',
      impact: analysis.riskLabel,
      message: `Origem recomendada: ${card?.name || 'Cartão'}. Parcelamento: ${inst?.label || '6x'}. Impacto: ${analysis.riskLabel}.`,
    }
  }

  return {
    canBuy: analysis.buyTodayRecommended,
    recommendedLabel: suggestion.best?.label || 'Conta principal',
    payment: suggestion.best?.payment || 'Pix',
    installments: 'À vista',
    impact: analysis.riskLabel,
    message: analysis.buyTodayRecommended
      ? `Você pode comprar. Origem: ${suggestion.best?.label}. Impacto: ${analysis.riskLabel}.`
      : `Aguarde. Se necessário, use ${suggestion.best?.label}.`,
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function getSourceLabel(state, sourceType, sourceId) {
  if (!sourceId) return '—'
  if (sourceType === SOURCE_TYPES.ACCOUNT || sourceType === SOURCE_TYPES.CASH) {
    return state.financialAccounts.find((a) => a.id === sourceId)?.name || 'Conta'
  }
  if (sourceType === SOURCE_TYPES.CREDIT_CARD) {
    return state.creditCards.find((c) => c.id === sourceId)?.name || 'Cartão'
  }
  return state.benefitWallets.find((b) => b.id === sourceId)?.name || 'Benefício'
}
