export const PREMIUM_FEATURE_LABELS = Object.freeze({
  predictive_advisor: 'Consultor financeiro Premium',
  scenario_simulation: 'Simulacoes Premium',
  advanced_reports: 'Relatorios avancados Premium',
  smart_actions: 'Acoes inteligentes Premium',
  export_reports: 'Exportacoes Premium',
  advanced_price_history: 'Historico de precos avancado Premium',
})

export const PREMIUM_ROUTE_FEATURES = Object.freeze({
  '/advisor': 'predictive_advisor',
  '/simulations': 'scenario_simulation',
  '/simulations/can-i-buy': 'scenario_simulation',
  '/purchase-simulator': 'scenario_simulation',
  '/ai-actions': 'smart_actions',
})

export function featureForPath(path = '') {
  const cleanPath = String(path || '').split('?')[0].replace(/\/+$/, '') || '/'
  if (PREMIUM_ROUTE_FEATURES[cleanPath]) return PREMIUM_ROUTE_FEATURES[cleanPath]
  return Object.entries(PREMIUM_ROUTE_FEATURES)
    .find(([route]) => cleanPath.startsWith(`${route}/`))?.[1] || null
}

export function hasFeatureAccess(access = {}, featureKey = '') {
  if (!featureKey) return true
  if (access?.features?.[featureKey] === true) return true
  if (access?.isPremium && access?.features?.[featureKey] !== false) return true
  return false
}

export function isNavItemLocked(item = {}, access = {}) {
  return Boolean(item.premiumFeature && !hasFeatureAccess(access, item.premiumFeature))
}

export function premiumFeatureLabel(featureKey = '') {
  return PREMIUM_FEATURE_LABELS[featureKey] || 'Recurso Premium'
}
