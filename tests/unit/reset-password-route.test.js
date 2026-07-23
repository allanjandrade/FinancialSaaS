import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.2 reset password route', () => {
  it('has a public route and prepares a recovery session from the URL hash', () => {
    const router = fs.readFileSync('src/router/index.js', 'utf8')
    const view = fs.readFileSync('src/views/ResetPassword.vue', 'utf8')
    const helper = fs.readFileSync('src/domain/auth/passwordReset.js', 'utf8')

    expect(router).toContain("path: '/reset-password'")
    expect(router).toContain("name: 'reset-password'")
    expect(view).toContain('preparePasswordRecoverySession')
    expect(helper).toContain('setSession')
    expect(helper).toContain('replaceState')
    expect(helper).not.toMatch(/console\.log|localStorage|sessionStorage/)
  })
})
