import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11 legal pages', () => {
  it('ships visible legal pages and matching docs', () => {
    for (const file of [
      'src/views/legal/PrivacyPolicy.vue',
      'src/views/legal/TermsOfUse.vue',
      'src/views/legal/CookiePolicy.vue',
      'docs/legal/PRIVACY_POLICY.md',
      'docs/legal/TERMS_OF_USE.md',
      'docs/legal/COOKIE_POLICY.md',
    ]) {
      expect(fs.existsSync(file), file).toBe(true)
    }
  })
})
