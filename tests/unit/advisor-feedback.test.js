import { describe, expect, it } from 'vitest'
import { validateAdvisorFeedback } from '@/domain/predictive/index.js'

describe('Release 9 advisor feedback', () => {
  it('accepts controlled feedback values and rejects arbitrary text', () => {
    expect(validateAdvisorFeedback({ recommendation_id: 'rec-1', feedback: 'useful' })).toEqual({
      recommendation_id: 'rec-1',
      feedback: 'useful',
      notes: '',
    })
    expect(() => validateAdvisorFeedback({ recommendation_id: 'rec-1', feedback: 'delete_expense' })).toThrow('feedback inválido')
  })
})
