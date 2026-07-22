export const ADMIN_ROLES = Object.freeze(['owner', 'admin', 'support'])
export const APP_ROLES = Object.freeze(['owner', 'admin', 'support', 'tester', 'user'])

const PERMISSIONS = Object.freeze({
  owner: ['manage_admins', 'manage_testers', 'manage_features', 'view_billing', 'view_sanitized_logs', 'critical_admin_actions'],
  admin: ['manage_testers', 'manage_features', 'view_billing', 'view_usage', 'view_sanitized_logs'],
  support: ['view_account_status', 'view_subscription_status', 'view_operational_errors', 'view_sanitized_logs'],
})

export function resolveAdminAccess(adminUser = null) {
  if (!adminUser?.active || !ADMIN_ROLES.includes(adminUser.role)) {
    return { is_admin: false, role: 'user', permissions: [] }
  }
  return { is_admin: true, role: adminUser.role, permissions: PERMISSIONS[adminUser.role] }
}

export function canAccessAdminPanel(access) {
  return Boolean(access?.is_admin && ['owner', 'admin', 'support'].includes(access.role))
}

export function canPerformAdminAction(access, action) {
  if (!access?.is_admin) return false
  if (action === 'promote_owner') return access.role === 'owner'
  if (action === 'manage_testers') return ['owner', 'admin'].includes(access.role)
  if (action === 'set_feature_override') return ['owner', 'admin'].includes(access.role)
  if (action === 'view_support') return ['owner', 'admin', 'support'].includes(access.role)
  return access.role === 'owner'
}

export function rejectForgedAdminPayload(payload = {}) {
  const forbidden = ['role', 'is_admin', 'permissions', 'subscription_status', 'active_subscription']
  const field = forbidden.find((key) => payload[key] != null)
  if (field) throw new Error(`Campo controlado pelo servidor: ${field}`)
}
