import { describe, expect, it } from 'vitest'
import { forecastCategorySpending } from '@/domain/predictive/index.js'
import { predictiveState } from './predictive-fixture.js'

describe('Release 9 predictive category spending forecast', () => {
  it('projects category spending without internal transfers or VA/VR', () => {
    const rows = forecastCategorySpending(predictiveState(), '2026-06-15')
    const mercado = rows.find((row) => row.category === 'Mercado')

    expect(mercado.actual).toBe(900)
    expect(mercado.projected).toBe(1800)
    expect(mercado.risk).toBe('critical')
  })
})
