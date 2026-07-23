import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { extractProductHtmlMetadata } from '../_shared/product-url.ts'
import {
  assertProductIdentityMatch,
  canonicalizeProductUrl,
  extractProductUrls,
  type CanonicalProductIdentity,
} from '../_shared/products/canonicalizeProductUrl.ts'
import { logSystemEvent } from '../_shared/observability/logger.js'

type FinanceStateRow = {
  id: string
  family_id: string
  user_id: string
  data: Record<string, unknown>
}

const KNOWN_PRODUCTS: Record<string, Partial<CanonicalProductIdentity>> = {
  'amazon:B0B3BHT71L': {
    title: 'Blend Cleaner Black 500ml Vonixx',
    brand: 'Vonixx',
    category: 'Automotivo',
  },
  'mercadolivre:MLB45334587': {
    title: 'Lavadora de alta pressao Gradiente Deep Aqua Jet 1500W',
    brand: 'Gradiente',
    category: 'Casa',
  },
}

function restHeaders(token: string) {
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  return {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

async function loadFinanceState(userId: string, token: string): Promise<FinanceStateRow | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('SUPABASE_URL ausente.')

  const response = await fetch(
    `${supabaseUrl}/rest/v1/finance_states?select=id,family_id,user_id,data&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: restHeaders(token) },
  )
  const data = await readJson(response)
  if (!response.ok) {
    throw new Error(`finance_states select failed ${response.status}: ${JSON.stringify(data)}`)
  }
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return null
  if (row.user_id !== userId) throw new Error('finance_states user mismatch')
  return row
}

async function saveFinanceState(row: FinanceStateRow, token: string, data: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('SUPABASE_URL ausente.')

  const response = await fetch(
    `${supabaseUrl}/rest/v1/finance_states?id=eq.${encodeURIComponent(row.id)}&user_id=eq.${encodeURIComponent(row.user_id)}&select=id,data`,
    {
      method: 'PATCH',
      headers: {
        ...restHeaders(token),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ data }),
    },
  )
  const payload = await readJson(response)
  if (!response.ok) {
    throw new Error(`finance_states update failed ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload?.[0] || null
}

async function upsertProductIdentity(userId: string, token: string, identity: CanonicalProductIdentity) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('SUPABASE_URL ausente.')
  const response = await fetch(`${supabaseUrl}/rest/v1/product_identities?on_conflict=user_id,source,source_product_id&select=*`, {
    method: 'POST',
    headers: {
      ...restHeaders(token),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      source: identity.source,
      source_product_id: identity.source_product_id,
      id_type: identity.id_type,
      canonical_url: identity.canonical_url,
      title: identity.title || null,
      brand: identity.brand || null,
      category: identity.category || null,
      image_url: identity.image_url || null,
      identity_source: 'url',
      identity_confidence: 1,
      raw_url: identity.raw_url,
      metadata: {
        removed_params: identity.removed_params,
        marketplace: identity.marketplace,
      },
      updated_at: new Date().toISOString(),
    }),
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new Error(`product_identities upsert failed ${response.status}: ${JSON.stringify(payload)}`)
  }
  return Array.isArray(payload) ? payload[0] : payload
}

function identityKey(identity: CanonicalProductIdentity) {
  return `${identity.source}:${identity.source_product_id}`.toLowerCase()
}

function isKnownShortProductUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host === 'a.co' || host === 'amzn.to'
  } catch {
    return false
  }
}

async function resolveProductUrl(url: string) {
  if (!isKnownShortProductUrl(url)) return url
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(9000),
    })
    return response.url || url
  } catch {
    return url
  }
}

async function enrichMetadata(identity: CanonicalProductIdentity): Promise<CanonicalProductIdentity> {
  const known = KNOWN_PRODUCTS[identityKey(identity)] || {}
  let metadata: Record<string, unknown> = {}

  try {
    const response = await fetch(identity.canonical_url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(9000),
    })
    if (response.ok) {
      metadata = extractProductHtmlMetadata(await response.text()) as Record<string, unknown>
    }
  } catch {
    // Metadata is best-effort. The canonical marketplace id remains the source of truth.
  }

  const enriched = {
    ...identity,
    title: String(known.title || metadata.name || identity.title || `${identity.marketplace} ${identity.source_product_id}`),
    image_url: String(known.image_url || metadata.imageUrl || identity.image_url || ''),
    imageUrl: String(known.imageUrl || metadata.imageUrl || identity.imageUrl || ''),
    brand: String(known.brand || metadata.brand || identity.brand || ''),
    category: String(known.category || identity.category || ''),
  }
  try {
    assertProductIdentityMatch(identity, {
      source: identity.source,
      source_product_id: identity.source_product_id,
      title: enriched.title,
      name: enriched.title,
      canonical_url: identity.canonical_url,
    })
    return enriched
  } catch {
    return {
      ...identity,
      title: identity.title || `${identity.marketplace} ${identity.source_product_id}`,
      image_url: identity.image_url || '',
      imageUrl: identity.imageUrl || '',
      brand: identity.brand || '',
      category: identity.category || '',
      metadata_status: 'product_identity_metadata_unconfirmed',
    }
  }
}

function parseOptionalPrice(value: unknown) {
  const parsed = Number(String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function buildWishlistItem(input: {
  identity: CanonicalProductIdentity
  productIdentityId: string
  body: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const identity = input.identity
  const metadataStatus = String((identity as CanonicalProductIdentity & { metadata_status?: string }).metadata_status || '')
  const productIdentity = {
    source: identity.source,
    source_product_id: identity.source_product_id,
    id_type: identity.id_type,
    canonical_url: identity.canonical_url,
    title: identity.title,
    brand: identity.brand,
    category: identity.category,
    identity_source: 'url',
    identity_confidence: 1,
    match_policy: 'url_exact',
  }

  return {
    id: crypto.randomUUID(),
    name: identity.title || `${identity.marketplace} ${identity.source_product_id}`,
    description: String(input.body.description || input.body.notes || ''),
    notes: String(input.body.notes || ''),
    value: null,
    targetPrice: parseOptionalPrice(input.body.targetPrice || input.body.desired_price),
    priority: String(input.body.priority || 'Media'),
    category: String(input.body.category || identity.category || 'Outros'),
    desiredDate: String(input.body.desiredDate || ''),
    marketplace: identity.marketplace,
    brand: identity.brand || '',
    model: '',
    attributes: {},
    imageUrl: identity.image_url || identity.imageUrl || '',
    originalLink: identity.raw_url,
    originalUrl: identity.raw_url,
    canonicalUrl: identity.canonical_url,
    canonical_url: identity.canonical_url,
    marketplaceItemId: identity.source_product_id,
    marketplace_item_id: identity.source_product_id,
    source: identity.source,
    source_product_id: identity.source_product_id,
    id_type: identity.id_type,
    product_identity_id: input.productIdentityId,
    identity_locked: true,
    identity_status: 'confirmed',
    identity_source: 'url',
    product_identity: productIdentity,
    priceStatus: 'pending_quote',
    priceMode: 'pending_quote',
    price_search_status: 'quote_pending',
    priceSummary: { status: 'pending_quote', offerCount: 0 },
    priceDiagnostics: metadataStatus === 'product_identity_metadata_unconfirmed'
      ? ['product-from-url:metadata-unconfirmed']
      : [],
    marketplaceOffers: [],
    accepted_candidates: [],
    ambiguous_candidates: [],
    last_rejected_candidates: [],
    best_compatible_offer: null,
    last_match_score: 0,
    last_match_reason: 'Produto travado pelo link informado. Aguardando preco do mesmo item.',
    monitorPrice: true,
    origin_label: 'Link do produto',
    created_at: now,
    updated_at: now,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido' }, 405)

  try {
    const auth = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)

    const input = String(body.url || body.link || body.input || body.text || '').trim()
    const urls = extractProductUrls(input)
    await logSystemEvent({
      userId: auth.user.id,
      source: 'edge_function',
      functionName: 'product-from-url',
      eventType: 'product_url_received',
      status: urls.length ? 'success' : 'blocked',
      metadata: { url_count: urls.length },
    })

    if (!urls.length) {
      return jsonResponse({
        error: 'product_url_required',
        code: 'PRODUCT_URL_REQUIRED',
        message: 'Cole um link de produto para adicionar.',
      }, 422)
    }

    if (urls.length > 1) {
      const resolvedUrls = await Promise.all(urls.map((url) => resolveProductUrl(url)))
      const choices = resolvedUrls.map((url) => canonicalizeProductUrl(url))
      await logSystemEvent({
        userId: auth.user.id,
        source: 'edge_function',
        functionName: 'product-from-url',
        eventType: 'multiple_product_urls_detected',
        status: 'blocked',
        metadata: { url_count: urls.length },
      })
      return jsonResponse({
        status: 'multiple_urls_detected',
        code: 'MULTIPLE_PRODUCT_URLS_DETECTED',
        message: 'Encontramos mais de um link. Escolha qual produto adicionar ou adicione todos separadamente.',
        urls: choices.map((choice, index) => ({
          index,
          ok: choice.ok,
          source: choice.ok ? choice.source : null,
          source_product_id: choice.ok ? choice.source_product_id : null,
          id_type: choice.ok ? choice.id_type : null,
          canonical_url: choice.ok ? choice.canonical_url : null,
          message: choice.ok ? null : choice.message,
        })),
      }, 409)
    }

    const resolvedUrl = await resolveProductUrl(urls[0])
    const canonical = canonicalizeProductUrl(resolvedUrl)
    if (!canonical.ok) {
      return jsonResponse({ error: canonical.message, code: canonical.code }, 422)
    }

    await logSystemEvent({
      userId: auth.user.id,
      source: 'edge_function',
      functionName: 'product-from-url',
      eventType: 'product_url_canonicalized',
      status: 'success',
      metadata: {
        source: canonical.source,
        source_product_id: canonical.source_product_id,
        id_type: canonical.id_type,
      },
    })

    const row = await loadFinanceState(auth.user.id, auth.token)
    if (!row) {
      return jsonResponse({
        error: 'finance_state_not_found',
        message: 'Estado financeiro do usuario nao encontrado.',
      }, 404)
    }

    const identity = await enrichMetadata(canonical)
    const productIdentity = await upsertProductIdentity(auth.user.id, auth.token, identity)
    await logSystemEvent({
      userId: auth.user.id,
      familyId: row.family_id,
      source: 'edge_function',
      functionName: 'product-from-url',
      eventType: 'product_identity_created',
      entityType: 'product_identity',
      entityId: productIdentity?.id || null,
      status: 'success',
      metadata: {
        source: identity.source,
        source_product_id: identity.source_product_id,
        id_type: identity.id_type,
      },
    })

    const currentData = row.data && typeof row.data === 'object' ? row.data : {}
    const wishlist = Array.isArray(currentData.wishlist) ? [...currentData.wishlist] : []
    const item = buildWishlistItem({
      identity,
      productIdentityId: String(productIdentity?.id || ''),
      body,
    })
    const nextData = {
      ...currentData,
      wishlist: [...wishlist, item],
    }
    await saveFinanceState(row, auth.token, nextData)

    await logSystemEvent({
      userId: auth.user.id,
      familyId: row.family_id,
      source: 'edge_function',
      functionName: 'product-from-url',
      eventType: 'wishlist_item_created_from_url',
      entityType: 'wishlist_item',
      entityId: item.id,
      status: 'success',
      metadata: {
        source: identity.source,
        source_product_id: identity.source_product_id,
        identity_locked: true,
      },
    })

    return jsonResponse({
      status: 'created',
      user_id_source: 'jwt',
      identity_locked: true,
      product_identity: item.product_identity,
      identity,
      item,
    })
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return jsonResponse({ error: authError.message, code: authError.code }, authError.status)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return jsonResponse({ error: 'Erro ao adicionar produto por link.', details: message }, 500)
  }
})
