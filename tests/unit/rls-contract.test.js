import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('RLS contract for production readiness', () => {
  it('protects price_search_cache with owner policies and service-role-only backend grants', () => {
    const migration = fs.readFileSync('supabase/migrations/20260620100000_price_search_cache_valueserp.sql', 'utf8')

    expect(migration).toContain('alter table public.price_search_cache enable row level security')
    expect(migration).toContain('auth.uid() = user_id')
    expect(migration).toContain('grant all on public.price_search_cache to service_role')
    expect(migration).toContain('grant select, insert, update, delete on public.price_search_cache to authenticated')
  })
})
