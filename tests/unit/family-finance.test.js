import { describe, it, expect } from 'vitest'
import { SPLIT_MODES } from '@/constants/family.js'
import {
  allocateSplitAmounts,
  computeInternalBalances,
  computeFairnessSplit,
  canPerform,
  memberName,
} from '@/utils/family-finance.js'
import { createFamilyState } from '../fixtures/family-state.js'

describe('allocateSplitAmounts', () => {
  it('divide por percentual', () => {
    const rows = allocateSplitAmounts(200, [
      { memberId: 'a', percent: 60 },
      { memberId: 'b', percent: 40 },
    ], SPLIT_MODES.PERCENT)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ memberId: 'a', amount: 120, percent: 60 })
    expect(rows[1]).toMatchObject({ memberId: 'b', amount: 80, percent: 40 })
  })

  it('divide por valor fixo', () => {
    const rows = allocateSplitAmounts(100, [
      { memberId: 'a', fixedAmount: 70 },
      { memberId: 'b', fixedAmount: 30 },
    ], SPLIT_MODES.FIXED)
    expect(rows[0].amount).toBe(70)
    expect(rows[1].amount).toBe(30)
  })

  it('divide por cotas', () => {
    const rows = allocateSplitAmounts(90, [
      { memberId: 'a', shares: 2 },
      { memberId: 'b', shares: 1 },
    ], SPLIT_MODES.SHARES)
    expect(rows[0].amount).toBe(60)
    expect(rows[1].amount).toBe(30)
  })

  it('retorna vazio para total zero', () => {
    expect(allocateSplitAmounts(0, [{ memberId: 'a', percent: 50 }])).toEqual([])
  })
})

describe('computeInternalBalances', () => {
  it('calcula quem deve ao pagador em despesa compartilhada 50/50', () => {
    const state = createFamilyState()
    const pairs = computeInternalBalances(state)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({
      fromMemberId: 'm-b',
      toMemberId: 'm-a',
      amount: 150,
    })
    expect(pairs[0].fromName).toBe('Jessica')
    expect(pairs[0].toName).toBe('Allan')
  })

  it('registra acertos na estrutura de saldos', () => {
    const state = createFamilyState()
    expect(state.settlements).toEqual([])
    const withSettlement = createFamilyState({
      settlements: [{ fromMemberId: 'm-b', toMemberId: 'm-a', amount: 50 }],
    })
    expect(withSettlement.settlements).toHaveLength(1)
  })
})

describe('computeFairnessSplit', () => {
  it('sugere percentuais proporcionais à renda', () => {
    const state = createFamilyState()
    const fairness = computeFairnessSplit(state, 6)
    const allan = fairness.find((r) => r.memberId === 'm-a')
    const jessica = fairness.find((r) => r.memberId === 'm-b')
    expect(allan.suggestedPercent).toBeCloseTo(61.5, 0)
    expect(jessica.suggestedPercent).toBeCloseTo(38.5, 0)
  })

  it('divide igualmente quando não há renda', () => {
    const state = createFamilyState({ incomes: [] })
    const fairness = computeFairnessSplit(state, 6)
    fairness.forEach((r) => expect(r.suggestedPercent).toBe(50))
  })
})

describe('canPerform', () => {
  it('administrador pode tudo', () => {
    expect(canPerform('administrator', 'invite')).toBe(true)
    expect(canPerform('administrator', 'remove_member')).toBe(true)
  })

  it('membro não gerencia permissões', () => {
    expect(canPerform('member', 'invite')).toBe(false)
    expect(canPerform('member', 'view')).toBe(true)
  })

  it('visualizador só consulta', () => {
    expect(canPerform('viewer', 'view')).toBe(true)
    expect(canPerform('viewer', 'invite')).toBe(false)
  })
})

describe('memberName', () => {
  it('retorna traço para id desconhecido', () => {
    expect(memberName(createFamilyState(), 'x')).toBe('—')
  })
})
