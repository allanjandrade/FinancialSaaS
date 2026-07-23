import { BILLING_FEATURES, getPlan } from './plans.js'

export const TESTER_FEATURES = Object.freeze({
  predictive_advisor: true,
  scenario_simulation: true,
  advanced_reports: true,
  price_search: true,
  automations: true,
  smart_actions: true,
  export_reports: true,
  billing_trial: true,
  advanced_price_history: true,
})

export const TESTER_LIMITS = Object.freeze({
  price_search_monthly: 50,
  ai_questions_monthly: 100,
  ocr_uploads_monthly: 30,
  automations_active: 10,
})

function nowTime(now = new Date()) {
  return new Date(now).getTime()
}

function isActiveSubscription(subscription = {}, now = new Date()) {
  const status = String(subscription.status || 'free')
  if (['active', 'trialing'].includes(status)) return true
  if (status === 'past_due' && subscription.current_period_end) {
    return new Date(subscription.current_period_end).getTime() + 3 * 86400000 >= nowTime(now)
  }
  return false
}

function isActiveTester(tester = {}, now = new Date()) {
  if (tester.status !== 'active') return false
  if (!tester.access_expires_at) return false
  return new Date(tester.access_expires_at).getTime() > nowTime(now)
}

function overrideActive(override = {}, now = new Date()) {
  if (!override) return false
  return !override.expires_at || new Date(override.expires_at).getTime() > nowTime(now)
}

export function resolveEntitlements(input = {}, now = new Date()) {
  const subscription = input.subscription || {}
  const activeSubscription = isActiveSubscription(subscription, now)
  const planCode = activeSubscription ? String(subscription.plan_code || 'free') : 'free'
  const plan = getPlan(planCode)
  const features = { ...plan.features }
  const limits = { ...plan.limits }
  const tester = input.tester || {}
  const testerActive = isActiveTester(tester, now)

  if (testerActive) {
    Object.assign(features, TESTER_FEATURES)
    Object.assign(limits, TESTER_LIMITS)
  }

  for (const override of input.overrides || []) {
    if (!overrideActive(override, now)) continue
    if (!BILLING_FEATURES.includes(override.feature_key)) continue
    features[override.feature_key] = Boolean(override.enabled)
  }

  return {
    plan_code: plan.code,
    subscription_status: activeSubscription ? subscription.status || 'active' : 'free',
    is_tester: testerActive,
    tester_group: testerActive ? tester.tester_group || 'default' : null,
    features,
    limits,
  }
}

export function canUseFeature(entitlements, featureKey, usage = 0) {
  if (!entitlements?.features?.[featureKey]) return { allowed: false, reason: 'FEATURE_DISABLED' }
  const limitKey = {
    wishlist_items: 'wishlist_items',
    automations: 'automations_active',
  }[featureKey] || `${featureKey}_monthly`
  const limit = entitlements.limits?.[limitKey]
  if (Number.isFinite(limit) && usage >= limit) return { allowed: false, reason: 'LIMIT_EXCEEDED', limit }
  return { allowed: true, reason: 'ALLOWED', limit: limit ?? null }
}

export function sanitizeBillingPayload(payload = {}) {
  const allowed = ['id', 'event_id', 'type', 'status', 'plan_code', 'provider_customer_id', 'provider_subscription_id', 'amount', 'currency']
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)))
}
