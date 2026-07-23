const CONTEXT_TYPES = new Set(['dashboard', 'entries', 'purchases', 'reports'])
const ALLOWED_FIELDS = new Set(['context_type', 'entity_id', 'user_query'])

export function validateAiAssistPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Envie um objeto JSON valido.'), { code: 'INVALID_PAYLOAD', status: 400 })
  }

  const unknownField = Object.keys(value).find((field) => !ALLOWED_FIELDS.has(field))
  if (unknownField) {
    throw Object.assign(new Error(`Campo nao permitido: ${unknownField}.`), { code: 'INVALID_PAYLOAD', status: 400 })
  }

  const contextType = String(value.context_type || '').trim()
  const userQuery = String(value.user_query || '').trim()
  const entityId = value.entity_id == null ? null : String(value.entity_id).trim()

  if (!CONTEXT_TYPES.has(contextType)) {
    throw Object.assign(new Error('Contexto do assistente invalido.'), { code: 'INVALID_PAYLOAD', status: 400 })
  }
  if (userQuery.length < 3 || userQuery.length > 1200) {
    throw Object.assign(new Error('A pergunta deve ter entre 3 e 1200 caracteres.'), { code: 'INVALID_PAYLOAD', status: 400 })
  }
  if (entityId && entityId.length > 200) {
    throw Object.assign(new Error('Identificador de contexto invalido.'), { code: 'INVALID_PAYLOAD', status: 400 })
  }

  return { contextType, entityId: entityId || null, userQuery }
}

export { CONTEXT_TYPES }
