const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high'])
const ACTION_TYPES = new Set(['create_transaction', 'update_transaction_category', 'mark_as_internal_transfer', 'add_to_wishlist', 'create_alert', 'create_recurring_rule'])

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function textList(value, maxItems = 5, maxLength = 240) {
  return Array.isArray(value)
    ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : []
}

export function safeAiFallback(basis = [], warnings = []) {
  return {
    answer: 'Nao foi possivel produzir uma analise confiavel agora. Consulte os indicadores da tela e tente novamente.',
    confidence: 'low',
    basis: textList(basis, 6, 180),
    warnings: [...textList(warnings, 5, 220), 'A resposta da IA nao passou pela validacao de seguranca.'].slice(0, 6),
    suggested_questions: [],
    suggested_actions: [],
  }
}

export function sanitizeAiResponse(value, fallbackBasis = [], fallbackWarnings = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return safeAiFallback(fallbackBasis, fallbackWarnings)
  }

  const answer = text(value.answer, 2400)
  if (!answer) return safeAiFallback(fallbackBasis, fallbackWarnings)

  const actions = Array.isArray(value.suggested_actions)
    ? value.suggested_actions.slice(0, 4).map((item) => {
        if (typeof item === 'string') return { label: text(item, 160), executable: false }
        return {
          label: text(item?.label || item?.title || item?.description, 160),
          executable: false,
          ...(ACTION_TYPES.has(item?.action_type) && item?.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
            ? { action_type: item.action_type, payload: item.payload }
            : {}),
        }
      }).filter((item) => item.label)
    : []

  const confidence = text(value.confidence, 12).toLowerCase()
  return {
    answer,
    confidence: CONFIDENCE_LEVELS.has(confidence) ? confidence : 'low',
    basis: textList(value.basis, 6, 220).length ? textList(value.basis, 6, 220) : textList(fallbackBasis, 6, 220),
    warnings: [...textList(value.warnings, 6, 240), ...textList(fallbackWarnings, 3, 240)].filter((item, index, list) => list.indexOf(item) === index).slice(0, 6),
    suggested_questions: textList(value.suggested_questions, 4, 180),
    suggested_actions: actions,
  }
}
