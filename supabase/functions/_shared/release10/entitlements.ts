const premiumFeatures = {
  predictive_advisor: true,
  scenario_simulation: true,
  advanced_reports: true,
  price_search: true,
  wishlist_items: true,
  automations: true,
  smart_actions: true,
  export_reports: true,
  advanced_price_history: true,
  ai_questions: true,
  ocr_uploads: true,
  billing_trial: true,
  billing_checkout: true,
}

const freeFeatures = {
  predictive_advisor: false,
  scenario_simulation: false,
  advanced_reports: false,
  price_search: true,
  wishlist_items: true,
  automations: true,
  smart_actions: false,
  export_reports: false,
  advanced_price_history: false,
  ai_questions: true,
  ocr_uploads: true,
  billing_trial: true,
  billing_checkout: true,
}

const testerFeatures = {
  predictive_advisor: true,
  scenario_simulation: true,
  advanced_reports: true,
  price_search: true,
  wishlist_items: true,
  automations: true,
  smart_actions: true,
  export_reports: true,
  advanced_price_history: true,
  ai_questions: true,
  ocr_uploads: true,
  billing_trial: true,
}

export function resolveRelease10Entitlements(input: any = {}, now = new Date()) {
  const subscription = input.subscription || {}
  const status = String(subscription.status || 'free')
  const active = ['active', 'trialing'].includes(status)
    || (status === 'past_due' && subscription.current_period_end && new Date(subscription.current_period_end).getTime() + 3 * 86400000 >= now.getTime())
  const planCode = active ? String(subscription.plan_code || 'free') : 'free'
  const premium = active && planCode !== 'free'
  const features = { ...(premium ? premiumFeatures : freeFeatures) }
  const limits: Record<string, number | null> = premium
    ? { price_search_monthly: 50, ai_questions_monthly: 100, ocr_uploads_monthly: 30, automations_active: 10 }
    : { price_search_monthly: 3, ai_questions_monthly: 10, ocr_uploads_monthly: 3, automations_active: 1, wishlist_items: 5 }
  const tester = input.tester
  const isTester = tester?.status === 'active' && tester.access_expires_at && new Date(tester.access_expires_at).getTime() > now.getTime()
  if (isTester) {
    Object.assign(features, testerFeatures)
    Object.assign(limits, { price_search_monthly: 50, ai_questions_monthly: 100, ocr_uploads_monthly: 30, automations_active: 10 })
  }
  for (const override of input.overrides || []) {
    if (override.expires_at && new Date(override.expires_at).getTime() <= now.getTime()) continue
    features[override.feature_key] = Boolean(override.enabled)
  }
  return { plan_code: planCode, is_tester: isTester, features, limits }
}
