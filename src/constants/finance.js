export const OFFICIAL_PAYMENT_METHODS = [
  'Pix',
  'Crédito',
  'Débito',
  'Dinheiro',
  'Boleto',
  'Transferência',
  'VA',
  'VR',
]

export const OFFICIAL_EXPENSE_CATEGORIES = [
  'Mercado',
  'Açougue',
  'Farmácia',
  'Combustível',
  'Restaurante',
  'Delivery',
  'Saúde',
  'Educação',
  'Transporte',
  'Internet',
  'Energia',
  'Água',
  'Moradia',
  'Impostos',
  'Assinaturas',
  'Lazer',
  'Outros',
]

import { INCOME_TYPES_EXTENDED } from './financial-structure.js'

export const OFFICIAL_INCOME_TYPES = INCOME_TYPES_EXTENDED

const PAYMENT_ALIASES = {
  'cartão de crédito': 'Crédito',
  'cartao de credito': 'Crédito',
  credito: 'Crédito',
  crédito: 'Crédito',
  debito: 'Débito',
  débito: 'Débito',
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  'transferência': 'Transferência',
  'vale alimentação': 'VA',
  'vale alimentacao': 'VA',
  va: 'VA',
  vr: 'VR',
  outro: 'Transferência',
}

const CATEGORY_ALIASES = {
  alimentacao: 'Restaurante',
  alimentação: 'Restaurante',
  transporte: 'Transporte',
  lazer: 'Lazer',
  carro: 'Combustível',
  moradia: 'Moradia',
  saude: 'Saúde',
  saúde: 'Saúde',
  educacao: 'Educação',
  educação: 'Educação',
  vestuario: 'Outros',
  vestuário: 'Outros',
  outro: 'Outros',
}

const INCOME_ALIASES = {
  'vale alimentação': 'VA',
  'vale alimentacao': 'VA',
  va: 'VA',
  vr: 'VR',
  extra: 'Freelancer',
  'pix recebido': 'Pix recebido',
  investimentos: 'Investimentos',
  outro: 'Outros',
}

function normalizeRaw(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizePaymentMethod(value) {
  if (!value) return 'Transferência'
  if (OFFICIAL_PAYMENT_METHODS.includes(value)) return value
  const normalized = PAYMENT_ALIASES[normalizeRaw(value)]
  return normalized || 'Transferência'
}

export function normalizeExpenseCategory(value) {
  if (!value) return 'Outros'
  if (OFFICIAL_EXPENSE_CATEGORIES.includes(value)) return value
  return CATEGORY_ALIASES[normalizeRaw(value)] || 'Outros'
}

export function normalizeIncomeType(value) {
  if (!value) return 'Outros'
  if (OFFICIAL_INCOME_TYPES.includes(value)) return value
  return INCOME_ALIASES[normalizeRaw(value)] || value || 'Outros'
}
