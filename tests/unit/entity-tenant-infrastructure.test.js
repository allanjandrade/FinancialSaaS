import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260628180000_entity_tenant_infrastructure.sql'
const typesPath = 'src/types/financialAccess.ts'

describe('entity tenant infrastructure contract', () => {
  it('defines entity-scoped RLS and financial audit logs', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8')

    expect(migration).toContain('create table if not exists public.financial_entities')
    expect(migration).toContain('create table if not exists public.financial_entity_memberships')
    expect(migration).toContain('create table if not exists public.financial_audit_logs')
    expect(migration).toContain('entity_id uuid not null')
    expect(migration).toContain("event_type text not null")
    expect(migration).toContain("check (event_type in ('crud', 'balance_change', 'sync_error'))")
    expect(migration).toContain('alter table public.finance_states')
    expect(migration).toContain('add column if not exists entity_id uuid')
    expect(migration).toContain('public.is_entity_member(entity_id)')
    expect(migration).toContain('public.can_write_entity_finance(entity_id)')
    expect(migration).toContain('public.can_admin_entity(entity_id)')
    expect(migration).toContain('alter table public.financial_audit_logs force row level security')
    expect(migration).toContain('financial_audit_logs_select_members')
    expect(migration).toContain('financial_audit_logs_insert_members')
  })

  it('exports the required TypeScript financial roles', () => {
    const types = fs.readFileSync(typesPath, 'utf8')

    expect(types).toContain("export const FINANCIAL_ROLES")
    for (const role of ['admin', 'financeiro_senior', 'controller', 'operador', 'leitura', 'auditor']) {
      expect(types).toContain(`'${role}'`)
    }
    for (const label of ['Admin', 'Financeiro Senior', 'Controller', 'Operador', 'Leitura', 'Auditor']) {
      expect(types).toContain(label)
    }
    expect(types).toContain('export type FinancialRole')
    expect(types).toContain('export interface FinancialEntityMembership')
    expect(types).toContain('export interface FinancialAuditLog')
  })
})
