import {
  OFFICIAL_PAYMENT_METHODS,
  normalizeExpenseCategory,
  normalizePaymentMethod as normalizeOfficialPaymentMethod,
} from '@/constants/finance'

const RECEIPT_KEYS = ['valor', 'estabelecimento', 'data', 'metodo', 'categoria']

const VALOR_KEYS = [
  'valor', 'valor_documento', 'valor_cobrado', 'valor_pagar', 'valor_titulo', 'amount', 'total',
]
const NAME_KEYS = [
  'estabelecimento', 'beneficiario', 'beneficiário', 'cedente', 'sacador', 'empresa', 'credor',
]
const DATE_KEYS = ['data', 'vencimento', 'data_vencimento', 'data_venc', 'due_date']
const METODO_KEYS = ['metodo', 'metodo_pagamento', 'forma_pagamento', 'tipo_pagamento']
const CAT_KEYS = ['categoria', 'tipo', 'tipo_despesa', 'category']

function pickField(raw, keys) {
  for (const key of keys) {
    const v = raw[key]
    if (v !== null && v !== undefined && String(v).trim() !== '') return v
  }
  return null
}

export function parseBrMoney(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? val : null
  let s = String(val).replace(/\s/g, '').replace(/^R\$?/i, '')
  if (!s) return null
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseBrDate(val) {
  if (!val) return null
  const s = String(val).trim()
  const br = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

export function mapOcrAliases(raw = {}) {
  const metodo = pickField(raw, METODO_KEYS)
  const blob = JSON.stringify(raw).toLowerCase()
  let inferredMetodo = metodo
  if (!inferredMetodo && (blob.includes('boleto') || blob.includes('linha digit'))) {
    inferredMetodo = 'Boleto'
  }

  let categoria = pickField(raw, CAT_KEYS)
  if (!categoria && inferredMetodo === 'Boleto') categoria = 'Contas'

  return {
    valor: parseBrMoney(pickField(raw, VALOR_KEYS)),
    estabelecimento: pickField(raw, NAME_KEYS),
    data: parseBrDate(pickField(raw, DATE_KEYS)),
    metodo: inferredMetodo,
    categoria,
  }
}

export function normalizePaymentMethod(metodo) {
  return normalizePaymentMethodOfficial(metodo)
}

function normalizePaymentMethodOfficial(metodo) {
  return normalizeOfficialPaymentMethod(metodo)
}

export function normalizeReceiptData(raw = {}) {
  const mapped = mapOcrAliases(raw)
  const today = new Date().toISOString().split('T')[0]

  return {
    valor: mapped.valor,
    estabelecimento: mapped.estabelecimento
      ? String(mapped.estabelecimento).trim()
      : null,
    data: mapped.data || today,
    metodo: normalizePaymentMethodOfficial(mapped.metodo || 'Transferência'),
    categoria: normalizeExpenseCategory(mapped.categoria),
  }
}

export function isFinancialReceiptJson(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return RECEIPT_KEYS.every((key) => key in obj)
}

export function tryParseFinancialJson(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()

  const attempts = [trimmed]
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (blockMatch) attempts.push(blockMatch[1].trim())
  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objectMatch) attempts.push(objectMatch[0])

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (isFinancialReceiptJson(parsed)) return parsed
    } catch {
      // continue
    }
  }
  return null
}

export function formatConfirmedExpenseMessage(normalized) {
  const name = normalized.estabelecimento || 'Desconhecido'
  const amount = normalized.valor ?? 0
  return `✅ Registro confirmado: ${name} - R$ ${amount}`
}

export function toExpensePayload(normalized) {
  if (normalized.valor == null) return null
  const metodo = normalizePaymentMethodOfficial(normalized.metodo)
  return {
    date: normalized.data,
    category: normalizeExpenseCategory(normalized.categoria),
    description: normalized.estabelecimento || 'Sem descrição',
    payment: metodo,
    amount: normalized.valor,
    paid: metodo !== 'Crédito' && metodo !== 'Boleto',
  }
}

export function paymentToDisplay(payment) {
  return OFFICIAL_PAYMENT_METHODS.includes(payment)
    ? payment
    : normalizePaymentMethodOfficial(payment)
}

export function addExpenseFromNormalized(normalized, financeStore) {
  const payload = toExpensePayload(normalized)
  if (!payload) return false

  financeStore.addExpense({
    date: payload.date,
    category: payload.category,
    description: payload.description,
    payment: paymentToDisplay(payload.payment),
    amount: payload.amount,
    paid: payload.paid,
    ocrProvider: normalized.ocrProvider,
    ocrConfidence: normalized.ocrConfidence,
    ocrDate: normalized.ocrDate,
    ocrTipoDocumento: normalized.ocrTipoDocumento,
    ocrObservacoes: normalized.ocrObservacoes,
  })
  return true
}
