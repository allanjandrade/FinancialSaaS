import { compareMarketplaces, pickBestOffers } from '@/utils/marketplace-comparator.js'
import {
  normalizeMercadoLivreId,
  normalizeShopeeItemRef,
  productTitleMatches,
} from '@/utils/product-ocr-api.js'
import { chooseBestCompatibleOffer, normalizeProductIdentity } from '@/utils/productIdentity.js'
import { assertProductIdentityMatch } from '@/domain/products/canonicalizeProductUrl.js'

function edgeFunctionHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

function buildQuery(product) {
  return [product?.nome || product?.name, product?.marca || product?.brand, product?.modelo || product?.model]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function lookupPayload(product, query) {
  const canonicalLink = product?.canonicalUrl || product?.canonical_url || product?.originalLink
  return {
    query,
    product_identity: product?.product_identity || product?.productIdentity || null,
    nome: product?.nome || product?.name,
    name: product?.name || product?.nome,
    marca: product?.marca || product?.brand,
    brand: product?.brand || product?.marca,
    modelo: product?.modelo || product?.model,
    model: product?.model || product?.modelo,
    marketplace: product?.marketplace,
    marketplaceItemId: product?.marketplaceItemId || product?.marketplace_item_id,
    source: product?.source,
    source_product_id: product?.source_product_id || product?.sourceProductId,
    id_type: product?.id_type || product?.idType,
    identity_locked: product?.identity_locked || product?.identityLocked,
    identity_status: product?.identity_status || product?.identityStatus,
    originalLink: canonicalLink,
    link: canonicalLink,
    originalUrl: product?.originalUrl || product?.original_url || product?.originalLink,
    canonicalUrl: canonicalLink,
  }
}

function normalizeLookupResult(payload, query, fallbackMode = 'none') {
  const normalizedOffers = (Array.isArray(payload?.offers) ? payload.offers : []).map((offer) => ({
    ...offer,
    total: Number(offer.total ?? offer.totalPrice ?? offer.price ?? 0),
    totalPrice: Number(offer.totalPrice ?? offer.total ?? offer.price ?? 0),
    imageUrl: offer.imageUrl || offer.image || '',
  }))
  const summary = payload?.summary || null
  const acceptedCandidates = Array.isArray(payload?.accepted_candidates) ? payload.accepted_candidates : normalizedOffers
  const bestCompatible = payload?.best_compatible_offer || null
  return {
    offers: acceptedCandidates.map((offer) => ({
      ...offer,
      total: Number(offer.total ?? offer.totalPrice ?? offer.price ?? 0),
      totalPrice: Number(offer.totalPrice ?? offer.total ?? offer.price ?? 0),
      imageUrl: offer.imageUrl || offer.image || '',
    })),
    sourcesUsed: payload?.sourcesUsed || (payload?.source ? [payload.source] : []),
    fetchedAt: payload?.fetchedAt || payload?.updatedAt || new Date().toISOString(),
    query: payload?.query || query,
    mode: payload?.mode || (normalizedOffers.length ? 'live' : summary?.status === 'pending_quote' ? 'pending_quote' : fallbackMode),
    metadata: payload?.metadata || {},
    diagnostics: payload?.diagnostics || [],
    summary,
    product_identity: payload?.product_identity || null,
    best_compatible_offer: bestCompatible,
    accepted_candidates: acceptedCandidates,
    ambiguous_candidates: payload?.ambiguous_candidates || [],
    rejected_candidates: payload?.rejected_candidates || [],
    status: payload?.status || summary?.status || (acceptedCandidates.length ? 'found_compatible' : ''),
    message: summary?.status === 'pending_quote'
      ? 'Cotação pendente. Não foi possível obter preços em tempo real agora.'
      : '',
    warning: payload?.warning || '',
  }
}

function productIdentityFor(product, query = '') {
  const explicit = product?.product_identity || product?.productIdentity
  if (explicit?.match_policy === 'url_exact') return explicit
  if (explicit?.match_policy === 'strict') return explicit
  const identity = normalizeProductIdentity([
    product?.name || product?.nome,
    product?.brand || product?.marca,
    product?.model || product?.modelo,
    query,
  ].filter(Boolean).join(' '))
  return identity.match_policy === 'strict' ? identity : null
}

function enforceCompatibleProductIdentity(product, result, query = '') {
  const identity = productIdentityFor(product, query)
  if (!identity) return result
  if (result?.product_identity && (
    result.best_compatible_offer ||
    Array.isArray(result.accepted_candidates) ||
    Array.isArray(result.rejected_candidates) ||
    Array.isArray(result.ambiguous_candidates)
  )) {
    return {
      ...result,
      product_identity: result.product_identity || identity,
      offers: result.accepted_candidates || result.offers || [],
    }
  }

  const candidates = Array.isArray(result?.offers) ? result.offers : []
  const compatibility = chooseBestCompatibleOffer(candidates, identity)
  return {
    ...result,
    product_identity: identity,
    offers: compatibility.accepted_candidates || [],
    best_compatible_offer: compatibility.best_compatible_offer,
    accepted_candidates: compatibility.accepted_candidates || [],
    ambiguous_candidates: compatibility.ambiguous_candidates || [],
    rejected_candidates: compatibility.rejected_candidates || compatibility.rejected || [],
    status: compatibility.status,
    summary: {
      lowestPrice: compatibility.best_compatible_offer?.total || null,
      averagePrice: compatibility.accepted_candidates?.length
        ? compatibility.accepted_candidates.reduce((sum, offer) => sum + Number(offer.total || offer.price || 0), 0) / compatibility.accepted_candidates.length
        : null,
      highestPrice: compatibility.accepted_candidates?.length
        ? Math.max(...compatibility.accepted_candidates.map((offer) => Number(offer.total || offer.price || 0)))
        : null,
      bestOffer: compatibility.best_compatible_offer,
      best_compatible_offer: compatibility.best_compatible_offer,
      offerCount: compatibility.accepted_candidates?.length || 0,
      status: compatibility.status,
    },
    diagnostics: [
      ...(result?.diagnostics || []),
      `identity:accepted:${compatibility.accepted_candidates?.length || 0}`,
      `identity:rejected:${compatibility.rejected_candidates?.length || compatibility.rejected?.length || 0}`,
      `identity:ambiguous:${compatibility.ambiguous_candidates?.length || 0}`,
    ],
    message: compatibility.best_compatible_offer
      ? ''
      : 'Nenhum preço compatível encontrado ainda.',
    warning: compatibility.best_compatible_offer
      ? result?.warning || ''
      : 'Resultados parecidos foram ignorados por incompatibilidade com a identidade do produto.',
  }
}

export function enforceExactProductIdentity(product, result) {
  const lockedIdentity = (product?.identity_locked || product?.identityLocked || product?.product_identity?.match_policy === 'url_exact')
    ? {
        ...(product?.product_identity || {}),
        source: product?.source || product?.product_identity?.source,
        source_product_id: product?.source_product_id || product?.sourceProductId || product?.product_identity?.source_product_id,
        title: product?.name || product?.nome || product?.product_identity?.title || '',
        match_policy: 'url_exact',
      }
    : null
  if (lockedIdentity?.source && lockedIdentity?.source_product_id) {
    const accepted = []
    const rejected = []
    for (const offer of result?.offers || []) {
      try {
        assertProductIdentityMatch(lockedIdentity, {
          source: offer.source,
          source_product_id: offer.source_product_id,
          title: offer.title,
          name: offer.title,
          url: offer.url || offer.link,
        })
        accepted.push({
          ...offer,
          compatibility_status: 'accepted',
          match_score: 1,
          match_reason: 'Produto exato confirmado pela identidade do link.',
        })
      } catch {
        rejected.push({
          ...offer,
          compatibility_status: 'rejected',
          match_score: 0,
          match_reason: 'Resultado descartado por divergencia da identidade do link.',
        })
      }
    }
    const best = accepted.length
      ? [...accepted].sort((a, b) => Number(a.total || a.totalPrice || a.price || 0) - Number(b.total || b.totalPrice || b.price || 0))[0]
      : null
    return {
      ...result,
      product_identity: lockedIdentity,
      offers: accepted,
      accepted_candidates: accepted,
      ambiguous_candidates: [],
      rejected_candidates: [...(result?.rejected_candidates || []), ...rejected],
      best_compatible_offer: best,
      status: best ? 'found_exact' : 'not_found',
      summary: {
        ...(result?.summary || {}),
        bestOffer: best,
        best_compatible_offer: best,
        offerCount: accepted.length,
        status: best ? 'found_exact' : 'not_found',
      },
      diagnostics: [
        ...(result?.diagnostics || []),
        'identity:url-locked',
        `identity:accepted:${accepted.length}`,
        `identity:rejected:${rejected.length}`,
      ],
      warning: best ? result?.warning || '' : 'Resultado descartado por divergência de identidade do produto.',
      message: best ? result?.message || '' : 'Cotação pendente. As fontes retornaram produtos diferentes do link informado.',
    }
  }

  const expectedItemId = normalizeMercadoLivreId(
    product?.marketplaceItemId || product?.marketplace_item_id || product?.canonicalUrl || product?.originalLink,
  )
  const expectedShopeeRef = normalizeShopeeItemRef(
    product?.marketplaceItemId || product?.marketplace_item_id || product?.canonicalUrl || product?.originalLink,
  )
  const expectedCatalogId = String(product?.marketplaceItemId || '').match(/\bMLBU\d+\b/i)?.[0]?.toUpperCase() || ''
  if (!expectedItemId && !expectedShopeeRef && !expectedCatalogId) return result

  const expectedTitle = product?.nome || product?.name || ''
  const offers = (result?.offers || []).filter((offer) => {
    const offerUrl = offer.url || offer.link || ''
    const idMatches = expectedItemId
      ? normalizeMercadoLivreId(offerUrl) === expectedItemId
      : expectedShopeeRef
        ? normalizeShopeeItemRef(offerUrl) === expectedShopeeRef
        : String(offerUrl).toUpperCase().includes(expectedCatalogId)
    return idMatches && (!expectedTitle || productTitleMatches(expectedTitle, offer.title))
  })
  const metadata = result?.metadata || {}
  const metadataIdMatches = expectedItemId
    ? normalizeMercadoLivreId(metadata.marketplaceItemId) === expectedItemId
    : expectedShopeeRef
      ? normalizeShopeeItemRef(metadata.marketplaceItemId) === expectedShopeeRef
      : String(metadata.marketplaceItemId || '').toUpperCase() === expectedCatalogId
  const metadataIsExact = metadataIdMatches && (
    !expectedTitle || !metadata.name || productTitleMatches(expectedTitle, metadata.name)
  )
  const exactReference = expectedItemId || expectedShopeeRef || expectedCatalogId
  const rejectedCount = (result?.offers || []).length - offers.length + (metadataIsExact ? 0 : Number(Boolean(metadata.name)))

  if (offers.length) {
    return {
      ...result,
      offers,
      metadata: metadataIsExact ? metadata : { marketplaceItemId: exactReference },
      diagnostics: [
        ...(result?.diagnostics || []),
        ...(rejectedCount ? [`identity:rejected:${rejectedCount}`] : []),
        'identity:exact',
      ],
    }
  }

  return {
    ...result,
    offers: [],
    metadata: { marketplaceItemId: exactReference },
    mode: 'pending_quote',
    status: 'pending_quote',
    summary: {
      lowestPrice: null,
      averagePrice: null,
      highestPrice: null,
      bestOffer: null,
      offerCount: 0,
      status: 'pending_quote',
    },
    message: 'Cotação pendente. As fontes retornaram produtos diferentes do anúncio informado.',
    warning: 'Resultado descartado por divergência de identidade do produto.',
    diagnostics: [
      ...(result?.diagnostics || []),
      `identity:rejected:${Math.max(1, rejectedCount)}`,
      'identity:exact-unavailable',
    ],
  }
}

async function fetchSameOriginLookup(product, query) {
  const response = await fetch('/api/product-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lookupPayload(product, query)),
  })
  if (!response.ok) throw new Error(`Product lookup HTTP ${response.status}`)
  return normalizeLookupResult(await response.json(), query)
}

async function fetchSupabaseLookup(product, query) {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Faca login para buscar precos ao vivo')

  const priceSearchUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/price-search`
  const priceSearchResponse = await fetch(priceSearchUrl, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify(lookupPayload(product, query)),
  })

  const priceSearchPayload = await priceSearchResponse.json().catch(() => ({}))
  let priceSearchResult = null
  if (priceSearchResponse.ok) {
    priceSearchResult = enforceExactProductIdentity(
      product,
      enforceCompatibleProductIdentity(product, normalizeLookupResult(priceSearchPayload, query), query),
    )
    if (priceSearchResult.offers.length) return priceSearchResult
  }

  const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/marketplace-search`
  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify(lookupPayload(product, query)),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = priceSearchPayload?.details || priceSearchPayload?.error || payload?.details || payload?.error
    throw new Error(detail || `Supabase lookup HTTP ${response.status}`)
  }
  const marketplaceResult = enforceExactProductIdentity(
    product,
    enforceCompatibleProductIdentity(product, normalizeLookupResult(payload, query), query),
  )
  return marketplaceResult.offers.length ? marketplaceResult : priceSearchResult || marketplaceResult
}

export async function fetchLiveMarketplaceOffers(product) {
  const query = buildQuery(product) || product?.marketplaceItemId || product?.marketplace_item_id
  if (!query) throw new Error('Informe o nome ou identificador do produto para buscar precos')

  let lookupResult = null

  try {
    lookupResult = enforceExactProductIdentity(product, await fetchSupabaseLookup(product, query))
  } catch (error) {
    console.warn('SUPABASE_PRICE_SEARCH_FALLBACK', error)
  }

  if (!lookupResult?.offers?.length) {
    try {
      const sameOriginResult = enforceExactProductIdentity(
        product,
        enforceCompatibleProductIdentity(product, await fetchSameOriginLookup(product, query), query),
      )
      if (sameOriginResult.offers.length || !lookupResult) lookupResult = sameOriginResult
    } catch (error) {
      console.warn('PRODUCT_LOOKUP_API_FALLBACK', error)
    }
  }

  if (lookupResult?.offers?.length) {
    return { ...lookupResult, mode: 'live' }
  }

  if (productIdentityFor(product, query)) {
    return {
      ...(lookupResult || {}),
      offers: [],
      sourcesUsed: lookupResult?.sourcesUsed || [],
      fetchedAt: lookupResult?.fetchedAt || new Date().toISOString(),
      query: lookupResult?.query || query,
      mode: lookupResult?.mode || 'none',
      metadata: lookupResult?.metadata || {},
      diagnostics: lookupResult?.diagnostics || [],
      product_identity: lookupResult?.product_identity || productIdentityFor(product, query),
      best_compatible_offer: null,
      accepted_candidates: [],
      ambiguous_candidates: lookupResult?.ambiguous_candidates || [],
      rejected_candidates: lookupResult?.rejected_candidates || [],
      summary: lookupResult?.summary || {
        lowestPrice: null,
        averagePrice: null,
        highestPrice: null,
        bestOffer: null,
        best_compatible_offer: null,
        offerCount: 0,
        status: lookupResult?.status || 'not_found',
      },
      status: lookupResult?.status || 'not_found',
      message: lookupResult?.message || 'Nenhum preço compatível encontrado ainda.',
      warning: lookupResult?.warning || 'Não use preço de produto incompatível para esta compra.',
    }
  }

  const basePrice = Number(product?.valor || product?.value || lookupResult?.metadata?.value || 0)
  if (basePrice <= 0) {
    return {
      ...(lookupResult || {}),
      offers: [],
      sourcesUsed: lookupResult?.sourcesUsed || [],
      fetchedAt: lookupResult?.fetchedAt || new Date().toISOString(),
      query: lookupResult?.query || query,
      mode: lookupResult?.mode || 'none',
      metadata: lookupResult?.metadata || {},
      diagnostics: lookupResult?.diagnostics || [],
      summary: lookupResult?.summary || null,
      status: lookupResult?.status || 'pending_quote',
      message: lookupResult?.message || 'Cotação pendente. Não foi possível obter preços em tempo real agora.',
      warning: lookupResult?.warning || 'Preço não disponível nas fontes automáticas.',
    }
  }

  return {
    ...(lookupResult || {}),
    offers: compareMarketplaces({ ...product, value: basePrice }).map((offer) => ({
      ...offer,
      source: 'estimated',
    })),
    sourcesUsed: lookupResult?.sourcesUsed || [],
    fetchedAt: lookupResult?.fetchedAt || new Date().toISOString(),
    query: lookupResult?.query || query,
    mode: 'estimated',
    metadata: lookupResult?.metadata || {},
    diagnostics: lookupResult?.diagnostics || [],
    summary: lookupResult?.summary || null,
    warning: lookupResult?.warning || 'Preços estimados por falta de fonte ao vivo.',
  }
}

export async function refreshWishlistPrices(product) {
  const result = await fetchLiveMarketplaceOffers(product)
  const best = pickBestOffers(result.offers)
  return { ...result, best }
}
