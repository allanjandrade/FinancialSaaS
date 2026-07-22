import { dayCountLabel } from './pt-br-copy.js'

export const MARKETPLACES = [
  { id: 'amazon', name: 'Amazon', priceFactor: 0.97, shipping: 0, deliveryDays: 2, trust: 95, warranty: 'Alta' },
  { id: 'ml', name: 'Mercado Livre', priceFactor: 1, shipping: 20, deliveryDays: 4, trust: 90, warranty: 'Média' },
  { id: 'shopee', name: 'Shopee', priceFactor: 0.95, shipping: 85, deliveryDays: 7, trust: 78, warranty: 'Baixa' },
  { id: 'magalu', name: 'Magazine Luiza', priceFactor: 1.02, shipping: 15, deliveryDays: 5, trust: 88, warranty: 'Média' },
  { id: 'kabum', name: 'Kabum', priceFactor: 0.99, shipping: 0, deliveryDays: 6, trust: 86, warranty: 'Média' },
  { id: 'pichau', name: 'Pichau', priceFactor: 0.98, shipping: 29, deliveryDays: 6, trust: 84, warranty: 'Média' },
  { id: 'casasbahia', name: 'Casas Bahia', priceFactor: 1.03, shipping: 25, deliveryDays: 6, trust: 85, warranty: 'Média' },
  { id: 'americanas', name: 'Americanas', priceFactor: 1.01, shipping: 18, deliveryDays: 7, trust: 80, warranty: 'Baixa' },
]

function hashSeed(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

function jitter(base, seed, spread = 0.06) {
  const factor = 1 + ((seed % 100) / 100 - 0.5) * spread * 2
  return Math.round(base * factor * 100) / 100
}

export function compareMarketplaces(product) {
  const basePrice = Number(product?.valor || product?.value || 0)
  if (basePrice <= 0) return []

  const seed = hashSeed(`${product?.nome || ''}-${product?.marca || ''}`)
  const sourceMarketplace = product?.marketplace

  const offers = MARKETPLACES.map((mp, index) => {
    let price = jitter(basePrice * mp.priceFactor, seed + index)
    if (sourceMarketplace && mp.name === sourceMarketplace) {
      price = basePrice
    }
    const shipping = mp.shipping
    const total = price + shipping
    return {
      marketplace: mp.name,
      price,
      shipping,
      total,
      deliveryDays: mp.deliveryDays,
      trust: mp.trust,
      warranty: mp.warranty,
      score: 0,
      url: '',
      title: product?.nome || product?.name || '',
      source: 'estimated',
    }
  })

  offers.forEach((offer) => {
    const priceScore = 40 * (1 - offer.total / Math.max(...offers.map((o) => o.total)))
    const trustScore = offer.trust * 0.35
    const deliveryScore = Math.max(0, 15 - offer.deliveryDays)
    offer.score = priceScore + trustScore + deliveryScore
  })

  offers.sort((a, b) => b.score - a.score)
  return offers
}

export function pickBestOffers(offers) {
  if (!offers.length) return { lowest: null, best: null, reason: '' }

  const lowest = [...offers].sort((a, b) => a.total - b.total)[0]
  const best = offers[0]

  const reason = lowest.marketplace === best.marketplace
    ? 'Menor preço total e melhor custo-benefício geral.'
    : `Entrega em ${dayCountLabel(best.deliveryDays)}, confiança ${best.trust}% e frete ${best.shipping === 0 ? 'grátis' : 'competitivo'}.`

  return { lowest, best, reason }
}

export function suggestAlternatives(product) {
  const name = String(product?.nome || product?.name || '').trim()
  if (!name) return []

  const value = Number(product?.valor || product?.value || 0)
  const alternatives = []

  const s24 = name.replace(/S25/i, 'S24')
  if (s24 !== name && value > 0) {
    alternatives.push({
      nome: s24,
      economia: Math.round(value * 0.31),
      perdaDesempenho: 'Baixa',
      valorEstimado: Math.round(value * 0.69),
    })
  }

  const genericPrev = name.replace(/\b(2025|2026|Pro Max|Ultra)\b/gi, '').trim() + ' (geração anterior)'
  if (genericPrev !== name && value > 0 && alternatives.length === 0) {
    alternatives.push({
      nome: genericPrev,
      economia: Math.round(value * 0.22),
      perdaDesempenho: 'Média',
      valorEstimado: Math.round(value * 0.78),
    })
  }

  return alternatives
}

export function detectPriceDrop(history, currentTotal) {
  if (!Array.isArray(history) || history.length === 0 || currentTotal <= 0) return null
  const previous = history[history.length - 1]
  if (!previous?.total || previous.total <= currentTotal) return null
  const pct = Math.round(((previous.total - currentTotal) / previous.total) * 100)
  return {
    percent: pct,
    from: previous.total,
    to: currentTotal,
    daysAgo: Math.max(
      1,
      Math.round((Date.now() - new Date(previous.at).getTime()) / (1000 * 60 * 60 * 24)),
    ),
  }
}
