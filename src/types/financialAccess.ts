export const FINANCIAL_ROLES = [
  'admin',
  'financeiro_senior',
  'controller',
  'operador',
  'leitura',
  'auditor',
] as const

export type FinancialRole = typeof FINANCIAL_ROLES[number]

export const FINANCIAL_ROLE_LABELS: Record<FinancialRole, string> = {
  admin: 'Admin',
  financeiro_senior: 'Financeiro Senior',
  controller: 'Controller',
  operador: 'Operador',
  leitura: 'Leitura',
  auditor: 'Auditor',
}

export type FinancialPermission =
  | 'entity:admin'
  | 'finance:read'
  | 'finance:write'
  | 'finance:operate'
  | 'audit:read'
  | 'audit:write'

export const FINANCIAL_ROLE_PERMISSIONS: Record<FinancialRole, readonly FinancialPermission[]> = {
  admin: ['entity:admin', 'finance:read', 'finance:write', 'finance:operate', 'audit:read', 'audit:write'],
  financeiro_senior: ['finance:read', 'finance:write', 'finance:operate', 'audit:read', 'audit:write'],
  controller: ['finance:read', 'finance:write', 'finance:operate', 'audit:read', 'audit:write'],
  operador: ['finance:read', 'finance:write', 'finance:operate', 'audit:write'],
  leitura: ['finance:read'],
  auditor: ['finance:read', 'audit:read'],
}

export type FinancialEntityStatus = 'active' | 'suspended' | 'archived'
export type FinancialMembershipStatus = 'active' | 'invited' | 'suspended' | 'removed'
export type FinancialAuditEventType = 'crud' | 'balance_change' | 'sync_error'

export interface FinancialEntity {
  id: string
  name: string
  owner_user_id: string
  status: FinancialEntityStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FinancialEntityMembership {
  id: string
  entity_id: string
  user_id: string
  role: FinancialRole
  status: FinancialMembershipStatus
  created_at: string
  updated_at: string
}

export interface FinancialAuditLog {
  id: string
  entity_id: string
  actor_user_id: string | null
  event_type: FinancialAuditEventType
  action: string
  resource_type: string
  resource_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  error_code: string | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
}
