import { describe, it, expect } from 'vitest'
import {
  classifyPurchaseMotivation,
  computeNecessityScore,
  computeOpportunityIndex,
} from '@/utils/purchase-intelligence.js'

describe('classifyPurchaseMotivation', () => {
  it('respeita motivação explícita', () => {
    expect(classifyPurchaseMotivation({ purchaseMotivation: 'Investimento' })).toBe('Investimento')
  })

  it('classifica mercado como necessidade', () => {
    expect(classifyPurchaseMotivation({ category: 'Mercado' })).toBe('Necessidade')
  })

  it('classifica eletrônicos como desejo', () => {
    expect(classifyPurchaseMotivation({ category: 'Eletrônicos' })).toBe('Desejo')
  })
})

describe('computeNecessityScore', () => {
  it('prioridade alta aumenta score', () => {
    const low = computeNecessityScore({ category: 'Lazer', priority: 'Baixa' }, { monthlySurplus: 1000 })
    const high = computeNecessityScore({ category: 'Lazer', priority: 'Alta' }, { monthlySurplus: 1000 })
    expect(high.score).toBeGreaterThan(low.score)
  })
})

describe('computeOpportunityIndex', () => {
  it('retorna score e veredito para item com histórico', () => {
    const item = {
      value: 80,
      priceHistory: [
        { price: 100, date: '2026-03-01' },
        { price: 100, date: '2026-04-01' },
        { price: 100, date: '2026-05-01' },
      ],
    }
    const result = computeOpportunityIndex(item, [])
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.verdict).toBeTruthy()
    expect(result.currentPrice).toBe(80)
  })
})
