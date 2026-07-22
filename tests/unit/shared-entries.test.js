import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { familyDashboardAmount, normalizeSharedEntryForm } from '@/domain/family/familySharing.js'

describe('Release 11.3 shared entries', () => {
  it('normalizes a shared entry without touching private finance state', () => {
    const payload = normalizeSharedEntryForm({
      description: 'Mercado',
      amount: '400',
      participant_user_ids: ['u1', 'u2', 'u2'],
    }, 'family-1')

    expect(payload).toMatchObject({
      family_group_id: 'family-1',
      type: 'expense',
      description: 'Mercado',
      amount: 400,
      split_method: 'equal',
      participant_user_ids: ['u1', 'u2'],
    })

    const createFn = fs.readFileSync('supabase/functions/shared-entry-create/index.ts', 'utf8')
    expect(createFn).not.toContain('finance_states')
  })

  it('separates individual impact from family total', () => {
    const entry = {
      amount: 400,
      family_total: 400,
      my_amount: 200,
      participants: [
        { user_id: 'u1', calculated_amount: 200 },
        { user_id: 'u2', calculated_amount: 200 },
      ],
    }

    expect(familyDashboardAmount(entry, 'mine', 'u1')).toBe(200)
    expect(familyDashboardAmount(entry, 'family', 'u1')).toBe(400)
  })
})
