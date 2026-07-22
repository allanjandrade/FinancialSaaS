import { describe, expect, it } from 'vitest'
import { ensureFinancialStructure } from '@/utils/financial-structure-migrate.js'

describe('financial structure migration', () => {
  it('normalizes legacy benefit wallets with type but no kind', () => {
    const state = {
      settings: { vaInitialBalance: 0 },
      familyMembers: [{ id: 'member-1', name: 'Titular' }],
      financialAccounts: [{ id: 'account-1', name: 'Conta', type: 'Conta Corrente', balance: 0 }],
      creditCards: [],
      benefitWallets: [{ id: 'benefit-legacy', name: 'VR', type: 'VR', balance: 430 }],
      expenses: [],
      incomes: [],
    }

    ensureFinancialStructure(state)

    expect(state.benefitWallets.find((wallet) => wallet.id === 'benefit-legacy')).toMatchObject({
      kind: 'vr',
      memberId: 'member-1',
      balance: 430,
    })
  })
})
