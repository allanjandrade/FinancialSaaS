import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.4 locked identity price search', () => {
  const source = fs.readFileSync('supabase/functions/price-search/index.ts', 'utf8')

  it('uses source product identity instead of generic text for URL-locked cache', () => {
    expect(source).toContain('lockedIdentityFromBody(body)')
    expect(source).toContain('productCacheKey(lockedIdentity)')
    expect(source).toContain('price_search_identity_locked')
  })

  it('returns before generic marketplace fallback when identity is locked', () => {
    const lockedIndex = source.indexOf('if (lockedIdentity)')
    const genericIndex = source.indexOf('if (!hasExactMarketplaceReference && !offers.length)')

    expect(lockedIndex).toBeGreaterThan(0)
    expect(genericIndex).toBeGreaterThan(lockedIndex)
    expect(source.slice(lockedIndex, genericIndex)).toContain('return new Response')
  })
})
