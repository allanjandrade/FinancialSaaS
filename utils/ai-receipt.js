const RECEIPT_KEYS = ['valor', 'estabelecimento', 'data', 'metodo', 'categoria']

const PAYMENT_ALIASES = {
  'cartão de crédito': 'Cartao de credito',
  'cartao de credito': 'Cartao de credito',
  'crédito': 'Cartao de credito',
  'credito': 'Cartao de credito',
  pix: 'Pix',
  débito: 'Debito',
  debito: 'Debito',
  dinheiro: 'Dinheiro',
  'vale alimentação': 'Vale alimentacao',
  'vale alimentacao': 'Vale alimentacao',
  outro: 'Outro',
}

export function normalizePaymentMethod(metodo) {
  if (!metodo) return 'Outro'
  const key = String(metodo).trim().toLowerCase()
  return PAYMENT_ALIASES[key] || String(metodo).trim()
}

export function normalizeReceiptData(raw = {}) {
  const today = new Date().toISOString().split('T')[0]
  const valorRaw = raw.valor
  const valor =
    valorRaw === null || valorRaw === undefined || valorRaw === ''
      ? null
      : Number(String(valorRaw).replace(',', '.'))

  return {
    valor: Number.isFinite(valor) ? valor : null,
    estabelecimento: raw.estabelecimento
      ? String(raw.estabelecimento).trim()
      : null,
    data: raw.data ? String(raw.data).trim() : today,
    metodo: normalizePaymentMethod(raw.metodo),
    categoria: raw.categoria ? String(raw.categoria).trim() : 'Outro',
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
  return {
    date: normalized.data,
    category: normalized.categoria,
    description: normalized.estabelecimento || 'Sem descrição',
    payment: normalized.metodo,
    amount: normalized.valor,
    paid: normalized.metodo !== 'Cartao de credito',
  }
}
