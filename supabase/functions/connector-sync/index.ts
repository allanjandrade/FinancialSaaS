import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'
import {
  isConnectorType,
  normalizeConnectorRecord,
} from '../_shared/connectors.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'

async function restRequest(path: string, token: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !apiKey) throw new Error('Supabase REST não configurado')
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `PostgREST ${response.status}`)
    Object.assign(error, { status: response.status, details: data })
    throw error
  }
  return data
}

async function registerConnector(body: Record<string, unknown>, token: string) {
  const familyId = String(body.familyId || '')
  const connectorType = String(body.connectorType || '')
  const provider = String(body.provider || '').trim()
  const externalAccountId = String(body.externalAccountId || 'default').trim()
  if (!familyId || !provider || !isConnectorType(connectorType)) {
    throw Object.assign(new Error('familyId, connectorType e provider são obrigatórios'), { status: 400 })
  }

  const rows = await restRequest(
    'connector_accounts?on_conflict=family_id,connector_type,provider,external_account_id',
    token,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{
        family_id: familyId,
        connector_type: connectorType,
        provider,
        external_account_id: externalAccountId,
        display_name: String(body.displayName || provider),
        status: String(body.status || 'pending'),
        scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : [],
        credential_secret_name: body.credentialSecretName ? String(body.credentialSecretName) : null,
        config: body.config && typeof body.config === 'object' ? body.config : {},
        updated_at: new Date().toISOString(),
      }]),
    },
  )
  return rows?.[0]
}

async function ingestRecords(body: Record<string, unknown>, token: string) {
  const accountId = String(body.accountId || '')
  const familyId = String(body.familyId || '')
  const records = Array.isArray(body.records) ? body.records : []
  const cursor = body.cursor == null ? null : String(body.cursor)
  if (!accountId || !familyId || !records.length) {
    throw Object.assign(new Error('accountId, familyId e records são obrigatórios'), { status: 400 })
  }
  if (records.length > 500) {
    throw Object.assign(new Error('Cada lote aceita no máximo 500 registros'), { status: 413 })
  }

  const accounts = await restRequest(
    `connector_accounts?id=eq.${encodeURIComponent(accountId)}&family_id=eq.${encodeURIComponent(familyId)}&select=*`,
    token,
  )
  const account = accounts?.[0]
  if (!account || !isConnectorType(account.connector_type)) {
    throw Object.assign(new Error('Conector não encontrado'), { status: 404 })
  }

  const runs = await restRequest('connector_sync_runs', token, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{
      account_id: accountId,
      family_id: familyId,
      cursor_before: account.cursor,
      records_seen: records.length,
    }]),
  })
  const run = runs?.[0]

  try {
    const normalized = await Promise.all(records.map((record, index) =>
      normalizeConnectorRecord(
        account.connector_type,
        record && typeof record === 'object' ? record as Record<string, unknown> : { value: record },
        index,
      )
    ))
    const eventRows = normalized.map((event) => ({
      account_id: accountId,
      family_id: familyId,
      ...event,
    }))
    const inserted = await restRequest(
      'connector_events?on_conflict=account_id,dedupe_key',
      token,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(eventRows),
      },
    )
    const created = Array.isArray(inserted) ? inserted.length : 0
    const now = new Date().toISOString()

    await restRequest(`connector_accounts?id=eq.${encodeURIComponent(accountId)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        cursor,
        status: 'active',
        last_synced_at: now,
        last_error: null,
        updated_at: now,
      }),
    })
    if (run?.id) {
      await restRequest(`connector_sync_runs?id=eq.${encodeURIComponent(run.id)}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          cursor_after: cursor,
          records_created: created,
          records_skipped: records.length - created,
          finished_at: now,
        }),
      })
    }

    return { runId: run?.id, seen: records.length, created, skipped: records.length - created, cursor }
  } catch (error) {
    if (run?.id) {
      await restRequest(`connector_sync_runs?id=eq.${encodeURIComponent(run.id)}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          finished_at: new Date().toISOString(),
        }),
      }).catch(() => null)
    }
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Método não permitido', 405)

  try {
    const { token } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'ingest')
    const result = action === 'register'
      ? await registerConnector(body, token)
      : await ingestRecords(body, token)
    return jsonResponse(result)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const status = Number((error as { status?: number })?.status || 500)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return errorResponse('Erro na sincronização do conector', status, message)
  }
})
