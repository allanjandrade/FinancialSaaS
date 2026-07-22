import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  answerDecisionQuestion,
  evaluatePriorityQueue,
  evaluatePurchase,
} from '@/utils/financial-planner.js'

describe('Portuguese copy pluralization', () => {
  it('formats purchase wait copy without parenthetical plurals', () => {
    const analysis = evaluatePurchase({ value: 6000 }, {
      monthlySurplus: 1000,
      emergencyReserveCurrent: 5000,
      emergencyReserveMinimum: 5000,
      currentBalance: 5000,
      cardLimit: 1000,
      cardBill: 0,
      activeGoalsValue: 0,
    })

    expect(analysis.recommendation).toBe('Aguardar 6 meses para preservar reserva e fluxo mensal.')
    expect(analysis.strategy).toBe('Reforçar a reserva por mais 6 meses')
    expect(analysis.recommendation).not.toContain('mês(es)')
    expect(analysis.strategy).not.toContain('Guardar por mais')
  })

  it('uses singular and plural month labels consistently in planning answers', () => {
    expect(evaluatePriorityQueue([{ name: 'Reserva', priorityOrder: 1 }], 1000, 1000))
      .toContain('1 mês')
    expect(evaluatePriorityQueue([{ name: 'Reserva', priorityOrder: 1 }], 2000, 1000))
      .toContain('2 meses')

    const oneMonth = {
      monthlySavingNeeded: 500,
      savingsPlan: { months: 1 },
      installments: [],
      reasons: [],
    }
    const twoMonths = {
      monthlySavingNeeded: 500,
      savingsPlan: { months: 2 },
      installments: [],
      reasons: [],
    }

    expect(answerDecisionQuestion('guardar', { name: 'Produto' }, oneMonth, {}))
      .toContain('por 1 mês.')
    expect(answerDecisionQuestion('guardar', { name: 'Produto' }, twoMonths, {}))
      .toContain('por 2 meses.')
  })

  it('removes known parenthetical plurals from user-facing screens and helpers', () => {
    const files = [
      'src/components/MaturityScore.vue',
      'src/components/NotificationBell.vue',
      'src/views/PurchaseDetail.vue',
      'src/views/Admin.vue',
      'src/views/PriceMonitor.vue',
      'src/views/Home.vue',
      'src/views/Family.vue',
      'src/views/IntelligenceCenter.vue',
      'src/utils/financial-intelligence.js',
      'src/utils/marketplace-comparator.js',
      'src/utils/financial-planner.js',
    ]
    const forbidden = [
      'mês(es)',
      'registro(s)',
      'nao lida(s)',
      'melhor(es) oferta(s)',
      'usuario(s) carregado(s)',
      'preço(s)',
      'lancamento(s)',
      'categoria(s)',
      'alerta(s)',
      'membro(s)',
      'ação(ões)',
      'bloco(s)',
      'dia(s)',
      'notificacao(oes)',
    ]

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      for (const snippet of forbidden) {
        expect(source, `${file} should not contain ${snippet}`).not.toContain(snippet)
      }
    }
  })
})
