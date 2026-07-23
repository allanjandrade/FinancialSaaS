export type PriceProviderName =
  | 'valueserp_google_shopping'
  | 'dataforseo_google_shopping'

export type PriceCandidate = {
  title: string
  description?: string
  price: number | null
  currency?: string
  source: string
  seller?: string
  url?: string
  image_url?: string
  shipping_price?: number | null
  total_price?: number | null
  provider: PriceProviderName
  provider_raw_id?: string
  captured_at: string
}

export type PriceProviderResult = {
  provider: PriceProviderName
  query: string
  raw_count: number
  candidates: PriceCandidate[]
  provider_task_id?: string | null
}

export type PriceProviderOptions = {
  query: string
  location?: string
  languageCode?: string
}
