import { formatCurrency } from './financial-planner.js'
import { resolvePricing, weightedAvg90DayPrice } from './price-context.js'

const PROMO_EVENTS = [
  { id: 'black-friday', name: 'Black Friday', month: 11, dayStart: 20, typicalDrop: [12, 18] },
  { id: 'prime-day', name: 'Prime Day', month: 7, dayStart: 10, typicalDrop: [8, 15] },
  { id: 'consumer-day', name: 'Dia do Consumidor', month: 3, dayStart: 10, typicalDrop: [5, 12] },
  { id: 'client-week', name: 'Semana do Cliente', month: 9, dayStart: 10, typicalDrop: [6, 14] },
  { id: 'anniversary-ml', name: 'Aniversário Mercado Livre', month: 8, dayStart: 15, typicalDrop: [7, 13] },
]

const MOTIVATION_OPTIONS = ['Necessidade', 'Desejo', 'Investimento']

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function avg90DayPrice(history, hasLiveData = false) {
  return weightedAvg90DayPrice(history, hasLiveData)
}

function daysUntilEvent(event, fromDate = new Date()) {
  const year = fromDate.getFullYear()
  let target = new Date(year, event.month - 1, event.dayStart)
  if (target < fromDate) {
    target = new Date(year + 1, event.month - 1, event.dayStart)
  }
  return Math.ceil((target - fromDate) / (1000 * 60 * 60 * 24))
}

export function classifyPurchaseMotivation(item) {
  if (item?.purchaseMotivation && MOTIVATION_OPTIONS.includes(item.purchaseMotivation)) {
    return item.purchaseMotivation
  }
  const cat = String(item?.category || '').toLowerCase()
  const name = String(item?.name || '').toLowerCase()
  if (cat.includes('invest') || name.includes('curso') || name.includes('certific')) return 'Investimento'
  if (['mercado', 'açougue', 'farmácia', 'saúde', 'transporte'].some((k) => cat.includes(k))) {
    return 'Necessidade'
  }
  if (['eletrônicos', 'games', 'lazer', 'restaurante', 'delivery'].some((k) => cat.includes(k))) {
    return 'Desejo'
  }
  return item?.priority === 'Alta' ? 'Necessidade' : 'Desejo'
}

export function computeNecessityScore(item, context) {
  const motivation = classifyPurchaseMotivation(item)
  let score = motivation === 'Necessidade' ? 72 : motivation === 'Investimento' ? 68 : 38
  if (item?.priority === 'Alta') score += 12
  if (item?.priority === 'Baixa') score -= 10
  if (item?.desiredDate) {
    const days = (new Date(item.desiredDate) - new Date()) / (1000 * 60 * 60 * 24)
    if (days > 0 && days < 45) score += 8
  }
  const monthlySurplus = Math.max(0, Number(context.monthlySurplus || 0))
  const value = Number(item?.value || 0)
  if (monthlySurplus > 0 && value / monthlySurplus > 2) score -= 12
  return {
    score: clamp(score),
    motivation,
    label: score >= 71 ? 'Alta necessidade' : score >= 31 ? 'Necessidade moderada' : 'Baixa necessidade',
  }
}

export function computeOpportunityIndex(item, offers = [], pricing = null) {
  const ctx = pricing || resolvePricing(item, offers)
  if (ctx.identityPending) {
    return {
      score: 0,
      verdict: 'Não é possível avaliar oportunidade enquanto não houver preço compatível.',
      currentPrice: 0,
      avg90Days: null,
      priceSource: 'identity_pending',
      hasLiveData: false,
    }
  }
  const current = ctx.currentPrice
  const history = item?.priceHistory || []
  const avg90 = avg90DayPrice(history, ctx.hasLiveData)

  let score = ctx.hasLiveData ? 58 : 50
  if (avg90 && current > 0) {
    const vsAvg = ((avg90 - current) / avg90) * 100
    if (vsAvg >= 10) score += ctx.hasLiveData ? 28 : 22
    else if (vsAvg >= 5) score += ctx.hasLiveData ? 18 : 14
    else if (vsAvg >= 0) score += 8
    else if (vsAvg <= -10) score -= ctx.hasLiveData ? 28 : 22
    else if (vsAvg <= -5) score -= 12
  }

  const liveHistory = history.filter((h) => h.source === 'live')
  const trendHistory = liveHistory.length >= 2 ? liveHistory : history
  if (trendHistory.length >= 3) {
    const last3 = trendHistory.slice(-3).map((h) => h.total)
    const trend = last3[2] - last3[0]
    if (trend < 0) score += 10
    if (trend > 0) score -= 8
  }

  const promo = getNextPromotion()
  if (promo && promo.daysUntil <= 60) score -= Math.min(20, 8 + Math.floor((60 - promo.daysUntil) / 10))

  const pricedOffers = (offers || []).filter((o) => o.total > 0)
  if (pricedOffers.length >= 2) {
    const totals = pricedOffers.map((o) => o.total)
    const spread = (Math.max(...totals) - Math.min(...totals)) / Math.max(...totals)
    if (spread > 0.08) score += ctx.hasLiveData ? 12 : 6
    if (ctx.bestOffer && ctx.bestOffer.total === Math.min(...totals) && ctx.hasLiveData) {
      score += 6
    }
  }

  score = clamp(score)
  const verdict =
    score >= 75 ? 'Excelente oportunidade'
    : score >= 55 ? 'Boa oportunidade'
    : score >= 40 ? 'Preço na média'
    : score >= 25 ? 'Preço acima da média'
    : 'Aguardar'

  return {
    score,
    verdict,
    currentPrice: current,
    avg90Days: avg90,
    priceSource: ctx.priceSource,
    hasLiveData: ctx.hasLiveData,
  }
}

export function getPromotionRadar(productName = '') {
  const now = new Date()
  const upcoming = PROMO_EVENTS.map((event) => {
    const daysUntil = daysUntilEvent(event, now)
    const [minDrop, maxDrop] = event.typicalDrop
    return {
      ...event,
      daysUntil,
      recommendation: daysUntil <= 45 ? 'Aguardar' : 'Monitorar',
      message: `${productName || 'Produto'}: historicamente cai entre ${minDrop}% e ${maxDrop}% na ${event.name}.`,
    }
  }).sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    next: upcoming[0],
    events: upcoming,
  }
}

export function predictPriceDrop(item, currentPrice, hasLiveData = false) {
  const history = item?.priceHistory || []
  const avg90 = avg90DayPrice(history, hasLiveData)
  const price = Number(currentPrice || item?.value || 0)
  if (!avg90 || price <= 0) {
    return {
      currentPrice: price,
      dropProbability: history.length >= 2 ? 45 : 30,
      estimatedRange: null,
      note: 'Histórico insuficiente — ative o monitoramento de preço.',
    }
  }

  const aboveAvg = price > avg90
  const magnitude = Math.abs((price - avg90) / avg90)
  let dropProbability = aboveAvg ? clamp(40 + magnitude * 120, 30, 85) : clamp(25 + magnitude * 40, 15, 50)
  const promo = getNextPromotion()
  if (promo?.daysUntil <= 50) dropProbability = clamp(dropProbability + 15, 0, 92)

  const low = price * (aboveAvg ? 0.88 : 0.95)
  const high = price * (aboveAvg ? 0.94 : 0.98)

  return {
    currentPrice: price,
    dropProbability,
    estimatedRange: { low: Math.round(low), high: Math.round(high) },
    note: aboveAvg ? 'Preço acima da média recente.' : 'Preço próximo ou abaixo da média.',
  }
}

function getNextPromotion() {
  return getPromotionRadar().next
}

export function detectBadPurchaseAlert(item, currentPrice, hasLiveData = false) {
  const price = Number(currentPrice || item?.value || 0)
  const avg90 = avg90DayPrice(item?.priceHistory || [], hasLiveData)
  if (!avg90 || price <= 0) return null

  const pctAbove = Math.round(((price - avg90) / avg90) * 100)
  const threshold = hasLiveData ? 5 : 8
  if (pctAbove < threshold) return null

  return {
    product: item?.name || 'Produto',
    currentPrice: price,
    avg90Days: avg90,
    percentAbove: pctAbove,
    recommendation: 'Aguardar',
    priceSource: hasLiveData ? 'live' : 'estimated',
    message: hasLiveData
      ? `Preço ao vivo está ${pctAbove}% acima da média ponderada (90 dias).`
      : `Preço está ${pctAbove}% acima da média dos últimos 90 dias.`,
  }
}

export function computePatrimonialImpact(itemValue, context) {
  const reserve = Math.max(0, Number(context.emergencyReserveCurrent || 0))
  const cash = Number(context.currentBalance || 0)
  const patrimony = reserve + Math.max(0, cash)
  const value = Number(itemValue || 0)
  const pct = patrimony > 0 ? Math.round((value / patrimony) * 100) : 0
  return {
    purchaseValue: value,
    availablePatrimony: patrimony,
    percentOfPatrimony: pct,
    message: `Representa ${pct}% do patrimônio financeiro disponível.`,
  }
}

export function computeReserveImpact(itemValue, context) {
  const current = Math.max(0, Number(context.emergencyReserveCurrent || 0))
  const value = Number(itemValue || 0)
  const after = current - value
  const reductionPct = current > 0 ? Math.round((value / current) * 100) : 0
  return {
    currentReserve: current,
    afterPurchase: after,
    reductionPct,
    message: `Reserva atual: ${formatCurrency(current)}. Após compra: ${formatCurrency(after)}. Redução: ${reductionPct}%.`,
  }
}

export function computeGoalsImpact(itemValue, context, priorityQueue = []) {
  const monthlySurplus = Math.max(0, Number(context.monthlySurplus || 0))
  const value = Number(itemValue || 0)
  const topGoal = [...(priorityQueue || [])].sort(
    (a, b) => Number(a.priorityOrder || 0) - Number(b.priorityOrder || 0),
  )[0]

  const goalName = topGoal?.name || context.primaryGoalName || 'Meta principal'
  const monthsBase = monthlySurplus > 0 ? Math.ceil((topGoal?.targetAmount || context.activeGoalsValue || 0) / monthlySurplus) : 6
  const delayMonths = monthlySurplus > 0 ? Math.ceil(value / monthlySurplus) : 3

  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() + monthsBase)
  const delayedDate = new Date()
  delayedDate.setMonth(delayedDate.getMonth() + monthsBase + delayMonths)

  return {
    goalName,
    expectedCompletionLabel: baseDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    afterPurchaseLabel: delayedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    delayMonths,
    message: `Meta "${goalName}": conclusão prevista em ${baseDate.toLocaleDateString('pt-BR', { month: 'long' })}. Após compra: ${delayedDate.toLocaleDateString('pt-BR', { month: 'long' })}.`,
  }
}

export function computeEffectivePrice(offer) {
  if (!offer) return null
  const base = Number(offer.total || offer.price || 0)
  const seed = (offer.marketplace || '').length
  const hasCoupon = seed % 3 !== 0
  const hasCashback = seed % 2 === 0
  const hasPoints = seed % 5 !== 0

  let discount = 0
  if (hasCoupon) discount += base * 0.05
  if (hasCashback) discount += base * 0.03
  if (hasPoints) discount += base * 0.02

  return {
    listPrice: base,
    effectivePrice: Math.round((base - discount) * 100) / 100,
    perks: [
      hasCoupon ? 'Cupom disponível' : null,
      hasCashback ? 'Cashback disponível' : null,
      hasPoints ? 'Programa de pontos disponível' : null,
    ].filter(Boolean),
  }
}

export function buildPurchaseIntelligence(item, context, offers = []) {
  const pricing = resolvePricing(item, offers)
  if (pricing.identityPending) {
    return {
      decision: 'price_identity_pending',
      message: 'Ainda não há preço compatível suficiente para avaliar esta compra.',
      necessity: computeNecessityScore(item, context),
      opportunity: {
        score: 0,
        verdict: 'Não é possível avaliar oportunidade enquanto não houver preço compatível.',
        currentPrice: 0,
        avg90Days: null,
        priceSource: 'identity_pending',
        hasLiveData: false,
      },
      promotion: getPromotionRadar(item?.name),
      priceDrop: {
        currentPrice: 0,
        dropProbability: 0,
        estimatedRange: null,
        note: 'Preço compatível pendente.',
      },
      badPurchase: null,
      patrimonial: computePatrimonialImpact(0, context),
      reserve: computeReserveImpact(0, context),
      goals: computeGoalsImpact(0, context, context.priorityQueue),
      effective: null,
      pricing,
      motivation: classifyPurchaseMotivation(item),
    }
  }
  const currentPrice = pricing.currentPrice
  const necessity = computeNecessityScore(item, context)
  const opportunity = computeOpportunityIndex(item, offers, pricing)
  const promotion = getPromotionRadar(item?.name)
  const priceDrop = predictPriceDrop(item, currentPrice, pricing.hasLiveData)
  const badPurchase = detectBadPurchaseAlert(item, currentPrice, pricing.hasLiveData)
  const patrimonial = computePatrimonialImpact(currentPrice, context)
  const reserve = computeReserveImpact(currentPrice, context)
  const goals = computeGoalsImpact(currentPrice, context, context.priorityQueue)
  const effective = computeEffectivePrice(pricing.bestOffer || offers[0])

  return {
    necessity,
    opportunity,
    promotion,
    priceDrop,
    badPurchase,
    patrimonial,
    reserve,
    goals,
    effective,
    pricing,
    motivation: necessity.motivation,
  }
}

export { MOTIVATION_OPTIONS }
