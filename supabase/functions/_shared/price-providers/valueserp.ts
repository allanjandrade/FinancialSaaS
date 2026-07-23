import type { PriceCandidate, PriceProviderOptions, PriceProviderResult } from './types.ts'

const PROVIDER = 'valueserp_google_shopping' as const

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  if (!value) return null
  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseShipping(value: unknown): number | null {
  const parsed = parsePrice(value)
  return parsed && parsed > 0 ? parsed : null
}

function candidateFromShoppingResult(item: any, capturedAt: string): PriceCandidate | null {
  const price = parsePrice(item?.extracted_price ?? item?.price)
  if (!price) return null
  const shipping = parseShipping(item?.shipping ?? item?.delivery ?? item?.extracted_shipping)
  const source = String(item?.source || item?.merchant || item?.seller || 'Google Shopping')
  return {
    title: String(item?.title || '').trim(),
    description: item?.snippet || item?.description || undefined,
    price,
    currency: item?.currency || 'BRL',
    source,
    seller: item?.merchant || item?.seller || source,
    url: item?.link || item?.product_link || item?.serpapi_product_api || '',
    image_url: item?.thumbnail || item?.image || '',
    shipping_price: shipping,
    total_price: price + (shipping || 0),
    provider: PROVIDER,
    provider_raw_id: item?.position != null ? String(item.position) : item?.product_id ? String(item.product_id) : undefined,
    captured_at: capturedAt,
  }
}

export async function searchValueSerpGoogleShopping(options: PriceProviderOptions): Promise<PriceProviderResult> {
  const query = String(options.query || '').trim()
  if (!query) {
    return { provider: PROVIDER, query, raw_count: 0, candidates: [] }
  }

  const apiKey = Deno.env.get('VALUE_SERP_API_KEY')?.trim()
  if (!apiKey) {
    throw new Error('VALUE_SERP_API_KEY_NOT_CONFIGURED')
  }

  const location = options.location || Deno.env.get('PRICE_SEARCH_LOCATION') || 'Brazil'
  const languageCode = options.languageCode || Deno.env.get('PRICE_SEARCH_LANGUAGE_CODE') || 'pt-br'
  const url = new URL('https://api.valueserp.com/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('q', query)
  url.searchParams.set('search_type', 'shopping')
  url.searchParams.set('location', location)
  url.searchParams.set('hl', languageCode)

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(18000) })
  if (!response.ok) {
    throw new Error(`VALUE_SERP_PROVIDER_ERROR_${response.status}`)
  }

  const payload = await response.json()
  const raw = Array.isArray(payload?.shopping_results)
    ? payload.shopping_results
    : Array.isArray(payload?.shopping_results?.items)
      ? payload.shopping_results.items
      : []
  const capturedAt = new Date().toISOString()
  const candidates = raw
    .map((item: any) => candidateFromShoppingResult(item, capturedAt))
    .filter(Boolean) as PriceCandidate[]

  return {
    provider: PROVIDER,
    query,
    raw_count: raw.length,
    candidates,
    provider_task_id: payload?.search_metadata?.id || payload?.request_info?.success ? String(payload?.search_metadata?.id || '') : null,
  }
}
