import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeHealthCheckPayload } from '@/domain/production-go-live.js'

describe('Release 11 production health-check', () => {
  it('uses release 11 safe status fields and rejects sensitive payloads', () => {
    const source = fs.readFileSync('supabase/functions/health-check/index.ts', 'utf8')
    expect(source).toContain('release-11')
    expect(source).toContain('billing')
    expect(source).toContain('entitlements')

    const sanitized = sanitizeHealthCheckPayload({ status: 'ok', token: 'secret' })
    expect(sanitized.status).toBe('degraded')
    expect(JSON.stringify(sanitized)).not.toContain('secret')
  })
})
