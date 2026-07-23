import {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
} from '../financial-engine/calculations.js'
import { normalizeFinanceState, requireReferenceDate } from '../financial-engine/normalize-state.js'

const SEVERITY_RANK = { normal: 0, info: 0, attention: 1, risk: 2, critical: 3 }

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function roundedPercent(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`
}

function success(triggered, payload) {
  return { status: 'success', triggered, ...payload }
}

function skipped(code, message, payload = {}) {
  return { status: 'skipped', triggered: false, code, message, ...payload }
}

export function evaluateAutomationTemplate(templateId, parameters, financeData, options = {}) {
  const referenceDate = requireReferenceDate(options.referenceDate || new Date().toISOString().slice(0, 10))
  const state = normalizeFinanceState(financeData || {}, referenceDate)
  switch (templateId) {
    case 'cash_balance_below':
      return evaluateCashBalanceBelow(state, parameters)
    case 'card_bill_ratio_above':
      return evaluateCardBillRatioAbove(state, parameters)
    case 'benefit_depletion_risk':
      return evaluateBenefitDepletionRisk(state, parameters)
    case 'bill_due_soon':
      return evaluateBillDueSoon(parameters)
    case 'category_anomaly_detected':
      return evaluateCategoryAnomalyDetected(state, parameters)
    case 'wishlist_target_price_reached':
      return evaluateWishlistTargetPriceReached(financeData || {}, parameters)
    case 'goal_progress_behind':
      return evaluateGoalProgressBehind(financeData || {}, parameters)
    case 'budget_category_above_limit':
      return evaluateBudgetCategoryAboveLimit(financeData || {}, parameters, referenceDate)
    case 'monthly_plan_risk':
      return evaluateMonthlyPlanRisk(state, parameters)
    case 'purchase_now_viable':
      return evaluatePurchaseNowViable(financeData || {}, parameters)
    case 'investment_capacity_available':
      return evaluateInvestmentCapacityAvailable(state, parameters)
    default:
      return skipped('TEMPLATE_NOT_SUPPORTED', 'Template de automacao nao suportado.')
  }
}

export function evaluateCashBalanceBelow(state, parameters) {
  const snapshot = calculateFinancialSnapshot(state)
  const threshold = Number(parameters.threshold)
  const triggered = snapshot.availableToSpend < threshold
  return success(triggered, {
    severity: triggered ? 'attention' : 'info',
    title: 'Saldo baixo',
    message: triggered
      ? `Saldo disponivel seguro abaixo de ${money(threshold)}.`
      : `Saldo disponivel seguro em ${money(snapshot.availableToSpend)}.`,
    signal: `available:${snapshot.availableToSpend}:threshold:${threshold}`,
    details: { availableToSpend: snapshot.availableToSpend, threshold },
  })
}

export function evaluateCardBillRatioAbove(state, parameters) {
  const cardRisk = calculateCardRisk(state)
  const ratio = Number(parameters.ratio)
  const triggered = cardRisk.billToIncomeRatio >= ratio
  return success(triggered, {
    severity: triggered ? cardRisk.riskLevel === 'critical' ? 'critical' : 'risk' : 'info',
    title: 'Fatura alta',
    message: triggered
      ? `Fatura em ${roundedPercent(cardRisk.billToIncomeRatio)} da renda mensal.`
      : `Fatura em ${roundedPercent(cardRisk.billToIncomeRatio)} da renda mensal.`,
    signal: `ratio:${cardRisk.billToIncomeRatio}:limit:${ratio}`,
    details: { billToIncomeRatio: cardRisk.billToIncomeRatio, ratio, totalOpenBill: cardRisk.totalOpenBill },
  })
}

export function evaluateBenefitDepletionRisk(state, parameters) {
  const benefitType = String(parameters.benefit_type || '').toUpperCase()
  const burn = calculateBenefitBurnRate(state, benefitType)
  const triggered = ['risk', 'depleted'].includes(burn.status)
  return success(triggered, {
    severity: burn.status === 'depleted' ? 'critical' : triggered ? 'risk' : 'info',
    title: `${benefitType} em risco`,
    message: triggered ? burn.recommendation : `${benefitType} sem risco de esgotamento no momento.`,
    signal: `${benefitType}:${burn.status}:${burn.projectedEndBalance}`,
    details: burn,
  })
}

export function evaluateBillDueSoon() {
  return skipped('BILLS_SOURCE_NOT_READY', 'Fonte confiavel de vencimentos ainda nao disponivel.')
}

export function evaluateCategoryAnomalyDetected(state, parameters) {
  const minimum = String(parameters.severity || 'attention')
  const result = calculateCategoryAnomalies(state)
  const minimumRank = SEVERITY_RANK[minimum] || 1
  const matches = (result.anomalies || []).filter((item) => (SEVERITY_RANK[item.severity] || 0) >= minimumRank)
  const strongest = matches.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0))[0]
  return success(Boolean(strongest), {
    severity: strongest?.severity || 'info',
    title: 'Categoria acima da media',
    message: strongest
      ? `${strongest.category} esta acima da media historica.`
      : 'Nenhuma categoria atingiu a severidade configurada.',
    signal: strongest ? `${strongest.category}:${strongest.channel}:${strongest.severity}:${strongest.currentAmount}` : `none:${minimum}`,
    details: { minimumSeverity: minimum, matches, anomalies: result.anomalies },
  })
}

export function evaluateWishlistTargetPriceReached(financeData, parameters) {
  const purchaseItemId = String(parameters.purchase_item_id || '')
  const wishlist = Array.isArray(financeData.wishlist) ? financeData.wishlist : []
  const item = wishlist.find((entry) => String(entry?.id || entry?.purchase_item_id || '') === purchaseItemId)
  if (!item) return skipped('WISHLIST_ITEM_NOT_FOUND', 'Item da wishlist nao encontrado.')
  const status = String(item.price_status || item.priceStatus || item.status || '').toLowerCase()
  const identityStatus = String(item.price_search_status || item.priceSearchStatus || '').toLowerCase()
  const matchScore = Number(item.last_match_score || item.lastMatchScore || item.best_compatible_offer?.match_score || 0)
  const compatibleOffer = item.best_compatible_offer || item.bestCompatibleOffer || null
  if (item.product_identity && (identityStatus !== 'found_compatible' || !compatibleOffer || matchScore < 0.85)) {
    return skipped('PRODUCT_IDENTITY_NOT_COMPATIBLE', 'Preco bloqueado ate confirmar compatibilidade do produto.', {
      details: { itemId: purchaseItemId, identityStatus, score: matchScore },
    })
  }
  if (['quote_pending', 'pending_quote', 'searching', 'found_ambiguous', 'not_found', 'error'].includes(status || identityStatus)) {
    return skipped('QUOTE_PENDING', 'Cotacao ainda pendente para o item monitorado.', { details: { itemId: purchaseItemId, status } })
  }
  const currentPrice = Number(compatibleOffer?.total ?? compatibleOffer?.totalPrice ?? compatibleOffer?.price ?? item.current_price ?? item.currentPrice ?? item.price ?? item.value)
  const desiredPrice = Number(item.desired_price ?? item.targetPrice ?? item.target_price)
  if (!Number.isFinite(currentPrice) || !Number.isFinite(desiredPrice) || currentPrice <= 0 || desiredPrice <= 0) {
    return skipped('WISHLIST_PRICE_DATA_NOT_READY', 'Preco atual ou preco alvo indisponivel.')
  }
  const priceStatusFound = item.product_identity ? identityStatus === 'found_compatible' : ['found', 'quoted', 'found_compatible'].includes(status || identityStatus)
  const triggered = priceStatusFound && currentPrice <= desiredPrice
  return success(triggered, {
    severity: triggered ? 'attention' : 'info',
    title: 'Preco alvo atingido',
    message: triggered
      ? `${item.name || 'Item'} atingiu o preco alvo de ${money(desiredPrice)}.`
      : `${item.name || 'Item'} ainda esta acima do preco alvo.`,
    signal: `${purchaseItemId}:${status}:${currentPrice}:${desiredPrice}`,
    details: { itemId: purchaseItemId, currentPrice, desiredPrice, status },
  })
}

export function evaluateGoalProgressBehind(financeData, parameters) {
  const goalId = String(parameters.goal_id || '')
  const goals = Array.isArray(financeData.planningGoals) ? financeData.planningGoals : []
  const goal = goals.find((entry) => String(entry.id || '') === goalId)
  if (!goal) return skipped('GOAL_NOT_FOUND', 'Meta nao encontrada.')
  const target = Number(goal.target_amount || goal.targetAmount || 0)
  const current = Number(goal.current_amount || goal.currentAmount || 0)
  const contribution = Number(goal.monthly_contribution || goal.monthlyContribution || 0)
  const remaining = Math.max(0, target - current)
  const triggered = target > 0 && contribution > 0 && remaining / contribution > 12
  return success(triggered, {
    severity: triggered ? 'attention' : 'info',
    title: 'Meta atrasada',
    message: triggered ? `${goal.name || 'Meta'} esta atrasada pelo ritmo atual.` : `${goal.name || 'Meta'} segue dentro do ritmo informado.`,
    signal: `${goalId}:${remaining}:${contribution}`,
    details: { goalId, remaining, contribution },
  })
}

export function evaluateBudgetCategoryAboveLimit(financeData, parameters, referenceDate) {
  const category = String(parameters.category || '')
  const [year, month] = String(referenceDate || '').split('-').map(Number)
  const key = year * 100 + month
  const budgets = Array.isArray(financeData.categoryBudgets) ? financeData.categoryBudgets : []
  const budget = budgets.find((entry) => Number(entry.month_key) === key && entry.category === category)
  if (!budget) return skipped('BUDGET_NOT_FOUND', 'Orcamento da categoria nao encontrado.')
  const actual = (Array.isArray(financeData.expenses) ? financeData.expenses : [])
    .filter((expense) => !expense.isInternalTransfer && expense.category === category)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const planned = Number(budget.planned || 0)
  const triggered = planned > 0 && actual > planned
  return success(triggered, {
    severity: triggered ? 'attention' : 'info',
    title: 'Orcamento acima do limite',
    message: triggered ? `${category} passou do limite planejado.` : `${category} esta dentro do limite planejado.`,
    signal: `${category}:${actual}:${planned}`,
    details: { category, actual, planned },
  })
}

export function evaluateMonthlyPlanRisk(state, parameters) {
  const minimum = String(parameters.risk_level || 'attention')
  const snapshot = calculateFinancialSnapshot(state)
  const cardRisk = calculateCardRisk(state)
  const risk = snapshot.availableToSpend < 0 || cardRisk.riskLevel === 'critical' ? 'critical' : cardRisk.riskLevel === 'attention' ? 'attention' : 'info'
  const triggered = (SEVERITY_RANK[risk] || 0) >= (SEVERITY_RANK[minimum] || 1)
  return success(triggered, {
    severity: risk,
    title: 'Risco no plano do mes',
    message: triggered ? 'Plano do mes precisa de atencao.' : 'Plano do mes sem risco relevante.',
    signal: `${risk}:${snapshot.availableToSpend}:${cardRisk.billToIncomeRatio}`,
    details: { availableToSpend: snapshot.availableToSpend, cardRisk },
  })
}

export function evaluatePurchaseNowViable(financeData, parameters) {
  const purchaseItemId = String(parameters.purchase_item_id || '')
  const wishlist = Array.isArray(financeData.wishlist) ? financeData.wishlist : []
  const item = wishlist.find((entry) => String(entry.id || '') === purchaseItemId)
  if (!item) return skipped('WISHLIST_ITEM_NOT_FOUND', 'Item da wishlist nao encontrado.')
  const compatible = !item.product_identity || (item.price_search_status === 'found_compatible' && Number(item.last_match_score || 0) >= 0.85)
  const price = Number(item.value || item.current_price || item.currentPrice || 0)
  const triggered = compatible && price > 0
  return success(triggered, {
    severity: triggered ? 'info' : 'attention',
    title: 'Compra viavel agora',
    message: triggered ? `${item.name || 'Item'} pode ser avaliado para compra.` : 'Item ainda nao tem compatibilidade/preco suficiente.',
    signal: `${purchaseItemId}:${compatible}:${price}`,
    details: { purchaseItemId, compatible, price },
  })
}

export function evaluateInvestmentCapacityAvailable(state, parameters) {
  const minimumAmount = Number(parameters.minimum_amount || 0)
  const snapshot = calculateFinancialSnapshot(state)
  const triggered = snapshot.safeToInvest >= minimumAmount && minimumAmount >= 0
  return success(triggered, {
    severity: triggered ? 'info' : 'attention',
    title: 'Capacidade de aporte disponivel',
    message: triggered ? `Ha capacidade conservadora para aporte acima de ${money(minimumAmount)}.` : 'Aporte conservador ainda nao esta disponivel.',
    signal: `${snapshot.safeToInvest}:${minimumAmount}`,
    details: { safeToInvest: snapshot.safeToInvest, minimumAmount },
  })
}
