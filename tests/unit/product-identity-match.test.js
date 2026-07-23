import { describe, expect, it } from 'vitest'
import {
  assertProductIdentityMatch,
  classifyProductCandidateForIdentity,
  ProductIdentityMismatchError,
} from '../../src/domain/products/canonicalizeProductUrl.js'

describe('Release 11.4 product identity matching', () => {
  const identity = {
    source: 'amazon',
    source_product_id: 'B0B3BHT71L',
    title: 'Blend Cleaner Black 500ml Vonixx',
  }

  it('accepts only the exact source product id for URL identities', () => {
    expect(assertProductIdentityMatch(identity, {
      source: 'amazon',
      source_product_id: 'B0B3BHT71L',
      title: 'Blend Cleaner Black 500ml Vonixx',
    })).toBe(true)
  })

  it('blocks divergent product ids with the mandatory error code', () => {
    expect(() => assertProductIdentityMatch(identity, {
      source: 'amazon',
      source_product_id: 'B000000000',
      title: 'Teclado gamer bright',
    })).toThrow(ProductIdentityMismatchError)
  })

  it('classifies same-store but wrong-id candidates as similar, not exact', () => {
    expect(classifyProductCandidateForIdentity(identity, {
      source: 'amazon',
      source_product_id: 'B000000000',
      title: 'Blend cleaner parecido',
    })).toBe('similar')
  })
})
