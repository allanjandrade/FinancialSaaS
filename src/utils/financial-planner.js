import { monthCountLabel } from './pt-br-copy.js'

export function formatCurrency(value) {
  const numValue = Number(value)
  if (value == null || value === '' || !Number.isFinite(numValue)) {
    return 'Preço indisponível'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue)
}

function addMonthsToToday(months) {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date
}

function toISODate(date) {
  return date.toISOString().split('T')[0]
}

function formatMonthYear(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function installmentImpact(amount, monthlySurplus) {
  if (monthlySurplus <= 0) return 'Alto'
  const ratio = amount / monthlySurplus
  if (ratio >= 0.5) return 'Alto'
  if (ratio >= 0.25) return 'Moderado'
  return 'Baixo'
}

function statusFromImpact(impactIndex) {
  if (impactIndex <= 30) return '🟢 Compra saudável'
  if (impactIndex <= 60) return '🟡 Compra possível com planejamento'
  return '🔴 Compra não recomendada'
}

function legacyStatusFromImpact(impactIndex) {
  if (impactIndex <= 30) return '🟢 Viável'
  if (impactIndex <= 60) return '🟡 Viável com planejamento'
  return '🔴 Não recomendado'
}

export function evaluatePurchase(item, context) {
  const itemValue = Number(item?.value ?? item?.valor ?? 0)
  const monthlySurplus = Math.max(0, Number(context.monthlySurplus || 0))
  const emergencyReserveCurrent = Math.max(0, Number(context.emergencyReserveCurrent || 0))
  const emergencyReserveMinimum = Math.max(0, Number(context.emergencyReserveMinimum || 0))
  const currentBalance = Number(context.currentBalance || 0)
  const cardLimit = Math.max(0, Number(context.cardLimit || 0))
  const cardBill = Math.max(0, Number(context.cardBill || 0))
  const activeGoalsValue = Math.max(0, Number(context.activeGoalsValue || 0))
  const familyMode = Boolean(context.familyMode)

  const reserveAfter = emergencyReserveCurrent - itemValue
  const cashAfter = currentBalance - itemValue
  const cardUtilizationFuture = cardLimit > 0 ? ((cardBill + itemValue) / cardLimit) * 100 : 100
  const reserveImpactPct = emergencyReserveCurrent > 0
    ? Math.round((itemValue / emergencyReserveCurrent) * 100)
    : 0

  const scoreReserve = reserveAfter < emergencyReserveMinimum ? 35 : reserveAfter < emergencyReserveMinimum * 1.2 ? 20 : 8
  const scoreCash = cashAfter < 0 ? 25 : cashAfter < monthlySurplus ? 12 : 6
  const scoreIncomeCommitment = monthlySurplus <= 0 ? 20 : Math.min(20, Math.round((itemValue / monthlySurplus) * 10))
  const scoreCard = cardUtilizationFuture > 80 ? 15 : cardUtilizationFuture > 60 ? 9 : 4
  const scoreGoals = activeGoalsValue > 0 && itemValue > activeGoalsValue * 0.4 ? 10 : 5
  const scoreFamily = familyMode ? 5 : 0

  const impactIndex = Math.max(0, Math.min(100, scoreReserve + scoreCash + scoreIncomeCommitment + scoreCard + scoreGoals + scoreFamily))
  const status = statusFromImpact(impactIndex)
  const legacyStatus = legacyStatusFromImpact(impactIndex)

  const monthsToSafeReserve = monthlySurplus > 0
    ? Math.max(0, Math.ceil((emergencyReserveMinimum - reserveAfter) / monthlySurplus))
    : 6

  const idealDateObj = impactIndex <= 30
    ? new Date()
    : addMonthsToToday(Math.max(1, monthsToSafeReserve))

  let strategy = 'Comprar agora'
  if (impactIndex > 60) strategy = `Reforçar a reserva por mais ${monthCountLabel(Math.max(1, monthsToSafeReserve))}`
  else if (impactIndex > 30) strategy = 'Aguardar'

  const monthlySavingNeeded = monthlySurplus > 0
    ? Math.max(0, itemValue / Math.max(1, monthsToSafeReserve))
    : itemValue

  const goalDelayMonths = activeGoalsValue > 0 && monthlySurplus > 0
    ? Math.ceil(itemValue / monthlySurplus)
    : monthsToSafeReserve

  return {
    impactIndex,
    riskLabel: impactIndex <= 30 ? 'Seguro' : impactIndex <= 60 ? 'Atenção' : 'Alto impacto financeiro',
    status,
    legacyStatus,
    reasons: [
      `Saldo após compra: ${formatCurrency(cashAfter)}`,
      `Reserva após compra: ${formatCurrency(reserveAfter)} (mínimo: ${formatCurrency(emergencyReserveMinimum)})`,
      reserveImpactPct > 0 ? `Consumiria ${reserveImpactPct}% da reserva atual.` : null,
      `Uso estimado do cartão: ${cardUtilizationFuture.toFixed(1)}%`,
      familyMode ? 'Modo família ativo: impacto considerado nas metas compartilhadas.' : null,
    ].filter(Boolean),
    recommendation: status === '🔴 Compra não recomendada'
      ? `Aguardar ${monthCountLabel(Math.max(1, monthsToSafeReserve))} para preservar reserva e fluxo mensal.`
      : status === '🟡 Compra possível com planejamento'
      ? `Economize ${formatCurrency(monthlySavingNeeded)} por mês até a data ideal.`
      : 'Compra compatível com o cenário atual.',
    strategy,
    idealDate: toISODate(idealDateObj),
    idealDateLabel: formatMonthYear(idealDateObj),
    buyTodayRecommended: impactIndex <= 30,
    goalDelayMonths,
    monthlySavingNeeded,
    installments: [
      { label: 'À vista', value: itemValue, impact: installmentImpact(itemValue, monthlySurplus) },
      { label: '3x', value: itemValue / 3, impact: installmentImpact(itemValue / 3, monthlySurplus) },
      { label: '6x', value: itemValue / 6, impact: installmentImpact(itemValue / 6, monthlySurplus) },
      { label: '10x', value: itemValue / 10, impact: installmentImpact(itemValue / 10, monthlySurplus) },
      { label: '12x', value: itemValue / 12, impact: installmentImpact(itemValue / 12, monthlySurplus) },
    ],
    scenarios: [
      { label: 'Comprar agora', monthShift: 0, projectedBalance: currentBalance - itemValue },
      { label: 'Comprar em 3 meses', monthShift: 3, projectedBalance: currentBalance + monthlySurplus * 3 - itemValue },
      { label: 'Comprar em 6 meses', monthShift: 6, projectedBalance: currentBalance + monthlySurplus * 6 - itemValue },
    ],
    savingsPlan: {
      monthlyAmount: monthlySavingNeeded,
      months: Math.max(1, Math.ceil(itemValue / Math.max(1, monthlySavingNeeded))),
    },
  }
}

export function evaluatePriorityQueue(priorityQueue, purchaseValue, monthlySurplus) {
  const ordered = [...(priorityQueue || [])].sort((a, b) => Number(a.priorityOrder || 0) - Number(b.priorityOrder || 0))
  if (ordered.length === 0) return null
  if (monthlySurplus <= 0) {
    return 'Sua fila de prioridades pode atrasar porque o fluxo mensal está comprometido.'
  }
  const delayedMonths = Math.ceil(Number(purchaseValue || 0) / monthlySurplus)
  const top = ordered[0]
  return `A compra pode atrasar "${top.name}" em cerca de ${monthCountLabel(Math.max(0, delayedMonths))}.`
}

function wishSortWeight(item) {
  const priorityWeight = { Alta: 0, Média: 1, Baixa: 2 }
  const pr = priorityWeight[item.priority] ?? 1
  const valuePenalty = Number(item.value || 0) / 10000
  const deadlineBoost = item.desiredDate
    ? Math.max(0, (new Date(item.desiredDate) - new Date()) / (1000 * 60 * 60 * 24 * 365))
    : 0.5
  return pr * 10 + valuePenalty - deadlineBoost
}

export function buildPriorityRanking(priorityQueue, wishlist) {
  const ranked = [...(priorityQueue || [])]
    .sort((a, b) => Number(a.priorityOrder || 0) - Number(b.priorityOrder || 0))
    .map((item, index) => ({
      order: index + 1,
      name: item.name,
      amount: item.targetAmount,
      type: 'priority',
      reason: 'Fila de prioridades financeiras',
    }))

  const wishes = [...(wishlist || [])]
    .sort((a, b) => wishSortWeight(a) - wishSortWeight(b))
    .map((item, index) => ({
      order: ranked.length + index + 1,
      name: item.name,
      amount: item.value,
      type: 'wish',
      reason: `${item.priority} · ${item.category || 'Sem categoria'}`,
    }))

  return [...ranked, ...wishes]
}

export function answerDecisionQuestion(question, item, analysis, offers) {
  const q = String(question || '').toLowerCase()
  const best = offers?.best
  const lowest = offers?.lowest

  if (q.includes('agora')) {
    return analysis.buyTodayRecommended
      ? 'Sim, o cenário financeiro permite comprar agora com baixo risco.'
      : `Não é o melhor momento. Estratégia sugerida: ${analysis.strategy}.`
  }
  if (q.includes('parcelar')) {
    const bestInst = [...(analysis.installments || [])].sort((a, b) => {
      const rank = { Baixo: 1, Moderado: 2, Alto: 3 }
      return rank[a.impact] - rank[b.impact]
    })[0]
    return bestInst
      ? `Parcelar em ${bestInst.label} tende a ter impacto ${bestInst.impact.toLowerCase()} no orçamento.`
      : 'Não há parcelas com impacto aceitável no cenário atual.'
  }
  if (q.includes('guardar') || q.includes('economizar')) {
    return `Guarde cerca de ${formatCurrency(analysis.monthlySavingNeeded)} por mês por ${monthCountLabel(analysis.savingsPlan.months)}.`
  }
  if (q.includes('reserva')) {
    return analysis.reasons.find((r) => r.includes('reserva')) || 'A compra impacta a reserva de emergência.'
  }
  if (q.includes('marketplace') || q.includes('custo-benef')) {
    return best
      ? `Melhor custo-benefício: ${best.marketplace} (total ${formatCurrency(best.total)}). Menor preço: ${lowest?.marketplace}.`
      : 'Execute a busca de preços para comparar marketplaces.'
  }
  if (q.includes('black friday') || q.includes('esperar')) {
    return `Data ideal sugerida: ${analysis.idealDateLabel}. Aguardar pode reduzir pressão sobre metas e reserva.`
  }
  if (q.includes('alternativa') || q.includes('mais barata')) {
    return 'Veja a seção de alternativas sugeridas abaixo do item.'
  }
  if (q.includes('impuls') || q.includes('racional')) {
    return analysis.impulseHint || 'Classifique o item como Necessidade, Desejo ou Investimento para uma análise mais precisa.'
  }
  if (q.includes('compromete') || q.includes('patrim')) {
    return analysis.patrimonialHint || analysis.reasons.find((r) => r.includes('reserva')) || 'Avalie o impacto na reserva e no saldo antes de comprar.'
  }
  if (q.includes('oportunidade') || q.includes('índice') || q.includes('indice')) {
    return analysis.opportunityHint || 'Atualize os preços e o histórico para calcular o índice de oportunidade.'
  }
  if (q.includes('quanto preciso') || q.includes('guardar por mês')) {
    return `Guarde cerca de ${formatCurrency(analysis.monthlySavingNeeded)} por mês por ${monthCountLabel(analysis.savingsPlan.months)}.`
  }
  return `${item?.name || 'Produto'}: ${analysis.status}. ${analysis.recommendation}`
}
