import { describe, expect, it } from 'vitest'
import {
  buildBudgetRows,
  buildMonthlyPlan,
  buildNarrativeReport,
  recommendInvestmentContribution,
  simulatePlannedPurchase,
} from '@/utils/planning-engine.js'
import {
  canTriggerWishlistTargetAlert,
  chooseBestCompatibleOffer,
  normalizeProductIdentity,
  scoreProductCandidate,
} from '@/utils/productIdentity.js'

function baseState() {
  return {
    settings: { year: 2026, selectedMonth: 6, cardClosingDay: 20 },
    incomes: [
      { id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 },
      { id: 'i2', date: '2026-06-05', type: 'VA', amount: 600 },
    ],
    expenses: [
      { id: 'e1', date: '2026-06-06', category: 'Mercado', payment: 'Debito', amount: 450 },
      { id: 'e2', date: '2026-06-07', category: 'Mercado', payment: 'VA', amount: 220 },
      { id: 'e3', date: '2026-06-08', category: 'Outros', payment: 'Pix', amount: 900, isInternalTransfer: true },
      { id: 'e4', date: '2026-06-10', category: 'Cartao', payment: 'Credito', amount: 700, cardCompetencyMonth: 6, cardCompetencyYear: 2026 },
    ],
    planningGoals: [
      {
        id: 'g1',
        name: 'Reserva',
        type: 'reserva_emergencia',
        target_amount: 10000,
        current_amount: 3000,
        monthly_contribution: 500,
        priority: 1,
        status: 'active',
      },
    ],
    categoryBudgets: [
      { id: 'b1', month_key: 202606, category: 'Mercado', planned: 700 },
    ],
  }
}

describe('Release 8 planning engine', () => {
  it('builds a monthly plan preserving benefit and card rules', () => {
    const plan = buildMonthlyPlan(baseState(), new Date('2026-06-19T12:00:00'))
    expect(plan.benefit_income).toBe(600)
    expect(plan.benefit_spend).toBe(220)
    expect(plan.projected_card_bill).toBe(700)
    expect(plan.safe_balance).toBe(3350)
  })

  it('keeps budget actuals free from internal transfers and VA/VR spend', () => {
    const rows = buildBudgetRows(baseState(), new Date('2026-06-19T12:00:00'))
    expect(rows.find((row) => row.category === 'Mercado').actual).toBe(450)
    expect(rows.find((row) => row.category === 'Outros').actual).toBe(0)
  })

  it('simulates a purchase without creating transactions', () => {
    const result = simulatePlannedPurchase({
      item_name: 'Cadeira',
      amount: 300,
      payment_type: 'cash',
      installments: 1,
      category: 'Outros',
    }, baseState(), new Date('2026-06-19T12:00:00'))
    expect(result.would_write_transaction).toBe(false)
    expect(['can_buy_now', 'wait', 'only_if_adjust_budget']).toContain(result.decision)
  })

  it('blocks investment recommendation when safe balance is negative', () => {
    const state = baseState()
    state.expenses.push({ id: 'e5', date: '2026-06-11', category: 'Moradia', payment: 'Pix', amount: 7000 })
    expect(recommendInvestmentContribution(state, new Date('2026-06-19T12:00:00')).safe_contribution).toBe(0)
  })

  it('uses only deterministic numbers in the narrative report', () => {
    const report = buildNarrativeReport(baseState(), new Date('2026-06-19T12:00:00'))
    expect(report.source).toBe('deterministic')
    expect(report.ai_language_polish_allowed).toBe(false)
    expect(report.paragraphs.join(' ')).toContain(String(report.numbers.safe_balance.toFixed(2)))
  })
})

describe('Release 8 wishlist product identity', () => {
  it('normalizes lanterna tras ld punto into strict Fiat Punto identity', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    expect(identity).toMatchObject({
      product_type: 'auto_part',
      part_name: 'lanterna traseira',
      side: 'right',
      vehicle_make: 'Fiat',
      vehicle_model: 'Punto',
      match_policy: 'strict',
    })
    expect(identity.must_match_terms).toEqual(expect.arrayContaining(['punto', 'lanterna', 'traseira']))
  })

  it('rejects Palio, Siena and Punto left candidates while accepting Punto right', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    expect(scoreProductCandidate({ title: 'Lanterna traseira direita Palio' }, identity).accepted).toBe(false)
    expect(scoreProductCandidate({ title: 'Lanterna traseira direita Siena' }, identity).accepted).toBe(false)
    expect(scoreProductCandidate({ title: 'Lanterna traseira esquerda Fiat Punto' }, identity).accepted).toBe(false)
    expect(scoreProductCandidate({ title: 'Lanterna traseira direita Fiat Punto 2008' }, identity).accepted).toBe(true)
  })

  it('does not choose an incompatible lower price as best offer', () => {
    const identity = normalizeProductIdentity('lanterna tras ld punto')
    const result = chooseBestCompatibleOffer([
      { title: 'Lanterna traseira direita Palio', total: 89 },
      { title: 'Lanterna traseira direita Fiat Punto', total: 320 },
    ], identity)
    expect(result.best_compatible_offer.total).toBe(320)
    expect(result.status).toBe('found_compatible')
  })

  it('requires found_compatible and score >= .85 before target alert', () => {
    expect(canTriggerWishlistTargetAlert({
      price_search_status: 'found_ambiguous',
      last_match_score: 0.92,
      lastQuotedPrice: 100,
      targetPrice: 150,
    })).toBe(false)
    expect(canTriggerWishlistTargetAlert({
      price_search_status: 'found_compatible',
      last_match_score: 0.9,
      lastQuotedPrice: 100,
      targetPrice: 150,
    })).toBe(true)
  })
})
