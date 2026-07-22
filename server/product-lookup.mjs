import { normalizeOffers, parseMoney, summarizeOffers } from './price-engine.mjs'

const MARKETPLACE_TRUST = {
  'Mercado Livre': { trust: 90, warranty: 'Media', deliveryDays: 4 },
  Shopee: { trust: 78, warranty: 'Baixa', deliveryDays: 7 },
  Amazon: { trust: 95, warranty: 'Alta', deliveryDays: 3 },
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Accept: 'application/json,text/html,*/*',
}

function extractMercadoLivreItemId(input = '') {
  const raw = String(input)
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {}
  return value.match(/(?:^|[^A-Z0-9])(MLB-?\d+)(?=$|[-/?#&:_\s])/i)?.[1]?.replace('-', '').toUpperCase() || ''
}

function extractShopeeItemRef(input = '') {
  const text = String(input)
  const pathMatch = text.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)/i)
  if (pathMatch) return { shopId: pathMatch[1], itemId: pathMatch[2], ref: `${pathMatch[1]}:${pathMatch[2]}` }
  const compactMatch = text.match(/\b(\d+):(\d+)\b/)
  if (compactMatch) return { shopId: compactMatch[1], itemId: compactMatch[2], ref: `${compactMatch[1]}:${compactMatch[2]}` }
  try {
    const parsed = new URL(text)
    const shopId = parsed.searchParams.get('shopid')
    const itemId = parsed.searchParams.get('itemid')
    if (shopId && itemId) return { shopId, itemId, ref: `${shopId}:${itemId}` }
  } catch {}
  return { shopId: '', itemId: '', ref: '' }
}

function sanitizeProductLink(link = '') {
  try {
    const parsed = new URL(link)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return link
  }
}

function extractSlug(link = '') {
  try {
    const parsed = new URL(link)
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/_JM$/i, '')
      .replace(/^MLB-?\d+-?/i, '')
      .replace(/^MLB\s*\d+\s*/i, '')
      .replace(/-i\.\d+\.\d+$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

function productTitleMatches(expectedTitle = '', candidateTitle = '') {
  const ignored = new Set(['para', 'com', 'sem', 'original', 'novo', 'nova', 'peca', 'produto'])
  const tokens = (value) => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !ignored.has(token) && !/^\d{4}$/.test(token)) || []
  const expected = [...new Set(tokens(expectedTitle))]
  const candidate = new Set(tokens(candidateTitle))
  if (!expected.length || !candidate.size) return false
  const overlap = expected.filter((token) => candidate.has(token)).length
  return overlap >= (expected.length >= 3 ? 2 : 1) && overlap / expected.length >= 0.3
}

function identifyMarketplace(link = '') {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '')
    if (host.includes('mercadolivre.com.br')) return 'Mercado Livre'
    if (host.includes('shopee.com.br')) return 'Shopee'
    if (host.includes('amazon.com.br')) return 'Amazon'
    return ''
  } catch {
    return ''
  }
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  )
  return pattern.exec(html)?.[1] || ''
}

function scoreOffers(offers) {
  if (!offers.length) return []
  const maxTotal = Math.max(...offers.map((o) => o.total))
  return offers
    .map((offer) => {
      const priceScore = maxTotal > 0 ? 40 * (1 - offer.total / maxTotal) : 0
      const trustScore = offer.trust * 0.35
      const deliveryScore = Math.max(0, 15 - offer.deliveryDays)
      return { ...offer, score: priceScore + trustScore + deliveryScore }
    })
    .sort((a, b) => b.score - a.score)
}

function buildResult({ offers = [], sourcesUsed = [], query = '', mode = 'none', metadata = {}, diagnostics = [], product = {} }) {
  const normalizedOffers = normalizeOffers(scoreOffers(offers), product)
  return {
    offers: normalizedOffers,
    sourcesUsed: normalizedOffers.length ? sourcesUsed : [],
    fetchedAt: new Date().toISOString(),
    query,
    mode: normalizedOffers.length ? mode : metadata?.name ? 'metadata' : 'none',
    metadata,
    diagnostics,
    summary: summarizeOffers(normalizedOffers),
  }
}

function buildOffer({ marketplace, price, shipping = 0, url = '', title = '', imageUrl = '', source = 'live' }) {
  const numericPrice = Number(price || 0)
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return null
  const meta = MARKETPLACE_TRUST[marketplace] || { trust: 75, warranty: 'Media', deliveryDays: 7 }
  const safeShipping = Math.max(0, Number(shipping || 0))
  return {
    marketplace,
    price: numericPrice,
    shipping: safeShipping,
    total: numericPrice + safeShipping,
    deliveryDays: meta.deliveryDays,
    trust: meta.trust,
    warranty: meta.warranty,
    score: 0,
    url,
    title,
    imageUrl,
    source,
  }
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      headers: { ...FETCH_HEADERS, ...headers },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal })
    if (!res.ok) return ''
    return res.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchRenderedHtml(url) {
  const apiKey = process.env.SCRAPERAPI_KEY || ''
  if (!apiKey) return ''
  const renderedUrl = `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&render=true&country_code=br&url=${encodeURIComponent(url)}`
  return fetchHtml(renderedUrl)
}

async function lookupMercadoLivreById({ link, itemId, expectedTitle }) {
  const normalizedId = extractMercadoLivreItemId(itemId || link)
  if (!normalizedId) return { offers: [], metadata: {}, diagnostics: ['ml:item-id-missing'] }

  const token = process.env.MERCADOLIBRE_ACCESS_TOKEN || ''
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
  const item = await fetchJson(`https://api.mercadolibre.com/items/${normalizedId}`, authHeaders)

  const apiItemId = extractMercadoLivreItemId(item?.id || item?.permalink || '')
  if (item?.price && apiItemId === normalizedId && productTitleMatches(expectedTitle, item?.title)) {
    const offer = buildOffer({
      marketplace: 'Mercado Livre',
      price: item.price,
      shipping: item.shipping?.free_shipping ? 0 : item.shipping?.cost || 0,
      url: item.permalink || link,
      title: item.title || extractSlug(link),
      imageUrl: item.thumbnail || item.pictures?.[0]?.secure_url || '',
    })
    return {
      offers: offer ? scoreOffers([offer]) : [],
      metadata: {
        name: item.title || '',
        value: Number(item.price || 0),
        imageUrl: item.thumbnail || item.pictures?.[0]?.secure_url || '',
        marketplaceItemId: normalizedId,
      },
      diagnostics: ['ml:item-api'],
    }
  }

  let html = link ? await fetchHtml(link) : ''
  const htmlItemId = extractMercadoLivreItemId(metaContent(html, 'og:url'))
  if (htmlItemId && htmlItemId !== normalizedId) {
    return {
      offers: [],
      metadata: { marketplaceItemId: normalizedId },
      diagnostics: ['ml:html-item-id-mismatch'],
    }
  }
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    extractSlug(link)
  if (!productTitleMatches(expectedTitle, title)) {
    return {
      offers: [],
      metadata: { marketplaceItemId: normalizedId },
      diagnostics: ['ml:html-title-mismatch'],
    }
  }
  const imageUrl = metaContent(html, 'og:image') || metaContent(html, 'twitter:image')
  let price =
    parseMoney(metaContent(html, 'product:price:amount')) ||
    parseMoney(metaContent(html, 'price')) ||
    parseMoney(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])
  let usedRenderedHtml = false

  if (!price && link) {
    const renderedHtml = await fetchRenderedHtml(link)
    if (renderedHtml) {
      usedRenderedHtml = true
      html = renderedHtml
      const renderedItemId = extractMercadoLivreItemId(metaContent(html, 'og:url'))
      if (!renderedItemId || renderedItemId !== normalizedId) {
        return {
          offers: [],
          metadata: { marketplaceItemId: normalizedId },
          diagnostics: ['scraperapi:item-id-mismatch'],
        }
      }
      const renderedTitle = metaContent(html, 'og:title') || metaContent(html, 'twitter:title')
      if (!productTitleMatches(expectedTitle, renderedTitle)) {
        return {
          offers: [],
          metadata: { marketplaceItemId: normalizedId },
          diagnostics: ['scraperapi:title-mismatch'],
        }
      }
      price =
        parseMoney(metaContent(html, 'product:price:amount')) ||
        parseMoney(metaContent(html, 'price')) ||
        parseMoney(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])
    }
  }
  const offer = buildOffer({
    marketplace: 'Mercado Livre',
    price,
    shipping: 0,
    url: link,
    title,
    imageUrl,
  })

  return {
    offers: offer ? scoreOffers([offer]) : [],
    metadata: {
      name: title,
      value: price || null,
      imageUrl,
      marketplaceItemId: normalizedId,
    },
    diagnostics: [
      'ml:item-api-unavailable',
      html ? 'ml:html' : 'ml:html-unavailable',
      ...(usedRenderedHtml ? ['scraperapi:rendered-html'] : []),
    ],
  }
}

async function lookupMercadoLivreSearch(query) {
  if (!query) return { offers: [], diagnostics: ['ml:search-empty'] }
  const data = await fetchJson(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=5`,
  )
  const results = Array.isArray(data?.results) ? data.results : []
  const offers = results
    .map((item) =>
      buildOffer({
        marketplace: 'Mercado Livre',
        price: item.price,
        shipping: item.shipping?.free_shipping ? 0 : item.shipping?.cost || 0,
        url: item.permalink || '',
        title: item.title || '',
        imageUrl: item.thumbnail || '',
      }),
    )
    .filter(Boolean)
  return { offers: scoreOffers(offers.slice(0, 1)), diagnostics: ['ml:search-api'] }
}

function normalizeShopeePrice(value) {
  const price = Number(value || 0)
  if (!Number.isFinite(price) || price <= 0) return 0
  return price > 100000 ? price / 100000 : price
}

async function lookupShopeeById({ link, itemRef }) {
  const ids = extractShopeeItemRef(itemRef || link)
  if (!ids.itemId || !ids.shopId) return { offers: [], metadata: {}, diagnostics: ['shopee:item-id-missing'] }

  const data = await fetchJson(
    `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${encodeURIComponent(ids.itemId)}&shop_id=${encodeURIComponent(ids.shopId)}`,
    {
      Referer: 'https://shopee.com.br/',
      'X-API-Source': 'pc',
    },
  )
  const item = data?.data?.item || data?.data || data?.item
  const price = normalizeShopeePrice(item?.price || item?.price_min || item?.price_min_before_discount)
  const title = item?.title || item?.name || extractSlug(link)
  const image =
    item?.image ||
    item?.images?.[0] ||
    item?.image_url ||
    ''
  const imageUrl = image && !String(image).startsWith('http')
    ? `https://down-br.img.susercontent.com/file/${image}`
    : image

  if (price) {
    const offer = buildOffer({
      marketplace: 'Shopee',
      price,
      shipping: 0,
      url: link,
      title,
      imageUrl,
    })
    return {
      offers: offer ? scoreOffers([offer]) : [],
      metadata: { name: title, value: price, imageUrl, marketplaceItemId: ids.ref },
      diagnostics: ['shopee:pdp-api'],
    }
  }

  return lookupShopeeFromHtml({ link, itemRef: ids.ref, diagnostics: ['shopee:pdp-api-unavailable'] })
}

async function lookupShopeeFromHtml({ link, itemRef = '', diagnostics = [] }) {
  let html = link ? await fetchHtml(link) : ''
  let title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
    extractSlug(link)
  let imageUrl = metaContent(html, 'og:image') || metaContent(html, 'twitter:image')
  let price =
    parseMoney(metaContent(html, 'product:price:amount')) ||
    parseMoney(metaContent(html, 'price')) ||
    parseMoney(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])
  let usedRenderedHtml = false

  if (!price && link) {
    const renderedHtml = await fetchRenderedHtml(link)
    if (renderedHtml) {
      usedRenderedHtml = true
      html = renderedHtml
      title =
        metaContent(html, 'og:title') ||
        metaContent(html, 'twitter:title') ||
        html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
        title
      imageUrl = metaContent(html, 'og:image') || metaContent(html, 'twitter:image') || imageUrl
      price =
        parseMoney(metaContent(html, 'product:price:amount')) ||
        parseMoney(metaContent(html, 'price')) ||
        parseMoney(html.match(/R\$\s*[\d.]+,\d{2}/)?.[0])
    }
  }

  const offer = buildOffer({ marketplace: 'Shopee', price, shipping: 0, url: link, title, imageUrl })
  return {
    offers: offer ? scoreOffers([offer]) : [],
    metadata: { name: title, value: price || null, imageUrl, marketplaceItemId: itemRef },
    diagnostics: [
      ...diagnostics,
      html ? 'shopee:html' : 'shopee:html-unavailable',
      ...(usedRenderedHtml ? ['scraperapi:rendered-html'] : []),
    ],
  }
}

async function lookupShopeeSearch(query) {
  if (!query) return { offers: [], diagnostics: ['shopee:search-empty'] }
  const data = await fetchJson(
    `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=8&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`,
    {
      Referer: 'https://shopee.com.br/',
      'X-API-Source': 'pc',
    },
  )
  const items = data?.items || data?.data?.items || []
  const offers = items
    .slice(0, 6)
    .map((entry) => {
      const basic = entry.item_basic || entry
      const price = normalizeShopeePrice(basic.price || basic.price_min)
      const itemId = basic.itemid
      const shopId = basic.shopid
      const title = basic.name || query
      const imageUrl = basic.image ? `https://down-br.img.susercontent.com/file/${basic.image}` : ''
      return buildOffer({
        marketplace: 'Shopee',
        price,
        shipping: basic.shop_location === 'Internacional' ? 20 : 0,
        url: itemId && shopId ? `https://shopee.com.br/product/${shopId}/${itemId}` : 'https://shopee.com.br',
        title,
        imageUrl,
      })
    })
    .filter(Boolean)
  return { offers: scoreOffers(offers.slice(0, 1)), diagnostics: ['shopee:search-api'] }
}

async function lookupSerpApi(query) {
  const apiKey = process.env.SERPAPI_KEY || ''
  if (!apiKey || !query) return { offers: [], diagnostics: ['serpapi:not-configured'] }
  const data = await fetchJson(
    `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&gl=br&hl=pt&num=10&api_key=${encodeURIComponent(apiKey)}`,
  )
  const rows = data?.shopping_results || []
  const offers = rows
    .map((row) => {
      const source = String(row.source || '')
      let marketplace = ''
      if (source.toLowerCase().includes('shopee')) marketplace = 'Shopee'
      if (source.toLowerCase().includes('mercado')) marketplace = 'Mercado Livre'
      if (!marketplace) return null
      return buildOffer({
        marketplace,
        price: parseMoney(row.extracted_price ?? row.price),
        shipping: 0,
        url: row.link || row.product_link || '',
        title: row.title || query,
        imageUrl: row.thumbnail || '',
      })
    })
    .filter(Boolean)
  return { offers: scoreOffers(offers.slice(0, 2)), diagnostics: ['serpapi:google-shopping'] }
}

export async function lookupProduct(input = {}) {
  const link = sanitizeProductLink(input.canonicalUrl || input.canonical_url || input.originalLink || input.link || '')
  const marketplace = input.marketplace || identifyMarketplace(link)
  const query = [input.query, input.nome || input.name, input.marca || input.brand, input.modelo || input.model]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const product = { ...input, name: input.name || input.nome || query }

  if (marketplace === 'Mercado Livre') {
    const requestedItemId = extractMercadoLivreItemId(
      input.marketplaceItemId || input.marketplace_item_id || link,
    )
    const byId = await lookupMercadoLivreById({
      link,
      itemId: input.marketplaceItemId || input.marketplace_item_id,
      expectedTitle: query || extractSlug(link),
    })
    if (requestedItemId) {
      return buildResult({
        offers: byId.offers,
        sourcesUsed: byId.offers.length ? ['mercadolivre:item'] : [],
        query: query || byId.metadata.name || extractSlug(link),
        mode: byId.offers.length ? 'live' : 'metadata',
        metadata: byId.metadata,
        diagnostics: byId.diagnostics,
        product,
      })
    }
    const searched = await lookupMercadoLivreSearch(query || extractSlug(link))
    if (!searched.offers.length) {
      const serp = await lookupSerpApi(query || extractSlug(link))
      if (serp.offers.length) {
        return buildResult({
          offers: serp.offers,
          sourcesUsed: ['serpapi'],
          query: query || extractSlug(link),
          mode: 'live',
          metadata: {},
          diagnostics: [...searched.diagnostics, ...serp.diagnostics],
          product,
        })
      }
    }
    return buildResult({
      offers: searched.offers,
      sourcesUsed: searched.offers.length ? ['mercadolivre:search'] : [],
      query: query || extractSlug(link),
      mode: searched.offers.length ? 'live' : 'none',
      metadata: {},
      diagnostics: searched.diagnostics,
      product,
    })
  }

  if (marketplace === 'Shopee') {
    const byId = await lookupShopeeById({ link, itemRef: input.marketplaceItemId || input.marketplace_item_id })
    if (byId.offers.length || byId.metadata.name) {
      return buildResult({
        offers: byId.offers,
        sourcesUsed: byId.offers.length ? ['shopee:item'] : [],
        query: query || byId.metadata.name || extractSlug(link),
        mode: byId.offers.length ? 'live' : 'metadata',
        metadata: byId.metadata,
        diagnostics: byId.diagnostics,
        product,
      })
    }
    const searched = await lookupShopeeSearch(query || extractSlug(link))
    if (searched.offers.length) {
      return buildResult({
        offers: searched.offers,
        sourcesUsed: ['shopee:search'],
        query: query || extractSlug(link),
        mode: 'live',
        metadata: {},
        diagnostics: searched.diagnostics,
        product,
      })
    }
    const serp = await lookupSerpApi(query || extractSlug(link))
    return buildResult({
      offers: serp.offers,
      sourcesUsed: serp.offers.length ? ['serpapi'] : [],
      query: query || extractSlug(link),
      mode: serp.offers.length ? 'live' : 'none',
      metadata: {},
      diagnostics: [...searched.diagnostics, ...serp.diagnostics],
      product,
    })
  }

  return buildResult({
    offers: [],
    sourcesUsed: [],
    query,
    mode: 'none',
    metadata: {},
    diagnostics: ['provider:not-implemented'],
    product,
  })
}
