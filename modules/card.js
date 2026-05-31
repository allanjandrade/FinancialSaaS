import { getState } from "../store/state.js";

export function calculateCardCompetency(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const closingDay = getState().settings.cardClosingDay || 1;
  
  // If purchase is on or before closing day, invoice is next month
  // If purchase is after closing day, invoice is month after next
  let competencyMonth, competencyYear;
  
  if (day <= closingDay) {
    // Invoice next month
    const nextMonth = new Date(year, month, 1);
    competencyMonth = nextMonth.getMonth() + 1;
    competencyYear = nextMonth.getFullYear();
  } else {
    // Invoice month after next
    const nextNextMonth = new Date(year, month + 1, 1);
    competencyMonth = nextNextMonth.getMonth() + 1;
    competencyYear = nextNextMonth.getFullYear();
  }
  
  return { competencyMonth, competencyYear };
}

export function checkCardLimit(dateString, amount) {
  const state = getState();
  const cardLimit = state.settings.cardLimit || 0;
  
  if (cardLimit === 0) return { valid: true };
  
  const { competencyMonth, competencyYear } = calculateCardCompetency(dateString);
  const competencyKey = competencyYear * 100 + competencyMonth;
  
  // Calculate current bill for that month
  const currentBill = state.expenses
    .filter((item) => {
      if (item.payment !== "Cartao de credito") return false;
      if (item.cardCompetencyMonth && item.cardCompetencyYear) {
        return item.cardCompetencyYear * 100 + item.cardCompetencyMonth === competencyKey;
      }
      return false;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  const futureBill = currentBill + amount;
  
  if (futureBill > cardLimit) {
    return { valid: false, futureBill, cardLimit };
  }
  
  return { valid: true };
}
