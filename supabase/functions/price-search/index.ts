import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'
import {
  extractMercadoLivreItemId,
  extractProductHtmlMetadata,
  extractShopeeItemRef,
  matchesMercadoLivreItem,
  productTitleMatches,
  sanitizeProductUrl,
  type ProductHtmlMetadata,
} from '../_shared/product-url.ts'
import {
  buildProductSearchQuery,
  chooseBestCompatibleOffer,
  isIdentityCompleteForProvider,
  normalizeProductIdentity,
  type ProductIdentity,
} from '../_shared/product-identity/index.ts'
import {
  configuredPriceProvider,
  searchPriceProvider,
  type PriceCandidate,
  type PriceProviderName,
  type PriceProviderResult,
} from '../_shared/price-providers/index.ts'
import {
  assertProductIdentityMatch,
  productCacheKey,
} from '../_shared/products/canonicalizeProductUrl.ts'
import { logSystemEvent } from '../_shared/observability/logger.js'

type PriceOffer = {
  marketplace: string
  title: string
  price: number
  shipping: number | null
  totalPrice: number
  url: string
  image: string
  seller: string
  source: string
  confidence: number
}

type SearchResult = {
  offers: PriceOffer[]
  diagnostics: string[]
  metadata?: ProductHtmlMetadata & { marketplaceItemId?: string }
}

type CacheRecord = {
  provider: string
  normalized_query: string
  product_identity: ProductIdentity
  accepted_candidates: unknown[]
  ambiguous_candidates: unknown[]
  rejected_candidates: unknown[]
  best_compatible_offer: unknown | null
  expires_at: string
}

let cachedSerpApiKey: string | null | undefined
let cachedScraperApiKey: string | null | undefined
let cachedMercadoLivreToken: string | null | undefined

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

function parsePrice(value: string | number | undefined | null): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }
  if (!value) return null

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeSecretValue(value: string | null | undefined, keyName: string): string | null {
  if (!value) return null
  let normalized = value.trim()
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  const prefix = `${keyName}=`
  if (normalized.startsWith(prefix)) {
    normalized = normalized.slice(prefix.length).trim()
  }

  return normalized || null
}

async function getVaultSecret(secretName: string): Promise<{ value: string | null; diagnostics: string[] }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return { value: null, diagnostics: ['vault:service-role-unavailable'] }
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_vault_secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ secret_name: secretName }),
    })

    if (!response.ok) {
      console.warn('VAULT_SECRET_RPC_ERROR', response.status)
      return { value: null, diagnostics: [`vault:rpc-error:${response.status}`] }
    }

    const data = await response.json().catch(() => null)
    const value = typeof data === 'string' ? data : null
    const normalizedValue = normalizeSecretValue(value, secretName)
    return normalizedValue
      ? { value: normalizedValue, diagnostics: ['vault:secret-loaded'] }
      : { value: null, diagnostics: ['vault:secret-empty'] }
  } catch (_error) {
    return { value: null, diagnostics: ['vault:rpc-unavailable'] }
  }
}

async function getSerpApiKey(): Promise<{ value: string | null; diagnostics: string[] }> {
  if (cachedSerpApiKey !== undefined) {
    return {
      value: cachedSerpApiKey,
      diagnostics: [cachedSerpApiKey ? 'serpapi:key-cache' : 'serpapi:key-cache-empty'],
    }
  }

  const envKey = normalizeSecretValue(Deno.env.get('SERPAPI_KEY'), 'SERPAPI_KEY')
  if (envKey) {
    cachedSerpApiKey = envKey
    return { value: envKey, diagnostics: ['serpapi:key-env'] }
  }

  const vaultResult = await getVaultSecret('SERPAPI_KEY')
  cachedSerpApiKey = vaultResult.value
  return { value: vaultResult.value, diagnostics: vaultResult.diagnostics }
}

async function getOptionalApiKey(
  keyName: string,
  cacheValue: string | null | undefined,
): Promise<{ value: string | null; diagnostics: string[] }> {
  if (cacheValue !== undefined) {
    return {
      value: cacheValue,
      diagnostics: [`${keyName.toLowerCase()}:key-cache${cacheValue ? '' : '-empty'}`],
    }
  }

  const envKey = normalizeSecretValue(Deno.env.get(keyName), keyName)
  if (envKey) {
    return { value: envKey, diagnostics: [`${keyName.toLowerCase()}:key-env`] }
  }

  const vaultResult = await getVaultSecret(keyName)
  return {
    value: vaultResult.value,
    diagnostics: vaultResult.diagnostics.map((item) => item.replace('vault:', `${keyName.toLowerCase()}:vault:`)),
  }
}

async function getScraperApiKey(): Promise<{ value: string | null; diagnostics: string[] }> {
  const result = await getOptionalApiKey('SCRAPERAPI_KEY', cachedScraperApiKey)
  cachedScraperApiKey = result.value
  return result
}

async function getMercadoLivreToken(): Promise<{ value: string | null; diagnostics: string[] }> {
  const result = await getOptionalApiKey('MERCADOLIBRE_ACCESS_TOKEN', cachedMercadoLivreToken)
  cachedMercadoLivreToken = result.value
  return result
}

async function mercadoLivreHeaders(): Promise<{ headers: Record<string, string>; diagnostics: string[] }> {
  const tokenResult = await getMercadoLivreToken()
  return {
    headers: tokenResult.value
      ? { ...FETCH_HEADERS, Authorization: `Bearer ${tokenResult.value}` }
      : FETCH_HEADERS,
    diagnostics: [tokenResult.value ? 'ml:token-env' : 'ml:token-missing'],
  }
}

function offerFromParts(parts: {
  marketplace: string
  title?: string
  price: number | null
  shipping?: number | null
  url?: string
  image?: string
  seller?: string
  source: string
  confidence?: number
}): PriceOffer | null {
  if (!parts.price || parts.price <= 0) return null
  const shipping = Number.isFinite(Number(parts.shipping)) && Number(parts.shipping) > 0
    ? Number(parts.shipping)
    : null
  const totalPrice = parts.price + (shipping || 0)
  return {
    marketplace: parts.marketplace,
    title: parts.title || '',
    price: parts.price,
    shipping,
    totalPrice,
    url: parts.url || '',
    image: parts.image || '',
    seller: parts.seller || parts.marketplace,
    source: parts.source,
    confidence: parts.confidence || 80,
  }
}

async function searchMercadoLivreItem(
  itemId: string,
  originalLink?: string,
  expectedTitle?: string,
): Promise<SearchResult> {
  const normalizedId = extractMercadoLivreItemId(itemId)
  if (!normalizedId) return { offers: [], diagnostics: ['ml:item-id-missing'] }
  const auth = await mercadoLivreHeaders()

  const response = await fetch(`https://api.mercadolibre.com/items/${normalizedId}`, {
    headers: auth.headers,
    signal: AbortSignal.timeout(12000),
  })

  if (!response.ok) {
    const htmlFallback = originalLink
      ? await searchDirectProductHtml(originalLink, normalizedId, expectedTitle)
      : null
    return {
      offers: htmlFallback?.offers || [],
      diagnostics: [
        ...auth.diagnostics,
        response.status === 403 ? 'ml:forbidden:403' : `ml:item-api-error:${response.status}`,
        ...(htmlFallback?.diagnostics || (originalLink ? ['ml:item-html-empty'] : [])),
      ],
      metadata: htmlFallback?.metadata,
    }
  }

  const item = await response.json()
  if (!matchesMercadoLivreItem(normalizedId, item?.id, item?.permalink)) {
    return {
      offers: [],
      diagnostics: [...auth.diagnostics, 'ml:item-api-id-mismatch'],
      metadata: { marketplaceItemId: normalizedId.replace(/^MLB/, 'MLB-') },
    }
  }
  if (expectedTitle && !productTitleMatches(expectedTitle, item?.title)) {
    return {
      offers: [],
      diagnostics: [...auth.diagnostics, 'ml:item-api-title-mismatch'],
      metadata: { marketplaceItemId: normalizedId.replace(/^MLB/, 'MLB-') },
    }
  }
  const offer = offerFromParts({
    marketplace: 'Mercado Livre',
    title: item?.title || '',
    price: parsePrice(item?.price),
    shipping: item?.shipping?.free_shipping ? 0 : parsePrice(item?.shipping?.cost),
    url: item?.permalink || originalLink || '',
    image: item?.thumbnail || '',
    seller: 'Mercado Livre',
    source: 'mercadolivre_item_api',
    confidence: 95,
  })

  if (!offer && originalLink) {
    const htmlFallback = await searchDirectProductHtml(originalLink, normalizedId, expectedTitle)
    if (htmlFallback.offers.length) {
      return {
        ...htmlFallback,
        diagnostics: [...auth.diagnostics, 'ml:item-api-no-price', ...htmlFallback.diagnostics],
      }
    }
  }

  return {
    offers: offer ? [offer] : [],
    diagnostics: [...auth.diagnostics, offer ? 'ml:item-api' : 'ml:item-api-no-price'],
    metadata: {
      name: item?.title || undefined,
      value: parsePrice(item?.price) || undefined,
      imageUrl: item?.pictures?.[0]?.secure_url || item?.thumbnail || undefined,
      brand: item?.attributes?.find((attribute: any) => attribute?.id === 'BRAND')?.value_name || undefined,
      model: item?.attributes?.find((attribute: any) => attribute?.id === 'MODEL')?.value_name || undefined,
      attributes: Object.fromEntries(
        (Array.isArray(item?.attributes) ? item.attributes : [])
          .filter((attribute: any) => attribute?.name && attribute?.value_name != null)
          .map((attribute: any) => [String(attribute.name), String(attribute.value_name)]),
      ),
      marketplaceItemId: normalizedId.replace(/^MLB/, 'MLB-'),
    },
  }
}

async function searchDirectProductHtml(
  originalLink: string,
  expectedItemId?: string,
  expectedTitle?: string,
): Promise<SearchResult> {
  const canonicalLink = sanitizeProductUrl(originalLink)
  if (!canonicalLink) return { offers: [], diagnostics: ['html:no-link'] }

  try {
    const response = await fetch(canonicalLink, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return { offers: [], diagnostics: [`html:error:${response.status}`] }

    const html = await response.text()
    const metadata = extractProductHtmlMetadata(html)
    if (expectedItemId && !matchesMercadoLivreItem(expectedItemId, response.url, metadata.marketplaceItemId)) {
      return {
        offers: [],
        diagnostics: ['html:item-id-mismatch'],
        metadata: { marketplaceItemId: expectedItemId.replace(/^MLB/, 'MLB-') },
      }
    }
    if (expectedTitle && !productTitleMatches(expectedTitle, metadata.name)) {
      return {
        offers: [],
        diagnostics: ['html:title-mismatch'],
        metadata: expectedItemId
          ? { marketplaceItemId: expectedItemId.replace(/^MLB/, 'MLB-') }
          : {},
      }
    }
    const price = metadata.value || parsePrice(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])
    const offer = offerFromParts({
      marketplace: canonicalLink.includes('mercadolivre') ? 'Mercado Livre' : 'Marketplace',
      title: metadata.name,
      price,
      shipping: null,
      url: canonicalLink,
      image: metadata.imageUrl,
      source: 'product_html',
      confidence: 78,
    })

    return {
      offers: offer ? [offer] : [],
      diagnostics: [offer ? 'html:open-graph' : 'html:no-price'],
      metadata,
    }
  } catch {
    return { offers: [], diagnostics: ['html:unavailable'] }
  }
}

async function searchMercadoLivreQuery(query: string): Promise<SearchResult> {
  const auth = await mercadoLivreHeaders()
  const response = await fetch(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=8`,
    { headers: auth.headers, signal: AbortSignal.timeout(12000) },
  )

  if (!response.ok) {
    return {
      offers: [],
      diagnostics: [
        ...auth.diagnostics,
        response.status === 403 ? 'ml:search-forbidden:403' : `ml:search-api-error:${response.status}`,
      ],
    }
  }

  const data = await response.json()
  const results = Array.isArray(data?.results) ? data.results : []
  const offers = results
    .map((item: any) =>
      offerFromParts({
        marketplace: 'Mercado Livre',
        title: item?.title || '',
        price: parsePrice(item?.price),
        shipping: item?.shipping?.free_shipping ? 0 : parsePrice(item?.shipping?.cost),
        url: item?.permalink || '',
        image: item?.thumbnail || '',
        seller: 'Mercado Livre',
        source: 'mercadolivre_search_api',
        confidence: 75,
      }),
    )
    .filter(Boolean) as PriceOffer[]

  return {
    offers,
    diagnostics: [
      ...auth.diagnostics,
      offers.length ? 'ml:search-api' : 'ml:search-api-no-price',
      `ml:raw-results:${results.length}`,
    ],
  }
}

async function searchScraperApi(
  originalLink: string,
  expectedItemId?: string,
  expectedTitle?: string,
): Promise<SearchResult> {
  const canonicalLink = sanitizeProductUrl(originalLink)
  if (!canonicalLink) return { offers: [], diagnostics: ['scraperapi:no-link'] }

  const keyResult = await getScraperApiKey()
  if (!keyResult.value) {
    return { offers: [], diagnostics: [...keyResult.diagnostics, 'scraperapi:not-configured'] }
  }

  const response = await fetch(
    `https://api.scraperapi.com?api_key=${encodeURIComponent(keyResult.value)}&render=true&url=${encodeURIComponent(canonicalLink)}`,
    { signal: AbortSignal.timeout(20000) },
  )

  if (!response.ok) {
    return { offers: [], diagnostics: [...keyResult.diagnostics, `scraperapi:error:${response.status}`] }
  }

  const html = await response.text()
  const metadata = extractProductHtmlMetadata(html)
  if (expectedItemId && (
    !metadata.marketplaceItemId ||
    !matchesMercadoLivreItem(expectedItemId, metadata.marketplaceItemId)
  )) {
    return {
      offers: [],
      diagnostics: [...keyResult.diagnostics, 'scraperapi:item-id-mismatch'],
      metadata: { marketplaceItemId: expectedItemId.replace(/^MLB/, 'MLB-') },
    }
  }
  if (expectedTitle && !productTitleMatches(expectedTitle, metadata.name)) {
    return {
      offers: [],
      diagnostics: [...keyResult.diagnostics, 'scraperapi:title-mismatch'],
      metadata: expectedItemId
        ? { marketplaceItemId: expectedItemId.replace(/^MLB/, 'MLB-') }
        : {},
    }
  }
  const price = metadata.value || parsePrice(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])

  const marketplace = canonicalLink.includes('mercadolivre')
    ? 'Mercado Livre'
    : canonicalLink.includes('shopee')
      ? 'Shopee'
      : 'Marketplace'
  const offer = offerFromParts({
    marketplace,
    title: metadata.name,
    price,
    shipping: null,
    url: canonicalLink,
    image: metadata.imageUrl,
    source: 'scraperapi_html',
    confidence: 70,
  })

  return {
    offers: offer ? [offer] : [],
    diagnostics: [...keyResult.diagnostics, offer ? 'scraperapi:html' : 'scraperapi:no-price'],
    metadata,
  }
}

function ocrFallbackOffer(body: any): SearchResult {
  const price = parsePrice(body.value ?? body.valor ?? body.price)
  if (!price) return { offers: [], diagnostics: ['ocr-price:empty'] }

  const offer = offerFromParts({
    marketplace: body.marketplace || 'OCR',
    title: body.name || body.nome || body.query || '',
    price,
    shipping: null,
    url: body.originalLink || body.link || '',
    image: body.imageUrl || '',
    seller: body.marketplace || 'OCR',
    source: 'ocr_identified_price',
    confidence: 60,
  })

  return {
    offers: offer ? [offer] : [],
    diagnostics: [offer ? 'ocr-price:fallback' : 'ocr-price:invalid'],
  }
}

async function searchSerpApi(
  query: string,
  expectedItemId?: string,
  expectedTitle?: string,
): Promise<SearchResult> {
  const keyResult = await getSerpApiKey()
  const apiKey = keyResult.value

  if (!apiKey) {
    console.warn('SERPAPI_KEY nao configurada')
    return { offers: [], diagnostics: [...keyResult.diagnostics, 'serpapi:not-configured'] }
  }

  const url =
    'https://serpapi.com/search.json?engine=google_shopping' +
    `&q=${encodeURIComponent(query)}` +
    '&gl=br' +
    '&hl=pt-br' +
    `&api_key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url)

  if (!response.ok) {
    console.warn('SERPAPI_ERROR', response.status)
    return {
      offers: [],
      diagnostics: [
        ...keyResult.diagnostics,
        response.status === 401 ? 'serpapi:credential-invalid:401' : `serpapi:error:${response.status}`,
      ],
    }
  }

  const data = await response.json()

  const rawResults = data.shopping_results || []
  const allOffers = rawResults
    .map((item: any) => {
      const price = parsePrice(item.price ?? item.extracted_price)
      if (!price) return null

      const marketplace = item.source || 'Google Shopping'
      return {
        marketplace,
        title: item.title || '',
        price,
        shipping: null,
        totalPrice: price,
        url: item.link || item.product_link || '',
        image: item.thumbnail || '',
        seller: marketplace,
        source: 'serpapi_google_shopping',
        confidence: 80,
      }
    })
    .filter(Boolean) as PriceOffer[]
  const offers = expectedItemId
    ? allOffers.filter((offer) => matchesMercadoLivreItem(expectedItemId, offer.url) &&
      extractMercadoLivreItemId(offer.url) === extractMercadoLivreItemId(expectedItemId) &&
      (!expectedTitle || productTitleMatches(expectedTitle, offer.title)))
    : allOffers
  const exactOffer = offers[0]

  return {
    offers,
    metadata: expectedItemId && exactOffer
      ? {
          name: exactOffer.title || undefined,
          value: exactOffer.price,
          imageUrl: exactOffer.image || undefined,
          marketplaceItemId: extractMercadoLivreItemId(expectedItemId)?.replace(/^MLB/, 'MLB-'),
        }
      : undefined,
    diagnostics: [
      ...keyResult.diagnostics,
      offers.length ? 'serpapi:google-shopping' : 'serpapi:no-priced-results',
      ...(expectedItemId ? [`serpapi:exact-matches:${offers.length}`] : []),
      `serpapi:raw-results:${rawResults.length}`,
    ],
  }
}

function summarizeOffers(offers: PriceOffer[]) {
  if (!offers.length) {
    return {
      lowestPrice: null,
      averagePrice: null,
      highestPrice: null,
      bestOffer: null,
      offerCount: 0,
      status: 'pending_quote',
    }
  }

  const prices = offers.map((offer) => offer.totalPrice || offer.price)
  const lowestPrice = Math.min(...prices)
  const highestPrice = Math.max(...prices)
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
  const bestOffer = [...offers].sort(
    (a, b) => (a.totalPrice || a.price) - (b.totalPrice || b.price),
  )[0]

  return {
    lowestPrice,
    averagePrice,
    highestPrice,
    bestOffer,
    offerCount: offers.length,
    status: 'quoted',
  }
}

function identityFromBody(body: any, query: string): ProductIdentity | null {
  if (body?.product_identity?.match_policy === 'strict') return body.product_identity as ProductIdentity
  const identity = normalizeProductIdentity([
    query,
    body?.name || body?.nome,
    body?.brand || body?.marca,
    body?.model || body?.modelo,
  ].filter(Boolean).join(' '))
  return identity.match_policy === 'strict' ? identity : null
}

function lockedIdentityFromBody(body: any) {
  const identity = body?.product_identity || body?.productIdentity || {}
  const source = String(body?.source || identity.source || '').toLowerCase().trim()
  const sourceProductId = String(body?.source_product_id || body?.sourceProductId || identity.source_product_id || identity.sourceProductId || '').toUpperCase().trim()
  const idType = String(body?.id_type || body?.idType || identity.id_type || identity.idType || '').trim()
  const locked = Boolean(
    body?.identity_locked ||
    body?.identityLocked ||
    identity.identity_source === 'url' ||
    identity.match_policy === 'url_exact',
  )
  if (!locked || !source || !sourceProductId) return null
  return {
    ...identity,
    source,
    source_product_id: sourceProductId,
    id_type: idType,
    title: identity.title || body?.name || body?.nome || '',
    match_policy: 'url_exact',
    identity_source: 'url',
    identity_confidence: 1,
  }
}

function filterLockedIdentityOffers(offers: PriceOffer[], identity: Record<string, unknown>) {
  const accepted: any[] = []
  const rejected: any[] = []

  for (const offer of offers) {
    try {
      assertProductIdentityMatch(identity, {
        source: (offer as any).source,
        source_product_id: (offer as any).source_product_id,
        title: offer.title,
        name: offer.title,
        url: offer.url,
        link: offer.url,
      })
      accepted.push({
        ...offer,
        total: offer.totalPrice || offer.price,
        compatibility_status: 'accepted',
        match_score: 1,
        match_reason: 'Produto exato confirmado pela identidade do link.',
      })
    } catch {
      rejected.push({
        ...offer,
        total: offer.totalPrice || offer.price,
        compatibility_status: 'rejected',
        match_score: 0,
        match_reason: 'Resultado descartado por divergencia da identidade do link.',
      })
    }
  }

  const best = accepted.length
    ? [...accepted].sort((a, b) => Number(a.total || a.price || 0) - Number(b.total || b.price || 0))[0]
    : null
  return {
    accepted_candidates: accepted,
    ambiguous_candidates: [],
    rejected_candidates: rejected,
    best_compatible_offer: best,
    status: best ? 'found_exact' : 'not_found',
  }
}

function lockedIdentityResponse(input: {
  query: string
  identity: Record<string, unknown>
  offers: PriceOffer[]
  diagnostics: string[]
  metadata?: SearchResult['metadata']
  cacheHit: boolean
  expiresAt?: string
}) {
  const filtered = filterLockedIdentityOffers(input.offers, input.identity)
  return {
    query: input.query,
    provider: null,
    product_identity: input.identity,
    updatedAt: new Date().toISOString(),
    source: filtered.best_compatible_offer ? 'live' : 'fallback',
    offers: filtered.accepted_candidates,
    best_compatible_offer: filtered.best_compatible_offer,
    accepted_candidates: filtered.accepted_candidates,
    ambiguous_candidates: [],
    rejected_candidates: filtered.rejected_candidates,
    status: filtered.status,
    summary: summarizeCompatible(filtered.best_compatible_offer, filtered.accepted_candidates, filtered.status),
    diagnostics: [
      ...input.diagnostics,
      'identity:url-locked',
      `identity:accepted:${filtered.accepted_candidates.length}`,
      `identity:rejected:${filtered.rejected_candidates.length}`,
    ],
    metadata: input.metadata || {},
    cache: {
      hit: input.cacheHit,
      key: productCacheKey(input.identity),
      expires_at: input.expiresAt || null,
    },
    message: filtered.best_compatible_offer
      ? ''
      : 'Nenhum preco do mesmo produto foi confirmado ainda.',
    warning: filtered.best_compatible_offer
      ? ''
      : 'Resultados parecidos foram ignorados por divergencia com o link informado.',
  }
}

function summarizeCompatible(best: any, accepted: any[], status: string) {
  const prices = accepted.map((offer) => Number(offer.total || offer.totalPrice || offer.price || 0)).filter((price) => price > 0)
  return {
    lowestPrice: prices.length ? Math.min(...prices) : null,
    averagePrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    highestPrice: prices.length ? Math.max(...prices) : null,
    bestOffer: best || null,
    best_compatible_offer: best || null,
    offerCount: accepted.length,
    status,
  }
}

function providerCandidateToOffer(candidate: PriceCandidate): PriceOffer | null {
  const price = Number(candidate.price || 0)
  if (!Number.isFinite(price) || price <= 0) return null
  const shipping = Number.isFinite(Number(candidate.shipping_price)) && Number(candidate.shipping_price) > 0
    ? Number(candidate.shipping_price)
    : null
  const totalPrice = Number(candidate.total_price || price + (shipping || 0))
  return {
    marketplace: candidate.seller || candidate.source || 'Google Shopping',
    title: candidate.title || '',
    price,
    shipping,
    totalPrice,
    url: candidate.url || '',
    image: candidate.image_url || '',
    seller: candidate.seller || candidate.source || 'Google Shopping',
    source: candidate.provider,
    confidence: 80,
  }
}

function serviceHeaders() {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) return null
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function buildCacheKey(input: {
  provider: PriceProviderName
  identity: ProductIdentity
  query: string
  location: string
  languageCode: string
}) {
  return sha256(JSON.stringify({
    provider: input.provider,
    identity: input.identity,
    query: input.query,
    location: input.location,
    languageCode: input.languageCode,
  }))
}

async function readPriceSearchCache(userId: string, cacheKey: string): Promise<CacheRecord | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const headers = serviceHeaders()
  if (!url || !headers) return null
  try {
    const response = await fetch(
      `${url}/rest/v1/price_search_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.success&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`,
      { headers },
    )
    if (!response.ok) return null
    const rows = await response.json().catch(() => [])
    return Array.isArray(rows) && rows.length ? rows[0] as CacheRecord : null
  } catch {
    return null
  }
}

async function writePriceSearchCache(input: {
  userId: string
  cacheKey: string
  provider: PriceProviderName
  query: string
  identity: ProductIdentity
  status: 'success' | 'failed'
  accepted: unknown[]
  ambiguous: unknown[]
  rejected: unknown[]
  best: unknown | null
  errorCode?: string
  errorMessage?: string
}) {
  const url = Deno.env.get('SUPABASE_URL')
  const headers = serviceHeaders()
  if (!url || !headers) return
  const ttlHours = Math.max(1, Number(Deno.env.get('PRICE_SEARCH_CACHE_TTL_HOURS') || 24))
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()
  const body = {
    user_id: input.userId,
    cache_key: input.cacheKey,
    provider: input.provider,
    normalized_query: input.query,
    product_identity: input.identity,
    status: input.status,
    accepted_candidates: input.accepted,
    ambiguous_candidates: input.ambiguous,
    rejected_candidates: input.rejected,
    best_compatible_offer: input.best,
    error_code: input.errorCode || null,
    error_message: input.errorMessage || null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }
  try {
    await fetch(`${url}/rest/v1/price_search_cache?on_conflict=cache_key`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(body),
    })
  } catch {
    // Cache failures must never break price search.
  }
}

function compatibleResponse(input: {
  query: string
  provider?: PriceProviderName | string
  productIdentity: ProductIdentity
  compatibility: ReturnType<typeof chooseBestCompatibleOffer>
  diagnostics: string[]
  metadata?: SearchResult['metadata']
  cacheHit: boolean
  expiresAt?: string
  providerResult?: PriceProviderResult | null
}) {
  return {
    status: input.compatibility.status,
    provider: input.provider || null,
    query: input.query,
    product_identity: input.productIdentity,
    updatedAt: new Date().toISOString(),
    source: input.compatibility.best_compatible_offer ? 'live' : 'provider',
    offers: input.compatibility.accepted_candidates,
    best_compatible_offer: input.compatibility.best_compatible_offer,
    accepted_candidates: input.compatibility.accepted_candidates,
    ambiguous_candidates: input.compatibility.ambiguous_candidates,
    rejected_candidates: input.compatibility.rejected_candidates,
    summary: summarizeCompatible(
      input.compatibility.best_compatible_offer,
      input.compatibility.accepted_candidates,
      input.compatibility.status,
    ),
    diagnostics: input.diagnostics,
    metadata: input.metadata || {},
    cache: {
      hit: input.cacheHit,
      expires_at: input.expiresAt || null,
    },
    provider_result: input.providerResult
      ? {
          provider: input.providerResult.provider,
          query: input.providerResult.query,
          raw_count: input.providerResult.raw_count,
          candidate_count: input.providerResult.candidates.length,
          provider_task_id: input.providerResult.provider_task_id || null,
        }
      : undefined,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const auth = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const descriptiveQuery = [body.name, body.nome, body.brand, body.marca, body.model, body.modelo]
      .filter((value) => String(value ?? '').trim())
      .join(' ')
    const querySource = [
      body.query,
      descriptiveQuery,
      body.source_product_id,
      body.sourceProductId,
      body.marketplaceItemId,
      body.canonicalUrl,
      body.originalLink,
      body.link,
    ].find((value) => String(value ?? '').trim())
    const query = String(querySource ?? '').trim()
    const lockedIdentity = lockedIdentityFromBody(body)
    const productIdentity = identityFromBody(body, query)

    if (!query) {
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'price-search',
        eventType: 'price_search_identity_required',
        status: 'blocked',
        metadata: { reason: 'query_empty' },
      })
      return new Response(
        JSON.stringify({
          status: 'quote_pending',
          query: '',
          best_compatible_offer: null,
          accepted_candidates: [],
          ambiguous_candidates: [],
          rejected_candidates: [],
          updatedAt: new Date().toISOString(),
          source: 'fallback',
          offers: [],
          summary: summarizeOffers([]),
          diagnostics: ['query:empty'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    if (productIdentity && !isIdentityCompleteForProvider(productIdentity)) {
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'price-search',
        eventType: 'price_search_identity_required',
        status: 'blocked',
        metadata: {
          product_type: productIdentity.product_type,
          has_model: Boolean(productIdentity.vehicle_model),
          has_side: Boolean(productIdentity.side),
        },
      })
      return new Response(
        JSON.stringify({
          status: 'identity_required',
          query,
          product_identity: productIdentity,
          best_compatible_offer: null,
          accepted_candidates: [],
          ambiguous_candidates: [],
          rejected_candidates: [],
          offers: [],
          summary: summarizeCompatible(null, [], 'identity_required'),
          diagnostics: ['identity:required'],
          cache: { hit: false, expires_at: null },
          message: 'Confirme modelo e lado do produto para buscar preco compativel.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    let offers: PriceOffer[] = []
    let metadata: SearchResult['metadata'] = {}
    const diagnostics: string[] = []
    const rawOriginalLink = String(body.originalUrl || body.originalLink || body.link || body.canonicalUrl || '')
    const originalLink = sanitizeProductUrl(body.canonicalUrl || rawOriginalLink)
    const marketplaceItemId = String(body.marketplaceItemId || '').trim()
    const exactReferenceSource = marketplaceItemId || rawOriginalLink || originalLink
    const mlItemId = extractMercadoLivreItemId(exactReferenceSource)
    const shopeeItemRef = extractShopeeItemRef(exactReferenceSource)
    const mlCatalogId = exactReferenceSource.match(/\bMLBU\d+\b/i)?.[0]?.toUpperCase() || ''
    const hasExactMarketplaceReference = Boolean(mlItemId || shopeeItemRef || mlCatalogId)
    if (mlItemId) metadata.marketplaceItemId = mlItemId.replace(/^MLB/, 'MLB-')
    if (shopeeItemRef) {
      metadata.marketplaceItemId = shopeeItemRef
      diagnostics.push('shopee:exact-lookup-deferred')
    }
    if (mlCatalogId && !mlItemId) {
      metadata.marketplaceItemId = mlCatalogId
      diagnostics.push('ml:catalog-exact-lookup-deferred')
    }

    await logSystemEvent({
      userId: auth.user.id,
      source: 'edge_function',
      functionName: 'price-search',
      eventType: 'price_search_requested',
      status: 'success',
      metadata: {
        has_identity: Boolean(productIdentity),
        identity_locked: Boolean(lockedIdentity),
        exact_reference: hasExactMarketplaceReference,
      },
    })

    if (lockedIdentity) {
      const provider = configuredPriceProvider()
      const providerQuery = String(
        lockedIdentity.id_type === 'canonical_url_hash'
          ? lockedIdentity.canonical_url || lockedIdentity.canonicalUrl || lockedIdentity.source_product_id
          : lockedIdentity.source_product_id,
      )
      const location = Deno.env.get('PRICE_SEARCH_LOCATION') || 'Brazil'
      const languageCode = Deno.env.get('PRICE_SEARCH_LANGUAGE_CODE') || 'pt-br'
      const cacheKey = productCacheKey(lockedIdentity)
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'price-search',
        eventType: 'price_search_identity_locked',
        status: 'success',
        metadata: {
          source: lockedIdentity.source,
          source_product_id: lockedIdentity.source_product_id,
          cache_key: cacheKey,
        },
      })

      const cached = cacheKey ? await readPriceSearchCache(auth.user.id, cacheKey) : null
      if (cached) {
        const cachedOffers = [
          ...(Array.isArray(cached.accepted_candidates) ? cached.accepted_candidates : []),
          ...(Array.isArray(cached.rejected_candidates) ? cached.rejected_candidates : []),
        ] as PriceOffer[]
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_cache_hit',
          status: 'success',
          metadata: { provider, cache_key: cacheKey },
        })
        return new Response(
          JSON.stringify(lockedIdentityResponse({
            query: cached.normalized_query || providerQuery,
            identity: lockedIdentity,
            offers: cachedOffers,
            diagnostics: ['cache:hit'],
            cacheHit: true,
            expiresAt: cached.expires_at,
          })),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      try {
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_provider_called',
          status: 'success',
          metadata: { provider, query_length: providerQuery.length, identity_locked: true },
        })
        const providerResult = await searchPriceProvider(provider, {
          query: providerQuery,
          location,
          languageCode,
        })
        const providerOffers = providerResult.candidates
          .map(providerCandidateToOffer)
          .filter(Boolean) as PriceOffer[]
        const lockedResponse = lockedIdentityResponse({
          query: providerQuery,
          identity: lockedIdentity,
          offers: providerOffers,
          diagnostics: [
            `provider:${providerResult.provider}`,
            `provider:raw-count:${providerResult.raw_count}`,
            `provider:candidates:${providerOffers.length}`,
          ],
          metadata,
          cacheHit: false,
        })
        await writePriceSearchCache({
          userId: auth.user.id,
          cacheKey,
          provider,
          query: providerQuery,
          identity: lockedIdentity as ProductIdentity,
          status: 'success',
          accepted: lockedResponse.accepted_candidates,
          ambiguous: [],
          rejected: lockedResponse.rejected_candidates,
          best: lockedResponse.best_compatible_offer,
        })
        return new Response(
          JSON.stringify(lockedResponse),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      } catch (providerError) {
        const message = providerError instanceof Error ? providerError.message : 'provider_error'
        diagnostics.push('provider:error')
        await writePriceSearchCache({
          userId: auth.user.id,
          cacheKey,
          provider,
          query: providerQuery,
          identity: lockedIdentity as ProductIdentity,
          status: 'failed',
          accepted: [],
          ambiguous: [],
          rejected: [],
          best: null,
          errorCode: 'PROVIDER_ERROR',
          errorMessage: message,
        })
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_provider_failed',
          severity: 'warning',
          status: 'failed',
          errorCode: 'PROVIDER_ERROR',
          errorMessage: message,
          metadata: { provider, identity_locked: true },
        })
        return new Response(
          JSON.stringify(lockedIdentityResponse({
            query: providerQuery,
            identity: lockedIdentity,
            offers: [],
            diagnostics,
            metadata,
            cacheHit: false,
          })),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
    }

    if (productIdentity && !hasExactMarketplaceReference) {
      const provider = configuredPriceProvider()
      const providerQuery = buildProductSearchQuery(productIdentity) || query
      const location = Deno.env.get('PRICE_SEARCH_LOCATION') || 'Brazil'
      const languageCode = Deno.env.get('PRICE_SEARCH_LANGUAGE_CODE') || 'pt-br'
      const cacheKey = await buildCacheKey({
        provider,
        identity: productIdentity,
        query: providerQuery,
        location,
        languageCode,
      })
      const cached = await readPriceSearchCache(auth.user.id, cacheKey)
      if (cached) {
        const cachedOffers = [
          ...(Array.isArray(cached.accepted_candidates) ? cached.accepted_candidates : []),
          ...(Array.isArray(cached.ambiguous_candidates) ? cached.ambiguous_candidates : []),
          ...(Array.isArray(cached.rejected_candidates) ? cached.rejected_candidates : []),
        ] as PriceOffer[]
        const compatibility = chooseBestCompatibleOffer(cachedOffers, productIdentity)
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_cache_hit',
          status: 'success',
          metadata: { provider, accepted: compatibility.accepted_candidates.length },
        })
        return new Response(
          JSON.stringify(compatibleResponse({
            query: cached.normalized_query,
            provider,
            productIdentity,
            compatibility,
            diagnostics: ['cache:hit'],
            cacheHit: true,
            expiresAt: cached.expires_at,
          })),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      try {
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_provider_called',
          status: 'success',
          metadata: { provider, query_length: providerQuery.length },
        })
        const providerResult = await searchPriceProvider(provider, {
          query: providerQuery,
          location,
          languageCode,
        })
        const providerOffers = providerResult.candidates
          .map(providerCandidateToOffer)
          .filter(Boolean) as PriceOffer[]
        offers.push(...providerOffers)
        diagnostics.push(
          `provider:${providerResult.provider}`,
          `provider:raw-count:${providerResult.raw_count}`,
          `provider:candidates:${providerOffers.length}`,
        )
        const compatibility = chooseBestCompatibleOffer(offers, productIdentity)
        await writePriceSearchCache({
          userId: auth.user.id,
          cacheKey,
          provider,
          query: providerQuery,
          identity: productIdentity,
          status: 'success',
          accepted: compatibility.accepted_candidates,
          ambiguous: compatibility.ambiguous_candidates,
          rejected: compatibility.rejected_candidates,
          best: compatibility.best_compatible_offer,
        })
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_candidates_scored',
          status: 'success',
          metadata: {
            accepted: compatibility.accepted_candidates.length,
            ambiguous: compatibility.ambiguous_candidates.length,
            rejected: compatibility.rejected_candidates.length,
          },
        })
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: compatibility.best_compatible_offer ? 'price_search_best_compatible_found' : 'price_search_no_compatible_offer',
          status: compatibility.best_compatible_offer ? 'success' : 'skipped',
          metadata: { provider, status: compatibility.status },
        })
        if (compatibility.rejected_candidates.length) {
          await logSystemEvent({
            userId: auth.user.id,
            source: 'edge_function',
            functionName: 'price-search',
            eventType: 'price_search_rejected_candidate',
            status: 'skipped',
            metadata: { provider, rejected_count: compatibility.rejected_candidates.length },
          })
        }
        return new Response(
          JSON.stringify(compatibleResponse({
            query: providerQuery,
            provider,
            productIdentity,
            compatibility,
            diagnostics,
            metadata,
            cacheHit: false,
            providerResult,
          })),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      } catch (providerError) {
        const message = providerError instanceof Error ? providerError.message : 'provider_error'
        diagnostics.push('provider:error')
        await writePriceSearchCache({
          userId: auth.user.id,
          cacheKey,
          provider,
          query: providerQuery,
          identity: productIdentity,
          status: 'failed',
          accepted: [],
          ambiguous: [],
          rejected: [],
          best: null,
          errorCode: 'PROVIDER_ERROR',
          errorMessage: message,
        })
        await logSystemEvent({
          userId: auth.user.id,
          source: 'edge_function',
          functionName: 'price-search',
          eventType: 'price_search_provider_failed',
          severity: 'warning',
          status: 'failed',
          errorCode: 'PROVIDER_ERROR',
          errorMessage: message,
          metadata: { provider },
        })
      }
    }

    if (mlItemId) {
      const mlItemResult = await searchMercadoLivreItem(mlItemId, originalLink, query)
      offers.push(...mlItemResult.offers)
      diagnostics.push(...mlItemResult.diagnostics)
      metadata = { ...metadata, ...mlItemResult.metadata }
    }

    if (mlItemId && !offers.length && originalLink) {
      const scraperResult = await searchScraperApi(originalLink, mlItemId, query)
      offers.push(...scraperResult.offers)
      diagnostics.push(...scraperResult.diagnostics)
      metadata = { ...metadata, ...scraperResult.metadata }
    }

    if (mlItemId && !offers.length) {
      const exactSerpResult = await searchSerpApi(`${mlItemId} ${query}`, mlItemId, query)
      offers.push(...exactSerpResult.offers)
      diagnostics.push(...exactSerpResult.diagnostics)
      metadata = { ...metadata, ...exactSerpResult.metadata }
    }

    if (!hasExactMarketplaceReference && !offers.length) {
      const mlSearchResult = await searchMercadoLivreQuery(query)
      offers.push(...mlSearchResult.offers)
      diagnostics.push(...mlSearchResult.diagnostics)
    }

    if (!hasExactMarketplaceReference) {
      const serpResult = await searchSerpApi(query)
      offers.push(...serpResult.offers)
      diagnostics.push(...serpResult.diagnostics)
    }

    if (!hasExactMarketplaceReference && !offers.length && originalLink) {
      const scraperResult = await searchScraperApi(originalLink)
      offers.push(...scraperResult.offers)
      diagnostics.push(...scraperResult.diagnostics)
      metadata = { ...metadata, ...scraperResult.metadata }
    }

    if (!hasExactMarketplaceReference && !offers.length) {
      const ocrResult = ocrFallbackOffer(body)
      offers.push(...ocrResult.offers)
      diagnostics.push(...ocrResult.diagnostics)
    }

    offers = offers.filter((offer) => offer.price && offer.price > 0)
    if (productIdentity) {
      if (diagnostics.includes('provider:error') && !offers.length) {
        return new Response(
          JSON.stringify({
            status: 'provider_error',
            provider: configuredPriceProvider(),
            query: buildProductSearchQuery(productIdentity) || query,
            product_identity: productIdentity,
            best_compatible_offer: null,
            accepted_candidates: [],
            ambiguous_candidates: [],
            rejected_candidates: [],
            offers: [],
            summary: summarizeCompatible(null, [], 'provider_error'),
            diagnostics,
            metadata,
            cache: { hit: false, expires_at: null },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      const compatibility = chooseBestCompatibleOffer(offers, productIdentity)
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'price-search',
        eventType: 'price_search_candidates_scored',
        status: 'success',
        metadata: {
          accepted: compatibility.accepted_candidates.length,
          ambiguous: compatibility.ambiguous_candidates.length,
          rejected: compatibility.rejected_candidates.length,
        },
      })
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'price-search',
        eventType: compatibility.best_compatible_offer ? 'price_search_best_compatible_found' : 'price_search_no_compatible_offer',
        status: compatibility.best_compatible_offer ? 'success' : 'skipped',
        metadata: { status: compatibility.status },
      })
      return new Response(
        JSON.stringify({
          query,
          provider: null,
          product_identity: productIdentity,
          updatedAt: new Date().toISOString(),
          source: offers.length ? 'live' : 'fallback',
          offers: compatibility.accepted_candidates,
          best_compatible_offer: compatibility.best_compatible_offer,
          accepted_candidates: compatibility.accepted_candidates,
          ambiguous_candidates: compatibility.ambiguous_candidates,
          rejected_candidates: compatibility.rejected_candidates,
          status: compatibility.status,
          summary: summarizeCompatible(compatibility.best_compatible_offer, compatibility.accepted_candidates, compatibility.status),
          diagnostics: [
            ...diagnostics,
            `identity:accepted:${compatibility.accepted_candidates.length}`,
            `identity:ambiguous:${compatibility.ambiguous_candidates.length}`,
            `identity:rejected:${compatibility.rejected_candidates.length}`,
          ],
          metadata,
          cache: { hit: false, expires_at: null },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        query,
        updatedAt: new Date().toISOString(),
        source: offers.length ? 'live' : 'fallback',
        offers,
        summary: summarizeOffers(offers),
        diagnostics,
        metadata,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      },
    )
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: authError.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: 'Erro ao buscar precos', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
