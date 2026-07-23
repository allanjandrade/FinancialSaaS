const LIMIT_DEFAULTS = {
  ai_actions_daily_limit: 30,
  automations_limit: 20,
  automation_runs_daily_limit: 100,
  diagnostics_exports_daily_limit: 5,
}

function serviceConfig() {
  const url = globalThis.Deno?.env.get('SUPABASE_URL')
  const key = globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service configuration missing')
  return { url, key }
}

async function serviceRest(path, init = {}) {
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
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || data?.error || `PostgREST ${response.status}`), {
      status: response.status,
      code: data?.code || 'REST_ERROR',
    })
  }
  return data
}

export async function getUserOperationLimits(userId) {
  const rows = await serviceRest(
    `user_operation_limits?select=ai_actions_daily_limit,automations_limit,automation_runs_daily_limit,diagnostics_exports_daily_limit&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  )
  return { ...LIMIT_DEFAULTS, ...(rows?.[0] || {}) }
}

function todayFilter() {
  return new Date().toISOString().slice(0, 10)
}

async function headCount(path) {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  })
  if (!response.ok) throw new Error(`Count failed: ${response.status}`)
  const range = response.headers.get('content-range') || '0-0/0'
  return Number(range.split('/')[1] || 0)
}

export async function countOperationUsage(userId, kind) {
  const encodedUser = encodeURIComponent(userId)
  if (kind === 'automations_limit') {
    return headCount(`user_automations?select=id&user_id=eq.${encodedUser}&status=in.(active,paused)`)
  }
  if (kind === 'automation_runs_daily_limit') {
    return headCount(`automation_runs?select=id&user_id=eq.${encodedUser}&started_at=gte.${todayFilter()}T00:00:00.000Z`)
  }
  if (kind === 'diagnostics_exports_daily_limit') {
    return headCount(`system_events?select=id&user_id=eq.${encodedUser}&event_type=eq.diagnostics_exported&created_at=gte.${todayFilter()}T00:00:00.000Z`)
  }
  return headCount(`system_events?select=id&user_id=eq.${encodedUser}&source=eq.ai_action&created_at=gte.${todayFilter()}T00:00:00.000Z`)
}

export async function assertOperationLimit(userId, kind) {
  const limits = await getUserOperationLimits(userId)
  const limit = Number(limits[kind] ?? LIMIT_DEFAULTS[kind])
  const used = await countOperationUsage(userId, kind)
  if (used >= limit) {
    throw Object.assign(new Error('Limite operacional atingido.'), {
      code: 'OPERATION_LIMIT_EXCEEDED',
      status: 429,
      limit,
      used,
      kind,
    })
  }
  return { limit, used, remaining: Math.max(0, limit - used) }
}
