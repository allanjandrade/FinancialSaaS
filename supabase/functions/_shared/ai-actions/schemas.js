export const AI_ACTION_TYPES = Object.freeze([
  'create_transaction',
  'update_transaction_category',
  'mark_as_internal_transfer',
  'add_to_wishlist',
  'create_alert',
  'create_recurring_rule',
])

const ACTION_SET = new Set(AI_ACTION_TYPES)
const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
const text = (value, field, max = 240) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || normalized.length > max) throw validation(`${field} invalido.`)
  return normalized
}
const optionalText = (value, field, max = 240) => value == null || value === '' ? '' : text(value, field, max)
const money = (value, field = 'amount') => {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > 999999999) throw validation(`${field} invalido.`)
  return Math.round(normalized * 100) / 100
}
const date = (value) => {
  const normalized = text(value, 'date', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T12:00:00Z`))) throw validation('date invalida.')
  return normalized
}
const exactKeys = (value, allowed) => {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown) throw validation(`Campo nao permitido: ${unknown}.`)
}

export class AiActionValidationError extends Error {
  constructor(message, code = 'INVALID_ACTION_PAYLOAD') {
    super(message)
    this.name = 'AiActionValidationError'
    this.code = code
    this.status = 400
  }
}

function validation(message) { return new AiActionValidationError(message) }

export function validateActionPayload(actionType, raw) {
  if (!ACTION_SET.has(actionType)) throw validation('Tipo de acao nao permitido.')
  if (!object(raw)) throw validation('Payload da acao invalido.')
  switch (actionType) {
    case 'create_transaction': {
      exactKeys(raw, ['kind', 'amount', 'date', 'description', 'category', 'payment', 'paid'])
      if (!['income', 'expense'].includes(raw.kind)) throw validation('kind invalido.')
      return {
        kind: raw.kind,
        amount: money(raw.amount),
        date: date(raw.date),
        description: text(raw.description, 'description', 180),
        category: optionalText(raw.category, 'category', 80),
        payment: optionalText(raw.payment, 'payment', 80),
        paid: raw.paid === true,
      }
    }
    case 'update_transaction_category':
      exactKeys(raw, ['transactionId', 'category'])
      return { transactionId: text(raw.transactionId, 'transactionId', 100), category: text(raw.category, 'category', 80) }
    case 'mark_as_internal_transfer': {
      exactKeys(raw, ['transactionIds', 'description'])
      if (!Array.isArray(raw.transactionIds) || raw.transactionIds.length < 1 || raw.transactionIds.length > 2) throw validation('transactionIds deve conter uma ou duas transacoes.')
      const transactionIds = [...new Set(raw.transactionIds.map((id) => text(id, 'transactionId', 100)))]
      if (transactionIds.length !== raw.transactionIds.length) throw validation('transactionIds duplicados.')
      return { transactionIds, description: optionalText(raw.description, 'description', 180) }
    }
    case 'add_to_wishlist':
      exactKeys(raw, ['name', 'value', 'category', 'priority', 'desiredDate', 'notes', 'originalUrl', 'targetPrice'])
      return {
        name: text(raw.name, 'name', 180),
        value: raw.value == null || raw.value === '' ? null : money(raw.value, 'value'),
        category: optionalText(raw.category, 'category', 80),
        priority: ['Baixa', 'Media', 'Alta'].includes(raw.priority) ? raw.priority : 'Media',
        desiredDate: raw.desiredDate ? date(raw.desiredDate) : '',
        notes: optionalText(raw.notes, 'notes', 500),
        originalUrl: optionalText(raw.originalUrl, 'originalUrl', 1200),
        targetPrice: raw.targetPrice == null || raw.targetPrice === '' ? null : money(raw.targetPrice, 'targetPrice'),
      }
    case 'create_alert':
      exactKeys(raw, ['alertType', 'title', 'message', 'severity'])
      return {
        alertType: text(raw.alertType, 'alertType', 60),
        title: text(raw.title, 'title', 140),
        message: text(raw.message, 'message', 500),
        severity: ['info', 'warning', 'critical'].includes(raw.severity) ? raw.severity : 'info',
      }
    case 'create_recurring_rule':
      exactKeys(raw, ['kind', 'description', 'amount', 'frequency', 'dayOfMonth', 'category'])
      if (!['income', 'expense'].includes(raw.kind)) throw validation('kind invalido.')
      if (!['Mensal', 'Semanal', 'Anual'].includes(raw.frequency)) throw validation('frequency invalida.')
      if (!Number.isInteger(Number(raw.dayOfMonth)) || Number(raw.dayOfMonth) < 1 || Number(raw.dayOfMonth) > 31) throw validation('dayOfMonth invalido.')
      return {
        kind: raw.kind,
        description: text(raw.description, 'description', 180),
        amount: money(raw.amount),
        frequency: raw.frequency,
        dayOfMonth: Number(raw.dayOfMonth),
        category: optionalText(raw.category, 'category', 80),
      }
  }
}

export function validateProposePayload(value) {
  if (!object(value)) throw validation('Requisicao invalida.')
  exactKeys(value, ['action_type', 'payload', 'idempotency_key'])
  return {
    actionType: text(value.action_type, 'action_type', 80),
    payload: validateActionPayload(value.action_type, value.payload),
    idempotencyKey: text(value.idempotency_key, 'idempotency_key', 120),
  }
}

export function validateConfirmationPayload(value, mode = 'confirm') {
  if (!object(value)) throw validation('Requisicao invalida.')
  const allowed = mode === 'confirm' ? ['draft_id', 'confirmation_token', 'idempotency_key'] : ['log_id', 'idempotency_key']
  exactKeys(value, allowed)
  return mode === 'confirm'
    ? { draftId: text(value.draft_id, 'draft_id', 80), confirmationToken: text(value.confirmation_token, 'confirmation_token', 300), idempotencyKey: text(value.idempotency_key, 'idempotency_key', 120) }
    : { logId: text(value.log_id, 'log_id', 80), idempotencyKey: text(value.idempotency_key, 'idempotency_key', 120) }
}

export function buildActionPreview(actionType, payload) {
  const labels = {
    create_transaction: payload.kind === 'income' ? 'Criar receita' : 'Criar despesa',
    update_transaction_category: 'Alterar categoria',
    mark_as_internal_transfer: 'Marcar transferencia interna',
    add_to_wishlist: 'Adicionar a lista de desejos',
    create_alert: 'Criar alerta',
    create_recurring_rule: 'Criar regra recorrente desativada',
  }
  return { title: labels[actionType], action_type: actionType, summary: payload.description || payload.name || payload.title || labels[actionType], payload }
}
