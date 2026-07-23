function serviceConfig() {
  const url = globalThis.Deno?.env.get('SUPABASE_URL')
  const key = globalThis.Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service configuration missing')
  return { url, key }
}

async function serviceRest(path) {
  const { url, key } = serviceConfig()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(data?.message || `PostgREST ${response.status}`)
  return data
}

export function rolloutEnabled(flag, userId) {
  if (!flag?.enabled) return false
  if (Number(flag.rollout_percentage || 0) >= 100) return true
  let hash = 0
  const text = `${userId}:${flag.key}`
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(31, hash) + text.charCodeAt(index) | 0
  return Math.abs(hash) % 100 < Number(flag.rollout_percentage || 0)
}

export async function getFeatureFlagForUser(userId, key) {
  const rows = await serviceRest(
    `feature_flags?select=key,enabled,rollout_percentage,config,metadata&key=eq.${encodeURIComponent(key)}&limit=1`,
  )
  const flag = rows?.[0]
  if (!flag) return { key, enabled: false, source: 'missing', config: {} }
  const overrides = await serviceRest(
    `user_flag_overrides?select=enabled&user_id=eq.${encodeURIComponent(userId)}&flag_key=eq.${encodeURIComponent(key)}&limit=1`,
  )
  if (overrides?.[0]) return { key, enabled: Boolean(overrides[0].enabled), source: 'override', config: flag.config || {} }
  return { key, enabled: rolloutEnabled(flag, userId), source: 'rollout', config: flag.config || {} }
}

export async function assertFeatureEnabled(userId, key) {
  const flag = await getFeatureFlagForUser(userId, key)
  if (!flag.enabled) {
    throw Object.assign(new Error('Recurso temporariamente desativado.'), {
      code: 'FEATURE_DISABLED',
      status: 403,
      flag: key,
    })
  }
  return flag
}
