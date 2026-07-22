import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.4 product-from-url edge function', () => {
  const source = fs.readFileSync('supabase/functions/product-from-url/index.ts', 'utf8')
  const migration = fs.readFileSync('supabase/migrations/20260627153000_release114_any_product_link_identity.sql', 'utf8')

  it('authenticates by JWT and rejects forged user identity fields', () => {
    const authIndex = source.indexOf('requireAuthenticatedUser(req)')
    const rejectIndex = source.indexOf('rejectIdentityOverride(body)')
    const loadIndex = source.indexOf('loadFinanceState(auth.user.id')
    expect(authIndex).toBeGreaterThan(0)
    expect(rejectIndex).toBeGreaterThan(authIndex)
    expect(loadIndex).toBeGreaterThan(rejectIndex)
  })

  it('creates locked wishlist items from canonical URL identities', () => {
    expect(source).toContain("identity_locked: true")
    expect(source).toContain("identity_source: 'url'")
    expect(source).toContain("match_policy: 'url_exact'")
    expect(source).toContain('product_identity_id')
  })

  it('resolves known short product links before canonicalization', () => {
    const resolveIndex = source.indexOf('const resolvedUrl = await resolveProductUrl(urls[0])')
    const canonicalIndex = source.indexOf('const canonical = canonicalizeProductUrl(resolvedUrl)')
    expect(source).toContain("host === 'a.co' || host === 'amzn.to'")
    expect(resolveIndex).toBeGreaterThan(0)
    expect(canonicalIndex).toBeGreaterThan(resolveIndex)
  })

  it('removes the database source whitelist so any URL source can be stored', () => {
    expect(migration).toContain('drop constraint if exists product_identities_source_check')
  })

  it('keeps canonical URL identity instead of returning 409 when metadata is inconclusive', () => {
    expect(source).toContain('product_identity_metadata_unconfirmed')
    expect(source).not.toContain('product_identity_mismatch_blocked')
    expect(source).not.toContain('PRODUCT_IDENTITY_MISMATCH_BLOCKED')
  })
})
