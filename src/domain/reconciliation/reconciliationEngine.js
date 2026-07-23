import {
  normalizeExpenseCategory,
  normalizeIncomeType,
  normalizePaymentMethod,
} from '@/constants/finance.js'
import { reconcileSubscriptionCharge } from '@/utils/subscriptions.js'

const DAY_MS = 24 * 60 * 60 * 1000
const SOURCE_CREDIT_CARD = 'credit_card'

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isoDate(value) {
  const text = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0]
  return parsed.toISOString().split('T')[0]
}

function parseLocalDate(value) {
  const [year, month, day] = isoDate(value).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function dateDiffDays(a, b) {
  return Math.round((parseLocalDate(a) - parseLocalDate(b)) / DAY_MS)
}

function descriptionLooksSame(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return false
  if (left === right || left.includes(right) || right.includes(left)) return true

  const leftTokens = new Set(left.split(' ').filter((token) => token.length >= 4))
  const rightTokens = new Set(right.split(' ').filter((token) => token.length >= 4))
  if (!leftTokens.size || !rightTokens.size) return false

  const hits = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return hits / Math.min(leftTokens.size, rightTokens.size) >= 0.7
}

function rowKind(row = {}) {
  if (row.kind === 'income' || row.kind === 'expense') return row.kind
  if (row.type && !row.category) return 'income'
  return 'expense'
}

function importRowKey(row = {}) {
  return [
    rowKind(row),
    isoDate(row.date),
    roundMoney(row.amount).toFixed(2),
    normalizeText(row.description),
  ].join('|')
}

function existingEntries(state = {}) {
  return [
    ...(state.expenses || []).map((entry) => ({ ...entry, kind: 'expense' })),
    ...(state.incomes || []).map((entry) => ({ ...entry, kind: 'income' })),
  ]
}

export function detectStatementDuplicate(row = {}, entries = []) {
  const kind = rowKind(row)
  const date = isoDate(row.date)
  const amount = roundMoney(row.amount)

  return (entries || []).find((entry) => {
    const entryKind = rowKind(entry)
    if (entryKind !== kind) return false
    if (Math.abs(roundMoney(entry.amount) - amount) > 0.01) return false
    if (Math.abs(dateDiffDays(isoDate(entry.date), date)) > 1) return false
    return descriptionLooksSame(row.description, entry.description || entry.category || entry.type)
  }) || null
}

const EXPENSE_RULES = [
  { category: 'Assinaturas', pattern: /\b(netflix|spotify|prime|amazon|chatgpt|openai|claude|gemini|icloud|google one|youtube|disney|hbo|max)\b/ },
  { category: 'Mercado', pattern: /\b(mercado|supermercado|atacadao|assai|carrefour|extra|pao de acucar)\b/ },
  { category: 'Farmácia', pattern: /\b(farmacia|drogaria|droga|raia|drogasil|pague menos)\b/ },
  { category: 'Combustível', pattern: /\b(posto|ipiranga|shell|petrobras|combustivel|abastec)\b/ },
  { category: 'Delivery', pattern: /\b(ifood|delivery|rappi)\b/ },
  { category: 'Restaurante', pattern: /\b(restaurante|lanchonete|padaria|cafe|bar)\b/ },
  { category: 'Transporte', pattern: /\b(uber|99|metro|onibus|mobilidade|sem parar|estacionamento)\b/ },
  { category: 'Internet', pattern: /\b(internet|vivo|claro|tim|oi|fibra|banda larga)\b/ },
  { category: 'Energia', pattern: /\b(energia|luz|enel|cemig|cpfl)\b/ },
  { category: 'Água', pattern: /\b(agua|sabesp|saneamento)\b/ },
  { category: 'Moradia', pattern: /\b(aluguel|condominio|moradia|imobiliaria)\b/ },
  { category: 'Educação', pattern: /\b(escola|faculdade|curso|educacao|livro)\b/ },
  { category: 'Saúde', pattern: /\b(saude|medico|consulta|laboratorio|hospital)\b/ },
  { category: 'Impostos', pattern: /\b(imposto|ipva|iptu|darf|gps)\b/ },
]

const INCOME_RULES = [
  { type: 'Salário', pattern: /\b(salario|folha|holerite|ordenado)\b/ },
  { type: 'Freelancer', pattern: /\b(freela|freelancer|servico prestado)\b/ },
  { type: 'Pix recebido', pattern: /\b(pix recebido|ted recebido|deposito|transferencia recebida)\b/ },
  { type: 'Reembolso', pattern: /\b(reembolso|estorno)\b/ },
  { type: 'Aluguel', pattern: /\b(aluguel recebido)\b/ },
  { type: 'Dividendos', pattern: /\b(dividendo|provento|rendimento)\b/ },
]

export function suggestEntryClassification(row = {}) {
  const text = normalizeText(row.description)
  if (rowKind(row) === 'income') {
    const rule = INCOME_RULES.find((item) => item.pattern.test(text))
    return { type: normalizeIncomeType(rule?.type || 'Outros') }
  }

  const rule = EXPENSE_RULES.find((item) => item.pattern.test(text))
  return { category: normalizeExpenseCategory(rule?.category || 'Outros') }
}

function sourceForRow(row = {}, options = {}) {
  const sourceType = row.sourceType || row.source_type || options.sourceType || 'account'
  const sourceId = row.sourceId || row.source_id || options.sourceId || ''
  const payment = normalizePaymentMethod(row.payment || options.payment || (
    sourceType === SOURCE_CREDIT_CARD ? 'Crédito' : 'Transferência'
  ))
  return { sourceType, sourceId, payment }
}

function candidateExpense(row = {}, options = {}) {
  const source = sourceForRow(row, options)
  return {
    id: row.id,
    date: isoDate(row.date),
    description: row.description || '',
    amount: roundMoney(row.amount),
    payment: source.payment,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    creditCardId: source.sourceType === SOURCE_CREDIT_CARD ? source.sourceId : row.creditCardId || row.card_id || row.cardId || null,
    card_id: source.sourceType === SOURCE_CREDIT_CARD ? source.sourceId : row.card_id || row.cardId || null,
    account_id: source.sourceType === 'account' ? source.sourceId : row.account_id || row.accountId || null,
  }
}

function reconcileRow(state, row, options) {
  if (rowKind(row) !== 'expense') return null
  const result = reconcileSubscriptionCharge(
    state.subscriptions || [],
    candidateExpense(row, options),
    isoDate(row.date),
    state.subscriptionCharges || [],
  )
  return result?.reconciled ? result : null
}

function previewItem(row = {}, context) {
  const kind = rowKind(row)
  const source = sourceForRow(row, context.options)
  const base = {
    id: row.id || `row-${context.index}`,
    rowIndex: context.index,
    kind,
    date: isoDate(row.date),
    description: row.description || '',
    amount: roundMoney(row.amount),
    source: row.source || 'statement',
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    payment: source.payment,
    action: 'create',
    reason: 'Pronto para criar',
    confidence: row.confidence ?? 80,
    raw: row.raw || '',
  }

  const classification = suggestEntryClassification(base)
  if (kind === 'income') base.suggestedType = classification.type
  else base.suggestedCategory = classification.category

  const rowKey = importRowKey(base)
  if (context.seenRows.has(rowKey)) {
    const duplicate = context.seenRows.get(rowKey)
    return {
      ...base,
      action: 'duplicate',
      reason: 'Linha repetida no arquivo',
      duplicateKey: rowKey,
      duplicateOf: { kind: 'import_row', id: duplicate.id },
    }
  }
  context.seenRows.set(rowKey, { id: base.id })

  const duplicate = detectStatementDuplicate(base, context.existingEntries)
  if (duplicate) {
    return {
      ...base,
      action: 'duplicate',
      reason: 'Lançamento já existe',
      duplicateKey: rowKey,
      duplicateOf: { kind: duplicate.kind, id: duplicate.id },
    }
  }

  const reconciliation = reconcileRow(context.state, base, context.options)
  if (reconciliation) {
    return {
      ...base,
      action: 'reconcile',
      reason: 'Assinatura prevista encontrada',
      suggestedCategory: normalizeExpenseCategory(base.suggestedCategory || 'Assinaturas'),
      subscriptionId: reconciliation.subscriptionId,
      subscriptionMatch: {
        id: reconciliation.subscriptionId,
        name: reconciliation.subscription?.name,
        score: reconciliation.score,
      },
    }
  }

  return base
}

function buildSummary(items) {
  return items.reduce((summary, item) => {
    summary.totalRows += 1
    summary[`${item.action}Count`] = (summary[`${item.action}Count`] || 0) + 1
    if (item.action === 'create' || item.action === 'reconcile') {
      summary.actionableCount += 1
      if (item.kind === 'income') summary.incomeTotal = roundMoney(summary.incomeTotal + item.amount)
      else summary.expenseTotal = roundMoney(summary.expenseTotal + item.amount)
      if (item.action === 'reconcile') summary.reconciledTotal = roundMoney(summary.reconciledTotal + item.amount)
    }
    if (item.action === 'duplicate') summary.duplicateTotal = roundMoney(summary.duplicateTotal + item.amount)
    return summary
  }, {
    totalRows: 0,
    createCount: 0,
    duplicateCount: 0,
    reconcileCount: 0,
    ignoredCount: 0,
    actionableCount: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    reconciledTotal: 0,
    duplicateTotal: 0,
  })
}

export function buildStatementImportPreview(state = {}, rows = [], options = {}) {
  const seenRows = new Map()
  const context = {
    state,
    options,
    seenRows,
    existingEntries: existingEntries(state),
    index: 0,
  }
  const items = (Array.isArray(rows) ? rows : []).map((row, index) => {
    context.index = index
    return previewItem(row, context)
  })
  const summary = buildSummary(items)

  return {
    id: options.id || `statement-preview-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    sourceType: options.sourceType || 'account',
    sourceId: options.sourceId || '',
    payment: normalizePaymentMethod(options.payment || (options.sourceType === SOURCE_CREDIT_CARD ? 'Crédito' : 'Transferência')),
    familyMemberId: options.familyMemberId || '',
    items,
    summary,
    canConfirm: summary.actionableCount > 0,
  }
}
