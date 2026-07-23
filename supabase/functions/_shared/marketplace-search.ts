import {
  extractMercadoLivreItemId,
  extractProductHtmlMetadata,
  extractShopeeItemRef,
  matchesMercadoLivreItem,
  productTitleMatches,
  sanitizeProductUrl,
} from './product-url.ts'

export type MarketplaceOffer = {
  marketplace: string
  price: number
  shipping: number
  total: number
  deliveryDays: number
  trust: number
  warranty: string
  score: number
  url: string
  title: string
  image?: string
  source: 'live'
}

const MARKETPLACE_TRUST: Record<string, { trust: number; warranty: string; deliveryDays: number }> = {
  'Amazon': { trust: 95, warranty: 'Alta', deliveryDays: 3 },
  'Mercado Livre': { trust: 90, warranty: 'Média', deliveryDays: 4 },
  'Shopee': { trust: 78, warranty: 'Baixa', deliveryDays: 7 },
  'Magazine Luiza': { trust: 88, warranty: 'Média', deliveryDays: 5 },
  'Kabum': { trust: 86, warranty: 'Média', deliveryDays: 6 },
  'Pichau': { trust: 84, warranty: 'Média', deliveryDays: 6 },
  'Casas Bahia': { trust: 85, warranty: 'Média', deliveryDays: 6 },
  'Americanas': { trust: 80, warranty: 'Baixa', deliveryDays: 7 },
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

function mercadoLivreHeaders() {
  const token = Deno.env.get('MERCADOLIBRE_ACCESS_TOKEN')
  return token ? { ...FETCH_HEADERS, Authorization: `Bearer ${token}` } : FETCH_HEADERS
}

function normalizeQuery(input: { query?: string; nome?: string; marca?: string; modelo?: string }) {
  const parts = [input.query, input.nome, input.marca, input.modelo].filter(Boolean)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function mapSourceToMarketplace(source: string): string | null {
  const s = source.toLowerCase()
  if (s.includes('amazon')) return 'Amazon'
  if (s.includes('mercado livre') || s.includes('mercadolivre')) return 'Mercado Livre'
  if (s.includes('shopee')) return 'Shopee'
  if (s.includes('magalu') || s.includes('magazine luiza')) return 'Magazine Luiza'
  if (s.includes('kabum')) return 'Kabum'
  if (s.includes('pichau')) return 'Pichau'
  if (s.includes('casas bahia')) return 'Casas Bahia'
  if (s.includes('americanas')) return 'Americanas'
  return null
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const s = String(value || '').replace(/[^\d.,]/g, '')
  if (!s) return 0
  if (/,\d{1,2}$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'))
  }
  return Number(s)
}

function buildOffer(
  marketplace: string,
  price: number,
  shipping: number,
  url: string,
  title: string,
  image = '',
): MarketplaceOffer | null {
  if (!Number.isFinite(price) || price <= 0) return null
  const meta = MARKETPLACE_TRUST[marketplace] || { trust: 75, warranty: 'Média', deliveryDays: 7 }
  const total = price + Math.max(0, shipping)
  return {
    marketplace,
    price,
    shipping: Math.max(0, shipping),
    total,
    deliveryDays: meta.deliveryDays,
    trust: meta.trust,
    warranty: meta.warranty,
    score: 0,
    url: url || '',
    title: title || '',
    image,
    source: 'live',
  }
}

function scoreOffers(offers: MarketplaceOffer[]): MarketplaceOffer[] {
  if (!offers.length) return []
  const maxTotal = Math.max(...offers.map((o) => o.total))
  for (const offer of offers) {
    const priceScore = maxTotal > 0 ? 40 * (1 - offer.total / maxTotal) : 0
    const trustScore = offer.trust * 0.35
    const deliveryScore = Math.max(0, 15 - offer.deliveryDays)
    offer.score = priceScore + trustScore + deliveryScore
  }
  return offers.sort((a, b) => b.score - a.score)
}

function pickBestPerMarketplace(candidates: MarketplaceOffer[]): MarketplaceOffer[] {
  const byMp = new Map<string, MarketplaceOffer>()
  for (const offer of candidates) {
    const current = byMp.get(offer.marketplace)
    if (!current || offer.total < current.total) {
      byMp.set(offer.marketplace, offer)
    }
  }
  return [...byMp.values()]
}

async function searchMercadoLivre(query: string): Promise<MarketplaceOffer[]> {
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=8`
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) {
    if (res.status === 403) console.warn('ML_SEARCH_FORBIDDEN_403')
    return []
  }

  const data = await res.json()
  const results = Array.isArray(data?.results) ? data.results : []
  const offers: MarketplaceOffer[] = []

  for (const item of results.slice(0, 5)) {
    const price = Number(item.price)
    const shipping = item.shipping?.free_shipping ? 0 : Number(item.shipping?.cost || 0)
    const offer = buildOffer(
      'Mercado Livre',
      price,
      shipping,
      item.permalink || '',
      item.title || '',
    )
    if (offer) offers.push(offer)
  }

  const best = pickBestPerMarketplace(offers)
  return best.length ? [best[0]] : []
}

async function getMercadoLivreItemById(
  itemId: string,
  originalLink?: string,
  expectedTitle?: string,
): Promise<MarketplaceOffer[]> {
  const normalizedId = extractMercadoLivreItemId(itemId)
  if (!normalizedId) return []

  const url = `https://api.mercadolibre.com/items/${normalizedId}`
  const res = await fetch(url, { headers: mercadoLivreHeaders(), signal: AbortSignal.timeout(12000) })
  if (!res.ok) {
    return originalLink ? getMercadoLivreItemFromHtml(originalLink, normalizedId, expectedTitle) : []
  }

  const item = await res.json()
  if (!matchesMercadoLivreItem(normalizedId, item?.id, item?.permalink)) return []
  if (expectedTitle && !productTitleMatches(expectedTitle, item?.title)) return []
  const price = Number(item?.price || 0)
  const shipping = item?.shipping?.free_shipping ? 0 : Number(item?.shipping?.cost || 0)
  const offer = buildOffer(
    'Mercado Livre',
    price,
    shipping,
    item?.permalink || '',
    item?.title || '',
    item?.pictures?.[0]?.secure_url || item?.thumbnail || '',
  )

  return offer ? [offer] : []
}

async function getMercadoLivreItemFromHtml(
  originalLink: string,
  expectedItemId?: string,
  expectedTitle?: string,
): Promise<MarketplaceOffer[]> {
  const canonicalLink = sanitizeProductUrl(originalLink)
  const res = await fetch(canonicalLink, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []

  const html = await res.text()
  const metadata = extractProductHtmlMetadata(html)
  if (expectedItemId && !matchesMercadoLivreItem(expectedItemId, res.url, metadata.marketplaceItemId)) return []
  if (expectedTitle && !productTitleMatches(expectedTitle, metadata.name)) return []
  const price = metadata.value || parseMoney(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])

  const offer = buildOffer(
    'Mercado Livre',
    price,
    0,
    canonicalLink,
    metadata.name || '',
    metadata.imageUrl || '',
  )

  return offer ? [offer] : []
}

async function searchShopee(query: string): Promise<MarketplaceOffer[]> {
  const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=8&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`
  const res = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: 'https://shopee.com.br/',
      'X-API-Source': 'pc',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []

  const data = await res.json()
  const items = data?.items || data?.data?.items || []
  const offers: MarketplaceOffer[] = []

  for (const entry of items.slice(0, 6)) {
    const basic = entry.item_basic || entry
    const price = Number(basic.price) / 100000
    const shipping = Number(basic.shop_location === 'Internacional' ? 20 : 0)
    const itemId = basic.itemid
    const shopId = basic.shopid
    const link = itemId && shopId
      ? `https://shopee.com.br/product/${shopId}/${itemId}`
      : 'https://shopee.com.br'
    const offer = buildOffer('Shopee', price, shipping, link, basic.name || '')
    if (offer) offers.push(offer)
  }

  const best = pickBestPerMarketplace(offers)
  return best.length ? [best[0]] : []
}

function normalizeShopeePrice(value: unknown): number {
  const price = Number(value || 0)
  if (!Number.isFinite(price) || price <= 0) return 0
  return price > 100000 ? price / 100000 : price
}

async function getShopeeItemById(itemRef: string, originalLink: string): Promise<MarketplaceOffer[]> {
  const normalizedRef = extractShopeeItemRef(itemRef || originalLink)
  if (!normalizedRef) return []
  const [shopId, itemId] = normalizedRef.split(':')
  const url = `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${encodeURIComponent(itemId)}&shop_id=${encodeURIComponent(shopId)}`
  const res = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: originalLink || 'https://shopee.com.br/',
      'X-API-Source': 'pc',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []

  const data = await res.json()
  const item = data?.data?.item || data?.data || data?.item
  const price = normalizeShopeePrice(item?.price || item?.price_min || item?.price_min_before_discount)
  const image = item?.image || item?.images?.[0] || item?.image_url || ''
  const imageUrl = image && !String(image).startsWith('http')
    ? `https://down-br.img.susercontent.com/file/${image}`
    : String(image || '')
  const canonicalLink = originalLink || `https://shopee.com.br/product/${shopId}/${itemId}`
  const offer = buildOffer('Shopee', price, 0, canonicalLink, item?.title || item?.name || '', imageUrl)
  return offer ? [offer] : []
}

async function searchKabum(query: string): Promise<MarketplaceOffer[]> {
  const url = 'https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products/list'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...FETCH_HEADERS,
      'Content-Type': 'application/json',
      Origin: 'https://www.kabum.com.br',
      Referer: 'https://www.kabum.com.br/',
    },
    body: JSON.stringify({
      page_number: 1,
      page_size: 8,
      name: query,
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []

  const data = await res.json()
  const products = data?.data?.products || data?.products || []
  const offers: MarketplaceOffer[] = []

  for (const p of products.slice(0, 6)) {
    const price = Number(p.price || p.price_with_discount || 0)
    const shipping = Number(p.shipping || 0)
    const link = p.url || p.link || `https://www.kabum.com.br/busca/${encodeURIComponent(query)}`
    const offer = buildOffer('Kabum', price, shipping, link, p.name || p.product_name || '')
    if (offer) offers.push(offer)
  }

  const best = pickBestPerMarketplace(offers)
  return best.length ? [best[0]] : []
}

async function searchMagalu(query: string): Promise<MarketplaceOffer[]> {
  const slug = query.toLowerCase().replace(/\s+/g, '-')
  const url = `https://www.magazineluiza.com.br/busca/${encodeURIComponent(slug)}/`
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []

  const html = await res.text()
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!nextDataMatch) return []

  const nextData = JSON.parse(nextDataMatch[1])
  const products =
    nextData?.props?.pageProps?.data?.search?.products ||
    nextData?.props?.pageProps?.data?.products ||
    []

  const offers: MarketplaceOffer[] = []
  for (const p of products.slice(0, 6)) {
    const price = Number(p.price?.bestPrice || p.price?.price || p.price || 0)
    const shipping = Number(p.shipping?.cost || 0)
    const link = p.path ? `https://www.magazineluiza.com.br${p.path}` : url
    const offer = buildOffer('Magazine Luiza', price, shipping, link, p.title || p.name || '')
    if (offer) offers.push(offer)
  }

  const best = pickBestPerMarketplace(offers)
  return best.length ? [best[0]] : []
}

async function searchAmazonBr(query: string): Promise<MarketplaceOffer[]> {
  const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []

  const html = await res.text()
  const priceMatches = [...html.matchAll(/"priceAmount":([0-9.]+)/g)].map((m) => Number(m[1]))
  const linkMatch = html.match(/href="(\/[^"]*\/dp\/[A-Z0-9]{10})/)
  const titleMatch = html.match(/<span class="a-size-medium a-color-base a-text-normal">([^<]+)</)

  if (!priceMatches.length) return []
  const price = Math.min(...priceMatches.filter((n) => n > 0))
  const offer = buildOffer(
    'Amazon',
    price,
    0,
    linkMatch ? `https://www.amazon.com.br${linkMatch[1]}` : url,
    titleMatch?.[1] || query,
  )
  return offer ? [offer] : []
}

async function searchPichau(query: string): Promise<MarketplaceOffer[]> {
  const url = `https://www.pichau.com.br/busca?busca=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []

  const html = await res.text()
  const priceMatch = html.match(/"price":\s*([0-9.]+)/)
  const nameMatch = html.match(/"name":\s*"([^"]+)"/)
  if (!priceMatch) return []

  const offer = buildOffer(
    'Pichau',
    Number(priceMatch[1]),
    29,
    url,
    nameMatch?.[1] || query,
  )
  return offer ? [offer] : []
}

async function searchCasasBahia(query: string): Promise<MarketplaceOffer[]> {
  const url = `https://www.casasbahia.com.br/c?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []

  const html = await res.text()
  const priceMatch = html.match(/"price":\s*([0-9.]+)/) || html.match(/R\$\s*([0-9.]+,[0-9]{2})/)
  if (!priceMatch) return []

  let price = Number(priceMatch[1])
  if (String(priceMatch[0]).includes(',')) {
    price = parseMoney(priceMatch[1])
  }

  const offer = buildOffer('Casas Bahia', price, 25, url, query)
  return offer ? [offer] : []
}

async function searchSerpApi(query: string): Promise<MarketplaceOffer[]> {
  const apiKey = Deno.env.get('SERPAPI_KEY')
  if (!apiKey) return []

  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=br&hl=pt&num=20&api_key=${apiKey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    if (res.status === 401) console.warn('SERPAPI_CREDENTIAL_INVALID_401')
    return []
  }

  const data = await res.json()
  const results = data?.shopping_results || []
  const offers: MarketplaceOffer[] = []

  for (const row of results) {
    const marketplace = mapSourceToMarketplace(row.source || '')
    if (!marketplace) continue
    const price = parseMoney(row.extracted_price ?? row.price)
    const shipping = 0
    const offer = buildOffer(
      marketplace,
      price,
      shipping,
      row.link || row.product_link || '',
      row.title || '',
    )
    if (offer) offers.push(offer)
  }

  return pickBestPerMarketplace(offers)
}

export async function searchLiveMarketplaces(input: {
  query?: string
  nome?: string
  marca?: string
  modelo?: string
  marketplace?: string
  marketplaceItemId?: string
  originalLink?: string
}) {
  const query = normalizeQuery(input)
  const rawOriginalLink = String(input.originalLink || '')
  const originalLink = sanitizeProductUrl(rawOriginalLink)
  const exactReferenceSource = input.marketplaceItemId || rawOriginalLink || originalLink

  const mlItemId = extractMercadoLivreItemId(exactReferenceSource)
  if (mlItemId && String(input.marketplace || '').toLowerCase().includes('mercado')) {
    const itemOffers = await getMercadoLivreItemById(mlItemId, originalLink, query)
    if (itemOffers.length) {
      return {
        offers: scoreOffers(itemOffers),
        sourcesUsed: ['mercadolivre:item'],
        fetchedAt: new Date().toISOString(),
        query: query || mlItemId,
      }
    }
    return {
      offers: [],
      sourcesUsed: [],
      fetchedAt: new Date().toISOString(),
      query: query || mlItemId,
      diagnostics: ['mercadolivre:item-exact-unavailable'],
    }
  }

  const shopeeItemRef = extractShopeeItemRef(exactReferenceSource)
  if (shopeeItemRef && String(input.marketplace || '').toLowerCase().includes('shopee')) {
    const itemOffers = await getShopeeItemById(shopeeItemRef, originalLink)
    return {
      offers: scoreOffers(itemOffers),
      sourcesUsed: itemOffers.length ? ['shopee:item'] : [],
      fetchedAt: new Date().toISOString(),
      query: query || shopeeItemRef,
      diagnostics: itemOffers.length ? ['shopee:item-exact'] : ['shopee:item-exact-unavailable'],
    }
  }

  if (!query) {
    return { offers: [], sourcesUsed: [], fetchedAt: new Date().toISOString(), query: '' }
  }

  const providers: Array<{ name: string; fn: () => Promise<MarketplaceOffer[]> }> = [
    { name: 'mercadolivre', fn: () => searchMercadoLivre(query) },
    { name: 'shopee', fn: () => searchShopee(query) },
    { name: 'kabum', fn: () => searchKabum(query) },
    { name: 'magalu', fn: () => searchMagalu(query) },
    { name: 'amazon', fn: () => searchAmazonBr(query) },
    { name: 'pichau', fn: () => searchPichau(query) },
    { name: 'casasbahia', fn: () => searchCasasBahia(query) },
    { name: 'serpapi', fn: () => searchSerpApi(query) },
  ]

  const settled = await Promise.allSettled(providers.map((p) => p.fn()))
  const sourcesUsed: string[] = []
  const allOffers: MarketplaceOffer[] = []

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      sourcesUsed.push(providers[index].name)
      allOffers.push(...result.value)
    }
  })

  const offers = scoreOffers(pickBestPerMarketplace(allOffers))

  return {
    offers,
    sourcesUsed,
    fetchedAt: new Date().toISOString(),
    query,
  }
}
