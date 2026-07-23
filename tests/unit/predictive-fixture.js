export function predictiveState() {
  return {
    settings: { year: 2026, selectedMonth: 6, minimumReserve: 1000 },
    financialAccounts: [{ id: 'cash-1', name: 'Conta', balance: 6000 }],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [
      { id: 'e1', date: '2026-06-02', category: 'Mercado', amount: 900, payment: 'Pix' },
      { id: 'e2', date: '2026-06-10', category: 'Lazer', amount: 500, payment: 'Pix' },
      { id: 'e3', date: '2026-06-12', category: 'Cartao', amount: 600, payment: 'Credito' },
      { id: 't1', date: '2026-06-12', category: 'Outros', amount: 1000, isInternalTransfer: true },
      { id: 'b1', date: '2026-06-12', category: 'Mercado', amount: 300, payment: 'VA' },
      { id: 'h1', date: '2026-05-10', category: 'Mercado', amount: 700, payment: 'Pix' },
      { id: 'h2', date: '2026-04-10', category: 'Mercado', amount: 650, payment: 'Pix' },
      { id: 'h3', date: '2026-03-10', category: 'Mercado', amount: 620, payment: 'Pix' },
    ],
    categoryBudgets: [
      { id: 'b-mercado', month_key: 202606, category: 'Mercado', planned: 1200 },
      { id: 'b-lazer', month_key: 202606, category: 'Lazer', planned: 400 },
    ],
    planningGoals: [
      { id: 'g1', name: 'Reserva', status: 'active', monthly_contribution: 500 },
    ],
  }
}
