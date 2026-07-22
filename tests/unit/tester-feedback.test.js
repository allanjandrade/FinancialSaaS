import { describe, expect, it } from 'vitest'

const AREAS = ['dashboard', 'advisor', 'billing', 'wishlist', 'price_search', 'automations', 'mobile', 'navigation']

function validateTesterFeedback(input = {}) {
  if (!AREAS.includes(input.area)) throw new Error('area invalida')
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('rating invalido')
  return { area: input.area, rating, message: String(input.message || '').slice(0, 1000), metadata: input.metadata || {} }
}

describe('Release 10 tester feedback', () => {
  it('accepts controlled areas and ratings only', () => {
    expect(validateTesterFeedback({ area: 'billing', rating: 5 }).area).toBe('billing')
    expect(() => validateTesterFeedback({ area: 'finance_states', rating: 5 })).toThrow('area invalida')
    expect(() => validateTesterFeedback({ area: 'billing', rating: 6 })).toThrow('rating invalido')
  })
})
