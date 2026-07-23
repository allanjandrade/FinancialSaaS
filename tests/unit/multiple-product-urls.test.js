import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.4 multiple product URLs contract', () => {
  it('product-from-url returns multiple_urls_detected before creating wishlist items', () => {
    const source = fs.readFileSync('supabase/functions/product-from-url/index.ts', 'utf8')
    const multipleIndex = source.indexOf("status: 'multiple_urls_detected'")
    const saveIndex = source.indexOf('await saveFinanceState(row')

    expect(multipleIndex).toBeGreaterThan(0)
    expect(saveIndex).toBeGreaterThan(multipleIndex)
    expect(source).toContain('multiple_product_urls_detected')
  })
})
