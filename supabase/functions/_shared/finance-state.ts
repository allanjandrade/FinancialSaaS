import { EdgeAuthError } from './auth.ts'

export type FinanceStateRow = {
  family_id: string
  user_id: string
  data: Record<string, unknown>
  updated_at?: string
}

export async function userRestRequest(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) {
    throw new EdgeAuthError('Configuracao do banco indisponivel.', 500, 'DATABASE_CONFIGURATION_ERROR')
  }
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    if (response.status === 401) {
      throw new EdgeAuthError('Sessao invalida ou expirada. Faca login novamente.')
    }
    if (response.status === 403) {
      throw new EdgeAuthError(
        'Voce nao tem permissao para executar esta acao.',
        403,
        'FORBIDDEN',
      )
    }
    throw Object.assign(new Error(data?.message || data?.error || `PostgREST ${response.status}`), {
      status: response.status,
    })
  }
  return data
}

export async function loadAuthorizedFinanceState(token: string, userId: string, familyId?: string) {
  if (!userId) throw new EdgeAuthError('Sessao invalida ou expirada. Faca login novamente.')
  const familyFilter = familyId ? `&family_id=eq.${encodeURIComponent(familyId)}` : ''
  const rows = await userRestRequest(
    `finance_states?select=family_id,user_id,data,updated_at&user_id=eq.${encodeURIComponent(userId)}${familyFilter}&order=updated_at.desc&limit=1`,
    token,
  ) as FinanceStateRow[]
  const row = rows?.[0]
  if (!row?.family_id || row.user_id !== userId || !row.data) {
    throw new EdgeAuthError(
      'Estado financeiro nao encontrado para o usuario autenticado.',
      404,
      'FINANCE_STATE_NOT_FOUND',
    )
  }
  return row
}

export async function assertAuthorizedFinanceEditor(token: string, familyId: string, userId: string) {
  const rows = await userRestRequest(
    `family_members?select=role,access_role&family_id=eq.${encodeURIComponent(familyId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    token,
  ) as Array<{ role?: string; access_role?: string }>
  const membership = rows?.[0]
  const role = String(membership?.access_role || membership?.role || '').toLowerCase()
  if (!membership || ['viewer', 'visualizador'].includes(role)) {
    throw new EdgeAuthError('Seu perfil possui acesso somente leitura.', 403, 'FORBIDDEN')
  }
  return membership
}

export function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function dateMonthKey(value: unknown) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/)
  return match ? Number(match[1]) * 100 + Number(match[2]) : 0
}
