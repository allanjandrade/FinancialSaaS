import { buildProductSearchQuery, normalizeProductIdentity, normalizeText } from '@/utils/productIdentity.js'

const GENERIC_DESCRIPTIONS = new Set(['produto', 'compra', 'coisa', 'peca', 'item'])

export class ProductDescriptionError extends Error {
  constructor(message, code = 'INVALID_DESCRIPTION') {
    super(message)
    this.name = 'ProductDescriptionError'
    this.code = code
  }
}

function usefulCharacters(value) {
  return normalizeText(value).replace(/[^a-z]/g, '')
}

export function normalizeProductDescription(description) {
  const raw = String(description || '').trim()
  const normalizedText = normalizeText(raw)
  const useful = usefulCharacters(raw)

  if (!raw || useful.length < 3 || /^\d+$/.test(normalizedText.replace(/\s/g, ''))) {
    throw new ProductDescriptionError('Descreva o produto que você quer procurar.')
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
    product_identity: {
      product_type: identity.product_type,
      part_name: identity.part_name,
      side: identity.side,
      vehicle_make: identity.vehicle_make,
      vehicle_model: identity.vehicle_model,
      vehicle_year: identity.vehicle_year,
      match_policy: identity.match_policy,
      original_text: identity.original_text,
      normalized_text: identity.normalized_text,
      must_match_terms: identity.must_match_terms,
      negative_terms: identity.negative_terms,
      side_required: identity.side_required,
    },
    needs_clarification: needsClarification,
    message: needsClarification
      ? 'Para buscar com mais precisao, informe o veiculo e o lado da peca.'
      : '',
  }
}
