import { featureForPath, hasFeatureAccess, premiumFeatureLabel } from '@/domain/entitlements/featureAccess.js'
import { loadAuthenticatedContext } from '@/lib/authenticated-context.js'

export async function resolveRouteFeatureAccess(to) {
  const feature = to?.meta?.premiumFeature || featureForPath(to?.path)
  if (!feature) return { allowed: true, feature: null }

  try {
    const context = await loadAuthenticatedContext()
    if (context?.skipped || context?.error || !context?.entitlements) {
      return { allowed: true, feature, reason: 'ENTITLEMENTS_UNAVAILABLE' }
    }

    const access = context.access
    const allowed = hasFeatureAccess(access, feature)
    return {
      allowed,
      feature,
      label: premiumFeatureLabel(feature),
      access,
      reason: allowed ? 'ALLOWED' : 'FEATURE_LOCKED',
    }
  } catch {
    return { allowed: true, feature, reason: 'ENTITLEMENTS_UNAVAILABLE' }
  }
}
