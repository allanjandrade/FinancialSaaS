import { quantityLabel } from './pt-br-copy.js'

const MONTH_COUNT = 12

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round((number(value) + Number.EPSILON) * factor) / factor
}

function percent(value, base) {
  return base > 0 ? round((value / base) * 100, 1) : 0
}

function monthKey(dateString) {
  const [year, month] = String(dateString || '').split('-').map(Number)
  return year && month ? year * 100 + month : 0
}

function average(values) {
  const valid = values.map(number).filter((value) => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
}

function selectedMonthExpenses(state, year, month) {
  const key = year * 100 + month
  return (state.expenses || []).filter((expense) => monthKey(expense.date) === key)
}

function categoryTotals(expenses) {
  return expenses.reduce((totals, expense) => {
    const category = expense.category || 'Outros'
    totals[category] = number(totals[category]) + number(expense.amount)
    return totals
  }, {})
}

function buildMonthlyRows(state, calcMonth, year) {
  return Array.from({ length: MONTH_COUNT }, (_, index) => {
    const month = index + 1
    const calculated = calcMonth(month)
    const income = number(calculated.incomeCash) + number(calculated.vaIncome)
    const expense = number(calculated.cashExpenses) + number(calculated.cardBill)
    return {
      key: year * 100 + month,
      month,
      income: round(income),
      expense: round(expense),
      surplus: round(income - expense),
      cardBill: round(calculated.cardBill),
      active: income > 0 || expense > 0,
    }
  })
}

function buildCategoryAnalysis(state, year, selectedMonth) {
  const currentTotals = categoryTotals(selectedMonthExpenses(state, year, selectedMonth))
  const previousMonths = [1, 2, 3]
    .map((offset) => selectedMonth - offset)
    .filter((month) => month > 0)
  const historicalTotals = previousMonths.map((month) =>
    categoryTotals(selectedMonthExpenses(state, year, month)))

  const rows = Object.entries(currentTotals).map(([category, current]) => {
    const baseline = average(historicalTotals.map((totals) => number(totals[category])))
    const change = baseline > 0 ? percent(current - baseline, baseline) : null
    return {
      category,
      current: round(current),
      baseline: round(baseline),
      change,
      anomaly: baseline > 0 && current - baseline >= 100 && change >= 20,
    }
  }).sort((a, b) => b.current - a.current)

  return {
    rows,
    top: rows[0] || null,
    anomalies: rows.filter((row) => row.anomaly),
  }
}

function action(id, severity, title, description, impact, route = null) {
  return { id, severity, title, description, impact, route }
}

function buildActions({ current, previous, forecast, reserve, card, categories, state }) {
  const actions = []

  if (current.surplus < 0) {
    actions.push(action(
      'restore-cashflow',
      'critical',
      'Reequilibrar o caixa deste mês',
      `As despesas superaram as receitas em R$ ${Math.abs(current.surplus).toFixed(2)}. Revise primeiro gastos recorrentes e as maiores categorias.`,
      Math.abs(current.surplus),
      '/entries',
    ))
  } else if (forecast.surplus < 0) {
    actions.push(action(
      'prevent-deficit',
      'critical',
      'Evitar déficit no próximo ciclo',
      `A projeção indica falta de R$ ${Math.abs(forecast.surplus).toFixed(2)} se o padrão recente continuar.`,
      Math.abs(forecast.surplus),
      '/plan',
    ))
  }

  if (reserve.gap > 0) {
    const contribution = Math.max(50, Math.min(Math.max(current.surplus, 0), reserve.gap))
    actions.push(action(
      'build-reserve',
      reserve.ratio < 50 ? 'critical' : 'warning',
      'Reforçar a reserva de emergência',
      `Faltam R$ ${reserve.gap.toFixed(2)} para o mínimo definido. Uma contribuição de R$ ${contribution.toFixed(2)} neste ciclo reduz a exposição.`,
      reserve.gap,
      '/plan',
    ))
  }

  if (card.utilization >= 70) {
    actions.push(action(
      'reduce-card',
      card.utilization >= 90 ? 'critical' : 'warning',
      'Reduzir dependência do cartão',
      `A fatura utiliza ${card.utilization.toFixed(1)}% do limite informado. Suspenda novas parcelas até reduzir essa pressão.`,
      card.bill,
      '/card',
    ))
  }

  categories.anomalies.slice(0, 2).forEach((row) => {
    actions.push(action(
      `category-${row.category}`,
      'warning',
      `Investigar aumento em ${row.category}`,
      `O gasto chegou a R$ ${row.current.toFixed(2)}, ${row.change.toFixed(1)}% acima da média recente.`,
      row.current - row.baseline,
      '/entries',
    ))
  })

  const openAlerts = (state.priceMonitorAlerts || []).filter((alert) => alert.status === 'open')
  if (openAlerts.length) {
    const alertLabel = quantityLabel(openAlerts.length, 'alerta de preço', 'alertas de preço')
    actions.push(action(
      'price-opportunities',
      'opportunity',
      'Revisar oportunidades de compra',
      `${alertLabel} ${openAlerts.length === 1 ? 'está aberto' : 'estão abertos'}. Confirme a necessidade e o impacto antes de comprar.`,
      openAlerts.length,
      '/purchases',
    ))
  }

  if (!actions.length && current.surplus > 0) {
    actions.push(action(
      'allocate-surplus',
      'opportunity',
      'Dar destino ao saldo positivo',
      `Há R$ ${current.surplus.toFixed(2)} de resultado positivo. Priorize reserva, dívida cara ou meta ativa.`,
      current.surplus,
      '/plan',
    ))
  }

  const severityOrder = { critical: 0, warning: 1, opportunity: 2, info: 3 }
  return actions
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.impact - a.impact)
    .slice(0, 6)
}

export function buildFinancialIntelligence(state, calcMonth) {
  const settings = state.settings || {}
  const year = number(settings.year) || new Date().getFullYear()
  const selectedMonth = Math.min(12, Math.max(1, number(settings.selectedMonth) || 1))
  const monthly = buildMonthlyRows(state, calcMonth, year)
  const current = monthly[selectedMonth - 1]
  const previous = monthly[Math.max(0, selectedMonth - 2)]
  const trailing = monthly.slice(Math.max(0, selectedMonth - 3), selectedMonth).filter((row) => row.active)
  const recurringPressure = number(settings.monthlyRecurringExpenses) + number(settings.monthlyDebtPayments)
  const forecast = {
    income: round(average(trailing.map((row) => row.income)) || current.income),
    expense: round((average(trailing.map((row) => row.expense)) || current.expense) + recurringPressure),
  }
  forecast.surplus = round(forecast.income - forecast.expense)

  const reserveCurrent = number(settings.emergencyReserveCurrent)
  const reserveMinimum = number(settings.emergencyReserveMinimum)
  const reserve = {
    current: reserveCurrent,
    minimum: reserveMinimum,
    gap: round(Math.max(0, reserveMinimum - reserveCurrent)),
    ratio: reserveMinimum > 0 ? percent(reserveCurrent, reserveMinimum) : 0,
    coverageMonths: forecast.expense > 0 ? round(reserveCurrent / forecast.expense, 1) : 0,
  }

  const cardLimit = number(settings.cardLimit) || (state.creditCards || [])
    .reduce((sum, cardItem) => sum + number(cardItem.limit), 0)
  const card = {
    bill: current.cardBill,
    limit: round(cardLimit),
    utilization: cardLimit > 0 ? percent(current.cardBill, cardLimit) : 0,
  }

  const categories = buildCategoryAnalysis(state, year, selectedMonth)
  const savingsRate = current.income > 0 ? percent(current.surplus, current.income) : 0
  const expenseChange = previous.expense > 0
    ? percent(current.expense - previous.expense, previous.expense)
    : null
  const actions = buildActions({ current, previous, forecast, reserve, card, categories, state })
  const activeMonths = monthly.filter((row) => row.active).length
  const confidence = Math.min(100, 35 + activeMonths * 8 + Math.min(20, (state.expenses || []).length))

  return {
    generatedAt: new Date().toISOString(),
    period: { year, month: selectedMonth, key: year * 100 + selectedMonth },
    current: {
      ...current,
      savingsRate,
      expenseChange,
    },
    previous,
    forecast,
    reserve,
    card,
    categories,
    actions,
    dataQuality: {
      confidence,
      activeMonths,
      transactionCount: (state.incomes || []).length + (state.expenses || []).length,
      label: confidence >= 80 ? 'Alta' : confidence >= 60 ? 'Moderada' : 'Inicial',
    },
    headline: actions[0]?.title || 'Finanças sob controle',
    monthly,
  }
}

export function financialSnapshotContent(analysis) {
  const categorySummary = analysis.categories.rows.slice(0, 6)
    .map((row) => `${row.category}: R$ ${row.current.toFixed(2)}`)
    .join('; ')
  const actions = analysis.actions.map((item) => item.title).join('; ')

  return [
    `Resumo financeiro do período ${analysis.period.key}.`,
    `Receitas: R$ ${analysis.current.income.toFixed(2)}.`,
    `Despesas: R$ ${analysis.current.expense.toFixed(2)}.`,
    `Resultado: R$ ${analysis.current.surplus.toFixed(2)}.`,
    `Taxa de economia: ${analysis.current.savingsRate.toFixed(1)}%.`,
    `Projeção do próximo ciclo: receitas R$ ${analysis.forecast.income.toFixed(2)}, despesas R$ ${analysis.forecast.expense.toFixed(2)}, resultado R$ ${analysis.forecast.surplus.toFixed(2)}.`,
    `Reserva: R$ ${analysis.reserve.current.toFixed(2)} de R$ ${analysis.reserve.minimum.toFixed(2)}; cobertura estimada de ${analysis.reserve.coverageMonths.toFixed(1)} meses.`,
    `Cartão: fatura R$ ${analysis.card.bill.toFixed(2)}, utilização ${analysis.card.utilization.toFixed(1)}%.`,
    `Categorias principais: ${categorySummary || 'sem dados'}.`,
    `Ações priorizadas: ${actions || 'nenhuma ação crítica'}.`,
  ].join('\n')
}

export function financialFactsForAI(analysis) {
  return {
    period: analysis.period,
    current: analysis.current,
    previous: analysis.previous,
    forecast: analysis.forecast,
    reserve: analysis.reserve,
    card: analysis.card,
    categories: analysis.categories.rows.slice(0, 8),
    actions: analysis.actions,
    dataQuality: analysis.dataQuality,
  }
}
