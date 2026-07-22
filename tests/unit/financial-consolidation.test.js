import { describe, it, expect } from 'vitest'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import {
  computeConsolidatedPatrimony,
  suggestExpenseSource,
  getSourceLabel,
} from '@/utils/financial-consolidation.js'

const state = {
  settings: { emergencyReserveCurrent: 2000 },
  financialAccounts: [
    { id: 'acc1', name: 'Nubank', balance: 3000, type: 'Conta Corrente' },
    { id: 'inv1', name: 'CDB', balance: 5000, type: 'Conta Investimento' },
  ],
  benefitWallets: [
    { id: 'va1', name: 'VA Empresa', kind: 'va', balance: 400 },
    { id: 'vr1', name: 'VR Empresa', kind: 'vr', balance: 200 },
  ],
  creditCards: [{ id: 'card1', name: 'Visa', limit: 5000, availableLimit: 3500 }],
}

describe('computeConsolidatedPatrimony', () => {
  it('soma contas, benefícios e reserva sem incluir limite de cartão', () => {
    const p = computeConsolidatedPatrimony(state, { cardBill: 800 })
    expect(p.bankBalance).toBe(3000)
    expect(p.investments).toBe(5000)
    expect(p.vaBalance).toBe(400)
    expect(p.vrBalance).toBe(200)
    expect(p.netPatrimony).toBe(3000 + 5000 + 400 + 200 + 2000)
    expect(p.cardLimits).toBe(5000)
    expect(p.cardBill).toBe(800)
  })
})

describe('suggestExpenseSource', () => {
  it('prioriza VA para categoria Mercado', () => {
    const { best } = suggestExpenseSource(state, { category: 'Mercado', amount: 100 })
    expect(best.sourceType).toBe(SOURCE_TYPES.BENEFIT_VA)
    expect(best.payment).toBe('VA')
    expect(best.sufficient).toBe(true)
  })

  it('prioriza VR para Restaurante', () => {
    const { best } = suggestExpenseSource(state, { category: 'Restaurante', amount: 50 })
    expect(best.sourceType).toBe(SOURCE_TYPES.BENEFIT_VR)
  })

  it('não recomenda fonte sem saldo suficiente como melhor ação', () => {
    const { best, alternatives } = suggestExpenseSource({
      ...state,
      financialAccounts: [],
      creditCards: [],
      benefitWallets: [{ id: 'va-empty', name: 'VA vazio', kind: 'va', balance: 0 }],
    }, { category: 'Mercado', amount: 80 })

    expect(best).toBeNull()
    expect(alternatives[0]).toMatchObject({
      sourceType: SOURCE_TYPES.BENEFIT_VA,
      sufficient: false,
    })
  })

  it('cai para conta ou cartão quando o benefício sugerido não cobre o gasto', () => {
    const { best } = suggestExpenseSource({
      ...state,
      benefitWallets: [{ id: 'va-empty', name: 'VA vazio', kind: 'va', balance: 0 }],
    }, { category: 'Mercado', amount: 80 })

    expect(best).toMatchObject({
      sourceType: SOURCE_TYPES.ACCOUNT,
      payment: 'Pix',
      sufficient: true,
    })
  })
})

describe('getSourceLabel', () => {
  it('resolve nome da conta', () => {
    expect(getSourceLabel(state, SOURCE_TYPES.ACCOUNT, 'acc1')).toBe('Nubank')
  })

  it('retorna traço sem id', () => {
    expect(getSourceLabel(state, SOURCE_TYPES.ACCOUNT, null)).toBe('—')
  })
})
