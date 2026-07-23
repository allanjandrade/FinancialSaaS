import type { MarketplaceOffer } from './marketplace-search.ts'
import {
  extractMercadoLivreItemId,
  extractShopeeItemRef,
  productTitleMatches,
} from './product-url.ts'

export type WishlistMonitorItem = {
  id?: string
  name?: string
  brand?: string
  model?: string
  marketplace?: string
  marketplaceItemId?: string
  canonicalUrl?: string
  originalLink?: string
  monitorPrice?: boolean
  targetPrice?: number | null
  lastQuotedPrice?: number | null
  priceHistory?: Array<{ total?: number; price?: number }>
  product_identity?: { match_policy?: string } | null
  price_search_status?: string
  last_match_score?: number
  best_compatible_offer?: MarketplaceOffer & { match_score?: number; compatibility_status?: string } | null
}

type SearchResult = {
  offers?: MarketplaceOffer[]
  sourcesUsed?: string[]
  diagnostics?: string[]
  status?: string
  best_compatible_offer?: MarketplaceOffer & { match_score?: number; compatibility_status?: string }
  accepted_candidates?: MarketplaceOffer[]
  rejected_candidates?: unknown[]
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function isWishlistItemMonitorable(item: WishlistMonitorItem): boolean {
  return Boolean(item?.monitorPrice && item?.id && item?.name)
}

function exactReference(item: WishlistMonitorItem) {
  const source = item.marketplaceItemId || item.canonicalUrl || item.originalLink || ''
  return {
    mercadoLivre: extractMercadoLivreItemId(source),
    shopee: extractShopeeItemRef(source),
    catalog: String(source).match(/\bMLBU\d+\b/i)?.[0]?.toUpperCase() || '',
  }
}

function offerMatchesItem(item: WishlistMonitorItem, offer: MarketplaceOffer): boolean {
  const titleMatches = !item.name || productTitleMatches(item.name, offer.title)
  if (!titleMatches) return false

  const reference = exactReference(item)
  if (reference.mercadoLivre) {
    return extractMercadoLivreItemId(offer.url) === reference.mercadoLivre
  }
  if (reference.shopee) {
    return extractShopeeItemRef(offer.url) === reference.shopee
  }
  if (reference.catalog) {
    return String(offer.url || '').toUpperCase().includes(reference.catalog)
  }
  return true
}

export function buildPriceMonitorResult(
  item: WishlistMonitorItem,
  search: SearchResult,
  checkedAt = new Date().toISOString(),
) {
  const requiresCompatibility = item.product_identity?.match_policy === 'strict'
  if (requiresCompatibility && (
    search.status !== 'found_compatible' ||
    !search.best_compatible_offer ||
    Number(search.best_compatible_offer.match_score || 0) < 0.85
  )) {
    return {
      checkedAt,
      status: search.status || 'pending_quote',
      price_search_status: search.status || 'not_found',
      diagnostics: [...(search.diagnostics || []), 'monitor:no-compatible-offer'],
      sourcesUsed: search.sourcesUsed || [],
      rejected_candidates: search.rejected_candidates || [],
    }
  }

  const sourceOffers = requiresCompatibility
    ? (search.accepted_candidates?.length ? search.accepted_candidates : [search.best_compatible_offer as MarketplaceOffer])
    : (search.offers || [])
  const offers = sourceOffers
    .filter((offer) => positiveNumber(offer.total || offer.price) && (requiresCompatibility || offerMatchesItem(item, offer)))
    .sort((a, b) => Number(a.total || a.price) - Number(b.total || b.price))

  const diagnostics = [...(search.diagnostics || [])]
  if (!offers.length) {
    return {
      checkedAt,
      status: 'pending_quote',
      diagnostics: [...diagnostics, 'monitor:no-exact-offer'],
      sourcesUsed: search.sourcesUsed || [],
    }
  }

  const best = offers[0]
  const total = Number(best.total || best.price)
  const previousPrices = (item.priceHistory || [])
    .map((entry) => positiveNumber(entry.total || entry.price))
    .filter((value): value is number => value !== null)
  const previousLowest = previousPrices.length ? Math.min(...previousPrices) : null
  const previousQuoted = positiveNumber(item.lastQuotedPrice)
  const targetPrice = positiveNumber(item.targetPrice)
  const targetReached = Boolean(
    targetPrice && total <= targetPrice && (!previousQuoted || previousQuoted > targetPrice),
  )
  const newHistoricalLow = Boolean(previousLowest && total < previousLowest - 0.009)
  const alertType = targetReached ? 'target_reached' : newHistoricalLow ? 'new_low' : null
  const alert = alertType
    ? {
        id: crypto.randomUUID(),
        dedupeKey: `${item.id}:${alertType}:${total.toFixed(2)}`,
        itemId: item.id,
        productName: item.name || 'Produto monitorado',
        type: alertType,
        message: targetReached
          ? `${item.name} atingiu o preco-alvo de R$ ${targetPrice?.toFixed(2)}.`
          : `${item.name} atingiu um novo menor preco: R$ ${total.toFixed(2)}.`,
        price: total,
        previousPrice: previousQuoted,
        targetPrice,
        marketplace: best.marketplace,
        url: best.url,
        createdAt: checkedAt,
        status: 'open',
      }
    : null

  return {
    checkedAt,
    status: 'quoted',
    price_search_status: requiresCompatibility ? 'found_compatible' : 'quoted',
    last_match_score: requiresCompatibility ? Number((best as any).match_score || 0) : 0,
    best_compatible_offer: requiresCompatibility ? best : null,
    diagnostics: [...diagnostics, 'monitor:exact-offer'],
    sourcesUsed: search.sourcesUsed || [],
    offers,
    bestOffer: best,
    historyEntry: {
      at: checkedAt,
      price: Number(best.price || total),
      total,
      marketplace: best.marketplace,
      source: 'scheduled',
      url: best.url,
      offers: offers.slice(0, 3).map((offer) => ({
        marketplace: offer.marketplace,
        title: offer.title,
        price: offer.price,
        shipping: offer.shipping,
        total: offer.total,
        url: offer.url,
      })),
    },
    alert,
  }
}
