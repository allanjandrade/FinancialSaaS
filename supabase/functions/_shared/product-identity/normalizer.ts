import {
  buildProductSearchQuery,
  isIdentityCompleteForProvider,
  normalizeProductIdentity,
  normalizeProductText,
  type ProductIdentity,
} from './index.ts'

export {
  buildProductSearchQuery,
  isIdentityCompleteForProvider,
  normalizeProductIdentity,
  normalizeProductText,
}

const GENERIC_DESCRIPTIONS = new Set(['produto', 'compra', 'coisa', 'peca', 'item'])

export class ProductDescriptionError extends Error {
  code: string

  constructor(message: string, code = 'INVALID_DESCRIPTION') {
    super(message)
    this.name = 'ProductDescriptionError'
    this.code = code
  }
}

function usefulCharacters(value: string) {
  return normalizeProductText(value).replace(/[^a-z]/g, '')
}

export function normalizeProductDescription(description: unknown): {
  raw_description: string
  normalized_query: string
  product_identity: ProductIdentity
  needs_clarification: boolean
  message: string
} {
  const raw = String(description || '').trim()
  const normalizedText = normalizeProductText(raw)
  const useful = usefulCharacters(raw)

  if (!raw || useful.length < 3 || /^\d+$/.test(normalizedText.replace(/\s/g, ''))) {
    throw new ProductDescriptionError('Descreva o produto que voce quer procurar.')
  }
  if (GENERIC_DESCRIPTIONS.has(normalizedText)) {
    throw new ProductDescriptionError(
      'Informe mais detalhes para encontrarmos o produto certo. Exemplo: lanterna traseira direita Fiat Punto',
      'GENERIC_DESCRIPTION',
    )
  }

  const identity = normalizeProductIdentity(raw)
  const normalizedQuery = buildProductSearchQuery(identity) || identity.normalized_text || normalizedText
  const needsClarification = identity.product_type === 'auto_part' && (!identity.vehicle_model || !identity.side)

  return {
    raw_description: raw,
    normalized_query: normalizedQuery,
    product_identity: identity,
    needs_clarification: needsClarification,
    message: needsClarification
      ? 'Para buscar com mais precisao, informe o veiculo e o lado da peca.'
      : '',
  }
}
