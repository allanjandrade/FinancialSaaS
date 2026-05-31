import { getState } from "../store/state.js";
import { calculateCardCompetency } from "./card.js";
import { monthKeyFromDate } from "../utils/dates.js";

const vaCategories = new Set(["Mercado", "Acougue", "Feira"]);

export function isVaExpense(expense) {
  return expense.payment === "Vale alimentacao" && vaCategories.has(expense.category);
}

export function expenseImpactKey(expense) {
  // Cash payments (Pix, Debito, Dinheiro, Vale alimentacao, Outro) impact immediately
  // Credit card payments impact based on card competency (invoice month)
  if (expense.payment === "Cartao de credito") {
    // Use card competency fields if available, otherwise fall back to old logic
    if (expense.cardCompetencyMonth && expense.cardCompetencyYear) {
      return expense.cardCompetencyYear * 100 + expense.cardCompetencyMonth;
    }
    // Fallback for old expenses without competency fields
    return monthKeyFromDate(expense.date, 1);
  }
  // Cash payments impact the month of the purchase
  return monthKeyFromDate(expense.date, 0);
}

export function createExpense(data) {
  const { date, category, description, payment, amount, paid } = data;
  const expense = {
    id: crypto.randomUUID(),
    date,
    category,
    description,
    payment,
    amount,
    paid,
  };

  // Add card competency fields for credit card expenses
  if (payment === "Cartao de credito") {
    const { competencyMonth, competencyYear } = calculateCardCompetency(expense.date);
    expense.cardCompetencyMonth = competencyMonth;
    expense.cardCompetencyYear = competencyYear;
  }

  return expense;
}

export { vaCategories };
