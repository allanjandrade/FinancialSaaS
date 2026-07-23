export const AUTOMATION_TEMPLATE_IDS = Object.freeze([
  'cash_balance_below',
  'card_bill_ratio_above',
  'benefit_depletion_risk',
  'bill_due_soon',
  'category_anomaly_detected',
  'wishlist_target_price_reached',
  'goal_progress_behind',
  'budget_category_above_limit',
  'monthly_plan_risk',
  'purchase_now_viable',
  'investment_capacity_available',
])

export const AUTOMATION_TEMPLATES = Object.freeze({
  cash_balance_below: {
    id: 'cash_balance_below',
    name: 'Saldo baixo',
    category: 'cash',
    defaultCooldownHours: 24,
  },
  card_bill_ratio_above: {
    id: 'card_bill_ratio_above',
    name: 'Fatura alta',
    category: 'card',
    defaultCooldownHours: 24,
  },
  benefit_depletion_risk: {
    id: 'benefit_depletion_risk',
    name: 'VA/VR em risco',
    category: 'benefit',
    defaultCooldownHours: 24,
  },
  bill_due_soon: {
    id: 'bill_due_soon',
    name: 'Conta vencendo',
    category: 'bill',
    defaultCooldownHours: 24,
  },
  category_anomaly_detected: {
    id: 'category_anomaly_detected',
    name: 'Categoria acima da media',
    category: 'category',
    defaultCooldownHours: 24,
  },
  wishlist_target_price_reached: {
    id: 'wishlist_target_price_reached',
    name: 'Preco alvo atingido',
    category: 'wishlist',
    defaultCooldownHours: 24,
  },
  goal_progress_behind: {
    id: 'goal_progress_behind',
    name: 'Meta atrasada',
    category: 'planning',
    defaultCooldownHours: 24,
  },
  budget_category_above_limit: {
    id: 'budget_category_above_limit',
    name: 'Orcamento acima do limite',
    category: 'planning',
    defaultCooldownHours: 24,
  },
  monthly_plan_risk: {
    id: 'monthly_plan_risk',
    name: 'Risco no plano do mes',
    category: 'planning',
    defaultCooldownHours: 24,
  },
  purchase_now_viable: {
    id: 'purchase_now_viable',
    name: 'Compra viavel agora',
    category: 'planning',
    defaultCooldownHours: 24,
  },
  investment_capacity_available: {
    id: 'investment_capacity_available',
    name: 'Capacidade de aporte disponivel',
    category: 'planning',
    defaultCooldownHours: 24,
  },
})

const ACTIONS = new Set([
  'list_templates',
  'list_user_automations',
  'create_automation',
  'pause_automation',
  'resume_automation',
  'delete_automation',
  'list_notifications',
  'mark_notification_read',
])

const DANGEROUS_KEYS = new Set([
  'user_id',
  'userId',
  'family_id',
  'familyId',
  'script',
  'code',
  'prompt',
  'sql',
  'webhook',
  'webhook_url',
  'webhookUrl',
  'email',
  'email_to',
  'emailTo',
  'phone',
  'phone_number',
  'phoneNumber',
  'whatsapp',
  'telegram',
  'gmail',
  'google',
  'drive',
  'sheets',
])

const PROHIBITED_PARAMETER_KEYS = new Set([...DANGEROUS_KEYS, 'action', 'actions'])

export class AutomationValidationError extends Error {
  constructor(message, code = 'INVALID_AUTOMATION_PAYLOAD', status = 400) {
    super(message)
    this.name = 'AutomationValidationError'
    this.code = code
    this.status = status
  }
}

const object = (value) => value && typeof value === 'object' && !Array.isArray(value)

function validation(message, code, status) {
  return new AutomationValidationError(message, code, status)
}

function exactKeys(value, allowed) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown) throw validation(`Campo nao permitido: ${unknown}.`)
}

function rejectDangerousKeys(value, keys = DANGEROUS_KEYS, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectDangerousKeys(item, keys, `${path}[${index}]`))
    return
  }
  if (!object(value)) return
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key)) {
      throw validation(`Campo perigoso bloqueado: ${path}${key}.`, 'FORBIDDEN_AUTOMATION_FIELD', 403)
    }
    rejectDangerousKeys(nested, keys, `${path}${key}.`)
  }
}

function text(value, field, max = 160) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || normalized.length > max) throw validation(`${field} invalido.`)
  return normalized
}

function optionalText(value, fallback, max = 160) {
  if (value == null || value === '') return fallback
  return text(value, 'name', max)
}

function numberInRange(value, field, min, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw validation(`${field} invalido.`)
  return Math.round(parsed * 10000) / 10000
}

function integerInRange(value, field, min, max) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw validation(`${field} invalido.`)
  return parsed
}

function cadence(value) {
  if (value == null || value === '') return 'daily'
  if (!['hourly', 'daily'].includes(value)) throw validation('cadence invalida.')
  return value
}

function timezone(value) {
  if (value == null || value === '') return 'America/Sao_Paulo'
  const normalized = text(value, 'timezone', 80)
  if (!/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(normalized)) throw validation('timezone invalida.')
  return normalized
}

function cooldownHours(value, fallback = 24) {
  if (value == null || value === '') return fallback
  return integerInRange(value, 'cooldown_hours', 1, 24 * 30)
}

export function validateTemplateId(value) {
  const id = text(value, 'template_id', 80)
  if (!AUTOMATION_TEMPLATE_IDS.includes(id)) throw validation('template_id nao permitido.')
  return id
}

export function validateTemplateParameters(templateId, raw = {}) {
  if (!object(raw)) throw validation('parameters invalido.')
  rejectDangerousKeys(raw, PROHIBITED_PARAMETER_KEYS)
  switch (templateId) {
    case 'cash_balance_below':
      exactKeys(raw, ['threshold'])
      return { threshold: numberInRange(raw.threshold, 'threshold', 0, 999999999) }
    case 'card_bill_ratio_above':
      exactKeys(raw, ['ratio'])
      return { ratio: numberInRange(raw.ratio, 'ratio', 0.01, 1) }
    case 'benefit_depletion_risk': {
      exactKeys(raw, ['benefit_type'])
      const benefitType = text(raw.benefit_type, 'benefit_type', 2).toUpperCase()
      if (!['VA', 'VR'].includes(benefitType)) throw validation('benefit_type invalido.')
      return { benefit_type: benefitType }
    }
    case 'bill_due_soon':
      exactKeys(raw, ['days_before'])
      return { days_before: integerInRange(raw.days_before, 'days_before', 1, 15) }
    case 'category_anomaly_detected': {
      exactKeys(raw, ['severity'])
      const severity = text(raw.severity, 'severity', 20)
      if (!['attention', 'risk', 'critical'].includes(severity)) throw validation('severity invalida.')
      return { severity }
    }
    case 'wishlist_target_price_reached':
      exactKeys(raw, ['purchase_item_id'])
      return { purchase_item_id: text(raw.purchase_item_id, 'purchase_item_id', 120) }
    case 'goal_progress_behind':
      exactKeys(raw, ['goal_id'])
      return { goal_id: text(raw.goal_id, 'goal_id', 120) }
    case 'budget_category_above_limit': {
      exactKeys(raw, ['category'])
      return { category: text(raw.category, 'category', 80) }
    }
    case 'monthly_plan_risk': {
      exactKeys(raw, ['risk_level'])
      const riskLevel = text(raw.risk_level, 'risk_level', 20)
      if (!['attention', 'critical'].includes(riskLevel)) throw validation('risk_level invalido.')
      return { risk_level: riskLevel }
    }
    case 'purchase_now_viable':
      exactKeys(raw, ['purchase_item_id'])
      return { purchase_item_id: text(raw.purchase_item_id, 'purchase_item_id', 120) }
    case 'investment_capacity_available':
      exactKeys(raw, ['minimum_amount'])
      return { minimum_amount: numberInRange(raw.minimum_amount, 'minimum_amount', 0, 999999999) }
    default:
      throw validation('template_id nao permitido.')
  }
}

export function validateAutomationCreatePayload(body) {
  if (!object(body)) throw validation('Requisicao invalida.')
  rejectDangerousKeys(body, DANGEROUS_KEYS)
  exactKeys(body, ['action', 'template_id', 'name', 'parameters', 'cadence', 'cooldown_hours', 'timezone'])
  const templateId = validateTemplateId(body.template_id)
  const template = AUTOMATION_TEMPLATES[templateId]
  return {
    templateId,
    name: optionalText(body.name, template.name),
    parameters: validateTemplateParameters(templateId, body.parameters || {}),
    cadence: cadence(body.cadence),
    cooldownHours: cooldownHours(body.cooldown_hours, template.defaultCooldownHours),
    timezone: timezone(body.timezone),
  }
}

export function validateAutomationActionPayload(value) {
  if (!object(value)) throw validation('Requisicao invalida.')
  rejectDangerousKeys(value, DANGEROUS_KEYS)
  const action = text(value.action, 'action', 80)
  if (!ACTIONS.has(action)) throw validation('Acao nao permitida.')
  if (action === 'create_automation') return { action, ...validateAutomationCreatePayload(value) }
  if (['pause_automation', 'resume_automation', 'delete_automation'].includes(action)) {
    exactKeys(value, ['action', 'automation_id'])
    return { action, automationId: text(value.automation_id, 'automation_id', 80) }
  }
  if (action === 'mark_notification_read') {
    exactKeys(value, ['action', 'notification_id'])
    return { action, notificationId: text(value.notification_id, 'notification_id', 80) }
  }
  if (['list_user_automations', 'list_notifications'].includes(action)) {
    exactKeys(value, ['action', 'limit'])
    return { action, limit: value.limit == null ? 30 : integerInRange(value.limit, 'limit', 1, 100) }
  }
  exactKeys(value, ['action'])
  return { action }
}
