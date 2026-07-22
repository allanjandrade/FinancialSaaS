function toArray(value) {
  return Array.isArray(value) ? value : []
}

function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function entryAmount(entry) {
  return Math.abs(numberOrZero(entry?.amount ?? entry?.value))
}

function hasIncomeSignal(state = {}, monthData = {}) {
  if (numberOrZero(monthData.income ?? monthData.totalIncome ?? monthData.income_cash) > 0) return true
  if (toArray(state.incomes).some((item) => entryAmount(item) > 0)) return true
  return toArray(state.entries).some((entry) => {
    const type = String(entry?.type || entry?.kind || '').toLowerCase()
    return ['income', 'receita', 'credit'].includes(type) && entryAmount(entry) > 0
  })
}

function hasExpenseSignal(state = {}, monthData = {}) {
  if (numberOrZero(monthData.expenses ?? monthData.totalExpenses ?? monthData.projected_card_bill) > 0) return true
  if (numberOrZero(monthData.cardBill ?? monthData.card_bill) > 0) return true
  if (toArray(state.expenses).some((item) => entryAmount(item) > 0)) return true
  return toArray(state.entries).some((entry) => {
    const type = String(entry?.type || entry?.kind || '').toLowerCase()
    return ['expense', 'despesa', 'debit'].includes(type) && entryAmount(entry) > 0
  })
}

function hasAccountSignal(state = {}) {
  return [
    state.accounts,
    state.financialAccounts,
    state.bankAccounts,
  ].some((items) => toArray(items).length > 0)
}

function hasCardSignal(state = {}) {
  return [
    state.cards,
    state.creditCards,
  ].some((items) => toArray(items).length > 0)
}

function activeSubscriptions(state = {}) {
  return toArray(state.subscriptions).filter((subscription) => {
    const status = String(subscription?.status || 'active').toLowerCase()
    return !['cancelled', 'canceled', 'cancelada', 'deleted', 'paused', 'pausada'].includes(status)
  })
}

function wishlistItems(state = {}) {
  return toArray(state.wishlist).concat(toArray(state.purchases)).filter(Boolean)
}

function hasAction(command = {}, key) {
  return toArray(command.actionPlan).some((action) => action?.key === key)
}

function stage(key, label, route, state, detail, cta) {
  return { key, label, route, state, detail, cta }
}

export function buildV3OperatingSystem({
  command = {},
  state = {},
  monthData = {},
  availableBalance = 0,
} = {}) {
  const hasIncome = hasIncomeSignal(state, monthData)
  const hasExpense = hasExpenseSignal(state, monthData)
  const hasAccount = hasAccountSignal(state)
  const hasCard = hasCardSignal(state)
  const subscriptions = activeSubscriptions(state)
  const disposableSubscriptions = subscriptions.filter((item) => item?.is_essential === false)
  const wishes = wishlistItems(state)
  const freeBalance = numberOrZero(availableBalance)
  const commandMode = String(command.mode || '').toLowerCase()
  const commandScore = numberOrZero(command.score?.score)

  const foundationState = hasIncome && hasAccount ? 'healthy' : 'critical'
  const controlState = hasIncome && hasExpense && freeBalance >= 0 ? 'healthy' : hasIncome ? 'attention' : 'critical'
  const commitmentsState = disposableSubscriptions.length > 0 || hasAction(command, 'pause-disposable-subscriptions')
    ? 'attention'
    : subscriptions.length > 0 ? 'healthy' : 'ready'
  const decisionsState = wishes.length > 0 && (freeBalance <= 0 || hasAction(command, 'freeze-wishlist'))
    ? 'attention'
    : wishes.length > 0 ? 'ready' : 'healthy'
  const intelligenceState = commandMode === 'critical' || commandScore < 50 ? 'attention' : 'ready'

  const stages = [
    stage(
      'foundation',
      'Base financeira',
      hasIncome ? '/structure?tab=accounts' : '/entries',
      foundationState,
      hasIncome && hasAccount
        ? 'Receita e conta principal conectadas ao mês.'
        : 'Cadastre receita e conta principal para ativar decisões confiáveis.',
      hasIncome ? 'Conferir contas' : 'Cadastrar receita',
    ),
    stage(
      'control',
      'Controle do mês',
      '/entries',
      controlState,
      hasExpense
        ? 'Movimentações reais alimentam saldo, fatura e projeção.'
        : 'Registre despesas reais para transformar previsão em controle.',
      'Registrar movimentações',
    ),
    stage(
      'commitments',
      'Compromissos recorrentes',
      '/subscriptions',
      commitmentsState,
      subscriptions.length
        ? `${subscriptions.length} assinatura(s) entram no fluxo previsto.`
        : 'Mapeie assinaturas para prever cobranças antes de elas caírem.',
      'Gerenciar assinaturas',
    ),
    stage(
      'decisions',
      'Decisões de compra',
      '/purchases',
      decisionsState,
      wishes.length
        ? `${wishes.length} item(ns) aguardam decisão com impacto financeiro.`
        : 'Use a wishlist para decidir compras antes de comprometer o mês.',
      'Avaliar compras',
    ),
    stage(
      'intelligence',
      'Inteligência consultiva',
      '/ai',
      intelligenceState,
      command?.primaryAction?.label
        ? `Copiloto explica a prioridade: ${command.primaryAction.label}.`
        : 'Copiloto usa os mesmos fatos do comando, sem resposta genérica.',
      'Perguntar ao copiloto',
    ),
  ]

  const activeStage = stages.find((item) => ['critical', 'attention'].includes(item.state)) || stages[stages.length - 1]
  const connectedCount = stages.filter((item) => ['healthy', 'ready', 'attention'].includes(item.state)).length

  return {
    homeRoute: '/dashboard',
    analysisRoute: '/analysis',
    headline: 'Sistema operacional financeiro do mês',
    summary: `${connectedCount} módulos conectados em um fluxo mensal.`,
    activeStage,
    stages,
    commandRoute: command?.primaryAction?.route || activeStage.route,
  }
}
