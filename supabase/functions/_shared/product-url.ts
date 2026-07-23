export type ProductHtmlMetadata = {
  name?: string
  value?: number
  imageUrl?: string
  brand?: string
  model?: string
  attributes?: Record<string, string>
  marketplaceItemId?: string
}

export function sanitizeProductUrl(input?: string | null): string {
  const value = String(input || '').trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

export function extractMercadoLivreItemId(input?: string | null): string | null {
  const raw = String(input || '')
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    // Keep the original value when a URL contains malformed escapes.
  }
  const match = value.match(/(?:^|[^A-Z0-9])MLB-?(\d+)(?=$|[-/?#&:_\s])/i)
  return match ? `MLB${match[1]}` : null
}

export function extractShopeeItemRef(input?: string | null): string | null {
  const text = String(input || '')
  const pathMatch = text.match(/(?:-i\.|\/product\/)(\d+)[./](\d+)/i)
  if (pathMatch) return `${pathMatch[1]}:${pathMatch[2]}`
  const compactMatch = text.match(/(?:^|\D)(\d+):(\d+)(?:$|\D)/)
  return compactMatch ? `${compactMatch[1]}:${compactMatch[2]}` : null
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

export function metaContent(html: string, key: string): string {
  const expected = key.toLowerCase()
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {}
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gi)) {
      attributes[match[1].toLowerCase()] = decodeHtml(match[3])
    }

    const metaKey = (attributes.property || attributes.name || '').toLowerCase()
    if (metaKey === expected) return attributes.content || ''
  }
  return ''
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function jsonLdObjects(html: string): any[] {
  const objects: any[] = []
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]))
      const values = Array.isArray(parsed) ? parsed : [parsed]
      for (const value of values) {
        objects.push(...(Array.isArray(value?.['@graph']) ? value['@graph'] : [value]))
      }
    } catch {
      // Invalid structured data must not prevent the Open Graph fallback.
    }
  }
  return objects
}

export function extractProductHtmlMetadata(html: string): ProductHtmlMetadata {
  const product = jsonLdObjects(html).find((entry) => {
    const type = entry?.['@type']
    return Array.isArray(type) ? type.includes('Product') : type === 'Product'
  })
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers
  const image = Array.isArray(product?.image) ? product.image[0] : product?.image
  const brand = typeof product?.brand === 'string' ? product.brand : product?.brand?.name
  const productUrl = metaContent(html, 'og:url') || product?.url || ''
  const marketplaceItemId = extractMercadoLivreItemId(productUrl || product?.productID || product?.sku)
  const attributes = Object.fromEntries(
    (Array.isArray(product?.additionalProperty) ? product.additionalProperty : [])
      .filter((entry: any) => entry?.name && entry?.value != null)
      .map((entry: any) => [String(entry.name), String(entry.value)]),
  )

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
  return {
    name: metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || product?.name || decodeHtml(titleTag) || undefined,
    value:
      positiveNumber(metaContent(html, 'og:price:amount')) ||
      positiveNumber(metaContent(html, 'product:price:amount')) ||
      positiveNumber(metaContent(html, 'price')) ||
      positiveNumber(offers?.price || offers?.lowPrice),
    imageUrl: metaContent(html, 'og:image') || metaContent(html, 'twitter:image') || image || undefined,
    brand: brand || undefined,
    model: product?.model || product?.mpn || undefined,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    marketplaceItemId: marketplaceItemId ? marketplaceItemId.replace(/^MLB/, 'MLB-') : undefined,
  }
}

export function matchesMercadoLivreItem(
  expectedItemId: string,
  ...candidates: Array<string | null | undefined>
): boolean {
  const expected = extractMercadoLivreItemId(expectedItemId)
  if (!expected) return false
  const discovered = candidates.map(extractMercadoLivreItemId).filter(Boolean)
  return discovered.length === 0 || discovered.every((itemId) => itemId === expected)
}

function identityTokens(value?: string | null): string[] {
  const ignored = new Set(['para', 'com', 'sem', 'original', 'novo', 'nova', 'peca', 'produto'])
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !ignored.has(token) && !/^\d{4}$/.test(token)) || []
}

export function productTitleMatches(expectedTitle?: string | null, candidateTitle?: string | null): boolean {
  const expected = [...new Set(identityTokens(expectedTitle))]
  const candidate = new Set(identityTokens(candidateTitle))
  if (!expected.length || !candidate.size) return false

  const overlap = expected.filter((token) => candidate.has(token)).length
  const requiredOverlap = expected.length >= 3 ? 2 : 1
  return overlap >= requiredOverlap && overlap / expected.length >= 0.3
}
