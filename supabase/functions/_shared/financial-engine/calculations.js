import {
  finiteNumber,
  monthKey,
  normalizedText
} from "./normalize-state.js";
function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
function utcDate(date) {
  return /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
}
function daysInMonth(date) {
  const parsed = utcDate(date);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
}
function currentMonthTransactions(state) {
  const key = monthKey(state.referenceDate);
  return state.transactions.filter((item) => item.date && monthKey(item.date) === key && !item.isInternalTransfer);
}
function realExpense(item) {
  return item.kind === "expense" && !item.isInternalTransfer && !item.benefitType;
}
function realIncome(item) {
  return item.kind === "income" && !item.isInternalTransfer && !item.benefitType;
}
function monthlyIncomeHistory(state) {
  const totals = /* @__PURE__ */ new Map();
  state.transactions.filter(realIncome).forEach((item) => {
    if (!item.date) return;
    totals.set(monthKey(item.date), (totals.get(monthKey(item.date)) || 0) + item.amount);
  });
  return [...totals.values()].filter((value) => value > 0);
}
function incomeIrregularity(state) {
  const history = monthlyIncomeHistory(state);
  if (history.length < 2) return { irregular: false, samples: history.length };
  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - average) ** 2, 0) / history.length;
  return { irregular: average > 0 && Math.sqrt(variance) / average > 0.25, samples: history.length };
}
function calculateFinancialSnapshot(state) {
  const transactions = currentMonthTransactions(state);
  const monthlyIncome = transactions.filter(realIncome).reduce((sum, item) => sum + item.amount, 0);
  const monthlyExpenses = transactions.filter(realExpense).reduce((sum, item) => sum + item.amount, 0);
  const detectedFixed = transactions.filter((item) => realExpense(item) && item.isFixed).reduce((sum, item) => sum + item.amount, 0);
  const fixedCommitments = Math.max(detectedFixed, state.settings.declaredRecurringExpenses) + state.settings.monthlyDebtPayments;
  const variableExpenses = Math.max(0, monthlyExpenses - detectedFixed);
  const realCashBalance = state.accounts.filter((item) => !item.isInvestment).reduce((sum, item) => sum + item.balance, 0);
  const investments = state.investments.reduce((sum, item) => sum + item.balance, 0);
  const benefitsBalance = state.benefits.reduce((sum, item) => sum + item.balance, 0);
  const creditCardOpenAmount = state.cards.reduce((sum, item) => sum + item.openAmount, 0);
  const debts = state.debts.reduce((sum, item) => sum + item.balance, 0);
  const [, , dayText] = state.referenceDate.split("-");
  const elapsedRatio = Number(dayText) / daysInMonth(state.referenceDate);
  const remainingFixed = Math.max(0, fixedCommitments * (1 - elapsedRatio));
  const minimumBuffer = Math.max(state.settings.minimumReserve, monthlyIncome * 0.3);
  const availableToSpend = Math.max(
    0,
    realCashBalance - creditCardOpenAmount - debts - remainingFixed - minimumBuffer
  );
  const warnings = [...state.warnings];
  if (monthlyIncome <= 0) warnings.push("Renda mensal insuficiente para calcular investimento seguro.");
  const safeToInvest = monthlyIncome > 0 ? Math.max(0, availableToSpend - minimumBuffer) : 0;
  return {
    referenceDate: state.referenceDate,
    period: state.period,
    realCashBalance: round(realCashBalance),
    investments: round(investments),
    emergencyReserve: round(state.settings.emergencyReserve),
    benefitsBalance: round(benefitsBalance),
    benefitsExcludedFromNetWorth: true,
    creditCardOpenAmount: round(creditCardOpenAmount),
    debts: round(debts),
    netWorth: round(realCashBalance + investments + state.settings.emergencyReserve - creditCardOpenAmount - debts),
    availableToSpend: round(availableToSpend),
    safeToInvest: round(safeToInvest),
    monthlyIncome: round(monthlyIncome),
    monthlyExpenses: round(monthlyExpenses),
    fixedCommitments: round(fixedCommitments),
    variableExpenses: round(variableExpenses),
    assumptions: {
      minimumBuffer: round(minimumBuffer),
      minimumBufferRule: "Maior valor entre reserva minima configurada e 30% da renda mensal.",
      internalTransfersExcluded: true,
      benefitsExcludedFromNetWorth: true,
      cardLimitsExcludedFromNetWorth: true
    },
    warnings: [...new Set(warnings)]
  };
}
function calculateBenefitBurnRate(state, requestedType) {
  const benefitType = String(requestedType || "").toUpperCase();
  if (!["VA", "VR"].includes(benefitType)) throw new Error("benefitType deve ser VA ou VR");
  const wallets = state.benefits.filter((item) => item.type === benefitType);
  const currentBalance = wallets.reduce((sum, item) => sum + item.balance, 0);
  const month = monthKey(state.referenceDate);
  const expenses = state.transactions.filter((item) => item.kind === "expense" && item.benefitType === benefitType && monthKey(item.date) === month && !item.isInternalTransfer);
  const spentSoFar = expenses.reduce((sum, item) => sum + item.amount, 0);
  const day = Number(state.referenceDate.slice(8, 10));
  const remaining = daysInMonth(state.referenceDate) - day;
  const dailyAverage = day > 0 ? spentSoFar / day : 0;
  const projectedSpendUntilEnd = dailyAverage * remaining;
  const projectedEndBalance = currentBalance - projectedSpendUntilEnd;
  let status = "safe";
  if (!wallets.length || !expenses.length) status = "insufficient_data";
  else if (currentBalance <= 0) status = "depleted";
  else if (projectedEndBalance < 0) status = "risk";
  else if (projectedEndBalance < currentBalance * 0.2) status = "attention";
  const depletionDays = dailyAverage > 0 ? Math.floor(currentBalance / dailyAverage) : null;
  const depletionDate = depletionDays != null && depletionDays <= remaining ? new Date(utcDate(state.referenceDate).getTime() + depletionDays * 864e5).toISOString().slice(0, 10) : null;
  const sustainableDaily = remaining > 0 ? currentBalance / remaining : currentBalance;
  const recommendation = status === "insufficient_data" ? "Cadastre gastos do beneficio para calcular o ritmo de consumo." : status === "depleted" ? `${benefitType} sem saldo disponivel.` : status === "risk" ? `Reduzir gasto diario para R$ ${round(sustainableDaily).toFixed(2)} para durar ate o fim do mes.` : `O saldo suporta ate R$ ${round(sustainableDaily).toFixed(2)} por dia ate o fim do mes.`;
  return {
    benefitType,
    referenceDate: state.referenceDate,
    period: state.period,
    currentBalance: round(currentBalance),
    spentSoFar: round(spentSoFar),
    daysElapsed: day,
    daysRemaining: remaining,
    dailyAverage: round(dailyAverage),
    projectedSpendUntilEnd: round(projectedSpendUntilEnd),
    projectedEndBalance: round(projectedEndBalance),
    estimatedDepletionDate: depletionDate,
    status,
    recommendation,
    assumptions: { creditsIgnoredAsSpend: true, benefitAccountsSeparated: true },
    warnings: wallets.length ? [] : [`Nenhuma carteira ${benefitType} cadastrada.`]
  };
}
function calculateCardRisk(state, cardId) {
  const selectedCards = cardId ? state.cards.filter((item) => item.id === String(cardId)) : state.cards;
  if (cardId && !selectedCards.length) throw new Error("Cartao nao encontrado");
  const snapshot = calculateFinancialSnapshot(state);
  const totalOpenBill = selectedCards.reduce((sum, item) => sum + item.openAmount, 0);
  const totalLimit = selectedCards.reduce((sum, item) => sum + item.limit, 0);
  const billToIncomeRatio = snapshot.monthlyIncome > 0 ? totalOpenBill / snapshot.monthlyIncome : 0;
  const limitUsageRatio = totalLimit > 0 ? totalOpenBill / totalLimit : 0;
  const reference = utcDate(state.referenceDate);
  const dueDates = selectedCards.map((card) => {
    let due = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), card.dueDay));
    if (due < reference) due = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, card.dueDay));
    return due;
  });
  const daysToDueDate = dueDates.length ? Math.min(...dueDates.map((due) => Math.ceil((due.getTime() - reference.getTime()) / 864e5))) : null;
  let riskLevel = "safe";
  if (!selectedCards.length || snapshot.monthlyIncome <= 0) riskLevel = "insufficient_data";
  else if (billToIncomeRatio > 0.5) riskLevel = "critical";
  else if (billToIncomeRatio > 0.35) riskLevel = "risk";
  else if (billToIncomeRatio > 0.2) riskLevel = "attention";
  const irregularity = incomeIrregularity(state);
  if (irregularity.irregular) {
    riskLevel = { safe: "attention", attention: "risk", risk: "critical" }[riskLevel] || riskLevel;
  }
  const reasons = [];
  if (snapshot.monthlyIncome > 0) reasons.push(`Fatura representa ${round(billToIncomeRatio * 100, 1)}% da renda mensal.`);
  if (daysToDueDate != null) reasons.push(`Vencimento mais proximo em ${daysToDueDate} dia(s).`);
  if (irregularity.irregular) reasons.push("Renda variou mais de 25% entre os meses analisados.");
  const recommendedMaxNewPurchase = snapshot.monthlyIncome > 0 ? Math.max(0, snapshot.monthlyIncome * 0.35 - totalOpenBill) : 0;
  return {
    referenceDate: state.referenceDate,
    period: state.period,
    cardId: cardId ? String(cardId) : null,
    totalOpenBill: round(totalOpenBill),
    monthlyIncome: snapshot.monthlyIncome,
    billToIncomeRatio: round(billToIncomeRatio, 4),
    limitUsageRatio: round(limitUsageRatio, 4),
    daysToDueDate,
    riskLevel,
    reasons,
    recommendedMaxNewPurchase: round(recommendedMaxNewPurchase),
    assumptions: { incomeRiskBands: [0.2, 0.35, 0.5], irregularIncomeAdjustment: true },
    warnings: selectedCards.length ? [] : ["Nenhum cartao cadastrado."]
  };
}
function calculateMonthEndProjection(state) {
  const current = currentMonthTransactions(state);
  const day = Number(state.referenceDate.slice(8, 10));
  const totalDays = daysInMonth(state.referenceDate);
  const confirmedIncome = current.filter(realIncome).reduce((sum, item) => sum + item.amount, 0);
  const expenseItems = current.filter(realExpense);
  const confirmedExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const fixedSpent = expenseItems.filter((item) => item.isFixed).reduce((sum, item) => sum + item.amount, 0);
  const variableSpent = Math.max(0, confirmedExpenses - fixedSpent);
  const projectedVariable = day > 0 ? variableSpent / day * totalDays : variableSpent;
  const declaredFixed = Math.max(fixedSpent, state.settings.declaredRecurringExpenses) + state.settings.monthlyDebtPayments;
  const recurringIncome = state.recurringRules.filter((item) => item.active && item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const history = monthlyIncomeHistory(state);
  const historicalIncome = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : 0;
  const projectedIncome = Math.max(confirmedIncome, recurringIncome, historicalIncome);
  const projectedExpenses = Math.max(confirmedExpenses, declaredFixed + projectedVariable);
  const projectedCardBill = state.cards.reduce((sum, item) => sum + item.openAmount, 0);
  const benefitProjection = state.benefits.reduce((sum, benefit) => {
    if (benefit.type === "OTHER") return sum + benefit.balance;
    const burn = calculateBenefitBurnRate(state, benefit.type);
    return sum + Math.max(0, burn.projectedEndBalance);
  }, 0);
  const projectedNetCashFlow = projectedIncome - projectedExpenses;
  const minimumBuffer = projectedIncome * 0.3;
  const projectedAvailableToInvest = Math.max(0, projectedNetCashFlow - minimumBuffer);
  const uncategorized = expenseItems.filter((item) => item.category === "A Classificar").length;
  const dataFactors = [
    Math.min(1, day / 15),
    Math.min(1, current.length / 12),
    projectedIncome > 0 ? 1 : 0,
    expenseItems.length ? 1 - uncategorized / expenseItems.length : 0
  ];
  const confidence = dataFactors.reduce((sum, value) => sum + value, 0) / dataFactors.length;
  const warnings = [];
  if (day < 15) warnings.push(`Projecao baseada em apenas ${day} dias do mes.`);
  if (current.length < 6) warnings.push("Poucos lancamentos reduzem a confianca da projecao.");
  if (projectedIncome <= 0) warnings.push("Renda nao cadastrada para o periodo.");
  if (uncategorized) warnings.push(`${uncategorized} despesa(s) ainda estao sem classificacao.`);
  return {
    referenceDate: state.referenceDate,
    period: state.period,
    projectedIncome: round(projectedIncome),
    confirmedIncome: round(confirmedIncome),
    projectedExpenses: round(projectedExpenses),
    confirmedExpenses: round(confirmedExpenses),
    projectedCardBill: round(projectedCardBill),
    projectedBenefitBalance: round(benefitProjection),
    projectedNetCashFlow: round(projectedNetCashFlow),
    projectedAvailableToInvest: round(projectedAvailableToInvest),
    confidence: round(confidence, 2),
    assumptions: {
      variableSpendUsesDailyAverage: true,
      fixedCommitments: round(declaredFixed),
      benefitsSeparatedFromCashFlow: true
    },
    warnings
  };
}
function previousMonthKeys(referenceDate, count) {
  const reference = utcDate(referenceDate);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - index - 1, 1));
    return date.toISOString().slice(0, 7);
  });
}
function calculateCategoryAnomalies(state, lookbackMonths = 3) {
  const safeLookback = Math.max(1, Math.min(12, Math.floor(finiteNumber(lookbackMonths) || 3)));
  const currentKey = monthKey(state.referenceDate);
  const historyKeys = previousMonthKeys(state.referenceDate, safeLookback);
  const expenses = state.transactions.filter((item) => item.kind === "expense" && !item.isInternalTransfer);
  const categoryChannels = new Set(expenses.filter((item) => monthKey(item.date) === currentKey).map((item) => `${item.category}\0${item.benefitType || "cash"}`));
  const anomalies = [...categoryChannels].map((categoryChannel) => {
    const [category, channel] = categoryChannel.split("\0");
    const matchesChannel = (item) => (item.benefitType || "cash") === channel;
    const currentAmount = expenses.filter((item) => monthKey(item.date) === currentKey && item.category === category && matchesChannel(item)).reduce((sum, item) => sum + item.amount, 0);
    const history = historyKeys.map((key) => expenses.filter((item) => monthKey(item.date) === key && item.category === category && matchesChannel(item)).reduce((sum, item) => sum + item.amount, 0)).filter((value) => value > 0);
    if (history.length < 2) return null;
    const historicalAverage = history.reduce((sum, value) => sum + value, 0) / history.length;
    const difference = currentAmount - historicalAverage;
    const differencePercent = historicalAverage > 0 ? difference / historicalAverage : 0;
    const relevant = historicalAverage >= 20 && difference >= 20 && differencePercent >= 0.2;
    let severity = "normal";
    if (relevant && differencePercent >= 1) severity = "critical";
    else if (relevant && differencePercent >= 0.5) severity = "risk";
    else if (relevant) severity = "attention";
    return {
      category,
      channel,
      currentAmount: round(currentAmount),
      historicalAverage: round(historicalAverage),
      difference: round(difference),
      differencePercent: round(differencePercent, 4),
      severity,
      samples: history.length,
      reason: severity === "normal" ? `${category} permanece dentro da faixa historica relevante.` : `${category} esta ${round(differencePercent * 100, 1)}% acima da media dos ultimos ${history.length} meses com dados.`
    };
  }).filter(Boolean);
  return {
    period: currentKey,
    lookbackMonths: safeLookback,
    anomalies,
    assumptions: { minimumHistoricalMonths: 2, minimumAverage: 20, minimumAbsoluteDifference: 20 },
    warnings: anomalies.length ? [] : ["Historico insuficiente para comparar categorias com relevancia."]
  };
}
function calculatePurchaseSimulation(state, input) {
  const amount = finiteNumber(input.amount);
  if (amount <= 0) throw new Error("amount deve ser maior que zero");
  const paymentMethod = String(input.paymentMethod || "");
  const installments = Math.max(1, Math.min(60, Math.floor(finiteNumber(input.installments) || 1)));
  const snapshot = calculateFinancialSnapshot(state);
  const cardRiskBefore = calculateCardRisk(state);
  const monthlyImpact = paymentMethod === "credit_card" ? amount / installments : amount;
  const simulatedBill = cardRiskBefore.totalOpenBill + (paymentMethod === "credit_card" ? monthlyImpact : 0);
  const simulatedRatio = snapshot.monthlyIncome > 0 ? simulatedBill / snapshot.monthlyIncome : 1;
  const benefitType = paymentMethod.toUpperCase();
  const benefitBalance = state.benefits.filter((item) => item.type === benefitType).reduce((sum, item) => sum + item.balance, 0);
  const benefitEligible = ["VA", "VR"].includes(benefitType);
  const category = String(input.category || "A Classificar");
  const normalizedCategory = normalizedText(category);
  const allowedBenefitCategories = benefitType === "VA" ? ["mercado", "acougue", "alimentacao"] : ["restaurante", "delivery", "alimentacao"];
  const benefitCategoryAllowed = !benefitEligible || allowedBenefitCategories.includes(normalizedCategory);
  let recommendedDecision = "safe";
  const reasons = [];
  if (snapshot.monthlyIncome <= 0) recommendedDecision = "insufficient_data";
  else if (!benefitCategoryAllowed) {
    recommendedDecision = "avoid";
    reasons.push(`Categoria ${category} nao e compativel com pagamento em ${benefitType}.`);
  } else if (benefitEligible && benefitBalance < amount) {
    recommendedDecision = "avoid";
    reasons.push(`Saldo ${benefitType} e insuficiente para a compra.`);
  } else if (paymentMethod === "credit_card" && simulatedRatio > 0.5) {
    recommendedDecision = "avoid";
    reasons.push(`Compra elevaria a fatura para ${round(simulatedRatio * 100, 1)}% da renda.`);
  } else if (paymentMethod === "credit_card" && simulatedRatio > 0.35) {
    recommendedDecision = "wait";
    reasons.push(`Compra elevaria a fatura para ${round(simulatedRatio * 100, 1)}% da renda.`);
  } else if (!benefitEligible && monthlyImpact > snapshot.availableToSpend) {
    recommendedDecision = "wait";
    reasons.push(`Impacto mensal supera o disponivel seguro de R$ ${snapshot.availableToSpend.toFixed(2)}.`);
  } else if (!benefitEligible && monthlyImpact > snapshot.availableToSpend * 0.5) {
    recommendedDecision = "attention";
  }
  if (installments > 1) reasons.push(`Compra compromete ${installments} meses em R$ ${round(monthlyImpact).toFixed(2)}.`);
  if (!reasons.length) reasons.push("Compra permanece dentro dos limites deterministicos configurados.");
  const reference = utcDate(state.referenceDate);
  const dueDay = state.cards[0]?.dueDay || 1;
  let bestDate = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), dueDay + 1));
  if (bestDate <= reference) bestDate = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, dueDay + 1));
  const maxSafePrice = paymentMethod === "credit_card" ? Math.max(0, snapshot.monthlyIncome * 0.35 - cardRiskBefore.totalOpenBill) * installments : benefitEligible ? benefitBalance : snapshot.availableToSpend;
  return {
    referenceDate: state.referenceDate,
    period: state.period,
    amount: round(amount),
    paymentMethod,
    installments,
    category,
    description: String(input.description || ""),
    monthlyImpact: round(monthlyImpact),
    impactOnAvailableToSpend: round(-monthlyImpact),
    impactOnCardRisk: `${cardRiskBefore.riskLevel}_to_${simulatedRatio > 0.5 ? "critical" : simulatedRatio > 0.35 ? "risk" : simulatedRatio > 0.2 ? "attention" : "safe"}`,
    recommendedDecision,
    bestPurchaseDate: bestDate.toISOString().slice(0, 10),
    maxSafePrice: round(maxSafePrice),
    reasons,
    assumptions: {
      benefitEligibilityValidatedByPaymentMethod: true,
      benefitCategoryAllowed,
      futureInstallmentsCommitted: installments
    },
    warnings: snapshot.warnings
  };
}
function recurringDescription(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\d+/g, "").replace(/[^a-z]+/g, " ").trim();
}
function calculateRecurringSuggestions(state, lookbackMonths = 6) {
  const safeLookback = Math.max(3, Math.min(12, Math.floor(finiteNumber(lookbackMonths) || 6)));
  const allowed = /* @__PURE__ */ new Set([monthKey(state.referenceDate), ...previousMonthKeys(state.referenceDate, safeLookback - 1)]);
  const groups = /* @__PURE__ */ new Map();
  state.transactions.filter((item) => !item.isInternalTransfer && item.date && allowed.has(monthKey(item.date))).forEach((item) => {
    const pattern = recurringDescription(item.description);
    if (!pattern) return;
    const key = `${item.kind}:${pattern}`;
    groups.set(key, [...groups.get(key) || [], item]);
  });
  const suggestions = [...groups.entries()].map(([key, items]) => {
    if (items.length < 2) return null;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const distinctMonths = new Set(sorted.map((item) => monthKey(item.date)));
    if (distinctMonths.size < 2) return null;
    const averageAmount = sorted.reduce((sum, item) => sum + item.amount, 0) / sorted.length;
    const maxVariation = averageAmount > 0 ? Math.max(...sorted.map((item) => Math.abs(item.amount - averageAmount) / averageAmount)) : 0;
    if (maxVariation > 0.2) return null;
    const dayAverage = Math.round(sorted.reduce((sum, item) => sum + Number(item.date.slice(8, 10)), 0) / sorted.length);
    const confidence = Math.min(0.98, 0.55 + distinctMonths.size * 0.12 - maxVariation * 0.5);
    const [kind, pattern] = key.split(":");
    return {
      descriptionPattern: pattern.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      category: sorted[sorted.length - 1].category,
      averageAmount: round(averageAmount),
      frequency: "monthly",
      confidence: round(confidence, 2),
      lastOccurrences: sorted.slice(-6).map((item) => item.date),
      suggestedRule: {
        type: kind,
        amount: round(averageAmount),
        dayOfMonth: dayAverage
      }
    };
  }).filter(Boolean).sort((a, b) => Number(b?.confidence) - Number(a?.confidence));
  return {
    period: { end: state.referenceDate, lookbackMonths: safeLookback },
    suggestions,
    assumptions: { minimumOccurrences: 2, highConfidenceOccurrences: 3, maximumAmountVariation: 0.2 },
    warnings: suggestions.length ? [] : ["Nenhum padrao recorrente confiavel foi encontrado."]
  };
}
export {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
  calculateMonthEndProjection,
  calculatePurchaseSimulation,
  calculateRecurringSuggestions
};
