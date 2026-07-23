import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.2 legal pack', () => {
  it('publishes all required documents and routes', () => {
    const docs = [
      'TERMS_OF_USE.md',
      'PRIVACY_POLICY.md',
      'COOKIE_POLICY.md',
      'DATA_PROCESSING_NOTICE.md',
      'SUBSCRIPTION_CANCELLATION_REFUND_POLICY.md',
      'AI_CONSENT_NOTICE.md',
      'SECURITY_POLICY_PUBLIC.md',
      'LGPD_REQUEST_PROCEDURE.md',
      'FINANCIAL_DISCLAIMER.md',
      'LEGAL_PACK_CHANGELOG.md',
    ]
    for (const doc of docs) {
      const text = fs.readFileSync(`docs/legal/${doc}`, 'utf8')
      expect(text.length).toBeGreaterThan(80)
      expect(text).not.toMatch(/\[[A-ZÁÉÍÓÚÃÕÇ ]+\]/)
    }

    const router = fs.readFileSync('src/router/index.js', 'utf8')
    for (const route of ['/privacy', '/terms', '/cookies', '/data-processing', '/subscription-policy', '/ai-consent', '/security', '/lgpd-requests', '/financial-disclaimer']) {
      expect(router).toContain(`path: '${route}'`)
    }
  })

  it('requires legal acceptance on signup', () => {
    const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
    expect(signup).toContain('data-testid="legal-acceptance"')
    expect(signup).toContain('legal_acceptance_version')
    expect(signup).toContain('/terms')
    expect(signup).toContain('/privacy')
  })
})
