/**
 * Resolve preço atual e histórico priorizando cotações ao vivo da API.
 */

import { hasCompatiblePrice, isAcceptedCompatibleOffer, requiresCompatiblePrice } from './productIdentity.js'

export function resolvePricing(item, offers = []) {
  const requiresCompatibility = requiresCompatiblePrice(item)
  const compatiblePriceReady = hasCompatiblePrice(item)
  if (requiresCompatibility && !compatiblePriceReady) {
    return {
      currentPrice: 0,
      bestOffer: null,
      liveOffers: [],
      hasLiveData: false,
      priceSource: 'identity_pending',
      marketplaceCount: 0,
      identityPending: true,
    }
  }
  const compatibleOffers = (offers || []).filter((offer) => {
    if (!requiresCompatibility) return true
    return isAcceptedCompatibleOffer(offer)
  })
  const liveOffers = compatibleOffers.filter((o) => o.source === 'live' && Number(o.total) > 0)
  const allPriced = compatibleOffers.filter((o) => Number(o.total) > 0)
  const pool = liveOffers.length > 0 ? liveOffers : allPriced

  const sorted = [...pool].sort((a, b) => a.total - b.total)
  const best = item?.best_compatible_offer || sorted[0]
  const currentPrice = Number(best?.total || best?.totalPrice || best?.price || item?.value || 0)
  const hasLiveData = liveOffers.length > 0 || item?.priceMode === 'live'

  return {
    currentPrice,
    bestOffer: best,
    liveOffers,
    hasLiveData,
    priceSource: hasLiveData ? 'live' : item?.priceMode === 'live' ? 'live' : 'estimated',
    marketplaceCount: pool.length,
  }
}

export function weightedAvg90DayPrice(history, hasLiveData) {
  const now = Date.now()
  const cutoff = now - 90 * 24 * 60 * 60 * 1000
  const points = (history || [])
    .filter((h) => new Date(h.at).getTime() >= cutoff)
    .map((h) => ({
      value: Number(h.total || h.price || 0),
      weight: h.source === 'live' ? 2 : 1,
    }))
    .filter((p) => p.value > 0)

  if (points.length === 0) return null

  const totalWeight = points.reduce((s, p) => s + p.weight, 0)
  const weighted = points.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight

  if (hasLiveData && points.some((p) => p.weight === 2)) {
    return weighted
  }
  return weighted
}
