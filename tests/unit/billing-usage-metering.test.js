import { describe, expect, it } from 'vitest'
import { meterUsage, summarizeUsage } from '@/domain/billing/usage.js'

describe('Release 10 billing usage metering', () => {
  it('summarizes usage without raw financial payloads', () => {
    const event = meterUsage({ event_type: 'price_search', quantity: 2, metadata: { finance_states: {}, query: 'produto' } })

    expect(event.quantity).toBe(2)
    expect(event.metadata.finance_states).toBeUndefined()
    expect(summarizeUsage([event, { event_type: 'price_search', quantity: 3 }]).price_search).toBe(5)
  })
})
