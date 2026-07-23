const clone = (value) => JSON.parse(JSON.stringify(value || {}))
const list = (state, key) => Array.isArray(state[key]) ? state[key] : (state[key] = [])
const WISHLIST_EDIT_FIELDS = ['name', 'value', 'category', 'priority', 'desiredDate', 'notes', 'originalUrl', 'originalLink', 'canonicalUrl', 'targetPrice', 'monitorPrice', 'priceStatus']

function findTransaction(state, id) {
  for (const key of ['expenses', 'incomes']) {
    const index = list(state, key).findIndex((item) => String(item.id) === String(id))
    if (index >= 0) return { key, index, item: state[key][index] }
  }
  return null
}

export function applyAiAction(currentState, actionType, payload, metadata) {
  const state = clone(currentState)
  const marker = metadata.marker
  const id = metadata.entityId
  if (actionType === 'create_transaction') {
    const key = payload.kind === 'income' ? 'incomes' : 'expenses'
    const entity = {
      id, date: payload.date, description: payload.description, amount: payload.amount,
      paid: payload.paid, created_at: metadata.now, aiActionMarker: marker,
      ...(payload.kind === 'income'
        ? { type: payload.category || 'Outros', sourceType: 'account', sourceId: null }
        : { category: payload.category || 'Outros', payment: payload.payment || 'Dinheiro', sourceType: 'account', sourceId: null }),
    }
    list(state, key).push(entity)
    return { state, entityType: payload.kind, entityId: id, result: { entity }, rollback: { actionType, key, entityId: id, marker } }
  }
  if (actionType === 'update_transaction_category') {
    const found = findTransaction(state, payload.transactionId)
    if (!found) throw Object.assign(new Error('Transacao nao encontrada.'), { code: 'ENTITY_NOT_FOUND', status: 409 })
    const previousCategory = found.item.category ?? found.item.type ?? ''
    if (found.key === 'expenses') found.item.category = payload.category
    else found.item.type = payload.category
    found.item.aiActionMarker = marker
    return { state, entityType: found.key === 'expenses' ? 'expense' : 'income', entityId: payload.transactionId, result: { previousCategory, category: payload.category }, rollback: { actionType, key: found.key, entityId: payload.transactionId, previousCategory, appliedCategory: payload.category, marker } }
  }
  if (actionType === 'mark_as_internal_transfer') {
    const transferGroupId = id
    const prior = payload.transactionIds.map((transactionId) => {
      const found = findTransaction(state, transactionId)
      if (!found) throw Object.assign(new Error('Transacao nao encontrada.'), { code: 'ENTITY_NOT_FOUND', status: 409 })
      const previous = { isInternalTransfer: found.item.isInternalTransfer, transferGroupId: found.item.transferGroupId, transferConfidence: found.item.transferConfidence, transferConfirmedAt: found.item.transferConfirmedAt, aiActionMarker: found.item.aiActionMarker }
      Object.assign(found.item, { isInternalTransfer: true, transferGroupId, transferConfidence: 100, transferConfirmedAt: metadata.now, aiActionMarker: marker })
      return { key: found.key, entityId: transactionId, previous }
    })
    list(state, 'internalTransfers').push({ id, transferGroupId, transactionIds: payload.transactionIds, description: payload.description || 'Transferencia interna', confirmed: true, confirmedAt: metadata.now, created_at: metadata.now, aiActionMarker: marker })
    return { state, entityType: 'internal_transfer', entityId: id, result: { transferGroupId, transactionIds: payload.transactionIds }, rollback: { actionType, entityId: id, transferGroupId, prior, marker } }
  }
  if (actionType === 'add_to_wishlist') {
    const entity = { id, name: payload.name, value: payload.value, category: payload.category || 'Outros', priority: payload.priority, desiredDate: payload.desiredDate, notes: payload.notes, originalUrl: payload.originalUrl, originalLink: payload.originalUrl, canonicalUrl: payload.originalUrl, targetPrice: payload.targetPrice, monitorPrice: true, priceStatus: payload.value ? 'manual' : 'pending_quote', created_at: metadata.now, aiActionMarker: marker }
    list(state, 'wishlist').push(entity)
    return { state, entityType: 'wishlist_item', entityId: id, result: { entity }, rollback: { actionType, key: 'wishlist', entityId: id, marker, entity } }
  }
  if (actionType === 'create_alert') {
    const entity = { id, ...payload, status: 'active', created_at: metadata.now, aiActionMarker: marker }
    list(state, 'aiAlerts').push(entity)
    return { state, entityType: 'alert', entityId: id, result: { entity }, rollback: { actionType, key: 'aiAlerts', entityId: id, marker } }
  }
  if (actionType === 'create_recurring_rule') {
    const entity = { id, ...payload, active: false, status: 'pending_confirmation', created_at: metadata.now, aiActionMarker: marker }
    list(state, 'recurringRules').push(entity)
    return { state, entityType: 'recurring_rule', entityId: id, result: { entity }, rollback: { actionType, key: 'recurringRules', entityId: id, marker } }
  }
  throw Object.assign(new Error('Acao nao suportada.'), { code: 'ACTION_NOT_SUPPORTED', status: 400 })
}

export function revertAiAction(currentState, rollback, now) {
  const state = clone(currentState)
  if (rollback.actionType === 'create_transaction') {
    const rows = list(state, rollback.key)
    const index = rows.findIndex((item) => item.id === rollback.entityId && item.aiActionMarker === rollback.marker)
    if (index < 0) throw conflict()
    const [entity] = rows.splice(index, 1)
    list(state, 'archivedTransactions').push({ ...entity, deletedAt: now, aiActionRevertedAt: now })
    return { state, result: { reverted: true, entityId: rollback.entityId, mode: 'soft_delete' } }
  }
  if (rollback.actionType === 'update_transaction_category') {
    const found = findTransaction(state, rollback.entityId)
    const current = found?.key === 'expenses' ? found?.item.category : found?.item.type
    if (!found || found.item.aiActionMarker !== rollback.marker || current !== rollback.appliedCategory) throw conflict()
    if (found.key === 'expenses') found.item.category = rollback.previousCategory
    else found.item.type = rollback.previousCategory
    delete found.item.aiActionMarker
    return { state, result: { reverted: true, entityId: rollback.entityId, category: rollback.previousCategory } }
  }
  if (rollback.actionType === 'mark_as_internal_transfer') {
    for (const prior of rollback.prior) {
      const found = findTransaction(state, prior.entityId)
      if (!found || found.item.aiActionMarker !== rollback.marker || found.item.transferGroupId !== rollback.transferGroupId) throw conflict()
      for (const field of ['isInternalTransfer', 'transferGroupId', 'transferConfidence', 'transferConfirmedAt', 'aiActionMarker']) {
        if (prior.previous[field] === undefined) delete found.item[field]
        else found.item[field] = prior.previous[field]
      }
    }
    state.internalTransfers = list(state, 'internalTransfers').filter((item) => !(item.id === rollback.entityId && item.aiActionMarker === rollback.marker))
    return { state, result: { reverted: true, entityId: rollback.entityId } }
  }
  const rows = list(state, rollback.key)
  if (rollback.actionType === 'add_to_wishlist') {
    const index = rows.findIndex((item) => String(item.id) === String(rollback.entityId))
    if (index < 0 || !isWishlistItemRevertable(rows[index], rollback)) throw conflict()
    rows.splice(index, 1)
    return { state, result: { reverted: true, entityId: rollback.entityId, mode: 'remove_wishlist_item' } }
  }
  const index = rows.findIndex((item) => item.id === rollback.entityId && item.aiActionMarker === rollback.marker)
  if (index < 0) throw conflict()
  Object.assign(rows[index], { active: false, status: 'reverted', revertedAt: now })
  return { state, result: { reverted: true, entityId: rollback.entityId } }
}

function isWishlistItemRevertable(item, rollback) {
  const created = rollback.entity || {}
  if (!item || String(item.id) !== String(rollback.entityId)) return false
  if (item.aiActionMarker != null && item.aiActionMarker !== rollback.marker) return false
  if (item.status === 'purchased' || item.priceStatus === 'purchased' || item.purchaseDate || item.purchasedAt || item.boughtAt) return false
  return WISHLIST_EDIT_FIELDS.every((field) => normalizeComparable(item[field]) === normalizeComparable(created[field]))
}

function normalizeComparable(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function conflict() {
  return Object.assign(new Error('A entidade mudou depois da acao e nao pode ser revertida automaticamente.'), { code: 'REVERT_CONFLICT', status: 409 })
}
