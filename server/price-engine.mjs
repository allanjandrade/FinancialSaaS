const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'e', 'em', 'a', 'o'])

export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value || '').replace(/[^\d.,]/g, '')
  if (!s) return null
  const parsed = /,\d{1,2}$/.test(s)
    ? Number(s.replace(/\./g, '').replace(',', '.'))
    : Number(s)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function words(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
}

export function scoreOfferMatch(product, offer) {
  const productWords = new Set(words([product?.name, product?.nome, product?.brand, product?.marca, product?.model, product?.modelo].filter(Boolean).join(' ')))
  const titleWords = new Set(words(offer?.title || ''))
  if (!productWords.size || !titleWords.size) return 50

  let hits = 0
  productWords.forEach((word) => {
    if (titleWords.has(word)) hits += 1
  })

  const coverage = hits / productWords.size
  const years = [...productWords].filter((word) => /^(19|20)\d{2}$/.test(word))
  const yearPenalty = years.some((year) => !titleWords.has(year)) ? 12 : 0
  return Math.max(0, Math.min(100, Math.round(coverage * 100 - yearPenalty)))
}

export function normalizeOffer(rawOffer, product = {}) {
  const price = parseMoney(rawOffer?.price)
  if (!price) return null

  const shipping = parseMoney(rawOffer?.shipping)
  const totalPrice = shipping == null ? price : price + shipping
  const confidence = Math.min(
    100,
    Math.max(
      0,
      Number(rawOffer?.confidence ?? scoreOfferMatch(product, rawOffer)),
    ),
  )

  return {
    marketplace: rawOffer?.marketplace || '',
    title: rawOffer?.title || '',
    price,
    shipping,
    totalPrice,
    total: totalPrice,
    url: rawOffer?.url || '',
    image: rawOffer?.image || rawOffer?.imageUrl || '',
    imageUrl: rawOffer?.imageUrl || rawOffer?.image || '',
    seller: rawOffer?.seller || '',
    rating: rawOffer?.rating ?? null,
    deliveryEstimate: rawOffer?.deliveryEstimate || '',
    deliveryDays: Number(rawOffer?.deliveryDays || 0),
    trust: Number(rawOffer?.trust || 0),
    warranty: rawOffer?.warranty || '',
    confidence,
    score: Number(rawOffer?.score || 0),
    source: rawOffer?.source || 'live',
  }
}

export function normalizeOffers(rawOffers, product = {}, minimumConfidence = 35) {
  return (rawOffers || [])
    .map((offer) => normalizeOffer(offer, product))
    .filter((offer) => offer && offer.confidence >= minimumConfidence)
}

export function summarizeOffers(offers) {
  const priced = (offers || []).filter((offer) => Number(offer.totalPrice || offer.total || 0) > 0)
  if (!priced.length) {
    return {
      lowestPrice: null,
      averagePrice: null,
      highestPrice: null,
      bestOffer: null,
      offerCount: 0,
    }
  }

  const totals = priced.map((offer) => Number(offer.totalPrice || offer.total))
  const lowest = Math.min(...totals)
  const highest = Math.max(...totals)
  const average = totals.reduce((sum, value) => sum + value, 0) / totals.length
  const bestOffer = [...priced].sort((a, b) => {
    const totalDiff = Number(a.totalPrice || a.total) - Number(b.totalPrice || b.total)
    if (Math.abs(totalDiff) > 0.01) return totalDiff
    return b.confidence - a.confidence
  })[0]

  return {
    lowestPrice: Math.round(lowest * 100) / 100,
    averagePrice: Math.round(average * 100) / 100,
    highestPrice: Math.round(highest * 100) / 100,
    bestOffer,
    offerCount: priced.length,
  }
}
