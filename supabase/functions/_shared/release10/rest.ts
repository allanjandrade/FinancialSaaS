import { EdgeAuthError } from '../auth.ts'

export async function serviceRestRequest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new EdgeAuthError('Configuracao service_role indisponivel.', 500, 'SERVICE_ROLE_UNAVAILABLE')
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
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || data?.error || `PostgREST ${response.status}`), { status: response.status })
  }
  return data
}

export async function authAdminRequest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new EdgeAuthError('Configuracao service_role indisponivel.', 500, 'SERVICE_ROLE_UNAVAILABLE')
  const response = await fetch(`${url}/auth/v1/admin/${path}`, {
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
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || data?.error || `Auth Admin ${response.status}`), { status: response.status })
  }
  return data
}

export async function resolveTargetUserId(body: Record<string, unknown>) {
  if (body.target_user_id) return String(body.target_user_id)
  const email = String(body.target_email || '').trim().toLowerCase()
  if (!email) throw Object.assign(new Error('Informe target_user_id ou target_email.'), { status: 400, code: 'TARGET_USER_REQUIRED' })
  const users = await authAdminRequest('users?per_page=1000') as { users?: Array<{ id: string; email?: string }> }
  const found = users.users?.find((user) => String(user.email || '').toLowerCase() === email)
  if (!found?.id) throw Object.assign(new Error('Usuario nao encontrado no Auth.'), { status: 404, code: 'TARGET_USER_NOT_FOUND' })
  return found.id
}

export function rejectIdentityOverride(body: Record<string, unknown>, fields = ['user_id', 'userId', 'role', 'is_admin', 'subscription_status']) {
  const attempted = fields.find((field) => body?.[field] != null)
  if (attempted) throw new EdgeAuthError('Campo controlado exclusivamente pelo backend.', 403, 'FORBIDDEN')
}

export function sanitizeMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitizeMetadata)
  const forbidden = new Set(['token', 'secret', 'authorization', 'password', 'service_role', 'gateway_payload', 'finance_states', 'raw_payload', 'card_number'])
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !forbidden.has(key.toLowerCase()))
    .map(([key, nested]) => [key, sanitizeMetadata(nested)]))
}

export async function audit(actorUserId: string | null, action: string, resourceType: string, details: Record<string, unknown> = {}) {
  await serviceRestRequest('admin_audit_logs', {
    method: 'POST',
    body: JSON.stringify({
      actor_user_id: actorUserId,
      target_user_id: details.target_user_id || null,
      action,
      resource_type: resourceType,
      resource_id: details.resource_id || null,
      metadata: sanitizeMetadata(details.metadata || {}),
    }),
  })
}

export async function adminAccess(userId: string) {
  const rows = await serviceRestRequest(`admin_users?select=role,active&user_id=eq.${encodeURIComponent(userId)}&limit=1`) as Array<{ role: string; active: boolean }>
  const row = rows?.[0]
  if (!row?.active || !['owner', 'admin', 'support'].includes(row.role)) {
    return { is_admin: false, role: 'user', permissions: [] as string[] }
  }
  const permissions: Record<string, string[]> = {
    owner: ['manage_admins', 'manage_testers', 'manage_features', 'view_billing', 'view_sanitized_logs', 'critical_admin_actions'],
    admin: ['manage_testers', 'manage_features', 'view_billing', 'view_usage', 'view_sanitized_logs'],
    support: ['view_account_status', 'view_subscription_status', 'view_operational_errors', 'view_sanitized_logs'],
  }
  return { is_admin: true, role: row.role, permissions: permissions[row.role] || [] }
}

export async function requireAdmin(userId: string, allowed = ['owner', 'admin', 'support']) {
  const access = await adminAccess(userId)
  if (!access.is_admin || !allowed.includes(access.role)) throw new EdgeAuthError('Acesso administrativo negado.', 403, 'FORBIDDEN')
  return access
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
