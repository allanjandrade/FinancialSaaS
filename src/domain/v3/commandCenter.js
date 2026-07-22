import { subscriptionMonthlyEquivalent } from '@/utils/subscriptions.js'

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((money(value) + Number.EPSILON) * 100) / 100
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, money(value)))
}

function activeItems(items = []) {
  return items.filter((item) => {
    const status = String(item?.status || 'active').toLowerCase()
    return !item?.deleted_at && !['cancelled', 'canceled', 'paused', 'expired', 'done', 'completed'].includes(status)
  })
}

function buildKpis({ income, expenses, balance, subscriptionTotal, subscriptionSavings, wishlistTotal }) {
  const kpis = [
    { key: 'income', label: 'Receitas do mês', value: income, tone: income > 0 ? 'income' : 'neutral' },
    { key: 'expenses', label: 'Compromissos', value: expenses, tone: expenses > 0 ? 'expense' : 'neutral' },
    { key: 'balance', label: 'Saldo livre', value: balance, tone: balance >= 0 ? 'income' : 'expense' },
  ]
  if (subscriptionTotal > 0) {
    kpis.push({ key: 'subscriptions', label: 'Assinaturas', value: subscriptionTotal, tone: 'expense' })
  }
  if (subscriptionSavings > 0) {
    kpis.push({ key: 'subscriptionSavings', label: 'Economia possível', value: subscriptionSavings, tone: 'savings' })
  }
  if (wishlistTotal > 0) {
    kpis.push({ key: 'wishlistRisk', label: 'Compras em espera', value: wishlistTotal, tone: 'warning' })
  }
  return kpis.slice(0, 5)
}

function buildBase({ state = {}, executiveSummary = {}, subscriptionSummary = {}, monthData = {}, availableBalance = 0 }) {
  const subscriptions = activeItems(state.subscriptions || [])
  const wishlist = activeItems(state.wishlist || [])
  const goals = activeItems(state.planningGoals || [])
  const income = money(monthData.incomeCash) || (state.incomes || []).reduce((sum, item) => sum + money(item.amount), 0)
  const expenses = money(monthData.cashExpenses) + money(monthData.cardBill)
  const balance = money(availableBalance)
  const subscriptionTotal = money(subscriptionSummary.totalMonthly)
  const subscriptionSavings = subscriptions
    .filter((item) => !item.is_essential && !item.isEssential)
    .reduce((sum, item) => sum + subscriptionMonthlyEquivalent(item), 0)
  const wishlistTotal = wishlist.reduce((sum, item) => sum + money(item.value || item.currentPrice || item.targetPrice), 0)
  const hasSetupGap = Boolean(executiveSummary.needsIncomeSetup) || income <= 0
  const hasTightCashFlow = balance < 0 || money(executiveSummary.safeToSpend) <= 0 || executiveSummary.risk === 'critical'

  return {
    subscriptions,
    wishlist,
    goals,
    income,
    expenses,
    balance,
    subscriptionTotal,
    subscriptionSavings: roundMoney(subscriptionSavings),
    wishlistTotal,
    hasSetupGap,
    hasTightCashFlow,
    nextCharge: subscriptionSummary.nextCharge || null,
    alerts: subscriptionSummary.alerts || [],
  }
}

function scoreLevel(score) {
  if (score >= 75) return 'strong'
  if (score >= 60) return 'stable'
  if (score >= 45) return 'attention'
  return 'fragile'
}

function cardLimitFromState(state = {}) {
  return (state.creditCards || []).reduce((sum, card) => sum + money(card.limit), 0)
}

function cardAvailableFromState(state = {}) {
  return (state.creditCards || []).reduce((sum, card) => sum + money(card.availableLimit ?? card.available_limit), 0)
}

function reserveFromState(state = {}) {
  const settings = state.settings || {}
  return {
    current: money(settings.emergencyReserveCurrent),
    minimum: money(settings.emergencyReserveMinimum),
  }
}

function pillar(key, label, score, detail, tone = 'neutral') {
  return { key, label, score: Math.round(clamp(score)), detail, tone }
}

export function buildV3FinancialScore({
  state = {},
  monthData = {},
  availableBalance = 0,
  subscriptionSummary = {},
} = {}) {
  const base = buildBase({ state, executiveSummary: {}, subscriptionSummary, monthData, availableBalance })
  const income = base.income
  const expenses = base.expenses
  const margin = income > 0 ? (income - expenses) / income : -1
  const cashflowScore = income <= 0
    ? 10
    : availableBalance < 0
      ? 15
      : clamp(55 + margin * 95)

  const reserve = reserveFromState(state)
  const reserveRatio = reserve.minimum > 0 ? reserve.current / reserve.minimum : (income > 0 ? 0.45 : 0)
  const reserveScore = reserve.minimum > 0 ? clamp(reserveRatio * 100) : income > 0 ? 55 : 20

  const cardLimit = cardLimitFromState(state)
  const cardAvailable = cardAvailableFromState(state)
  const cardBill = money(monthData.cardBill)
  const cardUsedRatio = cardLimit > 0
    ? Math.max(cardBill / cardLimit, (cardLimit - cardAvailable) / cardLimit)
    : income > 0 ? cardBill / income : cardBill > 0 ? 1 : 0
  const cardScore = cardLimit > 0 || cardBill > 0 ? clamp(100 - cardUsedRatio * 120) : 75

  const recurrenceRatio = income > 0 ? base.subscriptionTotal / income : base.subscriptionTotal > 0 ? 1 : 0
  const recurrencePenalty = recurrenceRatio * 180 + (base.subscriptionSavings > 0 ? 18 : 0)
  const recurrenceScore = clamp(100 - recurrencePenalty)
  const goalsScore = base.goals.length ? 85 : income > 0 ? 48 : 25

  const pillars = [
    pillar('cashflow', 'Fluxo do mês', cashflowScore, income <= 0 ? 'Receita ainda não cadastrada.' : `${Math.round(margin * 100)}% de margem operacional.`, cashflowScore >= 70 ? 'income' : cashflowScore >= 45 ? 'warning' : 'expense'),
    pillar('reserve', 'Reserva', reserveScore, reserve.minimum > 0 ? `${Math.round(reserveRatio * 100)}% do mínimo definido.` : 'Defina uma reserva mínima para medir proteção.', reserveScore >= 70 ? 'income' : reserveScore >= 45 ? 'warning' : 'expense'),
    pillar('cardPressure', 'Pressão do cartão', cardScore, cardLimit > 0 ? `${Math.round(cardUsedRatio * 100)}% do limite comprometido.` : 'Nenhum limite de cartão informado.', cardScore >= 70 ? 'income' : cardScore >= 45 ? 'warning' : 'expense'),
    pillar('recurrence', 'Gastos recorrentes', recurrenceScore, base.subscriptionTotal > 0 ? `${Math.round(recurrenceRatio * 100)}% da renda em assinaturas.` : 'Sem assinaturas pressionando o mês.', recurrenceScore >= 70 ? 'income' : recurrenceScore >= 45 ? 'warning' : 'expense'),
    pillar('goals', 'Metas', goalsScore, base.goals.length ? `${base.goals.length} meta ativa em acompanhamento.` : 'Nenhuma meta ativa para orientar sobras.', goalsScore >= 70 ? 'income' : 'warning'),
  ]
  const score = Math.round(pillars.reduce((sum, item) => sum + item.score, 0) / pillars.length)
  const weakPillars = pillars.filter((item) => item.score < 60)
  const improvementLevers = weakPillars.length
    ? weakPillars.map((item) => ({
      key: `improve-${item.key}`,
      label: item.key === 'cashflow'
        ? 'Reequilibrar fluxo'
        : item.key === 'reserve'
          ? 'Reforçar reserva'
          : item.key === 'cardPressure'
            ? 'Reduzir pressão do cartão'
            : item.key === 'recurrence'
              ? 'Cortar recorrências'
              : 'Criar meta norteadora',
      impact: 100 - item.score,
      pillar: item.key,
    }))
    : [{ key: 'maintain-cadence', label: 'Manter cadência', impact: 0, pillar: 'overall' }]

  return {
    score,
    level: scoreLevel(score),
    label: score >= 75 ? 'Forte' : score >= 60 ? 'Estável' : score >= 45 ? 'Em atenção' : 'Frágil',
    pillars,
    improvementLevers,
  }
}

function action({
  key,
  label,
  detail,
  priority = 'medium',
  route = '/plan',
  intent = null,
  category = 'execution',
  estimatedImpactAmount = 0,
  effort = 'medium',
}) {
  return {
    key,
    label,
    detail,
    priority,
    route,
    intent,
    category,
    estimatedImpactAmount: roundMoney(estimatedImpactAmount),
    effort,
    status: 'pending',
  }
}

export function buildV3ActionPlan({
  state = {},
  score = null,
  executiveSummary = {},
  subscriptionSummary = {},
  monthData = {},
  availableBalance = 0,
} = {}) {
  const base = buildBase({ state, executiveSummary, subscriptionSummary, monthData, availableBalance })
  const activeScore = score || buildV3FinancialScore({ state, monthData, availableBalance, subscriptionSummary })
  const reserve = reserveFromState(state)
  const reserveGap = Math.max(0, reserve.minimum - reserve.current)
  const cardPillar = activeScore.pillars.find((item) => item.key === 'cardPressure')
  const plan = []

  if (base.hasSetupGap) {
    plan.push(action({
      key: 'first-income',
      label: 'Cadastrar primeira receita',
      detail: 'Sem renda real, o sistema não deve sugerir gasto seguro nem projeções avançadas.',
      priority: 'critical',
      route: '/entries',
      intent: 'income',
      category: 'setup',
      effort: 'low',
    }))
  }

  if (!base.hasSetupGap && (base.balance < 0 || money(executiveSummary.safeToSpend) <= 0 || executiveSummary.risk === 'critical')) {
    plan.push(action({
      key: 'restore-cashflow',
      label: 'Reequilibrar caixa do mês',
      detail: 'Revise os maiores lançamentos e segure novas saídas até o saldo livre voltar ao positivo.',
      priority: 'critical',
      route: '/entries',
      category: 'cashflow',
      estimatedImpactAmount: Math.abs(Math.min(base.balance, money(executiveSummary.safeToSpend))),
      effort: 'medium',
    }))
  }

  if (cardPillar && cardPillar.score < 50) {
    plan.push(action({
      key: 'reduce-card-pressure',
      label: 'Reduzir pressão do cartão',
      detail: 'A fatura ou limite comprometido está pesando no mês. Evite novas parcelas e revise cobranças.',
      priority: cardPillar.score < 35 ? 'critical' : 'high',
      route: '/card',
      category: 'card',
      estimatedImpactAmount: money(monthData.cardBill),
      effort: 'medium',
    }))
  }

  if (base.subscriptionSavings > 0) {
    plan.push(action({
      key: 'pause-disposable-subscriptions',
      label: 'Cortar ou pausar assinatura',
      detail: 'Assinaturas dispensáveis ativas geram economia recorrente imediata.',
      priority: activeScore.level === 'fragile' ? 'high' : 'medium',
      route: '/subscriptions',
      category: 'subscriptions',
      estimatedImpactAmount: base.subscriptionSavings,
      effort: 'low',
    }))
  }

  if (base.wishlistTotal > 0 && (base.balance < 0 || money(executiveSummary.safeToSpend) <= 0 || activeScore.level === 'fragile')) {
    plan.push(action({
      key: 'freeze-wishlist',
      label: 'Segurar compras planejadas',
      detail: 'Itens desejados devem ficar em espera até o score sair da zona de risco.',
      priority: activeScore.level === 'fragile' ? 'high' : 'medium',
      route: '/purchases',
      category: 'wishlist',
      estimatedImpactAmount: base.wishlistTotal,
      effort: 'low',
    }))
  }

  if (reserveGap > 0 && base.income > 0) {
    plan.push(action({
      key: 'rebuild-reserve',
      label: 'Reforçar reserva',
      detail: 'A reserva abaixo do mínimo reduz margem de decisão e aumenta risco de endividamento.',
      priority: activeScore.level === 'fragile' ? 'high' : 'medium',
      route: '/goals',
      category: 'reserve',
      estimatedImpactAmount: reserveGap,
      effort: 'medium',
    }))
  }

  if (!base.goals.length && base.income > 0) {
    plan.push(action({
      key: 'create-north-star-goal',
      label: 'Criar meta norteadora',
      detail: 'Uma meta transforma sobra em plano e reduz decisões financeiras soltas.',
      priority: 'medium',
      route: '/goals',
      category: 'goals',
      effort: 'low',
    }))
  }

  if (base.goals.length && activeScore.level !== 'fragile') {
    plan.push(action({
      key: 'review-active-goal',
      label: 'Revisar meta ativa',
      detail: 'Use a margem do mês para manter a meta principal em movimento.',
      priority: 'low',
      route: '/goals',
      category: 'goals',
      effort: 'low',
    }))
  }

  if (!plan.length) {
    plan.push(action({
      key: 'maintain-monthly-cadence',
      label: 'Manter cadência semanal',
      detail: 'O mês está saudável. Revise vencimentos e metas uma vez por semana para preservar o ritmo.',
      priority: 'low',
      route: '/plan',
      category: 'maintenance',
      effort: 'low',
    }))
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return plan
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.estimatedImpactAmount - a.estimatedImpactAmount)
    .slice(0, 7)
}

function headlineFor(mode, score) {
  if (mode === 'setup') return 'Receita primeiro, análises depois.'
  if (mode === 'protect') return 'Preservar caixa virou prioridade.'
  if (mode === 'optimize') return 'Há economia recorrente disponível.'
  if (score.level === 'strong') return 'Finanças em modo de avanço controlado.'
  return 'Mês em operação acompanhada.'
}

function descriptionFor(mode, score) {
  if (mode === 'setup') return 'Cadastre a renda principal para ativar previsões, saldo seguro e recomendações confiáveis.'
  if (mode === 'protect') return 'O sistema priorizou ações que preservam fluxo, reduzem pressão e evitam novas saídas.'
  if (mode === 'optimize') return 'Assinaturas dispensáveis ativas pesam todo mês. Cortar ou pausar uma delas melhora o fluxo sem mexer nas metas.'
  if (score.level === 'strong') return 'A base está saudável. O foco agora é manter cadência, reserva e metas sem assumir riscos desnecessários.'
  return 'A base financeira está suficiente. Acompanhe vencimentos, metas e alertas antes de novas decisões.'
}

function northStarFor(mode, score) {
  if (mode === 'setup') return 'Construir base confiável de dados financeiros.'
  if (mode === 'protect') return 'Preservar caixa e impedir novas decisões que ampliem risco.'
  if (mode === 'optimize') return 'Reduzir custos recorrentes para liberar margem mensal.'
  if (score.level === 'strong') return 'Converter margem em reserva, metas e avanço controlado.'
  return 'Manter previsibilidade antes de assumir novos compromissos.'
}

export function buildV3CommandCenter({
  state = {},
  executiveSummary = {},
  subscriptionSummary = {},
  monthData = {},
  availableBalance = 0,
} = {}) {
  const base = buildBase({ state, executiveSummary, subscriptionSummary, monthData, availableBalance })
  const score = buildV3FinancialScore({ state, monthData, availableBalance, subscriptionSummary })
  const actionPlan = buildV3ActionPlan({ state, score, executiveSummary, subscriptionSummary, monthData, availableBalance })
  const risks = []

  if (base.balance < 0) {
    risks.push({
      key: 'negativeBalance',
      severity: 'critical',
      label: 'Saldo livre negativo',
      detail: 'Evite novas compras e revise compromissos antes do próximo vencimento.',
    })
  }
  if (base.nextCharge) {
    risks.push({
      key: 'nextSubscriptionCharge',
      severity: base.nextCharge.daysUntil <= 3 ? 'warning' : 'info',
      label: `Próxima assinatura: ${base.nextCharge.name}`,
      detail: `Cobrança prevista em ${base.nextCharge.daysUntil} dia${base.nextCharge.daysUntil === 1 ? '' : 's'}.`,
    })
  }

  const mode = base.hasSetupGap
    ? 'setup'
    : actionPlan.some((item) => item.priority === 'critical')
      ? 'protect'
      : base.subscriptionSavings > 0
        ? 'optimize'
        : 'operate'
  const primaryAction = mode === 'optimize'
    ? {
      ...(actionPlan.find((item) => item.key === 'pause-disposable-subscriptions') || actionPlan[0]),
      label: 'Revisar assinaturas dispensáveis',
    }
    : mode === 'operate'
      ? {
        key: 'monthlyPlan',
        label: 'Acompanhar próximos vencimentos',
        detail: 'Abra o planejamento para ver compromissos e margem do mês.',
        route: '/plan',
        priority: 'low',
      }
      : actionPlan[0] || {
    key: 'monthlyPlan',
    label: 'Acompanhar próximos vencimentos',
    detail: 'Abra o planejamento para ver compromissos e margem do mês.',
    route: '/plan',
  }

  return {
    mode,
    headline: headlineFor(mode, score),
    description: descriptionFor(mode, score),
    northStar: northStarFor(mode, score),
    score,
    actionPlan,
    primaryAction,
    kpis: buildKpis(base),
    risks,
    actions: actionPlan,
  }
}

export function v3CommandFactsForAI(command = {}) {
  return {
    mode: command.mode || 'unknown',
    score: money(command.score?.score),
    level: command.score?.level || 'unknown',
    northStar: command.northStar || '',
    headline: command.headline || '',
    primaryAction: command.primaryAction ? {
      key: command.primaryAction.key,
      label: command.primaryAction.label,
      route: command.primaryAction.route,
      priority: command.primaryAction.priority,
      estimatedImpactAmount: money(command.primaryAction.estimatedImpactAmount),
    } : null,
    pillars: (command.score?.pillars || []).map((pillarItem) => ({
      key: pillarItem.key,
      label: pillarItem.label,
      score: pillarItem.score,
      detail: pillarItem.detail,
    })),
    actions: (command.actionPlan || command.actions || []).map((item) => ({
      key: item.key,
      label: item.label,
      priority: item.priority,
      route: item.route,
      category: item.category,
      estimatedImpactAmount: money(item.estimatedImpactAmount),
    })),
  }
}
