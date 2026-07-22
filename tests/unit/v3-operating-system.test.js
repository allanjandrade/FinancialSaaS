import { describe, expect, it } from 'vitest'
import { buildV3OperatingSystem } from '@/domain/v3/financialOperatingSystem.js'

describe('V3 financial operating system', () => {
  it('turns disconnected modules into one monthly execution flow', () => {
    const system = buildV3OperatingSystem({
      command: {
        mode: 'critical',
        score: { score: 42 },
        primaryAction: { key: 'first-income', label: 'Cadastrar receita', route: '/entries' },
        actionPlan: [
          { key: 'first-income', label: 'Cadastrar receita', route: '/entries', priority: 'critical' },
          { key: 'pause-disposable-subscriptions', label: 'Revisar assinaturas', route: '/subscriptions', priority: 'high' },
        ],
      },
      state: {
        entries: [],
        accounts: [],
        cards: [],
        subscriptions: [
          { id: 'sub-1', status: 'active', amount: 30, is_essential: false },
        ],
        wishlist: [
          { id: 'wish-1', decision: 'wait' },
        ],
      },
      monthData: { income: 0, expenses: 30, cardBill: 0, cashBalance: -30 },
      availableBalance: -30,
    })

    expect(system.homeRoute).toBe('/dashboard')
    expect(system.analysisRoute).toBe('/analysis')
    expect(system.headline).toBe('Sistema operacional financeiro do mês')
    expect(system.activeStage.key).toBe('foundation')
    expect(system.stages.map((stage) => stage.key)).toEqual([
      'foundation',
      'control',
      'commitments',
      'decisions',
      'intelligence',
    ])
    expect(system.stages[0]).toMatchObject({
      label: 'Base financeira',
      route: '/entries',
      state: 'critical',
    })
    expect(system.stages[2]).toMatchObject({
      label: 'Compromissos recorrentes',
      route: '/subscriptions',
      state: 'attention',
    })
  })

  it('promotes command health when the user already has financial base and positive free balance', () => {
    const system = buildV3OperatingSystem({
      command: {
        mode: 'stable',
        score: { score: 82 },
        primaryAction: { key: 'maintain-monthly-cadence', label: 'Manter cadência', route: '/reports' },
        actionPlan: [],
      },
      state: {
        entries: [{ type: 'income', amount: 5000 }, { type: 'expense', amount: 1400 }],
        accounts: [{ id: 'acc-1' }],
        cards: [{ id: 'card-1' }],
        subscriptions: [{ id: 'sub-1', status: 'active', amount: 39.9, is_essential: true }],
        wishlist: [],
      },
      monthData: { income: 5000, expenses: 1400, cardBill: 450, cashBalance: 3600 },
      availableBalance: 3150,
    })

    expect(system.activeStage.key).toBe('intelligence')
    expect(system.summary).toContain('5 módulos conectados')
    expect(system.stages.every((stage) => ['healthy', 'ready'].includes(stage.state))).toBe(true)
  })
})
