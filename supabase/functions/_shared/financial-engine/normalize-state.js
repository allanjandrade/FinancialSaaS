function records(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}
function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizedText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function normalizeDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = /* @__PURE__ */ new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : `${match[1]}-${match[2]}-${match[3]}`;
}
function requireReferenceDate(value) {
  const date = normalizeDate(value);
  if (!date) throw new Error("referenceDate deve usar o formato YYYY-MM-DD");
  return date;
}
function monthKey(date) {
  return date.slice(0, 7);
}
function monthPeriod(referenceDate) {
  const [year, month] = referenceDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  };
}
function isBenefitLabel(value) {
  const label = normalizedText(value);
  if (label === "va") return "VA";
  if (label === "vr") return "VR";
  return null;
}
function isCreditCard(value) {
  const label = normalizedText(value);
  return label === "credito" || label === "credit_card" || label === "cartao de credito";
}
function isInvestmentAccount(item) {
  const type = normalizedText(item.type);
  return type.includes("investimento") || type === "investment";
}
function confirmedTransferIds(state) {
  const ids = /* @__PURE__ */ new Set();
  for (const item of records(state.internalTransfers)) {
    if (item.confirmed === false || item.reversed === true) continue;
    for (const value of [item.id, item.transferGroupId, item.transfer_group_id]) {
      if (value) ids.add(String(value));
    }
  }
  return ids;
}
function transactionDate(item, warnings, label) {
  const date = normalizeDate(item.date ?? item.occurredAt ?? item.occurred_at ?? item.created_at);
  if (!date) warnings.push(`${label} sem data valida foi ignorado nos calculos por periodo.`);
  return date;
}
function normalizeTransactions(state, warnings) {
  const transferIds = confirmedTransferIds(state);
  const incomes = records(state.incomes).map((item, index) => {
    const benefitType = isBenefitLabel(item.type ?? item.sourceType);
    const transferId = String(item.transferId ?? item.transferGroupId ?? item.transfer_group_id ?? "");
    return {
      id: String(item.id || `income-${index}`),
      kind: "income",
      date: transactionDate(item, warnings, `Receita ${index + 1}`),
      amount: Math.max(0, finiteNumber(item.amount)),
      description: String(item.description || item.type || "Receita"),
      category: String(item.category || item.type || "A Classificar"),
      paymentMethod: String(item.payment || item.sourceType || ""),
      sourceId: item.sourceId ? String(item.sourceId) : null,
      cardId: null,
      benefitType,
      isFixed: Boolean(item.isFixed ?? item.fixed ?? item.recurringIncomeId),
      isInternalTransfer: Boolean(item.isInternalTransfer ?? item.is_internal_transfer) || transferIds.has(transferId),
      paid: item.paid !== false
    };
  });
  const expenses = records(state.expenses).map((item, index) => {
    const benefitType = isBenefitLabel(item.payment ?? item.sourceType);
    const transferId = String(item.transferId ?? item.transferGroupId ?? item.transfer_group_id ?? "");
    return {
      id: String(item.id || `expense-${index}`),
      kind: "expense",
      date: transactionDate(item, warnings, `Despesa ${index + 1}`),
      amount: Math.max(0, finiteNumber(item.amount)),
      description: String(item.description || "Despesa"),
      category: String(item.category || "A Classificar"),
      paymentMethod: isCreditCard(item.payment) ? "credit_card" : String(item.payment || item.sourceType || ""),
      sourceId: item.sourceId ? String(item.sourceId) : null,
      cardId: item.creditCardId || isCreditCard(item.payment) && item.sourceId ? String(item.creditCardId || item.sourceId) : null,
      benefitType,
      isFixed: Boolean(item.isFixed ?? item.fixed ?? item.recurring ?? item.recurringExpenseId),
      isInternalTransfer: Boolean(item.isInternalTransfer ?? item.is_internal_transfer) || transferIds.has(transferId),
      paid: item.paid === true
    };
  });
  return [...incomes, ...expenses];
}
function normalizeFinanceState(state, referenceDate) {
  const validReferenceDate = requireReferenceDate(referenceDate);
  const warnings = [];
  const rawAccounts = records(state.financialAccounts);
  const accounts = rawAccounts.map((item, index) => ({
    id: String(item.id || `account-${index}`),
    name: String(item.name || `Conta ${index + 1}`),
    type: String(item.type || "Conta"),
    balance: finiteNumber(item.balance),
    isInvestment: isInvestmentAccount(item)
  }));
  if (!accounts.length) warnings.push("Nenhuma conta financeira foi cadastrada.");
  const transactions = normalizeTransactions(state, warnings);
  const benefits = records(state.benefitWallets).map((item, index) => {
    const kind = normalizedText(item.kind ?? item.type);
    return {
      id: String(item.id || `benefit-${index}`),
      name: String(item.name || `Beneficio ${index + 1}`),
      type: kind === "va" ? "VA" : kind === "vr" ? "VR" : "OTHER",
      balance: finiteNumber(item.balance),
      monthlyRecharge: Math.max(0, finiteNumber(item.monthlyRecharge)),
      rechargeDay: Math.max(1, Math.min(31, finiteNumber(item.rechargeDay) || 1))
    };
  });
  const creditExpenses = transactions.filter((item) => item.kind === "expense" && item.paymentMethod === "credit_card" && !item.paid && !item.isInternalTransfer);
  const rawCards = records(state.creditCards);
  const cards = rawCards.map((item, index) => {
    const id = String(item.id || `card-${index}`);
    const declared = finiteNumber(item.openBill ?? item.currentBill ?? item.bill) + finiteNumber(item.closedUnpaidBill ?? item.unpaidBill);
    const inferred = creditExpenses.filter((expense) => expense.cardId === id || !expense.cardId && rawCards.length === 1).reduce((sum, expense) => sum + expense.amount, 0);
    const limit = Math.max(0, finiteNumber(item.limit));
    const openAmount = Math.max(0, declared || inferred);
    return {
      id,
      name: String(item.name || `Cartao ${index + 1}`),
      limit,
      availableLimit: Math.max(0, finiteNumber(item.availableLimit) || limit - openAmount),
      openAmount,
      closingDay: Math.max(1, Math.min(31, finiteNumber(item.closingDay) || 1)),
      dueDay: Math.max(1, Math.min(31, finiteNumber(item.dueDay) || 10))
    };
  });
  const internalTransfers = records(state.internalTransfers).map((item, index) => ({
    id: String(item.id || `transfer-${index}`),
    date: normalizeDate(item.date),
    amount: Math.max(0, finiteNumber(item.amount)),
    confirmed: item.confirmed !== false && item.reversed !== true
  }));
  const debts = records(state.sharedDebts).map((item, index) => ({
    id: String(item.id || `debt-${index}`),
    description: String(item.description || item.name || "Divida"),
    balance: Math.max(0, finiteNumber(item.balance ?? item.amount ?? item.remainingAmount))
  }));
  const recurringRules = [
    ...records(state.recurringIncomes).map((item, index) => ({
      id: String(item.id || `recurring-income-${index}`),
      kind: "income",
      description: String(item.description || item.type || "Receita recorrente"),
      category: String(item.category || item.type || "Receita"),
      amount: Math.max(0, finiteNumber(item.amount)),
      dayOfMonth: Math.max(1, Math.min(31, finiteNumber(item.dayOfMonth) || 1)),
      active: item.active !== false
    })),
    ...records(state.recurringExpenses).map((item, index) => ({
      id: String(item.id || `recurring-expense-${index}`),
      kind: "expense",
      description: String(item.description || item.category || "Despesa recorrente"),
      category: String(item.category || "A Classificar"),
      amount: Math.max(0, finiteNumber(item.amount)),
      dayOfMonth: Math.max(1, Math.min(31, finiteNumber(item.dayOfMonth) || 1)),
      active: item.active !== false
    }))
  ];
  const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
  return {
    referenceDate: validReferenceDate,
    period: monthPeriod(validReferenceDate),
    accounts,
    transactions,
    benefits,
    cards,
    investments: accounts.filter((item) => item.isInvestment).map(({ id, name, balance }) => ({ id, name, balance })),
    internalTransfers,
    debts,
    wishlist: records(state.wishlist).map((item, index) => {
      const currentPrice = finiteNumber(item.currentPrice ?? item.value ?? item.price);
      const targetPrice = finiteNumber(item.targetPrice);
      return {
        id: String(item.id || `wishlist-${index}`),
        name: String(item.name || item.title || "Item sem nome"),
        currentPrice: currentPrice > 0 ? currentPrice : null,
        targetPrice: targetPrice > 0 ? targetPrice : null,
        status: String(item.status || (currentPrice > 0 ? "quoted" : "quote_pending")),
        category: String(item.category || "A Classificar")
      };
    }),
    recurringRules,
    settings: {
      emergencyReserve: Math.max(0, finiteNumber(settings.emergencyReserveCurrent)),
      minimumReserve: Math.max(0, finiteNumber(settings.emergencyReserveMinimum)),
      declaredRecurringExpenses: Math.max(0, finiteNumber(settings.monthlyRecurringExpenses)),
      monthlyDebtPayments: Math.max(0, finiteNumber(settings.monthlyDebtPayments))
    },
    warnings: [...new Set(warnings)]
  };
}
export {
  finiteNumber,
  monthKey,
  monthPeriod,
  normalizeDate,
  normalizeFinanceState,
  normalizedText,
  requireReferenceDate
};
