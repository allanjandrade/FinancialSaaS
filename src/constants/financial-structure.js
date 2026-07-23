export const ACCOUNT_TYPES = [
  'Conta Corrente',
  'Conta Poupança',
  'Conta Investimento',
  'Carteira Digital',
  'Dinheiro em Espécie',
]

export const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra']

export const BENEFIT_PROVIDERS_VA = [
  'Pluxee', 'Alelo', 'Ticket', 'VR Benefícios', 'Flash', 'Swile', 'iFood Benefícios', 'Caju', 'Outro',
]

export const BENEFIT_PROVIDERS_VR = [
  'Pluxee', 'Alelo', 'Ticket', 'VR Benefícios', 'Flash', 'Swile', 'Sodexo', 'Outro',
]

export const CORPORATE_BENEFIT_TYPES = [
  'Auxílio Home Office',
  'Auxílio Combustível',
  'Auxílio Mobilidade',
  'Auxílio Cultura',
  'Auxílio Educação',
]

export const INCOME_TYPES_EXTENDED = [
  'Salário',
  'Hora Extra',
  'PLR',
  'Bônus',
  'Freelancer',
  'Comissão',
  'Aluguel',
  'Dividendos',
  'Juros',
  'Cashback',
  'Venda de Produtos',
  'Venda de Ativos',
  'Reembolso',
  'Benefício Corporativo',
  'VA',
  'VR',
  'Pix recebido',
  'Investimentos',
  'Outros',
]

export const RECURRING_FREQUENCIES = ['Mensal', 'Semanal', 'Quinzenal', 'Anual']

export const SOURCE_TYPES = {
  ACCOUNT: 'account',
  CREDIT_CARD: 'credit_card',
  BENEFIT_VA: 'benefit_va',
  BENEFIT_VR: 'benefit_vr',
  BENEFIT_CORPORATE: 'benefit_corporate',
  CASH: 'cash',
}

export const OPEN_FINANCE_DEFAULT = {
  externalId: null,
  provider: null,
  institutionId: null,
  syncStatus: 'manual',
  lastSyncedAt: null,
}

export function createOpenFinanceFields(overrides = {}) {
  return { ...OPEN_FINANCE_DEFAULT, ...overrides }
}

export function newId() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 11)
}
