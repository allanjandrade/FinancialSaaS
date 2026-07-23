export const PLAN_CODES = Object.freeze([
  'free',
  'premium_monthly',
  'premium_annual',
  'family_monthly',
  'family_annual',
  'pro_monthly',
  'pro_annual',
])

export const BILLING_FEATURES = Object.freeze([
  'unlimited_entries',
  'advanced_reports',
  'predictive_advisor',
  'scenario_simulation',
  'price_search',
  'wishlist_items',
  'automations',
  'smart_actions',
  'family_members',
  'export_reports',
  'advanced_price_history',
  'ai_questions',
  'ocr_uploads',
  'billing_trial',
  'billing_checkout',
])

export const PLANS = Object.freeze({
  free: {
    code: 'free',
    name: 'Grátis',
    monthlyPrice: 0,
    annualPrice: 0,
    commercial: true,
    features: {
      unlimited_entries: false,
      advanced_reports: false,
      predictive_advisor: false,
      scenario_simulation: false,
      price_search: true,
      wishlist_items: true,
      automations: true,
      smart_actions: false,
      family_members: false,
      export_reports: false,
      advanced_price_history: false,
      ai_questions: true,
      ocr_uploads: true,
    },
    limits: {
      entries_monthly: 30,
      credit_cards: 1,
      benefit_wallets: 1,
      wishlist_items: 5,
      price_search_monthly: 3,
      ai_questions_monthly: 10,
      ocr_uploads_monthly: 3,
      automations_active: 1,
    },
  },
  premium_monthly: {
    code: 'premium_monthly',
    name: 'Premium mensal',
    monthlyPrice: 19.9,
    annualPrice: 199,
    commercial: true,
    features: premiumFeatures(),
    limits: premiumLimits(),
  },
  premium_annual: {
    code: 'premium_annual',
    name: 'Premium anual',
    monthlyPrice: 16.58,
    annualPrice: 199,
    commercial: true,
    features: premiumFeatures(),
    limits: premiumLimits(),
  },
  family_monthly: {
    code: 'family_monthly',
    name: 'Familiar mensal',
    monthlyPrice: 29.9,
    annualPrice: 299,
    commercial: false,
    features: { ...premiumFeatures(), family_members: true },
    limits: { ...premiumLimits(), price_search_monthly: 100, ai_questions_monthly: 150, automations_active: 20 },
  },
  family_annual: {
    code: 'family_annual',
    name: 'Familiar anual',
    monthlyPrice: 24.92,
    annualPrice: 299,
    commercial: false,
    features: { ...premiumFeatures(), family_members: true },
    limits: { ...premiumLimits(), price_search_monthly: 100, ai_questions_monthly: 150, automations_active: 20 },
  },
  pro_monthly: {
    code: 'pro_monthly',
    name: 'Pro mensal',
    monthlyPrice: 49.9,
    annualPrice: 499,
    commercial: false,
    features: { ...premiumFeatures(), family_members: true, export_reports: true },
    limits: { ...premiumLimits(), price_search_monthly: 300, ai_questions_monthly: 300, ocr_uploads_monthly: 100, automations_active: 50 },
  },
  pro_annual: {
    code: 'pro_annual',
    name: 'Pro anual',
    monthlyPrice: 41.58,
    annualPrice: 499,
    commercial: false,
    features: { ...premiumFeatures(), family_members: true, export_reports: true },
    limits: { ...premiumLimits(), price_search_monthly: 300, ai_questions_monthly: 300, ocr_uploads_monthly: 100, automations_active: 50 },
  },
})

function premiumFeatures() {
  return {
    unlimited_entries: true,
    advanced_reports: true,
    predictive_advisor: true,
    scenario_simulation: true,
    price_search: true,
    wishlist_items: true,
    automations: true,
    smart_actions: true,
    family_members: false,
    export_reports: true,
    advanced_price_history: true,
    ai_questions: true,
    ocr_uploads: true,
    billing_trial: true,
    billing_checkout: true,
  }
}

function premiumLimits() {
  return {
    entries_monthly: null,
    credit_cards: null,
    benefit_wallets: null,
    wishlist_items: null,
    price_search_monthly: 50,
    ai_questions_monthly: 100,
    ocr_uploads_monthly: 30,
    automations_active: 10,
  }
}

export function normalizePlanCode(value) {
  return PLAN_CODES.includes(value) ? value : 'free'
}

export function getPlan(code) {
  return PLANS[normalizePlanCode(code)]
}

export function planDisplayName(code) {
  const normalized = normalizePlanCode(code)
  if (normalized === 'free') return 'Grátis'
  return getPlan(normalized).name
}

export function currentPlanLabel(code) {
  return `Plano atual: ${planDisplayName(code)}`
}

export function publicPlans() {
  return ['free', 'premium_monthly', 'premium_annual'].map(getPlan)
}

export function calculatePricingModel(input = {}) {
  const price = Number(input.price ?? 19.9)
  const gatewayFeePercent = Number(input.gatewayFeePercent ?? 0.0399)
  const gatewayFixedFee = Number(input.gatewayFixedFee ?? 0.49)
  const taxPercent = Number(input.taxPercent ?? 0.06)
  const variableCosts = Number(input.variableCosts ?? 2.5)
  const monthlyFixedCosts = Number(input.monthlyFixedCosts ?? 500)
  const churnMonthly = Math.max(0.01, Number(input.churnMonthly ?? 0.05))
  const gateway = price * gatewayFeePercent + gatewayFixedFee
  const taxes = price * taxPercent
  const netRevenue = price - gateway - taxes - variableCosts
  const margin = price > 0 ? netRevenue / price : 0
  const breakEvenSubscribers = netRevenue > 0 ? Math.ceil(monthlyFixedCosts / netRevenue) : null
  const ltv = netRevenue / churnMonthly
  return {
    grossRevenue: round(price),
    gateway: round(gateway),
    taxes: round(taxes),
    variableCosts: round(variableCosts),
    netRevenue: round(netRevenue),
    marginPercent: round(margin * 100, 2),
    breakEvenSubscribers,
    ltv: round(ltv),
    maxCac: round(ltv / 3),
    mrrAt100Subscribers: round(price * 100),
    arrAt100Subscribers: round(price * 100 * 12),
  }
}

function round(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}
