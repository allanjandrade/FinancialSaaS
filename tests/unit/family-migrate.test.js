import { describe, it, expect } from 'vitest'
import { ensureFamilyMode } from '@/utils/family-migrate.js'
import { FAMILY_ROLES } from '@/constants/family.js'

describe('ensureFamilyMode', () => {
  it('cria família e membro titular em estado vazio', () => {
    const state = {
      settings: {},
      expenses: [],
      incomes: [],
    }
    const changed = ensureFamilyMode(state)
    expect(changed).toBe(true)
    expect(state.family).toBeTruthy()
    expect(state.familyMembers).toHaveLength(1)
    expect(state.familyMembers[0].role).toBe(FAMILY_ROLES.ADMINISTRATOR)
    expect(state.settings.familyModeEnabled).toBe(true)
    expect(state.familyInvites).toEqual([])
  })

  it('normaliza despesas compartilhadas e splits', () => {
    const state = {
      settings: { currentMemberId: 'm1' },
      family: { id: 'f1', adminMemberId: 'm1' },
      familyMembers: [{ id: 'm1', name: 'A', role: 'administrator' }],
      expenses: [{ id: 'e1', amount: 10, date: '2026-01-01', familyMemberId: 'm1' }],
      incomes: [{ id: 'i1', amount: 100, date: '2026-01-01' }],
    }
    ensureFamilyMode(state)
    expect(state.expenses[0].isShared).toBe(false)
    expect(state.expenses[0].splitMode).toBe('percent')
    expect(state.expenses[0].paidByMemberId).toBe('m1')
    expect(state.incomes[0].ownerMemberId).toBe('m1')
  })
})
