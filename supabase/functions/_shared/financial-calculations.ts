import { dateMonthKey, numberValue } from './finance-state.ts'

type JsonRecord = Record<string, unknown>

function array(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as JsonRecord[] : []
}

function normalizedLabel(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isCredit(value: unknown) {
  return normalizedLabel(value) === 'credito'
}

function isBenefit(value: unknown) {
  return ['va', 'vr'].includes(normalizedLabel(value))
}

function expenseMonthKey(expense: JsonRecord) {
  if (isCredit(expense.payment)) {
    const year = numberValue(expense.cardCompetencyYear)
    const month = numberValue(expense.cardCompetencyMonth)
    if (year && month) return year * 100 + month
    const match = String(expense.date || '').match(/^(\d{4})-(\d{2})/)
    if (!match) return 0
    const shifted = new Date(Number(match[1]), Number(match[2]), 1)
    return shifted.getFullYear() * 100 + shifted.getMonth() + 1
  }
  return dateMonthKey(expense.date)
}

export function calculateMonthlyReport(state: JsonRecord, year: number, month: number) {
  const key = year * 100 + month
  const incomes = array(state.incomes).filter((item) => dateMonthKey(item.date) === key)
  const expenses = array(state.expenses).filter((item) => expenseMonthKey(item) === key)
  const bankIncome = incomes
    .filter((item) => !isBenefit(item.type))
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const benefitCredits = incomes
    .filter((item) => isBenefit(item.type))
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const confirmedTransferIds = new Set(
    array(state.internalTransfers)
      .filter((item) => dateMonthKey(item.date) === key)
      .filter((item) => item.confirmedAt || item.transferConfirmedAt || item.confirmed !== false)
      .map((item) => String(item.id || '')),
  )
  const realExpenses = expenses.filter((item) => {
    const transferId = String(item.transferId || item.transfer_group_id || '')
    return !item.isInternalTransfer && !item.is_internal_transfer && !confirmedTransferIds.has(transferId)
  })
  const bankExpenses = realExpenses
    .filter((item) => !isCredit(item.payment) && !isBenefit(item.payment))
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const cardExpenses = realExpenses
    .filter((item) => isCredit(item.payment))
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const benefitExpenses = realExpenses
    .filter((item) => isBenefit(item.payment))
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const byCategory = realExpenses.reduce<Record<string, number>>((totals, item) => {
    const category = String(item.category || 'Outros')
    totals[category] = (totals[category] || 0) + numberValue(item.amount)
    return totals
  }, {})
  const categoryTotal = Object.values(byCategory).reduce((sum, value) => sum + value, 0)
  const totalExpenses = bankExpenses + cardExpenses + benefitExpenses

  return {
    year,
    month,
    income: { bank: bankIncome, benefits: benefitCredits, total: bankIncome + benefitCredits },
    expenses: {
      bank: bankExpenses,
      card: cardExpenses,
      benefits: benefitExpenses,
      total: totalExpenses,
    },
    result: bankIncome - bankExpenses - cardExpenses,
    benefitBalanceChange: benefitCredits - benefitExpenses,
    byCategory,
    reconciliation: {
      categoryTotal,
      expenseTotal: totalExpenses,
      matches: Math.abs(categoryTotal - totalExpenses) < 0.01,
    },
    excludedInternalTransfers: confirmedTransferIds.size,
  }
}

export function calculateNetWorth(state: JsonRecord) {
  const accounts = array(state.financialAccounts)
  const bankBalance = accounts
    .filter((item) => String(item.type || '') !== 'Conta Investimento')
    .reduce((sum, item) => sum + numberValue(item.balance), 0)
  const investments = accounts
    .filter((item) => String(item.type || '') === 'Conta Investimento')
    .reduce((sum, item) => sum + numberValue(item.balance), 0)
  const reserve = numberValue((state.settings as JsonRecord | undefined)?.emergencyReserveCurrent)
  const declaredCardBills = array(state.creditCards).reduce((sum, card) => {
    const current = numberValue(card.openBill ?? card.currentBill ?? card.bill)
    const closedUnpaid = numberValue(card.closedUnpaidBill ?? card.unpaidBill)
    return sum + current + closedUnpaid
  }, 0)
  const openCardBills = declaredCardBills || array(state.expenses)
    .filter((item) => isCredit(item.payment) && item.paid !== true)
    .reduce((sum, item) => sum + numberValue(item.amount), 0)
  const debts = array(state.sharedDebts).reduce((sum, item) => sum + numberValue(item.balance), 0)
  const liabilities = openCardBills + debts
  return {
    assets: { bankAccounts: bankBalance, investments, emergencyReserve: reserve, total: bankBalance + investments + reserve },
    liabilities: { cardBills: openCardBills, debts, total: liabilities },
    netWorth: bankBalance + investments + reserve - liabilities,
    excluded: { benefitAccounts: true, cardLimits: true, internalTransfers: true },
  }
}
