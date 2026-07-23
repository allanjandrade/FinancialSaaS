import { firstSafeExternalUrl, normalizeExternalUrl } from '@/utils/safe-url.js'

export { normalizeExternalUrl }

export function purchaseOfferUrl(offer) {
  return firstSafeExternalUrl(offer?.url, offer?.link, offer?.productUrl, offer?.product_url)
}

function firstOfferUrl(offers) {
  for (const offer of Array.isArray(offers) ? offers : []) {
    const directUrl = purchaseOfferUrl(offer)
    if (directUrl) return directUrl

    const nestedUrl = firstOfferUrl(offer?.offers)
    if (nestedUrl) return nestedUrl
  }
  return ''
}

export function directPurchaseUrl(item) {
  return [
    purchaseOfferUrl(item?.best_compatible_offer),
    purchaseOfferUrl(item?.bestCompatibleOffer),
    firstOfferUrl(item?.accepted_candidates),
    firstOfferUrl(item?.acceptedCandidates),
    firstOfferUrl(item?.marketplaceOffers),
    purchaseOfferUrl(item),
    normalizeExternalUrl(item?.originalUrl),
    normalizeExternalUrl(item?.originalLink),
    firstOfferUrl(item?.priceHistory),
    normalizeExternalUrl(item?.canonicalUrl),
  ].find(Boolean) || ''
}

export function shoppingSearchUrl(item) {
  const query = String(item?.name || item?.description || '').replace(/\s+/g, ' ').trim()
  return query ? `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}` : ''
}

export function purchaseLinkForItem(item) {
  const direct = directPurchaseUrl(item)
  if (direct) return { href: direct, label: 'Comprar', direct: true }

  const fallback = shoppingSearchUrl(item)
  return {
    href: fallback,
    label: fallback ? 'Buscar oferta' : '',
    direct: false,
  }
}
