import { EdgeAuthError } from '../auth.ts'
import { serviceRestRequest } from './rest.ts'
import { resolveRelease10Entitlements } from './entitlements.ts'

export async function resolveUserEntitlements(userId: string) {
  const subscriptions = await serviceRestRequest(`billing_subscriptions?select=plan_code,status,current_period_end&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1`) as any[]
  const testers = await serviceRestRequest(`beta_testers?select=status,tester_group,access_expires_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`) as any[]
  const overrides = await serviceRestRequest(`user_feature_overrides?select=feature_key,enabled,expires_at&user_id=eq.${encodeURIComponent(userId)}`) as any[]
  return resolveRelease10Entitlements({
    subscription: subscriptions?.[0] || { status: 'free', plan_code: 'free' },
    tester: testers?.[0],
    overrides,
  })
}

export async function requireFeatureAccess(userId: string, featureKey: string) {
  const entitlements = await resolveUserEntitlements(userId)
  if (entitlements.features?.[featureKey] === true) return entitlements
  throw new EdgeAuthError('Recurso Premium nao liberado para este plano.', 403, 'FEATURE_NOT_ALLOWED')
}
