const EXTERNAL_URL_KEYS = new Set([
  'url',
  'link',
  'productUrl',
  'product_url',
  'originalUrl',
  'original_url',
  'originalLink',
  'canonicalUrl',
  'canonical_url',
  'cancelUrl',
  'website_url',
])

const IMAGE_URL_KEYS = new Set([
  'imageUrl',
  'image_url',
  'avatar_url',
  'avatarUrl',
  'image',
  'src',
])

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value)
}

function parseUrl(value, allowedProtocols) {
  const raw = String(value || '').trim()
  if (!raw || hasControlCharacters(raw)) return ''
  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith('www.')
      ? `https://${raw}`
      : raw

  try {
    const url = new URL(withProtocol)
    return allowedProtocols.includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function normalizeExternalUrl(value) {
  return parseUrl(value, ['http:', 'https:'])
}

export function normalizeImageUrl(value) {
  return parseUrl(value, ['http:', 'https:', 'blob:'])
}

export function firstSafeExternalUrl(...values) {
  for (const value of values) {
    const url = normalizeExternalUrl(value)
    if (url) return url
  }
  return ''
}

export function sanitizeExternalUrlFields(value) {
  if (Array.isArray(value)) return value.map(sanitizeExternalUrlFields)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (IMAGE_URL_KEYS.has(key)) return [key, normalizeImageUrl(entry)]
    if (EXTERNAL_URL_KEYS.has(key)) return [key, normalizeExternalUrl(entry)]
    return [key, sanitizeExternalUrlFields(entry)]
  }))
}
