export type WishlistPriorityFactors = {
  necessidade?: number
  urgencia?: number
  impactoPratico?: number
  viabilidade?: number
  risco?: number
  preferencia?: number
}

export type WishlistPredictiveItem = WishlistPriorityFactors & {
  id?: string
  name?: string
  description?: string
  notes?: string
  value?: number
  valor?: number
  price?: number
  cost?: number
  amount?: number
  targetAmount?: number
  manualPrice?: boolean
  priceMode?: string
  priceStatus?: string
  price_search_status?: string
  priceSummary?: { status?: string } | null
  identity_locked?: boolean
  product_identity?: { title?: string; name?: string } | null
  productIdentity?: { title?: string; name?: string } | null
  priorityFactors?: WishlistPriorityFactors
}

export type WishlistOpportunityCostInput = {
  itemA: WishlistPredictiveItem
  itemB: WishlistPredictiveItem
  monthlySavingsCapacity: number
  currentSavings?: number
  daysPerMonth?: number
}

export type ScoredWishlistItem = {
  id?: string
  name?: string
  cost: number
  priorityScore: number
  hasReliableCost?: boolean
}

export type WishlistOpportunityCostResult = {
  itemA: ScoredWishlistItem
  itemB: ScoredWishlistItem
  monthlySavingsCapacity: number
  currentSavings: number
  opportunityCostAmount: number
  baselineDaysToItemB: number | null
  daysToItemBAfterItemA: number | null
  delayDays: number | null
  delayMonths: number | null
  delaysItemB: boolean
}

export type WishlistRankingDecision = 'Comprar à vista' | 'Adiar' | 'Alto custo de oportunidade' | 'Simular compra'

export type WishlistRankingInput = {
  items: WishlistPredictiveItem[]
  monthlySavingsCapacity: number
  currentSavings?: number
  daysPerMonth?: number
}

export type WishlistRankingItem = ScoredWishlistItem & {
  rank: number
  decision: WishlistRankingDecision
  analystJustification: string
  comparison: WishlistOpportunityCostResult | null
}

export const PRIORITY_SCORE_WEIGHTS = Object.freeze({
  necessidade: 0.3,
  urgencia: 0.2,
  impactoPratico: 0.2,
  viabilidade: 0.15,
  risco: 0.1,
  preferencia: 0.05,
})

function toPositiveNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function itemCost(item: WishlistPredictiveItem): number {
  return toPositiveNumber(
    item.value
      ?? item.valor
      ?? item.price
      ?? item.cost
      ?? item.amount
      ?? item.targetAmount,
  )
}

const TECHNICAL_FALLBACK_NAMES = new Set([
  'api',
  'auth',
  'function',
  'functions',
  'product from url',
  'produto',
  'rest',
  'storage',
])

function cleanName(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function isTechnicalFallbackName(value: unknown): boolean {
  const normalized = cleanName(value).toLowerCase()
  return !normalized || TECHNICAL_FALLBACK_NAMES.has(normalized) || /^v\d+$/.test(normalized)
}

function displayWishlistItemName(item: WishlistPredictiveItem): string {
  const rawName = cleanName(item.name)
  const identity = item.product_identity || item.productIdentity || null
  const candidates = isTechnicalFallbackName(rawName)
    ? [identity?.title, identity?.name, item.description, item.notes, rawName]
    : [rawName, identity?.title, identity?.name, item.description, item.notes]

  for (const candidate of candidates) {
    const name = cleanName(candidate)
    if (name && !isTechnicalFallbackName(name)) return name
  }

  return 'Produto sem nome confiavel'
}

function hasReliableCost(item: WishlistPredictiveItem): boolean {
  const cost = itemCost(item)
  if (cost <= 0) return false

  const priceMode = String(item.priceMode || '').toLowerCase()
  if (item.manualPrice || priceMode === 'manual') return true

  const priceStatus = String(item.priceStatus || '').toLowerCase()
  if (['quoted', 'found_compatible', 'compatible'].includes(priceStatus)) return true

  const status = [
    priceStatus,
    item.price_search_status,
    item.priceSummary?.status,
  ].map((value) => String(value || '').toLowerCase()).join(' ')

  return !/(pending_quote|quote_pending|pending|cotacao pendente)/.test(status)
}

function priorityFactors(item: WishlistPredictiveItem): WishlistPriorityFactors {
  const explicit = item.priorityFactors || item
  return {
    necessidade: explicit.necessidade ?? derivedNecessidade(item),
    urgencia: explicit.urgencia ?? derivedUrgencia(item),
    impactoPratico: explicit.impactoPratico ?? derivedImpactoPratico(item),
    viabilidade: explicit.viabilidade ?? 55,
    risco: explicit.risco ?? derivedRisco(item),
    preferencia: explicit.preferencia ?? derivedPreferencia(item),
  }
}

function daysToFund(amount: number, monthlySavingsCapacity: number, daysPerMonth: number): number | null {
  if (amount <= 0) return 0
  if (monthlySavingsCapacity <= 0) return null
  return Math.ceil((amount / monthlySavingsCapacity) * daysPerMonth)
}

export function calculatePriorityScore(factors: WishlistPriorityFactors = {}): number {
  return round(
    toPositiveNumber(factors.necessidade) * PRIORITY_SCORE_WEIGHTS.necessidade
      + toPositiveNumber(factors.urgencia) * PRIORITY_SCORE_WEIGHTS.urgencia
      + toPositiveNumber(factors.impactoPratico) * PRIORITY_SCORE_WEIGHTS.impactoPratico
      + toPositiveNumber(factors.viabilidade) * PRIORITY_SCORE_WEIGHTS.viabilidade
      + toPositiveNumber(factors.risco) * PRIORITY_SCORE_WEIGHTS.risco
      + toPositiveNumber(factors.preferencia) * PRIORITY_SCORE_WEIGHTS.preferencia,
  )
}

export function calculateWishlistOpportunityCost(
  input: WishlistOpportunityCostInput,
): WishlistOpportunityCostResult {
  const itemACost = itemCost(input.itemA)
  const itemBCost = itemCost(input.itemB)
  const currentSavings = toPositiveNumber(input.currentSavings)
  const monthlySavingsCapacity = toPositiveNumber(input.monthlySavingsCapacity)
  const daysPerMonth = toPositiveNumber(input.daysPerMonth, 30) || 30

  const baselineAmountToItemB = Math.max(0, itemBCost - currentSavings)
  const amountToItemBAfterItemA = Math.max(0, itemACost + itemBCost - currentSavings)
  const opportunityCostAmount = Math.max(0, amountToItemBAfterItemA - baselineAmountToItemB)
  const baselineDaysToItemB = daysToFund(baselineAmountToItemB, monthlySavingsCapacity, daysPerMonth)
  const daysToItemBAfterItemA = daysToFund(amountToItemBAfterItemA, monthlySavingsCapacity, daysPerMonth)
  const delayDays = baselineDaysToItemB == null || daysToItemBAfterItemA == null
    ? null
    : Math.max(0, daysToItemBAfterItemA - baselineDaysToItemB)

  return {
    itemA: {
      id: input.itemA.id,
      name: displayWishlistItemName(input.itemA),
      cost: itemACost,
      priorityScore: calculatePriorityScore(priorityFactors(input.itemA)),
      hasReliableCost: hasReliableCost(input.itemA),
    },
    itemB: {
      id: input.itemB.id,
      name: displayWishlistItemName(input.itemB),
      cost: itemBCost,
      priorityScore: calculatePriorityScore(priorityFactors(input.itemB)),
      hasReliableCost: hasReliableCost(input.itemB),
    },
    monthlySavingsCapacity,
    currentSavings,
    opportunityCostAmount,
    baselineDaysToItemB,
    daysToItemBAfterItemA,
    delayDays,
    delayMonths: delayDays == null ? null : round(delayDays / daysPerMonth),
    delaysItemB: delayDays != null && delayDays > 0,
  }
}

export function buildWishlistPurchaseRanking(input: WishlistRankingInput): WishlistRankingItem[] {
  const items = Array.isArray(input.items) ? input.items : []
  const monthlySavingsCapacity = toPositiveNumber(input.monthlySavingsCapacity)
  const currentSavings = toPositiveNumber(input.currentSavings)
  const daysPerMonth = toPositiveNumber(input.daysPerMonth, 30) || 30

  const scored = items.map((item) => ({
    id: item.id,
    name: displayWishlistItemName(item),
    cost: itemCost(item),
    priorityScore: calculatePriorityScore({
      ...priorityFactors(item),
      viabilidade: (item.priorityFactors || item).viabilidade ?? derivedViabilidade(item, monthlySavingsCapacity),
    }),
    hasReliableCost: hasReliableCost(item),
    source: item,
  }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.cost - b.cost || String(a.name || '').localeCompare(String(b.name || '')))

  return scored.map((item, index) => {
    const higherPriorityItem = scored.slice(0, index)[0] || null
    const comparison = higherPriorityItem
      ? calculateWishlistOpportunityCost({
        itemA: item.source,
        itemB: higherPriorityItem.source,
        monthlySavingsCapacity,
        currentSavings,
        daysPerMonth,
      })
      : null
    const decision = rankingDecision(item, higherPriorityItem, comparison, currentSavings, monthlySavingsCapacity)

    return {
      id: item.id,
      name: item.name,
      cost: item.cost,
      priorityScore: item.priorityScore,
      rank: index + 1,
      decision,
      analystJustification: analystJustification(decision, item, higherPriorityItem, comparison),
      comparison,
    }
  })
}

function rankingDecision(
  item: ScoredWishlistItem,
  higherPriorityItem: ScoredWishlistItem | null,
  comparison: WishlistOpportunityCostResult | null,
  currentSavings: number,
  monthlySavingsCapacity: number,
): WishlistRankingDecision {
  const delayDays = comparison?.delayDays || 0
  if (!item.hasReliableCost) return 'Simular compra'
  if (higherPriorityItem && delayDays >= 60) return 'Alto custo de oportunidade'
  if (higherPriorityItem && delayDays > 0) return 'Adiar'
  if (item.cost <= currentSavings || item.priorityScore >= 70) return 'Comprar à vista'
  if (monthlySavingsCapacity <= 0) return 'Adiar'
  return 'Simular compra'
}

function analystJustification(
  decision: WishlistRankingDecision,
  item: ScoredWishlistItem,
  higherPriorityItem: ScoredWishlistItem | null,
  comparison: WishlistOpportunityCostResult | null,
): string {
  const name = item.name || 'Este item'
  const referenceName = higherPriorityItem?.name || 'o item prioritario'
  const delayDays = comparison?.delayDays || 0

  if (!item.hasReliableCost) {
    return `${name} ainda precisa de preco confiavel antes da decisao; salve um preco manual ou aguarde uma cotacao compativel para destravar a analise financeira.`
  }
  if (decision === 'Comprar à vista') {
    return `${name} lidera o ranking por maior prioridade e impacto financeiro controlado; comprar à vista evita parcelamento e mantém a decisão objetiva.`
  }
  if (decision === 'Alto custo de oportunidade') {
    return `Alto custo de oportunidade: comprar ${name} agora atrasa ${referenceName} em ${delayDays} dias, então a decisão mais disciplinada é preservar caixa.`
  }
  if (decision === 'Adiar') {
    return `Adiar: ${name} fica abaixo de ${referenceName} no ranking e ainda desloca a capacidade de poupança em ${delayDays} dias.`
  }
  return `${name} exige simulação antes da compra; a prioridade é intermediária e depende da capacidade mensal disponível.`
}

function derivedNecessidade(item: WishlistPredictiveItem): number {
  const motivation = String((item as { purchaseMotivation?: string }).purchaseMotivation || '').toLowerCase()
  const category = String((item as { category?: string }).category || '').toLowerCase()
  const priority = String((item as { priority?: string }).priority || '').toLowerCase()
  if (motivation.includes('necess') || ['saude', 'saúde', 'mercado', 'transporte', 'educacao', 'educação'].some((key) => category.includes(key))) return 85
  if (motivation.includes('invest') || ['curso', 'trabalho', 'produtividade'].some((key) => category.includes(key))) return 72
  if (priority.includes('alta')) return 68
  if (priority.includes('baixa')) return 35
  return 50
}

function derivedUrgencia(item: WishlistPredictiveItem): number {
  const desiredDate = (item as { desiredDate?: string }).desiredDate
  if (desiredDate) {
    const days = Math.ceil((new Date(desiredDate).getTime() - Date.now()) / 86400000)
    if (Number.isFinite(days) && days <= 15) return 90
    if (Number.isFinite(days) && days <= 45) return 75
    if (Number.isFinite(days) && days <= 90) return 60
  }
  const priority = String((item as { priority?: string }).priority || '').toLowerCase()
  if (priority.includes('alta')) return 70
  if (priority.includes('baixa')) return 30
  return 50
}

function derivedImpactoPratico(item: WishlistPredictiveItem): number {
  const category = String((item as { category?: string }).category || '').toLowerCase()
  const name = String(item.name || '').toLowerCase()
  if (['notebook', 'computador', 'trabalho', 'curso', 'saude', 'saúde'].some((key) => category.includes(key) || name.includes(key))) return 82
  if (['casa', 'mobilidade', 'educacao', 'educação'].some((key) => category.includes(key))) return 68
  return 48
}

function derivedViabilidade(item: WishlistPredictiveItem, monthlySavingsCapacity: number): number {
  const cost = itemCost(item)
  if (cost <= 0) return 30
  if (monthlySavingsCapacity <= 0) return 15
  const months = cost / monthlySavingsCapacity
  if (months <= 1) return 90
  if (months <= 2) return 72
  if (months <= 4) return 50
  return 28
}

function derivedRisco(item: WishlistPredictiveItem): number {
  const priority = String((item as { priority?: string }).priority || '').toLowerCase()
  if (priority.includes('alta')) return 35
  if (priority.includes('baixa')) return 65
  return 50
}

function derivedPreferencia(item: WishlistPredictiveItem): number {
  const priority = String((item as { priority?: string }).priority || '').toLowerCase()
  if (priority.includes('alta')) return 80
  if (priority.includes('baixa')) return 35
  return 55
}

export function useWishlistPredictiveEngine() {
  return {
    buildWishlistPurchaseRanking,
    calculatePriorityScore,
    calculateWishlistOpportunityCost,
  }
}
