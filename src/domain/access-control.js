export const ADMIN_ROLES = Object.freeze(['owner', 'admin', 'support'])
export const OPERATIONAL_ROLES = Object.freeze(['owner', 'admin'])

export function resolveFrontendAccess({ admin = {}, entitlements = {} } = {}) {
  const adminRole = admin?.is_admin ? String(admin.role || 'support') : 'user'
  const planCode = String(entitlements?.plan_code || 'free')
  return {
    isAdmin: Boolean(admin?.is_admin && ADMIN_ROLES.includes(adminRole)),
    isOwner: adminRole === 'owner',
    isOperationalAdmin: OPERATIONAL_ROLES.includes(adminRole),
    adminRole,
    isTester: Boolean(entitlements?.is_tester),
    testerGroup: entitlements?.tester_group || null,
    planCode,
    isPremium: planCode !== 'free',
    features: entitlements?.features || {},
    limits: entitlements?.limits || {},
  }
}

export function canSeeNavItem(item, access) {
  if (item.adminOnly) return Boolean(access?.isAdmin)
  if (item.operationalOnly) return Boolean(access?.isOperationalAdmin)
  return true
}

export function canUseEntitledFeature(access, featureKey) {
  if (!featureKey) return true
  if (access?.features?.[featureKey] === true) return true
  if (access?.isPremium && access?.features?.[featureKey] !== false) return true
  return false
}

export function canAccessCheckout(access, mode = 'testers_only') {
  if (mode === 'disabled') return false
  if (mode === 'enabled') return true
  return Boolean(access?.isTester || access?.isOwner || access?.adminRole === 'admin')
}

export function checkoutBlockedMessage(mode = 'testers_only') {
  if (mode === 'disabled') return 'Assinatura indisponível no momento.'
  return 'Upgrade Premium indisponível para esta conta no momento.'
}
