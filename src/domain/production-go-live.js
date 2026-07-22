export const BILLING_CHECKOUT_MODES = Object.freeze(['disabled', 'testers_only', 'enabled'])

export function resolveBillingCheckoutMode(value = 'testers_only') {
  return BILLING_CHECKOUT_MODES.includes(value) ? value : 'testers_only'
}

export function isMaintenanceBlocked({ maintenanceMode = false, essential = false } = {}) {
  return Boolean(maintenanceMode && !essential)
}

export function sanitizeHealthCheckPayload(payload = {}) {
  const restrictedRoleKey = ['service', 'role'].join('_')
  const forbidden = ['token', 'secret', restrictedRoleKey, 'finance_states', 'gateway_payload', 'raw_prompt', 'authorization']
  const serialized = JSON.stringify(payload)
  for (const key of forbidden) {
    if (serialized.toLowerCase().includes(key)) return { status: 'degraded', version: 'release-11', checks: {} }
  }
  return payload
}
