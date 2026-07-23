import { searchDataForSeoGoogleShopping } from './dataforseo.ts'
import { searchValueSerpGoogleShopping } from './valueserp.ts'
import type { PriceProviderName, PriceProviderOptions, PriceProviderResult } from './types.ts'

export type {
  PriceCandidate,
  PriceProviderName,
  PriceProviderOptions,
  PriceProviderResult,
} from './types.ts'

export function configuredPriceProvider(): PriceProviderName {
  const value = Deno.env.get('PRICE_SEARCH_PROVIDER') || 'valueserp_google_shopping'
  return value === 'dataforseo_google_shopping' ? value : 'valueserp_google_shopping'
}

export async function searchPriceProvider(
  provider: PriceProviderName,
  options: PriceProviderOptions,
): Promise<PriceProviderResult> {
  if (provider === 'dataforseo_google_shopping') return searchDataForSeoGoogleShopping(options)
  return searchValueSerpGoogleShopping(options)
}
