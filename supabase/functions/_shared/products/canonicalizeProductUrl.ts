const AMAZON_TRACKING_PARAMS = new Set([
  'pf_rd_r',
  'pf_rd_p',
  'sbo',
  'linkcode',
  'tag',
  'linkid',
  'ascsubtag',
  'btn_ref',
  'utm_source',
  'utm_medium',
  'utm_campaign',
])

const MERCADO_LIVRE_TRACKING_PARAMS = new Set([
  'matt_event_ts',
  'matt_d2id',
  'matt_tracing_id',
  'matt_tool_id',
  'reco_backend',
  'reco_client',
  'reco_item_pos',
  'source',
  'tracking_id',
  'c_id',
  'c_uid',
  'polycard_client',
  'reco_backend_type',
  'reco_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
])

const COMMON_TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
])

const MARKETPLACE_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
}

const PROTOCOLLESS_PRODUCT_DOMAIN_PATTERN = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"']*)?$/i
const GENERIC_PATH_SEGMENTS = new Set([
  'api',
  'auth',
  'catalog',
  'catalogo',
  'function',
  'functions',
  'gp',
  'item',
  'items',
  'loja',
  'p',
  'product',
  'products',
  'produto',
  'produtos',
  'rest',
  'shop',
  'store',
  'storage',
  'up',
])

export type CanonicalProductIdentity = {
  ok: true
  source: string
  canonical_url: string
  canonicalUrl: string
  source_product_id: string
  sourceProductId: string
  id_type: string
  idType: string
  marketplace: string
  title: string
  image_url: string
  imageUrl: string
  brand: string
  category: string
  identity_confidence: number
  identity_source: 'url'
  identity_status: 'confirmed'
  raw_url: string
  rawUrl: string
  removed_params: string[]
  removedParams: string[]
}

export type CanonicalProductError = {
  ok: false
  code: string
  message: string
  raw_url?: string
}

export class ProductIdentityMismatchError extends Error {
  code = 'PRODUCT_IDENTITY_MISMATCH_BLOCKED'
  status = 409

  constructor(message = 'Nao conseguimos confirmar que o anuncio encontrado e o mesmo produto do link informado.') {
    super(message)
    this.name = 'ProductIdentityMismatchError'
  }
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function compactUrlCandidate(value: string) {
  return String(value || '')
    .trim()
    .replace(/[)\].,;]+$/g, '')
}

export function extractProductUrls(input?: string | null): string[] {
  const text = String(input || '')
  const urls: string[] = []
  const starts = [...text.matchAll(/https?:\/\//gi)].map((match) => match.index).filter((index) => index != null) as number[]
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    const nextStart = starts[index + 1] ?? text.length
    const segment = text.slice(start, nextStart)
    const raw = compactUrlCandidate(segment.split(/[\s<>"']/)[0])
    if (raw) urls.push(raw)
  }

  for (const token of text.split(/[\s<>"']+/)) {
    const raw = compactUrlCandidate(token)
    if (!raw || /^https?:\/\//i.test(raw)) continue
    if (PROTOCOLLESS_PRODUCT_DOMAIN_PATTERN.test(raw)) urls.push(`https://${raw}`)
  }

  return [...new Set(urls)]
}

function removeParams(url: URL, blockedParams: Set<string>): string[] {
  const removedParams: string[] = []
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase()
    if (blockedParams.has(normalized) || normalized.startsWith('ref_')) {
      removedParams.push(key)
      url.searchParams.delete(key)
    }
  }
  url.hash = ''
  return removedParams
}

function normalizeGenericUrl(url: URL): string[] {
  const removedParams = removeParams(url, COMMON_TRACKING_PARAMS)
  url.hostname = url.hostname.toLowerCase()
  if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4)
  url.pathname = url.pathname.replace(/\/+$/g, '') || '/'
  const sortedParams = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) =>
    `${aKey}=${aValue}`.localeCompare(`${bKey}=${bValue}`),
  )
  url.search = ''
  for (const [key, value] of sortedParams) url.searchParams.append(key, value)
  return removedParams
}

function fnv1aHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

function marketplaceLabelForHost(host: string): string {
  const suffixes = new Set(['www', 'com', 'combr', 'br', 'net', 'org', 'co'])
  return host
    .split('.')
    .filter(Boolean)
    .filter((part) => !suffixes.has(part.toLowerCase()))
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Link externo'
}

function isTechnicalEndpoint(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname.toLowerCase()
  if (host.endsWith('.supabase.co') && /^\/(?:functions|rest|auth|storage)\/v\d+\b/.test(path)) return true
  if (/^\/(?:functions|api|rest|auth)\/v\d+\b/.test(path)) return true
  return false
}

export function extractAmazonAsin(input?: string | null): string {
  const raw = safeDecode(String(input || ''))
  const matches = [
    raw.match(/\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i),
    raw.match(/[?&](?:asin|ASIN)=([A-Z0-9]{10})(?:&|$)/),
    raw.match(/\b(B0[A-Z0-9]{8}|[A-Z0-9]{10})\b/),
  ]
  const value = matches.find(Boolean)?.[1]
  return value ? value.toUpperCase() : ''
}

export function extractMercadoLivreProductId(input?: string | null): { source_product_id: string; id_type: string } | null {
  const raw = safeDecode(String(input || ''))
  const catalog = raw.match(/(?:^|\/)(MLB\d{6,}|MLBU\d{6,})(?:[/?#]|$)/i)
  if (catalog) {
    const id = catalog[1].toUpperCase()
    return {
      source_product_id: id,
      id_type: id.startsWith('MLBU') ? 'catalog_item_id' : 'catalog_product_id',
    }
  }

  const pdpFilter = raw.match(/pdp_filters=[^#&]*item_id[:%3A]+(MLB-?\d+)/i)
  const item = pdpFilter || raw.match(/(?:^|[^A-Z0-9])(MLB)-?(\d+)(?=$|[-/?#&:_\s])/i)
  if (item) {
    const id = pdpFilter
      ? pdpFilter[1].replace('-', '').toUpperCase()
      : `${item[1].toUpperCase()}${item[2]}`
    return {
      source_product_id: id,
      id_type: 'item_id',
    }
  }

  return null
}

function titleFromPath(pathname: string) {
  const segment = pathname
    .split('/')
    .filter(Boolean)
    .find((part) => {
      const normalized = safeDecode(part)
        .replace(/_JM$/i, '')
        .replace(/^MLB-?\d+-?/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const key = normalized.toLowerCase().replace(/\s+/g, '')
      return normalized
        && !GENERIC_PATH_SEGMENTS.has(key)
        && !/^v\d+$/i.test(key)
        && !/^(dp|MLB-?\d+|MLBU\d+)$/i.test(key)
        && /[a-z]/i.test(normalized)
    }) || ''
  return safeDecode(segment)
    .replace(/_JM$/i, '')
    .replace(/^MLB-?\d+-?/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function baseIdentity(input: {
  source: string
  canonicalUrl: string
  sourceProductId: string
  idType: string
  rawUrl: string
  removedParams: string[]
  parsed: URL
}): CanonicalProductIdentity {
  return {
    ok: true,
    source: input.source,
    canonical_url: input.canonicalUrl,
    canonicalUrl: input.canonicalUrl,
    source_product_id: input.sourceProductId,
    sourceProductId: input.sourceProductId,
    id_type: input.idType,
    idType: input.idType,
    marketplace: MARKETPLACE_LABELS[input.source] || input.source,
    title: titleFromPath(input.parsed.pathname),
    image_url: '',
    imageUrl: '',
    brand: '',
    category: '',
    identity_confidence: 1,
    identity_source: 'url',
    identity_status: 'confirmed',
    raw_url: input.rawUrl,
    rawUrl: input.rawUrl,
    removed_params: input.removedParams,
    removedParams: input.removedParams,
  }
}

export function canonicalizeProductUrl(input?: string | null): CanonicalProductIdentity | CanonicalProductError {
  const rawUrl = extractProductUrls(input)[0] || String(input || '').trim()
  if (!rawUrl) {
    return {
      ok: false,
      code: 'PRODUCT_URL_EMPTY',
      message: 'Informe um link de produto.',
    }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      ok: false,
      code: 'PRODUCT_URL_INVALID',
      message: 'Link de produto invalido.',
      raw_url: rawUrl,
    }
  }
  if (isTechnicalEndpoint(parsed)) {
    return {
      ok: false,
      code: 'PRODUCT_URL_TECHNICAL_ENDPOINT',
      message: 'Cole o link da pagina do produto, nao um endpoint tecnico do sistema.',
      raw_url: rawUrl,
    }
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')

  if (host.includes('amazon.com.br') || host.includes('amazon.com')) {
    const asin = extractAmazonAsin(rawUrl)
    if (!asin) {
      return {
        ok: false,
        code: 'AMAZON_ASIN_NOT_FOUND',
        message: 'Nao foi possivel identificar o ASIN do produto Amazon.',
        raw_url: rawUrl,
      }
    }
    const removedParams = removeParams(parsed, AMAZON_TRACKING_PARAMS)
    const canonicalUrl = `https://www.amazon.com.br/dp/${asin}`
    return baseIdentity({
      source: 'amazon',
      canonicalUrl,
      sourceProductId: asin,
      idType: 'asin',
      rawUrl,
      removedParams,
      parsed,
    })
  }

  if (host.includes('mercadolivre.com.br') || host.includes('mercadolibre.com')) {
    const identity = extractMercadoLivreProductId(rawUrl)
    if (!identity?.source_product_id) {
      return {
        ok: false,
        code: 'MERCADO_LIVRE_ID_NOT_FOUND',
        message: 'Nao foi possivel identificar o produto do Mercado Livre.',
        raw_url: rawUrl,
      }
    }
    const removedParams = removeParams(parsed, MERCADO_LIVRE_TRACKING_PARAMS)
    const id = identity.source_product_id
    const canonicalUrl = identity.id_type === 'catalog_product_id'
      ? `https://www.mercadolivre.com.br/p/${id}`
      : identity.id_type === 'catalog_item_id'
        ? `https://www.mercadolivre.com.br/${id}`
        : `https://produto.mercadolivre.com.br/${id.replace(/^MLB/, 'MLB-')}`
    return baseIdentity({
      source: 'mercadolivre',
      canonicalUrl,
      sourceProductId: id,
      idType: identity.id_type,
      rawUrl,
      removedParams,
      parsed,
    })
  }

  const removedParams = normalizeGenericUrl(parsed)
  const canonicalUrl = parsed.toString()
  const source = parsed.hostname.toLowerCase()
  return {
    ...baseIdentity({
      source,
      canonicalUrl,
      sourceProductId: `URL_${fnv1aHash(canonicalUrl)}`,
      idType: 'canonical_url_hash',
      rawUrl,
      removedParams,
      parsed,
    }),
    marketplace: MARKETPLACE_LABELS[source] || marketplaceLabelForHost(source),
    title: titleFromPath(parsed.pathname) || source,
  }
}

export function productCacheKey(identity: Record<string, unknown> | null | undefined): string {
  const source = String(identity?.source || '').toLowerCase().trim()
  const sourceProductId = String(identity?.source_product_id || identity?.sourceProductId || '').toUpperCase().trim()
  if (!source || !sourceProductId) return ''
  return `${source}:${sourceProductId}`
}

function meaningfulTokens(value?: string | null): string[] {
  const ignored = new Set(['para', 'com', 'sem', 'original', 'novo', 'nova', 'peca', 'produto', 'anuncio', 'loja'])
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !ignored.has(token) && !/^\d{4}$/.test(token)) || []
}

function titleLooksCompatible(expectedTitle?: string | null, candidateTitle?: string | null): boolean {
  const expected = [...new Set(meaningfulTokens(expectedTitle))]
  const candidate = new Set(meaningfulTokens(candidateTitle))
  if (!expected.length || !candidate.size) return true
  const overlap = expected.filter((token) => candidate.has(token)).length
  return overlap >= (expected.length >= 3 ? 2 : 1) && overlap / expected.length >= 0.25
}

function identityFromCandidate(candidate: Record<string, unknown> | null | undefined) {
  if (!candidate) return null
  const explicitSource = candidate.source || candidate.product_source || candidate.marketplace_source
  const explicitId = candidate.source_product_id || candidate.sourceProductId
  if (explicitSource && explicitId) {
    return {
      source: String(explicitSource).toLowerCase(),
      source_product_id: String(explicitId).toUpperCase(),
    }
  }

  const url = candidate.canonical_url || candidate.canonicalUrl || candidate.url || candidate.link || candidate.originalLink || ''
  const canonical = canonicalizeProductUrl(String(url || ''))
  if (canonical.ok) {
    return {
      source: canonical.source,
      source_product_id: canonical.source_product_id,
    }
  }

  return null
}

export function assertProductIdentityMatch(
  inputIdentity: Record<string, unknown> | null | undefined,
  extractedProduct: Record<string, unknown> | null | undefined,
): true {
  const expectedSource = String(inputIdentity?.source || '').toLowerCase().trim()
  const expectedId = String(inputIdentity?.source_product_id || inputIdentity?.sourceProductId || '').toUpperCase().trim()
  if (!expectedSource || !expectedId) {
    throw new ProductIdentityMismatchError('Identidade do produto incompleta para validar o link informado.')
  }

  const candidateIdentity = identityFromCandidate(extractedProduct)
  if (!candidateIdentity?.source_product_id) {
    throw new ProductIdentityMismatchError()
  }
  if (candidateIdentity.source && candidateIdentity.source !== expectedSource) {
    throw new ProductIdentityMismatchError()
  }
  if (candidateIdentity.source_product_id !== expectedId) {
    throw new ProductIdentityMismatchError()
  }

  const expectedTitle = String(inputIdentity?.title || inputIdentity?.name || '')
  const candidateTitle = String(extractedProduct?.title || extractedProduct?.name || '')
  const expectedTitleIsOnlyId = meaningfulTokens(expectedTitle).length === 1 && expectedTitle.toUpperCase().includes(expectedId)
  if (!expectedTitleIsOnlyId && !titleLooksCompatible(expectedTitle, candidateTitle)) {
    throw new ProductIdentityMismatchError()
  }

  return true
}

export function classifyProductCandidateForIdentity(
  identity: Record<string, unknown> | null | undefined,
  candidate: Record<string, unknown> | null | undefined,
): 'exact' | 'similar' | 'rejected' {
  try {
    assertProductIdentityMatch(identity, candidate)
    return 'exact'
  } catch {
    const expectedSource = String(identity?.source || '').toLowerCase()
    const candidateIdentity = identityFromCandidate(candidate)
    if (candidateIdentity?.source && candidateIdentity.source === expectedSource) return 'similar'
    return 'rejected'
  }
}
