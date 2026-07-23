import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('edge function user scope', () => {
  it('loads finance_states with user_id derived from JWT', () => {
    const source = fs.readFileSync('supabase/functions/_shared/finance-state.ts', 'utf8')

    expect(source).toContain('user_id=eq.${encodeURIComponent(userId)}')
    expect(source).not.toMatch(/finance_states\?select=family_id,data,updated_at\$\{filter\}/)
  })

  it('AI action RPCs update finance_states by family_id and user_id', () => {
    const migration = fs.readFileSync('supabase/migrations/20260621110000_hotfix_p0_user_isolation.sql', 'utf8')

    expect(migration).toMatch(/where family_id = v_draft\.family_id\s+and user_id = p_user_id/i)
    expect(migration).toMatch(/where family_id = v_log\.family_id\s+and user_id = p_user_id/i)
    expect(migration).toMatch(/where id = v_state\.id\s+and user_id = p_user_id/i)
  })
})
