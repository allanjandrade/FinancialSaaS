import {
  hasCompatiblePrice,
  isAcceptedCompatibleOffer,
  requiresCompatiblePrice,
} from '@/utils/productIdentity.js'

function positiveNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function offerTotal(offer) {
  const total = positiveNumber(offer?.total ?? offer?.totalPrice)
  if (total) return total
  const price = positiveNumber(offer?.price)
  if (!price) return null
  const shipping = positiveNumber(offer?.shipping ?? offer?.shipping_price ?? offer?.shippingPrice) || 0
  return price + shipping
}

function acceptedSourceOffers(item) {
  return [
    item?.best_compatible_offer,
    item?.bestCompatibleOffer,
    ...(Array.isArray(item?.accepted_candidates) ? item.accepted_candidates : []),
    ...(Array.isArray(item?.acceptedCandidates) ? item.acceptedCandidates : []),
    ...(Array.isArray(item?.marketplaceOffers) ? item.marketplaceOffers : []),
  ].filter(Boolean)
}

function candidateOffers(item) {
  return [
    ...acceptedSourceOffers(item),
    ...(Array.isArray(item?.ambiguous_candidates) ? item.ambiguous_candidates : []),
    ...(Array.isArray(item?.ambiguousCandidates) ? item.ambiguousCandidates : []),
    ...(Array.isArray(item?.rejected_candidates) ? item.rejected_candidates : []),
    ...(Array.isArray(item?.rejectedCandidates) ? item.rejectedCandidates : []),
    ...(Array.isArray(item?.last_rejected_candidates) ? item.last_rejected_candidates : []),
    ...(Array.isArray(item?.lastRejectedCandidates) ? item.lastRejectedCandidates : []),
  ].filter(Boolean)
}

function explicitCompatibilityStatus(value) {
  return String(value?.compatibility_status || value?.compatibilityStatus || '').toLowerCase()
}

function hasBlockedCompatibilityStatus(value) {
  const status = explicitCompatibilityStatus(value)
  return status === 'rejected' || status === 'ambiguous'
}

function isPresentationAcceptedOffer(offer, item) {
  if (hasBlockedCompatibilityStatus(offer)) return false
  if (!requiresCompatiblePrice(item)) return true
  return isAcceptedCompatibleOffer(offer)
}

function hasExplicitBlockedCandidate(item) {
  return candidateOffers(item).some(hasBlockedCompatibilityStatus)
}

function acceptedOffers(item) {
  return acceptedSourceOffers(item)
    .filter((offer) => isPresentationAcceptedOffer(offer, item))
    .filter((offer) => offerTotal(offer))
}

export function bestComparableOffer(item) {
  const explicitBest = item?.best_compatible_offer || item?.bestCompatibleOffer || null
  if (explicitBest && isPresentationAcceptedOffer(explicitBest, item) && offerTotal(explicitBest)) {
    return explicitBest
  }

  const offers = acceptedOffers(item)
  if (!offers.length) return null
  return [...offers].sort((a, b) => offerTotal(a) - offerTotal(b))[0]
}

export function totalComparablePrice(item) {
  const best = bestComparableOffer(item)
  if (best) return offerTotal(best)
  const compatiblePriceRequired = requiresCompatiblePrice(item)
  if (compatiblePriceRequired && hasExplicitBlockedCandidate(item)) return null
  if (compatiblePriceRequired && !hasCompatiblePrice(item)) return null
  return positiveNumber(item?.lastQuotedPrice || item?.value)
}

export function canonicalProductCode(item) {
  const source = String(item?.source || item?.marketplace || '').trim()
  const id = String(item?.source_product_id || item?.sourceProductId || item?.marketplaceItemId || '').trim()
  if (source && id) return `${source} · ${id}`
  if (id) return id
  if (source) return source
  return 'Identidade pendente'
}

export function priceHistorySummary(item) {
  const compatiblePriceRequired = requiresCompatiblePrice(item)
  const rows = (Array.isArray(item?.priceHistory) ? item.priceHistory : [])
    .filter((entry) => {
      const hasCompatibilityStatus = Boolean(explicitCompatibilityStatus(entry) || entry?.match_score || entry?.matchScore || entry?.match)
      if (compatiblePriceRequired) return isPresentationAcceptedOffer(entry, item)
      return !hasCompatibilityStatus || isPresentationAcceptedOffer(entry, item)
    })
    .map((entry) => offerTotal(entry))
    .filter(Boolean)

  if (!rows.length) {
    return { lowest: null, average: null, highest: null, count: 0 }
  }

  const total = rows.reduce((sum, value) => sum + value, 0)
  return {
    lowest: Math.min(...rows),
    average: Number((total / rows.length).toFixed(2)),
    highest: Math.max(...rows),
    count: rows.length,
  }
}

export function offerShippingText(offer) {
  const rawShipping = offer?.shipping ?? offer?.shipping_price ?? offer?.shippingPrice
  const shipping = positiveNumber(rawShipping)
  if (shipping) return shipping
  if (offer && Number(rawShipping) === 0) return 0
  return null
}

export function productSearchStatus(item) {
  const status = item?.price_search_status || item?.priceSearchStatus || item?.priceStatus || ''
  const identityStatus = item?.identity_status || item?.identityStatus || ''
  const lockedNeedsReview = (item?.identity_locked || item?.identityLocked) && identityStatus === 'needs_review'
  const comparableBest = bestComparableOffer(item)
  const blockedCompatibleSuccess = requiresCompatiblePrice(item) && !comparableBest && hasExplicitBlockedCandidate(item)

  if (lockedNeedsReview) {
    return {
      label: 'Precisa revisar',
      tone: 'danger',
      description: 'Nao conseguimos confirmar que este link corresponde ao produto correto.',
    }
  }

  if (status === 'error') {
    return {
      label: 'Erro ao atualizar',
      tone: 'danger',
      description: 'Nao foi possivel atualizar os precos agora.',
    }
  }

  if (!blockedCompatibleSuccess && hasCompatiblePrice(item)) {
    return {
      label: 'Produto confirmado',
      tone: 'success',
      description: 'Identidade confirmada e oferta compativel encontrada.',
    }
  }

  if (status === 'found_ambiguous') {
    return {
      label: 'Precisa revisar',
      tone: 'warning',
      description: 'Encontramos produtos parecidos, mas nenhum foi confirmado.',
    }
  }

  if (status === 'not_found') {
    return {
      label: 'Nenhuma oferta compativel',
      tone: 'warning',
      description: 'Ainda nao encontramos uma oferta compativel para este produto.',
    }
  }

  if (item?.monitorPrice && (status === 'quoted' || item?.priceStatus === 'quoted')) {
    return {
      label: 'Monitorando',
      tone: 'info',
      description: 'Produto salvo e monitorado para novas oportunidades.',
    }
  }

  return {
    label: 'Buscando preco',
    tone: 'pending',
    description: 'Estamos buscando ofertas compativeis para este produto.',
  }
}
