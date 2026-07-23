import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ValueSERP provider contract', () => {
  it('exists only as a server-side provider and never decides compatibility', () => {
    const provider = fs.readFileSync('supabase/functions/_shared/price-providers/valueserp.ts', 'utf8')
    const index = fs.readFileSync('supabase/functions/_shared/price-providers/index.ts', 'utf8')

    expect(provider).toContain('https://api.valueserp.com/search')
    expect(provider).toContain("search_type', 'shopping'")
    expect(provider).toContain('VALUE_SERP_API_KEY')
    expect(provider).not.toContain('best_compatible_offer')
    expect(index).toContain('valueserp_google_shopping')
  })
})
