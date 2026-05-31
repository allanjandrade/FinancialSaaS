import { getState } from "../store/state.js";
import { monthKeyFromDate } from "../utils/dates.js";
import { expenseImpactKey, isVaExpense } from "./expenses.js";

export function selectedKey() {
  const state = getState();
  return state.settings.year * 100 + state.settings.selectedMonth;
}

export function calcMonth(month) {
  const state = getState();
  const key = state.settings.year * 100 + month;
  const incomeCash = state.incomes
    .filter((item) => monthKeyFromDate(item.date) === key && item.type !== "Vale alimentacao")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const vaIncome = state.incomes
    .filter((item) => monthKeyFromDate(item.date) === key && item.type === "Vale alimentacao")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  // Cash expenses: Pix, Debito, Dinheiro, Vale alimentacao, Outro
  const cashExpenses = state.expenses
    .filter((item) => {
      const isCashPayment = item.payment !== "Cartao de credito";
      const impactsThisMonth = expenseImpactKey(item) === key;
      return isCashPayment && impactsThisMonth;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  // Card invoice: only credit card expenses that impact this month
  const cardBill = state.expenses
    .filter((item) => item.payment === "Cartao de credito" && expenseImpactKey(item) === key)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  // VA usage (from cash expenses only)
  const vaUse = state.expenses
    .filter((item) => expenseImpactKey(item) === key && isVaExpense(item))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  return {
    key,
    incomeCash,
    vaIncome,
    cashExpenses,
    cardBill,
    vaUse,
    cashBalance: incomeCash - (cashExpenses - vaUse),
  };
}

export function vaBalanceUntil(month) {
  const state = getState();
  let balance = Number(state.settings.vaInitialBalance || 0);
  for (let current = 1; current <= month; current += 1) {
    const item = calcMonth(current);
    balance += item.vaIncome - item.vaUse;
  }
  return balance;
}

export function categoryTotals() {
  const state = getState();
  const key = selectedKey();
  return state.expenses
    .filter((item) => expenseImpactKey(item) === key)
    .reduce((totals, item) => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount);
      return totals;
    }, {});
}

export function cardCount(key) {
  const state = getState();
  return state.expenses.filter((item) => expenseImpactKey(item) === key && item.payment === "Cartao de credito").length;
}
