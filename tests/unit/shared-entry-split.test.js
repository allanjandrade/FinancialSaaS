import { describe, expect, it } from 'vitest'
import { calculateSharedEntryParticipants } from '@/domain/family/familySharing.js'

describe('Release 11.3 shared entry split', () => {
  it('splits equally by cents without duplicating entries', () => {
    expect(calculateSharedEntryParticipants(400, ['a', 'b'])).toEqual([
      { user_id: 'a', allocation_type: 'equal', allocation_value: null, calculated_amount: 200 },
      { user_id: 'b', allocation_type: 'equal', allocation_value: null, calculated_amount: 200 },
    ])
    expect(calculateSharedEntryParticipants(10, ['a', 'b', 'c']).map((row) => row.calculated_amount)).toEqual([3.34, 3.33, 3.33])
  })

  it('supports visible-only without financial impact', () => {
    expect(calculateSharedEntryParticipants(400, ['a', 'b'], 'visible_only')).toEqual([
      { user_id: 'a', allocation_type: 'visible_only', allocation_value: null, calculated_amount: 0 },
      { user_id: 'b', allocation_type: 'visible_only', allocation_value: null, calculated_amount: 0 },
    ])
  })
})
