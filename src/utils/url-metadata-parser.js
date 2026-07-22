/**
 * URL Metadata Parser
 * Extracts product information from marketplace URLs using OpenGraph and JSON-LD
 */

const MARKETPLACE_PATTERNS = {
  'mercadolivre.com.br': 'Mercado Livre',
  'amazon.com.br': 'Amazon',
  'shopee.com.br': 'Shopee',
  'magazineluiza.com.br': 'Magazine Luiza',
  'kabum.com.br': 'Kabum',
  'pichau.com.br': 'Pichau',
  'casasbahia.com.br': 'Casas Bahia',
  'americanas.com.br': 'Americanas',
}

/**
 * Identifies the marketplace from a URL
 */
export function identifyMarketplace(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    for (const [pattern, name] of Object.entries(MARKETPLACE_PATTERNS)) {
      if (host.includes(pattern)) {
        return name
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extracts product slug from URL
 */
export function extractSlug(url) {
  try {
    const parsed = new URL(url)
    const slug = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/[-_]/g, ' ')
      .trim()
    return slug
  } catch {
    return ''
  }
}

/**
 * Simulates OpenGraph/JSON-LD metadata extraction
 * In production, this would fetch the page and parse actual metadata
 * For now, it returns a structured object based on URL analysis
 */
export async function extractUrlMetadata(url) {
  const marketplace = identifyMarketplace(url)
  const slug = extractSlug(url)

  if (!marketplace) {
    throw new Error('Marketplace não identificado')
  }

  if (!slug) {
    throw new Error('Não foi possível extrair informações do produto')
  }

  // In production, this would:
  // 1. Fetch the HTML page
  // 2. Parse OpenGraph meta tags (og:title, og:image, og:description, product:price:amount)
  // 3. Parse JSON-LD structured data
  // 4. Extract product schema information

  // For now, return structured data based on URL parsing
  return {
    title: slug,
    price: null, // Would be extracted from OpenGraph in production
    brand: null, // Would be extracted from JSON-LD in production
    image: null, // Would be extracted from og:image in production
    marketplace,
    source: 'url',
    confidence: 0.7, // Lower confidence without actual metadata
  }
}

/**
 * Validates extracted metadata
 */
export function validateMetadata(metadata) {
  if (!metadata.title || metadata.title.length < 3) {
    return { valid: false, reason: 'Nome do produto inválido' }
  }

  // Price is optional from URL - will be fetched from marketplace
  return { valid: true }
}
