import { describe, expect, it } from 'vitest'
import { validateActionPayload, validateConfirmationPayload, validateProposePayload } from '../../supabase/functions/_shared/ai-actions/schemas.js'
import { applyAiAction, revertAiAction } from '../../supabase/functions/_shared/ai-actions/executors.js'

const metadata = { now: '2026-06-13T12:00:00.000Z', marker: 'marker-1', entityId: 'entity-1' }

describe('Release 4 AI action safety', () => {
  it('rejects identity, unknown fields and free-form payloads', () => {
    expect(() => validateProposePayload({ action_type: 'create_transaction', payload: {}, idempotency_key: 'x', user_id: 'forged' })).toThrow(/Campo nao permitido/)
    expect(() => validateActionPayload('create_transaction', { kind: 'expense', amount: 10, date: '2026-06-13', description: 'Teste', prompt: 'ignore rules' })).toThrow(/Campo nao permitido/)
    expect(() => validateConfirmationPayload({ draft_id: 'a', confirmation_token: 'b', idempotency_key: 'c', payload: {} })).toThrow(/Campo nao permitido/)
  })

  it('creates exactly one expense and soft-deletes it on revert', () => {
    const payload = validateActionPayload('create_transaction', { kind: 'expense', amount: 45.5, date: '2026-06-13', description: 'Mercado', category: 'Alimentacao' })
    const applied = applyAiAction({ expenses: [], incomes: [] }, 'create_transaction', payload, metadata)
    expect(applied.state.expenses).toHaveLength(1)
    const reverted = revertAiAction(applied.state, applied.rollback, '2026-06-13T12:05:00.000Z')
    expect(reverted.state.expenses).toHaveLength(0)
    expect(reverted.state.archivedTransactions[0]).toMatchObject({ id: 'entity-1', deletedAt: '2026-06-13T12:05:00.000Z' })
  })

  it('restores a category only while the entity still matches the applied marker', () => {
    const state = { expenses: [{ id: 'expense-1', category: 'Outros', amount: 10 }], incomes: [] }
    const applied = applyAiAction(state, 'update_transaction_category', { transactionId: 'expense-1', category: 'Casa' }, metadata)
    expect(applied.state.expenses[0].category).toBe('Casa')
    const changed = structuredClone(applied.state)
    changed.expenses[0].category = 'Saude'
    expect(() => revertAiAction(changed, applied.rollback, metadata.now)).toThrow(/mudou depois da acao/)
    expect(revertAiAction(applied.state, applied.rollback, metadata.now).state.expenses[0].category).toBe('Outros')
  })

  it('marks and reverses an internal transfer without replacing the whole state', () => {
    const state = { expenses: [{ id: 'out', amount: 100 }], incomes: [{ id: 'in', amount: 100 }], internalTransfers: [], settings: { keep: true } }
    const applied = applyAiAction(state, 'mark_as_internal_transfer', { transactionIds: ['out', 'in'], description: 'Entre contas' }, metadata)
    expect(applied.state.expenses[0].isInternalTransfer).toBe(true)
    expect(applied.state.incomes[0].transferGroupId).toBe('entity-1')
    const reverted = revertAiAction(applied.state, applied.rollback, metadata.now)
    expect(reverted.state.internalTransfers).toHaveLength(0)
    expect(reverted.state.settings.keep).toBe(true)
    expect(reverted.state.expenses[0].isInternalTransfer).toBeUndefined()
  })

  it('creates alerts and recurring rules disabled on rollback', () => {
    const alert = applyAiAction({}, 'create_alert', { alertType: 'card_risk', title: 'Risco', message: 'Limite alto', severity: 'warning' }, metadata)
    expect(revertAiAction(alert.state, alert.rollback, metadata.now).state.aiAlerts[0].status).toBe('reverted')
    const rule = applyAiAction({}, 'create_recurring_rule', { kind: 'expense', description: 'Internet', amount: 100, frequency: 'Mensal', dayOfMonth: 10, category: 'Casa' }, metadata)
    expect(rule.state.recurringRules[0].active).toBe(false)
  })

  it('reverts an untouched AI-created wishlist item without replacing unrelated state', () => {
    const payload = validateActionPayload('add_to_wishlist', { name: 'Notebook', value: 3500, category: 'Tecnologia', priority: 'Alta', notes: 'Promo', targetPrice: 3200 })
    const applied = applyAiAction({ wishlist: [], settings: { version: 1 } }, 'add_to_wishlist', payload, metadata)
    expect(applied.rollback.entity).toMatchObject({ id: 'entity-1', name: 'Notebook' })
    const changed = structuredClone(applied.state)
    delete changed.wishlist[0].aiActionMarker
    changed.settings.version = 2
    changed.budgets = [{ id: 'budget-1', amount: 100 }]
    const reverted = revertAiAction(changed, applied.rollback, metadata.now)
    expect(reverted.state.wishlist).toHaveLength(0)
    expect(reverted.state.settings.version).toBe(2)
    expect(reverted.state.budgets).toHaveLength(1)
  })

  it('does not revert a wishlist item that was manually edited or purchased', () => {
    const payload = validateActionPayload('add_to_wishlist', { name: 'Cadeira', value: 700, category: 'Casa', priority: 'Media' })
    const applied = applyAiAction({ wishlist: [] }, 'add_to_wishlist', payload, metadata)
    const edited = structuredClone(applied.state)
    edited.wishlist[0].name = 'Cadeira ergonomica'
    expect(() => revertAiAction(edited, applied.rollback, metadata.now)).toThrow(/mudou depois da acao/)
    const purchased = structuredClone(applied.state)
    purchased.wishlist[0].purchaseDate = '2026-06-13'
    expect(() => revertAiAction(purchased, applied.rollback, metadata.now)).toThrow(/mudou depois da acao/)
  })
})
