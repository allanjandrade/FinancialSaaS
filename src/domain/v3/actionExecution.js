import { subscriptionMonthlyEquivalent } from '@/utils/subscriptions.js'
import { OFFICIAL_INCOME_TYPES } from '@/constants/finance.js'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const DEFAULT_FIRST_INCOME_TYPE = OFFICIAL_INCOME_TYPES.includes('Salário') ? 'Salário' : 'Outros'

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((money(value) + Number.EPSILON) * 100) / 100
}

function text(value) {
  return value == null ? '' : String(value)
}

function formatMoney(value) {
  return brl.format(money(value)).replace(/\s+/g, ' ')
}

function isActiveItem(item = {}) {
  const status = String(item.status || 'active').toLowerCase()
  return !item.deleted_at && !['cancelled', 'canceled', 'paused', 'expired', 'done', 'completed'].includes(status)
}

function isEssential(subscription = {}) {
  return Boolean(subscription.is_essential ?? subscription.isEssential)
}

function baseExecution(item = {}, overrides = {}) {
  return {
    key: text(item.key),
    type: text(item.executionType || item.type || item.key || 'route'),
    mode: text(item.executionMode || 'route'),
    title: text(item.title),
    description: text(item.description),
    route: text(item.route),
    actionLabel: text(item.actionLabel || 'Abrir'),
    priority: text(item.priority),
    contextKey: text(item.contextKey),
    canWrite: false,
    requiresConfirmation: Boolean(item.requiresConfirmation),
    ...overrides,
  }
}

function firstFinancialAccount(state = {}) {
  return Array.isArray(state.financialAccounts) ? state.financialAccounts[0] : null
}

function compactSubscription(subscription = {}) {
  return {
    id: text(subscription.id),
    name: text(subscription.name || subscription.provider || 'Assinatura'),
    provider: text(subscription.provider),
    monthlyAmount: roundMoney(subscription.monthlyAmount ?? subscriptionMonthlyEquivalent(subscription)),
    nextBillingDate: text(subscription.nextBillingDate || subscription.next_billing_date),
    status: text(subscription.status || 'active'),
  }
}

function resolveSubscription(item = {}, state = {}) {
  const ids = [
    item.subscriptionId,
    item.subscription_id,
    item.contextKey,
  ].filter(Boolean).map(String)
  if (!ids.length || !Array.isArray(state.subscriptions)) return null
  return state.subscriptions.find((subscription) => ids.includes(String(subscription?.id || subscription?.subscription_id || ''))) || null
}

function dispensableOptions(state = {}) {
  return (Array.isArray(state.subscriptions) ? state.subscriptions : [])
    .filter((subscription) => isActiveItem(subscription) && !isEssential(subscription))
    .map(compactSubscription)
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
}

function buildFirstIncomeExecution(item = {}, context = {}) {
  const referenceDate = text(context.referenceDate)
  const account = firstFinancialAccount(context.state)

  return baseExecution(item, {
    type: 'first-income',
    mode: 'drawer',
    route: text(item.route || '/entries'),
    actionLabel: 'Confirmar receita',
    canWrite: true,
    requiresConfirmation: true,
    diagnosis: 'Receita ausente: cadastre uma renda real para liberar gasto seguro e previsoes confiaveis.',
    draftDefaults: {
      description: 'Receita mensal',
      amount: 0,
      date: referenceDate,
      type: DEFAULT_FIRST_INCOME_TYPE,
      sourceId: text(account?.id),
    },
  })
}

function buildReviewOcrExecution(item = {}) {
  const fallbackRoute = text(item.route || '/entries')

  return baseExecution(item, {
    type: 'review-ocr',
    mode: 'drawer',
    route: fallbackRoute,
    fallbackRoute,
    actionLabel: 'Abrir revisao',
    canWrite: false,
    requiresConfirmation: false,
    explanation: 'OCR e importacoes exigem revisao humana antes de criar ou alterar lancamentos.',
  })
}

function buildSubscriptionChargeExecution(item = {}, context = {}) {
  const target = resolveSubscription(item, context.state)
  const compactTarget = target ? compactSubscription(target) : null
  const nextBillingDate = text(target?.next_billing_date || target?.nextBillingDate || item.dueDate)

  return baseExecution(item, {
    type: 'subscription-charge',
    mode: 'drawer',
    route: text(item.route || '/subscriptions'),
    actionLabel: text(item.actionLabel || 'Gerenciar assinatura'),
    canWrite: Boolean(target),
    requiresConfirmation: true,
    target: compactTarget || {
      id: text(item.subscriptionId || item.contextKey),
      name: text(item.title || 'Assinatura'),
      provider: '',
      monthlyAmount: money(item.impactAmount),
      nextBillingDate,
      status: '',
    },
    externalUrl: text(target?.url),
    draftDefaults: {
      action: 'pause',
      nextBillingDate,
    },
  })
}

function buildCutSubscriptionsExecution(item = {}, context = {}) {
  const options = dispensableOptions(context.state)
  const fallbackMonthly = roundMoney(options.reduce((sum, option) => sum + money(option.monthlyAmount), 0))
  const impactAmount = roundMoney(item.impactAmount ?? fallbackMonthly)
  const annualImpactAmount = roundMoney(item.annualImpactAmount ?? impactAmount * 12)

  return baseExecution(item, {
    type: 'cut-dispensable-subscriptions',
    mode: 'drawer',
    route: text(item.route || '/subscriptions'),
    actionLabel: text(item.actionLabel || 'Revisar cortes'),
    canWrite: options.length > 0,
    requiresConfirmation: true,
    options,
    impactAmount,
    annualImpactAmount,
    draftDefaults: {
      action: 'pause',
      selectedSubscriptionIds: [],
    },
  })
}

function buildCreateFirstGoalExecution(item = {}) {
  return baseExecution(item, {
    type: 'create-first-goal',
    mode: 'drawer',
    route: text(item.route || '/goals'),
    actionLabel: text(item.actionLabel || 'Criar meta'),
    canWrite: true,
    requiresConfirmation: true,
    draftDefaults: {
      name: 'Reserva de emergencia',
      type: 'reserva_emergencia',
      target_amount: 0,
      current_amount: 0,
      monthly_contribution: 0,
      target_date: '',
      priority: 3,
      status: 'active',
    },
  })
}

function buildRouteFallbackExecution(item = {}) {
  return baseExecution(item, {
    type: text(item.executionType || item.type || item.key || 'route'),
    mode: 'route',
    route: text(item.route),
    fallbackRoute: text(item.route),
    actionLabel: text(item.actionLabel || 'Abrir'),
    canWrite: false,
    requiresConfirmation: false,
  })
}

export function buildAssistedExecution(item = {}, context = {}) {
  const executionType = item.executionType || item.key || item.type

  if (executionType === 'first-income') return buildFirstIncomeExecution(item, context)
  if (executionType === 'review-ocr') return buildReviewOcrExecution(item, context)
  if (executionType === 'subscription-charge') return buildSubscriptionChargeExecution(item, context)
  if (executionType === 'cut-dispensable-subscriptions') return buildCutSubscriptionsExecution(item, context)
  if (executionType === 'create-first-goal') return buildCreateFirstGoalExecution(item, context)

  return buildRouteFallbackExecution(item)
}

function selectedIdsFromDraft(draft = {}) {
  const ids = draft.selectedSubscriptionIds || draft.subscriptionIds || draft.selectedIds || []
  return Array.isArray(ids) ? ids.map(String) : []
}

function confirmationBase(overrides = {}) {
  return {
    title: 'Confirmar acao',
    message: '',
    confirmLabel: 'Confirmar',
    destructive: false,
    ...overrides,
  }
}

function firstIncomeConfirmation(execution = {}, draft = {}) {
  const defaults = execution.draftDefaults || {}
  const description = text(draft.description || defaults.description || 'Receita')
  const amount = money(draft.amount ?? defaults.amount)
  const date = text(draft.date || defaults.date)
  const suffix = date ? ` em ${date}` : ''

  return confirmationBase({
    title: 'Confirmar receita',
    message: `Salvar ${description} de ${formatMoney(amount)}${suffix}.`,
    confirmLabel: 'Salvar receita',
  })
}

function subscriptionChargeConfirmation(execution = {}, draft = {}) {
  const action = draft.action || execution.draftDefaults?.action || 'pause'
  const name = text(execution.target?.name || 'Assinatura')
  const amount = money(execution.target?.monthlyAmount || execution.impactAmount)
  const nextBillingDate = text(draft.nextBillingDate || draft.next_billing_date || execution.draftDefaults?.nextBillingDate || execution.target?.nextBillingDate)

  if (action === 'cancel') {
    return confirmationBase({
      title: 'Cancelar assinatura',
      message: `Cancelar ${name}. Economia estimada: ${formatMoney(amount)}/mes.`,
      confirmLabel: 'Cancelar assinatura',
      destructive: true,
    })
  }

  if (action === 'updateDate') {
    return confirmationBase({
      title: 'Atualizar vencimento',
      message: `Atualizar proxima cobranca de ${name} para ${nextBillingDate || 'a nova data informada'}.`,
      confirmLabel: 'Atualizar data',
    })
  }

  const dateText = nextBillingDate ? ` antes da cobranca em ${nextBillingDate}` : ''
  return confirmationBase({
    title: 'Pausar assinatura',
    message: `Pausar ${name}${dateText}. Impacto estimado: ${formatMoney(amount)}/mes.`,
    confirmLabel: 'Pausar assinatura',
  })
}

function cutSubscriptionsConfirmation(execution = {}, draft = {}) {
  const ids = selectedIdsFromDraft(draft)
  const options = Array.isArray(execution.options) ? execution.options : []
  const selected = ids.length ? options.filter((option) => ids.includes(String(option.id))) : options
  const monthly = roundMoney(selected.reduce((sum, option) => sum + money(option.monthlyAmount), 0) || execution.impactAmount)
  const annual = roundMoney(monthly * 12 || execution.annualImpactAmount)
  const names = selected.map((option) => option.name).filter(Boolean).join(', ') || 'assinaturas selecionadas'
  const action = draft.action === 'cancel' ? 'Cancelar' : 'Pausar'

  return confirmationBase({
    title: 'Confirmar cortes',
    message: `${action} ${names}. Economia estimada: ${formatMoney(monthly)}/mes (${formatMoney(annual)}/ano).`,
    confirmLabel: `${action} assinaturas`,
    destructive: draft.action === 'cancel',
  })
}

function createFirstGoalConfirmation(execution = {}, draft = {}) {
  const defaults = execution.draftDefaults || {}
  const name = text(draft.name || defaults.name || 'Meta financeira')
  const target = money(draft.target_amount ?? draft.targetAmount ?? defaults.target_amount)
  const monthly = money(draft.monthly_contribution ?? draft.monthlyContribution ?? defaults.monthly_contribution)

  return confirmationBase({
    title: 'Confirmar meta',
    message: `Criar meta ${name} com alvo de ${formatMoney(target)} e aporte mensal de ${formatMoney(monthly)}.`,
    confirmLabel: 'Criar meta',
  })
}

function fallbackConfirmation(execution = {}) {
  const route = text(execution.fallbackRoute || execution.route)
  const routeText = route ? `Abrir ${route} para continuar sem escrita automatica.` : 'Continuar pela tela indicada sem escrita automatica.'

  return confirmationBase({
    title: text(execution.title || 'Continuar acao'),
    message: routeText,
    confirmLabel: text(execution.actionLabel || 'Abrir'),
  })
}

export function buildExecutionConfirmation(execution = {}, draft = {}) {
  if (execution.type === 'first-income') return firstIncomeConfirmation(execution, draft)
  if (execution.type === 'subscription-charge') return subscriptionChargeConfirmation(execution, draft)
  if (execution.type === 'cut-dispensable-subscriptions') return cutSubscriptionsConfirmation(execution, draft)
  if (execution.type === 'create-first-goal') return createFirstGoalConfirmation(execution, draft)

  return fallbackConfirmation(execution)
}

function optionFacts(option = {}) {
  return {
    id: text(option.id),
    name: text(option.name),
    provider: text(option.provider),
    monthlyAmount: money(option.monthlyAmount),
  }
}

function targetFacts(target = {}) {
  return {
    id: text(target.id),
    name: text(target.name),
    provider: text(target.provider),
    monthlyAmount: money(target.monthlyAmount),
    nextBillingDate: text(target.nextBillingDate),
  }
}

export function executionFactsForAI(execution = {}) {
  return {
    type: text(execution.type),
    mode: text(execution.mode),
    requiresConfirmation: Boolean(execution.requiresConfirmation),
    canWrite: false,
    route: text(execution.route),
    fallbackRoute: text(execution.fallbackRoute),
    actionLabel: text(execution.actionLabel),
    title: text(execution.title),
    description: text(execution.description),
    contextKey: text(execution.contextKey),
    diagnosis: text(execution.diagnosis || execution.explanation),
    impactAmount: money(execution.impactAmount),
    annualImpactAmount: money(execution.annualImpactAmount),
    externalUrl: text(execution.externalUrl),
    target: targetFacts(execution.target),
    options: (Array.isArray(execution.options) ? execution.options : []).slice(0, 8).map(optionFacts),
  }
}
