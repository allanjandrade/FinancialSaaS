const STORAGE_KEY = "controle-financeiro-app-v1";

const EMPTY_STATE = {
  settings: {
    year: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    cardLimit: 0,
    cardClosingDay: 1,
    cardDueDay: 10,
    vaInitialBalance: 0,
  },
  incomes: [],
  expenses: [],
};

let state = null;

export function getState() {
  return state;
}

export function setState(newState) {
  state = newState;
}

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state = structuredClone(EMPTY_STATE);
    return state;
  }
  try {
    const parsed = JSON.parse(saved);
    state = {
      settings: { ...EMPTY_STATE.settings, ...parsed.settings },
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
    return state;
  } catch {
    state = structuredClone(EMPTY_STATE);
    return state;
  }
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeState(value) {
  return {
    settings: { ...EMPTY_STATE.settings, ...value.settings },
    incomes: Array.isArray(value.incomes) ? value.incomes : [],
    expenses: Array.isArray(value.expenses) ? value.expenses : [],
  };
}

export { EMPTY_STATE, STORAGE_KEY };
