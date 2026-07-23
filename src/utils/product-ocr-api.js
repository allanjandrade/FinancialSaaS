import { extractNativeDocumentText } from './native-document-extraction.js'

function edgeFunctionHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Falha ao ler o arquivo'))
        return
      }
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

export async function fetchProductOcr(file) {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Faça login para analisar anúncios')

  const imagemBase64 = await fileToBase64(file)
  const extractedText = await extractNativeDocumentText(file)
  const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/product-ocr`

  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify({
      imagemBase64,
      mimeType: file.type || 'image/jpeg',
      extractedText,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao processar anúncio' }))
    const detail = errorData?.details || errorData?.error || `HTTP ${response.status}`
    throw new Error(detail)
  }

  return response.json()
}

export function normalizeMercadoLivreId(value) {
  const raw = String(value || '')
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // Preserve malformed URLs for the normal parser fallback.
  }
  const match = decoded.match(/(?:^|[^A-Z0-9])(MLB)-?(\d+)(?=$|[-/?#&:_\s])/i)
  return match ? `${match[1].toUpperCase()}-${match[2]}` : null
}

export function normalizeShopeeItemRef(value) {
  const text = String(value || '')
  const pathMatch = text.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)/i)
  if (pathMatch) return `${pathMatch[1]}:${pathMatch[2]}`
  return text.match(/(?:^|\D)(\d+):(\d+)(?:$|\D)/)?.slice(1, 3).join(':') || null
}

function identityTokens(value) {
  const ignored = new Set(['para', 'com', 'sem', 'original', 'novo', 'nova', 'peca', 'produto'])
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !ignored.has(token) && !/^\d{4}$/.test(token)) || []
}

export function productTitleMatches(expectedTitle, candidateTitle) {
  const expected = [...new Set(identityTokens(expectedTitle))]
  const candidate = new Set(identityTokens(candidateTitle))
  if (!expected.length || !candidate.size) return false
  const overlap = expected.filter((token) => candidate.has(token)).length
  return overlap >= (expected.length >= 3 ? 2 : 1) && overlap / expected.length >= 0.3
}

export function sanitizeProductUrl(url) {
  if (!url) {
    return {
      originalUrl: '',
      canonicalUrl: '',
      removedParams: [],
      hasVariation: false,
    }
  }

  try {
    const parsed = new URL(url)
    const removedParams = [...parsed.searchParams.keys()]
    const hasVariation = ['searchVariation', 'variation_id', 'variation', 'sku', 'attributes']
      .some((key) => parsed.searchParams.has(key))

    let canonicalUrl = `${parsed.origin}${parsed.pathname}`

    const shopeePathIds = parsed.pathname.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)/i)
    const shopeeQueryShopId = parsed.searchParams.get('shopid')
    const shopeeQueryItemId = parsed.searchParams.get('itemid')
    if (!shopeePathIds && shopeeQueryShopId && shopeeQueryItemId && parsed.hostname.includes('shopee')) {
      canonicalUrl = `${parsed.origin}/product/${shopeeQueryShopId}/${shopeeQueryItemId}`
    }

    return {
      originalUrl: url,
      canonicalUrl,
      removedParams: parsed.hash ? [...removedParams, '#hash'] : removedParams,
      hasVariation,
    }
  } catch {
    return {
      originalUrl: url,
      canonicalUrl: url,
      removedParams: [],
      hasVariation: false,
    }
  }
}

export function parseProductLink(url) {
  if (!url) {
    return {
      marketplace: null,
      slug: '',
      itemId: null,
      originalUrl: '',
      canonicalUrl: '',
      removedParams: [],
      hasVariation: false,
    }
  }
  try {
    const originalParsed = new URL(url)
    const sanitized = sanitizeProductUrl(url)
    const parsed = new URL(sanitized.canonicalUrl || url)
    const host = parsed.hostname.replace(/^www\./, '')
    const map = {
      'mercadolivre.com.br': 'Mercado Livre',
      'amazon.com.br': 'Amazon',
      'shopee.com.br': 'Shopee',
      'magazineluiza.com.br': 'Magazine Luiza',
      'kabum.com.br': 'Kabum',
      'pichau.com.br': 'Pichau',
      'casasbahia.com.br': 'Casas Bahia',
      'americanas.com.br': 'Americanas',
    }
    const marketplace = Object.entries(map).find(([key]) => host.includes(key))?.[1] || null
    const pathParts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const upIndex = pathParts.findIndex((part) => part.toLowerCase() === 'up')
    const isShopeeProductPath = /\/product\/\d+\/\d+/i.test(parsed.pathname)
    const rawSlug = isShopeeProductPath
      ? ''
      : upIndex > 0
        ? pathParts[upIndex - 1]
        : pathParts.at(-1) || ''
    const pdpFilters = originalParsed.searchParams.get('pdp_filters') || ''
    const mercadoLivreId = normalizeMercadoLivreId(pdpFilters) || normalizeMercadoLivreId(parsed.pathname)
    const mercadoLivreCatalogMatch = parsed.pathname.match(/(?:^|\/)MLBU(\d+)(?:$|\/)/i)
    const mercadoLivreCatalogId = mercadoLivreCatalogMatch ? `MLBU${mercadoLivreCatalogMatch[1]}` : null
    const shopeePathIds = parsed.pathname.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)/i)
    const shopeeQueryShopId = originalParsed.searchParams.get('shopid')
    const shopeeQueryItemId = originalParsed.searchParams.get('itemid')
    const shopeeId = shopeePathIds
      ? shopeePathIds.slice(1, 3).join(':')
      : shopeeQueryShopId && shopeeQueryItemId
        ? `${shopeeQueryShopId}:${shopeeQueryItemId}`
        : null
    const itemId = mercadoLivreId || shopeeId || mercadoLivreCatalogId
    const slug = rawSlug
      .replace(/_JM$/i, '')
      .replace(/^MLB-?\d+-?/i, '')
      .replace(/^MLB\s*\d+\s*/i, '')
      .replace(/-i\.\d+\.\d+$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      marketplace,
      slug,
      itemId,
      catalogItemId: mercadoLivreCatalogId,
      originalUrl: sanitized.originalUrl,
      canonicalUrl: sanitized.canonicalUrl,
      removedParams: sanitized.removedParams,
      hasVariation: sanitized.hasVariation,
    }
  } catch {
    return {
      marketplace: null,
      slug: '',
      itemId: null,
      originalUrl: url,
      canonicalUrl: url,
      removedParams: [],
      hasVariation: false,
    }
  }
}
