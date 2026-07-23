function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function hashText(value) {
  let hash = 2166136261
  const text = String(value)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function automationWindowKey(cadence, now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  const iso = date.toISOString()
  return cadence === 'hourly' ? iso.slice(0, 13) : iso.slice(0, 10)
}

export function buildAutomationDedupeKey(automation, evaluation, now = new Date()) {
  const signal = evaluation?.signal || stableStringify(evaluation?.details || evaluation || {})
  return [
    `automation:${automation.id}`,
    `template:${automation.template_id}`,
    `window:${automationWindowKey(automation.cadence, now)}`,
    `signal:${hashText(signal)}`,
  ].join(':')
}

export function nextRunAt(cadence, now = new Date()) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  if (cadence === 'hourly') date.setUTCHours(date.getUTCHours() + 1)
  else date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

export function isInCooldown(lastTriggeredAt, cooldownHours, now = new Date()) {
  if (!lastTriggeredAt) return false
  const last = new Date(lastTriggeredAt).getTime()
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (!Number.isFinite(last) || !Number.isFinite(current)) return false
  return last + Number(cooldownHours || 1) * 60 * 60 * 1000 > current
}

export function normalizeRunResult(evaluation, cooldown = false) {
  if (cooldown) {
    return {
      status: 'skipped',
      triggered: false,
      resultPayload: {
        code: 'COOLDOWN_ACTIVE',
        message: 'Cooldown ativo; notificacao in-app nao duplicada.',
        evaluation,
      },
    }
  }
  if (evaluation.status === 'skipped') {
    return {
      status: 'skipped',
      triggered: false,
      resultPayload: evaluation,
    }
  }
  return {
    status: 'success',
    triggered: Boolean(evaluation.triggered),
    resultPayload: evaluation,
  }
}

export function buildNotificationPayload(automation, evaluation, sourceId = automation.id) {
  return {
    user_id: automation.user_id,
    source: 'automation',
    source_id: sourceId,
    severity: evaluation.severity || 'info',
    title: evaluation.title || automation.name,
    message: evaluation.message || 'Automacao executada.',
    payload: {
      automation_id: automation.id,
      template_id: automation.template_id,
      details: evaluation.details || {},
    },
  }
}
