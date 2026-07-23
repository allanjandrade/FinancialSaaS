/**
 * Pontuação de maturidade financeira (0–100) com base no histórico de lançamentos
 * e nas configurações do usuário ao longo dos meses.
 */

function monthKeyFromDate(dateString) {
  const [year, month] = dateString.split('-').map(Number)
  return year * 100 + month
}

function collectMonthlyTotals(financeState, calcMonth, year) {
  const rows = []
  for (let m = 1; m <= 12; m++) {
    const key = year * 100 + m
    const snap = calcMonth(m)
    const income = snap.incomeCash + snap.vaIncome
    const expense = snap.cashExpenses + snap.cardBill
    if (income > 0 || expense > 0) {
      rows.push({ key, month: m, income, expense, surplus: income - expense, cardBill: snap.cardBill })
    }
  }
  return rows
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreSpendingControl(monthlyRows) {
  if (monthlyRows.length === 0) return 50
  const withIncome = monthlyRows.filter((r) => r.income > 0)
  if (withIncome.length === 0) return 40

  const ratios = withIncome.map((r) => r.expense / r.income)
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const positiveSurplusMonths = withIncome.filter((r) => r.surplus > 0).length
  const consistency = positiveSurplusMonths / withIncome.length

  let score = 100
  if (avgRatio > 1) score -= 45
  else if (avgRatio > 0.9) score -= 30
  else if (avgRatio > 0.8) score -= 18
  else if (avgRatio > 0.7) score -= 8

  score = score * 0.7 + consistency * 100 * 0.3
  return clampScore(score)
}

function scoreEmergencyReserve(settings) {
  const current = Math.max(0, Number(settings.emergencyReserveCurrent || 0))
  const minimum = Math.max(0, Number(settings.emergencyReserveMinimum || 0))
  if (minimum <= 0) {
    return current > 0 ? 65 : 35
  }
  const ratio = current / minimum
  if (ratio >= 1.5) return 95
  if (ratio >= 1) return 82
  if (ratio >= 0.75) return 68
  if (ratio >= 0.5) return 55
  if (ratio >= 0.25) return 38
  return 22
}

function scoreCreditDependency(monthlyRows, settings) {
  const limit = Math.max(0, Number(settings.cardLimit || 0))
  const recent = monthlyRows.slice(-3)
  if (recent.length === 0) return 55

  const avgIncome = recent.reduce((s, r) => s + r.income, 0) / recent.length
  const avgCard = recent.reduce((s, r) => s + r.cardBill, 0) / recent.length

  let score = 85
  if (avgIncome > 0) {
    const cardShare = avgCard / avgIncome
    if (cardShare > 0.6) score -= 40
    else if (cardShare > 0.45) score -= 28
    else if (cardShare > 0.3) score -= 15
    else if (cardShare > 0.15) score -= 6
  }

  if (limit > 0) {
    const utilization = avgCard / limit
    if (utilization > 0.8) score -= 25
    else if (utilization > 0.6) score -= 15
    else if (utilization > 0.4) score -= 8
  }

  return clampScore(score)
}

function scorePurchasePlanning(financeState) {
  const wishlist = financeState.wishlist || []
  const queue = financeState.priorityQueue || []
  let score = 35

  if (queue.length > 0) score += 25
  if (wishlist.length > 0) score += 15

  const withHistory = wishlist.filter((w) => (w.priceHistory || []).length >= 2).length
  const monitored = wishlist.filter((w) => w.monitorPrice).length
  const withOffers = wishlist.filter((w) => (w.marketplaceOffers || []).length > 0).length

  score += Math.min(15, withHistory * 5)
  score += Math.min(10, monitored * 4)
  score += Math.min(10, withOffers * 3)

  const recentExpenses = (financeState.expenses || []).filter((e) => {
    const key = monthKeyFromDate(e.date)
    const now = new Date()
    const currentKey = now.getFullYear() * 100 + (now.getMonth() + 1)
    return key >= currentKey - 2
  })
  const categorized = recentExpenses.filter((e) => e.category && e.category !== 'Outros').length
  if (recentExpenses.length > 0) {
    score += Math.round((categorized / recentExpenses.length) * 10)
  }

  return clampScore(score)
}

function overallFromDimensions(dimensions) {
  const values = Object.values(dimensions)
  return clampScore(values.reduce((a, b) => a + b, 0) / values.length)
}

export function getCalendarMonthKey(date = new Date()) {
  return date.getFullYear() * 100 + (date.getMonth() + 1)
}

export function formatMonthKeyLabel(monthKey) {
  const year = Math.floor(monthKey / 100)
  const month = monthKey % 100
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function trendLabel(current, previous) {
  if (previous == null) return 'stable'
  const diff = current - previous
  if (diff >= 5) return 'up'
  if (diff <= -5) return 'down'
  return 'stable'
}

function previousMonthEntry(history, currentKey) {
  const sorted = [...(history || [])].sort((a, b) => a.monthKey - b.monthKey)
  return sorted.filter((h) => h.monthKey < currentKey).pop() || null
}

export function buildMaturitySnapshot(financeState, calcMonth) {
  const maturity = computeFinancialMaturity(financeState, calcMonth, { skipHistoryTrend: true })
  return {
    monthKey: getCalendarMonthKey(),
    at: new Date().toISOString(),
    overall: maturity.overall,
    dimensions: { ...maturity.dimensions },
  }
}

export function syncMaturityHistory(history, snapshot) {
  const list = Array.isArray(history) ? [...history] : []
  const idx = list.findIndex((h) => h.monthKey === snapshot.monthKey)
  if (idx >= 0) list[idx] = snapshot
  else list.push(snapshot)
  return list.sort((a, b) => a.monthKey - b.monthKey).slice(-24)
}

export function getMaturityChartSeries(history) {
  return [...(history || [])]
    .sort((a, b) => a.monthKey - b.monthKey)
    .map((entry) => ({
      monthKey: entry.monthKey,
      label: formatMonthKeyLabel(entry.monthKey),
      overall: entry.overall,
      spendingControl: entry.dimensions?.spendingControl,
      emergencyReserve: entry.dimensions?.emergencyReserve,
      creditDependency: entry.dimensions?.creditDependency,
      purchasePlanning: entry.dimensions?.purchasePlanning,
    }))
}

export function computeFinancialMaturity(financeState, calcMonth, options = {}) {
  const year = financeState.settings?.year || new Date().getFullYear()
  const monthlyRows = collectMonthlyTotals(financeState, calcMonth, year)
  const activeMonths = monthlyRows.length

  const dimensions = {
    spendingControl: scoreSpendingControl(monthlyRows),
    emergencyReserve: scoreEmergencyReserve(financeState.settings || {}),
    creditDependency: scoreCreditDependency(monthlyRows, financeState.settings || {}),
    purchasePlanning: scorePurchasePlanning(financeState),
  }

  const overall = overallFromDimensions(dimensions)
  const history = financeState.settings?.maturityHistory || []
  const currentKey = getCalendarMonthKey()
  const prevEntry = options.skipHistoryTrend ? null : previousMonthEntry(history, currentKey)
  const lastOverall = prevEntry?.overall ?? null

  return {
    overall,
    dimensions,
    activeMonths,
    historyCount: history.length,
    trend: trendLabel(overall, lastOverall),
    previousOverall: lastOverall,
    labels: {
      spendingControl: 'Controle de gastos',
      emergencyReserve: 'Reserva de emergência',
      creditDependency: 'Dependência de crédito',
      purchasePlanning: 'Planejamento de compras',
    },
    level:
      overall >= 80 ? 'Excelente'
      : overall >= 65 ? 'Bom'
      : overall >= 50 ? 'Em evolução'
      : 'Precisa de atenção',
  }
}
