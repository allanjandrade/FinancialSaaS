import { describe, expect, it } from 'vitest'
import {
  buildWishlistPurchaseRanking,
  calculatePriorityScore,
  calculateWishlistOpportunityCost,
} from '@/composables/useWishlistPredictiveEngine'

describe('wishlist predictive engine', () => {
  it('calculates the weighted priority score from decision factors', () => {
    const score = calculatePriorityScore({
      necessidade: 80,
      urgencia: 60,
      impactoPratico: 70,
      viabilidade: 50,
      risco: 20,
      preferencia: 90,
    })

    expect(score).toBe(64)
  })

  it('calculates how many days Item A delays Item B based on monthly savings capacity', () => {
    const result = calculateWishlistOpportunityCost({
      itemA: {
        id: 'a',
        name: 'Item A',
        value: 600,
        necessidade: 40,
        urgencia: 50,
        impactoPratico: 60,
        viabilidade: 70,
        risco: 20,
        preferencia: 80,
      },
      itemB: {
        id: 'b',
        name: 'Item B',
        value: 1200,
        necessidade: 90,
        urgencia: 80,
        impactoPratico: 75,
        viabilidade: 65,
        risco: 30,
        preferencia: 50,
      },
      monthlySavingsCapacity: 300,
      currentSavings: 0,
    })

    expect(result.itemA.priorityScore).toBe(50.5)
    expect(result.itemB.priorityScore).toBe(73.25)
    expect(result.baselineDaysToItemB).toBe(120)
    expect(result.daysToItemBAfterItemA).toBe(180)
    expect(result.delayDays).toBe(60)
    expect(result.delaysItemB).toBe(true)
  })

  it('builds a recommended purchase ranking with senior analyst decisions', () => {
    const ranking = buildWishlistPurchaseRanking({
      monthlySavingsCapacity: 500,
      currentSavings: 1800,
      items: [
        {
          id: 'console',
          name: 'Console',
          value: 1200,
          necessidade: 30,
          urgencia: 35,
          impactoPratico: 30,
          viabilidade: 45,
          risco: 70,
          preferencia: 90,
        },
        {
          id: 'notebook',
          name: 'Notebook',
          value: 1800,
          necessidade: 95,
          urgencia: 80,
          impactoPratico: 90,
          viabilidade: 65,
          risco: 30,
          preferencia: 60,
        },
      ],
    })

    expect(ranking.map((item) => item.id)).toEqual(['notebook', 'console'])
    expect(ranking[0].decision).toBe('Comprar à vista')
    expect(ranking[0].analystJustification).toContain('maior prioridade')
    expect(ranking[1].decision).toBe('Alto custo de oportunidade')
    expect(ranking[1].analystJustification).toContain('atrasa Notebook')
    expect(ranking[1].comparison?.delayDays).toBe(72)
  })

  it('does not surface technical fallback names or buy-now decisions while quote is pending', () => {
    const ranking = buildWishlistPurchaseRanking({
      monthlySavingsCapacity: 500,
      currentSavings: 2000,
      items: [
        {
          id: 'ps5',
          name: 'functions',
          description: 'PlayStation 5 Slim',
          value: null,
          priceStatus: 'pending_quote',
          price_search_status: 'quote_pending',
          identity_locked: true,
          product_identity: {
            title: 'PlayStation 5 Slim',
          },
          necessidade: 60,
          urgencia: 45,
          impactoPratico: 55,
          viabilidade: 50,
          risco: 35,
          preferencia: 90,
        },
      ],
    })

    expect(ranking[0].name).toBe('PlayStation 5 Slim')
    expect(ranking[0].analystJustification).toContain('PlayStation 5 Slim')
    expect(ranking[0].analystJustification).not.toContain('functions')
    expect(ranking[0].decision).toBe('Simular compra')
    expect(ranking[0].analystJustification).toContain('preco confiavel')
  })

  it('treats quoted items as reliable even when legacy search status is still pending', () => {
    const ranking = buildWishlistPurchaseRanking({
      monthlySavingsCapacity: 500,
      currentSavings: 1800,
      items: [
        {
          id: 'notebook',
          name: 'Notebook para trabalho',
          value: 1800,
          priceStatus: 'quoted',
          price_search_status: 'quote_pending',
          necessidade: 95,
          urgencia: 80,
          impactoPratico: 90,
          viabilidade: 65,
          risco: 30,
          preferencia: 60,
        },
      ],
    })

    expect(ranking[0].decision).toBe('Comprar à vista')
    expect(ranking[0].analystJustification).toContain('lidera o ranking')
  })
})
