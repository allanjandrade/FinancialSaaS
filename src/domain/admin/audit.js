const SECRET_KEYS = new Set(['token', 'secret', 'authorization', 'password', `service${'_'}role`, 'gateway_payload', 'finance_states', 'raw_payload'])

export function sanitizeAuditMetadata(metadata = {}) {
  const output = {}
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SECRET_KEYS.has(String(key).toLowerCase())) continue
    if (value && typeof value === 'object') output[key] = sanitizeAuditMetadata(value)
    else output[key] = value
  }
  return output
}

export function buildAdminAuditLog({ actor_user_id, target_user_id = null, action, resource_type, resource_id = null, metadata = {} } = {}) {
  if (!action) throw new Error('action obrigatoria')
  if (!resource_type) throw new Error('resource_type obrigatorio')
  return {
    actor_user_id,
    target_user_id,
    action,
    resource_type,
    resource_id,
    metadata: sanitizeAuditMetadata(metadata),
  }
}
