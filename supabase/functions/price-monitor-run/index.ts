import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { searchLiveMarketplaces } from '../_shared/marketplace-search.ts'
import {
  buildPriceMonitorResult,
  isWishlistItemMonitorable,
  type WishlistMonitorItem,
} from '../_shared/price-monitor.ts'

type FinanceStateRow = {
  family_id: string
  user_id: string
  data: { wishlist?: WishlistMonitorItem[] }
}

function serviceConfig() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Configuracao administrativa do Supabase indisponivel')
  return { url, key }
}

async function serviceRequest(path: string, init: RequestInit = {}) {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(data?.message || data?.error || `PostgREST ${response.status}`)
  return data
}

async function configureSchedule() {
  const { url, key } = serviceConfig()
  return serviceRequest('rpc/configure_price_monitor_schedule', {
    method: 'POST',
    body: JSON.stringify({
      p_project_url: url,
      p_service_role_key: key,
      p_schedule: '15 12 * * *',
    }),
  })
}

function hoursSince(value?: string): number {
  const timestamp = new Date(value || 0).getTime()
  return Number.isFinite(timestamp) ? (Date.now() - timestamp) / 3600000 : Infinity
}

async function applyResult(familyId: string, userId: string, itemId: string, result: unknown) {
  return serviceRequest('rpc/apply_wishlist_price_monitor_result', {
    method: 'POST',
    body: JSON.stringify({ p_family_id: familyId, p_user_id: userId, p_item_id: itemId, p_result: result }),
  })
}

async function runMonitor(limit = 12) {
  const rows = await serviceRequest('finance_states?select=family_id,user_id,data&order=updated_at.asc') as FinanceStateRow[]
  const tasks = rows
    .flatMap((row) => (row.data?.wishlist || []).map((item) => ({ familyId: row.family_id, userId: row.user_id, item })))
    .filter(({ userId }) => Boolean(userId))
    .filter(({ item }) => isWishlistItemMonitorable(item) && hoursSince((item as any).priceMonitorCheckedAt) >= 20)
    .sort((a, b) => hoursSince((b.item as any).priceMonitorCheckedAt) - hoursSince((a.item as any).priceMonitorCheckedAt))
    .slice(0, Math.min(Math.max(1, limit), 20))

  const summary = { selected: tasks.length, quoted: 0, pending: 0, alerts: 0, failed: 0 }

  for (let index = 0; index < tasks.length; index += 2) {
    const batch = tasks.slice(index, index + 2)
    await Promise.all(batch.map(async ({ familyId, userId, item }) => {
      const checkedAt = new Date().toISOString()
      try {
        const search = await searchLiveMarketplaces({
          query: [item.name, item.brand, item.model].filter(Boolean).join(' '),
          nome: item.name,
          marca: item.brand,
          modelo: item.model,
          marketplace: item.marketplace,
          marketplaceItemId: item.marketplaceItemId,
          originalLink: item.canonicalUrl || item.originalLink,
        })
        const result = buildPriceMonitorResult(item, search, checkedAt)
        await applyResult(familyId, userId, String(item.id), result)
        if (result.status === 'quoted') summary.quoted += 1
        else summary.pending += 1
        if (result.alert) summary.alerts += 1
      } catch (error) {
        summary.failed += 1
        await applyResult(familyId, userId, String(item.id), {
          checkedAt,
          status: 'pending_quote',
          diagnostics: ['monitor:run-error', error instanceof Error ? error.message : 'unknown'],
        }).catch(() => undefined)
      }
    }))
  }

  return { ...summary, finishedAt: new Date().toISOString() }
}

function isServiceRoleRequest(req: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return Boolean(key && req.headers.get('authorization') === `Bearer ${key}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Metodo nao permitido', 405)

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'run')

    if (action === 'configure') {
      await requireAuthenticatedUser(req)
      return jsonResponse({ configured: true, schedule: await configureSchedule() })
    }

    if (!isServiceRoleRequest(req)) return errorResponse('Execucao reservada ao agendador', 403)

    return jsonResponse(await runMonitor(Number(body.limit || 12)))
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    return errorResponse(
      'Falha no monitoramento de precos',
      500,
      error instanceof Error ? error.message : 'Erro desconhecido',
    )
  }
})
