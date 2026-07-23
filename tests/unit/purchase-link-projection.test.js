import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = () => fs.readFileSync('src/api/release1-projections.js', 'utf8')

describe('purchase link projection', () => {
  it('keeps purchase URLs from saved items and compatible offers when syncing projections', () => {
    const code = source()

    expect(code).toContain('item.originalLink')
    expect(code).toContain('item.canonicalUrl')
    expect(code).toContain('item.best_compatible_offer')
    expect(code).toContain('productUrl')
  })

  it('syncs the current compatible ad before canonical item URLs', () => {
    const code = source()

    expect(code.indexOf('offerUrl(item.best_compatible_offer)')).toBeLessThan(code.indexOf('item.originalUrl'))
  })
})
