export const RECOMMENDATION_STATES = {
  BUY: 'COMPRAR',
  NORMAL: 'NORMAL',
  WAIT: 'AGUARDAR',
  HIGH_ALERT: 'ALERTA_ALTA',
}

export function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizePriceRecord(record) {
  const quantity = Math.max(1, toNumber(record.quantity, 1))
  const price = toNumber(record.price)
  return {
    ...record,
    price,
    quantity,
    unit_price: record.unit_price != null
      ? toNumber(record.unit_price)
      : price / quantity,
    currency: record.currency || 'BRL',
    availability: record.availability || 'available',
    collected_at: record.collected_at || new Date().toISOString(),
  }
}

export function daysBetween(dateString, now = new Date()) {
  const at = new Date(dateString)
  if (Number.isNaN(at.getTime())) return Infinity
  return Math.floor((now.getTime() - at.getTime()) / 86400000)
}

export function recordsForProduct(records, productId) {
  return (records || [])
    .filter((record) => record.product_id === productId && toNumber(record.price) > 0)
    .map(normalizePriceRecord)
    .sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at))
}

export function recordsWithinDays(records, days, now = new Date()) {
  return records.filter((record) => daysBetween(record.collected_at, now) <= days)
}

export function averagePrice(records) {
  if (!records.length) return null
  return records.reduce((sum, record) => sum + toNumber(record.price), 0) / records.length
}

export function minPrice(records) {
  if (!records.length) return null
  return Math.min(...records.map((record) => toNumber(record.price)))
}

export function maxPrice(records) {
  if (!records.length) return null
  return Math.max(...records.map((record) => toNumber(record.price)))
}

export function percentageVariation(currentPrice, referencePrice) {
  const current = toNumber(currentPrice)
  const reference = toNumber(referencePrice)
  if (current <= 0 || reference <= 0) return null
  return ((current - reference) / reference) * 100
}

export function recommendationFromVariation(variation) {
  if (variation == null) return RECOMMENDATION_STATES.NORMAL
  if (variation >= 20) return RECOMMENDATION_STATES.HIGH_ALERT
  if (variation >= 10) return RECOMMENDATION_STATES.WAIT
  if (variation <= -10) return RECOMMENDATION_STATES.BUY
  return RECOMMENDATION_STATES.NORMAL
}

export function recommendationText(state, productName = 'Produto') {
  const texts = {
    [RECOMMENDATION_STATES.BUY]: `${productName} está abaixo da média histórica. Recomendação: boa janela de compra.`,
    [RECOMMENDATION_STATES.NORMAL]: `${productName} está dentro da faixa normal. Recomendação: comprar se estiver na lista do mês.`,
    [RECOMMENDATION_STATES.WAIT]: `${productName} está acima da média. Recomendação: aguardar, salvo necessidade.`,
    [RECOMMENDATION_STATES.HIGH_ALERT]: `${productName} está muito acima da média. Recomendação: evitar compra agora.`,
  }
  return texts[state] || texts[RECOMMENDATION_STATES.NORMAL]
}

export function buildPriceStats(product, records, tracked = {}, now = new Date()) {
  const productRecords = recordsForProduct(records, product.id)
  const current = productRecords[0] || null
  const currentPrice = current?.price ?? null
  const p7 = recordsWithinDays(productRecords, 7, now)
  const p30 = recordsWithinDays(productRecords, 30, now)
  const p60 = recordsWithinDays(productRecords, 60, now)
  const p90 = recordsWithinDays(productRecords, 90, now)
  const avg90 = averagePrice(p90)
  const avgReference = avg90 ?? averagePrice(productRecords)
  const variation = percentageVariation(currentPrice, avgReference)
  const recommendation = recommendationFromVariation(variation)
  const usualQuantity = Math.max(1, toNumber(tracked.usual_quantity, 1))
  const frequency = Math.max(1, toNumber(tracked.purchase_frequency_days, 30))
  const monthlyQuantity = usualQuantity * (30 / frequency)

  return {
    product_id: product.id,
    current_price: currentPrice,
    current_store_id: current?.store_id || null,
    latest_record: current,
    average_price_7_days: averagePrice(p7),
    average_price_30_days: averagePrice(p30),
    average_price_60_days: averagePrice(p60),
    average_price_90_days: avg90,
    lowest_price_30_days: minPrice(p30),
    lowest_price_90_days: minPrice(p90),
    highest_price_history: maxPrice(productRecords),
    lowest_price_history: minPrice(productRecords),
    variation_percentual: variation,
    trend: trendFromRecords(productRecords),
    recommendation,
    recommendation_text: recommendationText(recommendation, product.name),
    savings_potential: avgReference && currentPrice
      ? Math.max(0, (avgReference - currentPrice) * usualQuantity)
      : 0,
    estimated_monthly_spend: avgReference ? avgReference * monthlyQuantity : 0,
    record_count: productRecords.length,
  }
}

export function trendFromRecords(records) {
  if (records.length < 2) return 'SEM_DADOS'
  const latest = toNumber(records[0].price)
  const previous = toNumber(records[1].price)
  if (latest > previous) return 'ALTA'
  if (latest < previous) return 'QUEDA'
  return 'ESTAVEL'
}
