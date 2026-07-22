import { BILLING_FEATURES } from '../billing/plans.js'

export function validateFeatureKey(featureKey) {
  if (!BILLING_FEATURES.includes(featureKey) && featureKey !== 'admin_panel' && featureKey !== 'operational_dashboard') {
    throw new Error('feature inexistente')
  }
  return featureKey
}

export function setFeatureOverride({ user_id, feature_key, enabled, reason, expires_at } = {}) {
  if (!user_id) throw new Error('user_id obrigatorio')
  validateFeatureKey(feature_key)
  if (!reason) throw new Error('reason obrigatorio')
  return {
    user_id,
    feature_key,
    enabled: Boolean(enabled),
    reason,
    expires_at: expires_at || null,
  }
}
