import { describe, expect, it } from 'vitest'
import { sanitizeBillingPayload } from '@/domain/billing/entitlements.js'

describe('Release 10 billing security', () => {
  it('does not expose gateway secrets or finance data', () => {
    const sanitized = sanitizeBillingPayload({
      event_id: 'evt_1',
      status: 'active',
      finance_states: {},
      authorization: 'Bearer secret',
      card_number: '4111111111111111',
    })

    expect(sanitized.event_id).toBe('evt_1')
    expect(sanitized.finance_states).toBeUndefined()
    expect(sanitized.authorization).toBeUndefined()
    expect(sanitized.card_number).toBeUndefined()
  })
})
