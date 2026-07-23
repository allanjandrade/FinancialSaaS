import { describe, expect, it } from 'vitest'
import {
  calculateMonthlyReport,
  calculateNetWorth,
} from '../../supabase/functions/_shared/financial-calculations.ts'

function certificationState() {
  return {
    incomes: [
      { id: 'salary', date: '2026-06-05', type: 'Salario', amount: 3000 },
      { id: 'va-credit', date: '2026-06-05', type: 'VA', amount: 682 },
    ],
    expenses: [
      { id: 'bank-expense', date: '2026-06-10', payment: 'Pix', category: 'Moradia', amount: 530, paid: true },
      { id: 'va-purchase', date: '2026-06-11', payment: 'VA', category: 'Mercado', amount: 400, paid: true },
      {
        id: 'card-bill',
        date: '2026-05-20',
        payment: 'Credito',
        category: 'Transporte',
        amount: 480,
        paid: false,
        cardCompetencyYear: 2026,
        cardCompetencyMonth: 6,
      },
    ],
    internalTransfers: [
      { id: 'transfer', date: '2026-06-12', amount: 4200, confirmed: true, confirmedAt: '2026-06-12T12:00:00Z' },
    ],
    financialAccounts: [
      { id: 'santander', type: 'Conta Corrente', balance: 2470 },
      { id: 'nubank', type: 'Conta Corrente', balance: 4200 },
      { id: 'investment', type: 'Conta Investimento', balance: 1000 },
    ],
    benefitWallets: [{ id: 'va', kind: 'va', balance: 282 }],
    creditCards: [{ id: 'card', limit: 10000, openBill: 480 }],
    sharedDebts: [],
    settings: { emergencyReserveCurrent: 0 },
  }
}

describe('Release 1 financial calculations', () => {
  it('separates bank, card and benefit movements without counting transfers', () => {
    const report = calculateMonthlyReport(certificationState(), 2026, 6)

    expect(report.income.bank).toBe(3000)
    expect(report.income.benefits).toBe(682)
    expect(report.expenses.bank).toBe(530)
    expect(report.expenses.card).toBe(480)
    expect(report.expenses.benefits).toBe(400)
    expect(report.benefitBalanceChange).toBe(282)
    expect(report.result).toBe(1990)
    expect(report.reconciliation.matches).toBe(true)
    expect(report.excludedInternalTransfers).toBe(1)
  })

  it('excludes benefit balances and card limits from net worth', () => {
    const result = calculateNetWorth(certificationState())

    expect(result.assets.bankAccounts).toBe(6670)
    expect(result.assets.investments).toBe(1000)
    expect(result.liabilities.cardBills).toBe(480)
    expect(result.netWorth).toBe(7190)
    expect(result.excluded.benefitAccounts).toBe(true)
    expect(result.excluded.cardLimits).toBe(true)
  })
})
