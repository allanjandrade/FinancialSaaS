import { describe, expect, it } from 'vitest'
import { normalizeProductDescription } from '@/domain/products/productDescriptionNormalizer.js'

describe('product description normalizer', () => {
  it('normalizes abbreviated auto-part descriptions', () => {
    const result = normalizeProductDescription('lanterna tras ld punto')

    expect(result).toMatchObject({
      raw_description: 'lanterna tras ld punto',
      normalized_query: 'lanterna traseira direita Fiat Punto',
      needs_clarification: false,
    })
    expect(result.product_identity).toMatchObject({
      product_type: 'auto_part',
      part_name: 'lanterna traseira',
      side: 'right',
      vehicle_make: 'Fiat',
      vehicle_model: 'Punto',
      match_policy: 'strict',
    })
  })

  it('keeps Frontier model and year searchable for auto-part descriptions', () => {
    const result = normalizeProductDescription('lanterna traseira direita frontier 2003')

    expect(result).toMatchObject({
      raw_description: 'lanterna traseira direita frontier 2003',
      normalized_query: 'lanterna traseira direita Nissan Frontier 2003',
      needs_clarification: false,
    })
    expect(result.product_identity).toMatchObject({
      product_type: 'auto_part',
      part_name: 'lanterna traseira',
      side: 'right',
      vehicle_make: 'Nissan',
      vehicle_model: 'Frontier',
      vehicle_year: '2003',
      match_policy: 'strict',
    })
  })

  it('rejects empty, numeric and generic descriptions', () => {
    expect(() => normalizeProductDescription('')).toThrow(/Descreva/)
    expect(() => normalizeProductDescription('12345')).toThrow(/Descreva/)
    expect(() => normalizeProductDescription('produto')).toThrow(/Informe mais detalhes/)
  })

  it('asks for clarification when auto-part identity lacks vehicle or side', () => {
    const result = normalizeProductDescription('lanterna traseira')
    expect(result.needs_clarification).toBe(true)
    expect(result.message).toContain('veiculo')
  })
})
