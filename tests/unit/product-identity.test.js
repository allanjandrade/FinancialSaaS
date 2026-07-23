import { describe, expect, it } from 'vitest'
import { normalizeProductIdentity } from '@/utils/productIdentity.js'

describe('Release 8 product identity normalization', () => {
  it('normalizes lanterna tras ld punto into a strict auto-part identity', () => {
    expect(normalizeProductIdentity('lanterna tras ld punto')).toMatchObject({
      product_type: 'auto_part',
      part_name: 'lanterna traseira',
      side: 'right',
      vehicle_make: 'Fiat',
      vehicle_model: 'Punto',
      match_policy: 'strict',
      must_match_terms: ['lanterna', 'traseira', 'punto', 'direita'],
      side_required: true,
    })
  })

  it('normalizes Nissan Frontier auto-part descriptions into a strict identity', () => {
    expect(normalizeProductIdentity('lanterna traseira direita frontier 2003')).toMatchObject({
      product_type: 'auto_part',
      part_name: 'lanterna traseira',
      side: 'right',
      vehicle_make: 'Nissan',
      vehicle_model: 'Frontier',
      match_policy: 'strict',
      must_match_terms: ['lanterna', 'traseira', 'frontier', 'direita'],
      side_required: true,
    })
  })
})
