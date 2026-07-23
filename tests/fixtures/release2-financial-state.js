export function release2FinancialState() {
  return {
    settings: {
      emergencyReserveCurrent: 0,
      emergencyReserveMinimum: 0,
      monthlyRecurringExpenses: 1200,
      monthlyDebtPayments: 0,
    },
    financialAccounts: [
      { id: 'checking', name: 'Conta principal', type: 'Conta Corrente', balance: 8200 },
      { id: 'investment', name: 'Investimentos', type: 'Conta Investimento', balance: 1000 },
    ],
    creditCards: [
      { id: 'card-1', name: 'Cartao principal', limit: 2000, openBill: 920, closingDay: 20, dueDay: 20 },
    ],
    benefitWallets: [
      { id: 'va-1', name: 'VA', kind: 'va', balance: 282, monthlyRecharge: 682, rechargeDay: 1 },
      { id: 'vr-1', name: 'VR', kind: 'vr', balance: 150, monthlyRecharge: 150, rechargeDay: 1 },
    ],
    sharedDebts: [],
    internalTransfers: [
      { id: 'transfer-1', transferGroupId: 'group-1', date: '2026-06-12', amount: 4200, confirmed: true },
    ],
    incomes: [
      { id: 'salary-jun', date: '2026-06-05', type: 'Salario', description: 'Salario Empresa', amount: 3000 },
      { id: 'salary-may', date: '2026-05-05', type: 'Salario', description: 'Salario Empresa', amount: 3000 },
      { id: 'salary-apr', date: '2026-04-05', type: 'Salario', description: 'Salario Empresa', amount: 3000 },
      { id: 'salary-mar', date: '2026-03-05', type: 'Salario', description: 'Salario Empresa', amount: 3000 },
      { id: 'va-credit', date: '2026-06-01', type: 'VA', description: 'Credito VA', amount: 682 },
      { id: 'transfer-income', date: '2026-06-12', type: 'Outros', amount: 4200, transferId: 'group-1' },
    ],
    expenses: [
      { id: 'rent', date: '2026-06-08', payment: 'Pix', category: 'Moradia', description: 'Aluguel', amount: 1200, paid: true, isFixed: true },
      { id: 'market-jun', date: '2026-06-10', payment: 'Pix', category: 'Mercado', description: 'Mercado mensal', amount: 840, paid: true },
      { id: 'market-may', date: '2026-05-10', payment: 'Pix', category: 'Mercado', description: 'Mercado mensal', amount: 620, paid: true },
      { id: 'market-apr', date: '2026-04-10', payment: 'Pix', category: 'Mercado', description: 'Mercado mensal', amount: 600, paid: true },
      { id: 'market-mar', date: '2026-03-10', payment: 'Pix', category: 'Mercado', description: 'Mercado mensal', amount: 640, paid: true },
      { id: 'small-jun', date: '2026-06-10', payment: 'Pix', category: 'Taxas', description: 'Taxa pequena', amount: 10, paid: true },
      { id: 'small-may', date: '2026-05-10', payment: 'Pix', category: 'Taxas', description: 'Taxa pequena', amount: 5, paid: true },
      { id: 'small-apr', date: '2026-04-10', payment: 'Pix', category: 'Taxas', description: 'Taxa pequena', amount: 5, paid: true },
      { id: 'netflix-jun', date: '2026-06-10', payment: 'Credito', creditCardId: 'card-1', category: 'Assinaturas', description: 'Netflix', amount: 39.9, paid: false },
      { id: 'netflix-may', date: '2026-05-10', payment: 'Credito', creditCardId: 'card-1', category: 'Assinaturas', description: 'Netflix', amount: 39.9, paid: true },
      { id: 'netflix-apr', date: '2026-04-10', payment: 'Credito', creditCardId: 'card-1', category: 'Assinaturas', description: 'Netflix', amount: 39.9, paid: true },
      { id: 'card-purchase', date: '2026-06-11', payment: 'Credito', creditCardId: 'card-1', category: 'Transporte', description: 'Pecas do carro', amount: 880.1, paid: false },
      { id: 'va-purchase', date: '2026-06-11', payment: 'VA', sourceId: 'va-1', category: 'Mercado', description: 'Compra VA', amount: 400, paid: true },
      { id: 'transfer-expense', date: '2026-06-12', payment: 'Pix', category: 'Transferencia', amount: 4200, transferId: 'group-1', paid: true },
    ],
    recurringIncomes: [
      { id: 'salary-rule', type: 'Salario', description: 'Salario Empresa', amount: 3000, dayOfMonth: 5, active: true },
    ],
    wishlist: [],
  }
}
