import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, rejectIdentityOverride, requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  normalizeProductDescription,
  ProductDescriptionError,
} from '../_shared/product-identity/normalizer.ts'

type FinanceStateRow = {
  id: string
  family_id: string
  user_id: string
  data: Record<string, unknown>
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

async function runPriceSearch(token: string, body: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !apiKey) throw new Error('Configuracao de price-search indisponivel.')

  const response = await fetch(`${supabaseUrl}/functions/v1/price-search`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return {
    ok: response.ok,
    status: response.status,
    data: await readJson(response),
  }
}

function mergeItemWithPriceResult(item: Record<string, unknown>, result: Record<string, unknown> | null) {
  if (!result) return item
  const best = result.best_compatible_offer || null
  const metadata = result.metadata && typeof result.metadata === 'object' ? result.metadata as Record<string, unknown> : {}
  const price = Number((best as any)?.total || (best as any)?.totalPrice || (best as any)?.price || 0)
  const foundCompatible = (result.status === 'found_compatible' || result.status === 'found_exact') && price > 0
  return {
    ...item,
    name: foundCompatible
      ? String((best as any)?.title || metadata.name || item.name || '')
      : String(metadata.name || item.name || ''),
    value: foundCompatible ? price : item.value || null,
    imageUrl: String((best as any)?.imageUrl || (best as any)?.image || metadata.imageUrl || item.imageUrl || ''),
    marketplace: String((best as any)?.marketplace || metadata.marketplace || item.marketplace || ''),
    priceStatus: foundCompatible ? 'quoted' : 'pending_quote',
    priceMode: result.source || result.provider ? 'live' : 'unavailable',
    price_search_status: result.status || 'quote_pending',
    marketplaceOffers: result.offers || result.accepted_candidates || [],
    best_compatible_offer: foundCompatible ? best : null,
    accepted_candidates: result.accepted_candidates || [],
    ambiguous_candidates: result.ambiguous_candidates || [],
    last_rejected_candidates: result.rejected_candidates || [],
    last_match_score: Number((best as any)?.match_score || (best as any)?.match?.score || 0),
    last_match_reason: String((best as any)?.match_reason || (best as any)?.match?.reason || result.message || ''),
    priceSummary: result.summary || null,
    priceDiagnostics: result.diagnostics || [],
    sourcesUsed: result.sourcesUsed || [],
    priceFetchedAt: new Date().toISOString(),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido' }, 405)

  try {
    const auth = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    rejectIdentityOverride(body)

    const description = body.description ?? body.descricao ?? body.query
    const normalized = normalizeProductDescription(description)
    if (normalized.needs_clarification) {
      return jsonResponse({
        status: 'needs_clarification',
        ...normalized,
      }, 422)
    }

    const row = await loadFinanceState(auth.user.id, auth.token)
    if (!row) {
      return jsonResponse({
        error: 'finance_state_not_found',
        message: 'Estado financeiro do usuario nao encontrado.',
      }, 404)
    }

    const currentData = row.data && typeof row.data === 'object' ? row.data : {}
    const wishlist = Array.isArray(currentData.wishlist) ? [...currentData.wishlist] : []
    const now = new Date().toISOString()
    const item = {
      id: crypto.randomUUID(),
      name: normalized.normalized_query,
      description: normalized.raw_description,
      value: null,
      targetPrice: Number(body.desired_price || body.targetPrice || 0) > 0
        ? Number(body.desired_price || body.targetPrice)
        : null,
      priority: 'Media',
      category: 'Outros',
      priceStatus: 'pending_quote',
      priceMode: 'pending_quote',
      price_search_status: 'quote_pending',
      product_identity: normalized.product_identity,
      monitorPrice: true,
      source: 'description',
      created_at: now,
      updated_at: now,
    }
    const priceSearch = await runPriceSearch(auth.token, {
      query: normalized.normalized_query,
      product_identity: normalized.product_identity,
      desired_price: body.desired_price,
    })

    const updatedItem = mergeItemWithPriceResult(item, priceSearch.ok ? priceSearch.data : {
      status: 'price_search_error',
      diagnostics: [`price-search:${priceSearch.status}`],
    })
    const nextData = {
      ...currentData,
      wishlist: [...wishlist, updatedItem],
    }
    await saveFinanceState(row, auth.token, nextData)

    return jsonResponse({
      status: 'created',
      user_id_source: 'jwt',
      item: updatedItem,
      search: priceSearch.data,
      normalized,
    })
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return jsonResponse({ error: authError.message, code: authError.code }, authError.status)
    if (error instanceof ProductDescriptionError) {
      return jsonResponse({ error: error.message, code: error.code }, 422)
    }
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return jsonResponse({ error: 'Erro ao buscar produto por descricao.', details: message }, 500)
  }
})
