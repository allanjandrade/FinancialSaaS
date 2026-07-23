import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('product-search-by-description edge contract', () => {
  it('uses JWT identity and never body user_id', () => {
    const source = fs.readFileSync('supabase/functions/product-search-by-description/index.ts', 'utf8')

    expect(source).toContain('requireAuthenticatedUser(req)')
    expect(source).toContain('rejectIdentityOverride(body)')
    expect(source).toContain('price-search')
    expect(source).toContain('user_id=eq.${encodeURIComponent(userId)}')
    expect(source).toContain('best as any)?.imageUrl')
    expect(source).toContain("result.status === 'found_exact'")
    expect(source).toContain('best as any)?.title')
    expect(source).not.toMatch(/body\.user_id|body\.userId/)
    expect(source.match(/await saveFinanceState/g) || []).toHaveLength(1)
  })
})
