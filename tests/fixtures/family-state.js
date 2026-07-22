import { SPLIT_MODES } from '@/constants/family.js'

export const memberA = { id: 'm-a', name: 'Allan', role: 'administrator', email: 'allan@test.com' }
export const memberB = { id: 'm-b', name: 'Jessica', role: 'member', email: 'jessica@test.com' }

export function createFamilyState(overrides = {}) {
  return {
    settings: { year: 2026, selectedMonth: 6, familyModeEnabled: true, currentMemberId: 'm-a' },
    family: { id: 'fam-1', name: 'Família Teste', adminMemberId: 'm-a' },
    familyMembers: [memberA, memberB],
    familyInvites: [],
    sharedDebts: [],
    sharedGoals: [],
    settlements: [],
    auditLog: [],
    incomes: [
      { id: 'i1', date: '2026-06-01', amount: 8000, familyMemberId: 'm-a' },
      { id: 'i2', date: '2026-06-05', amount: 5000, familyMemberId: 'm-b' },
    ],
    expenses: [
      {
        id: 'e1',
        date: '2026-06-10',
        amount: 300,
        isShared: true,
        paidByMemberId: 'm-a',
        splitMode: SPLIT_MODES.PERCENT,
        splits: [
          { memberId: 'm-a', percent: 50 },
          { memberId: 'm-b', percent: 50 },
        ],
      },
    ],
    financialAccounts: [
      { id: 'acc-a', name: 'Conta Allan', balance: 1000, memberId: 'm-a', type: 'Conta Corrente' },
      { id: 'acc-b', name: 'Conta Jessica', balance: 500, memberId: 'm-b', type: 'Conta Corrente' },
    ],
    benefitWallets: [],
    creditCards: [],
    wishlist: [],
    priorityQueue: [],
    ...overrides,
  }
}

export function mockCalcMonth(month) {
  return {
    incomeCash: month === 6 ? 13000 : 0,
    vaIncome: 0,
    cashExpenses: month === 6 ? 2000 : 0,
    cardBill: month === 6 ? 500 : 0,
    cashBalance: 1500,
  }
}
