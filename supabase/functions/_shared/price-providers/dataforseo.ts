import type { PriceProviderOptions, PriceProviderResult } from './types.ts'

export async function searchDataForSeoGoogleShopping(options: PriceProviderOptions): Promise<PriceProviderResult> {
  return {
    provider: 'dataforseo_google_shopping',
    query: String(options.query || '').trim(),
    raw_count: 0,
    candidates: [],
    provider_task_id: null,
  }
}
