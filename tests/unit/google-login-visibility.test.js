import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11 Google login visibility', () => {
  it('shows Google only behind the feature flag and hides the divider with it', () => {
    const login = fs.readFileSync('src/views/Login.vue', 'utf8')
    const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')

    expect(login).toContain('<GoogleLoginButton v-if="googleAuthEnabled"')
    expect(signup).toContain('<GoogleLoginButton v-if="googleAuthEnabled"')
    expect(login).toContain('<div v-if="googleAuthEnabled" class="divider"')
    expect(signup).toContain('<div v-if="googleAuthEnabled" class="divider"')
  })

  it('blocks new Google users in a closed environment unless explicitly allowed', () => {
    const googleAuth = fs.readFileSync('src/domain/auth/googleAuth.js', 'utf8')
    const callback = fs.readFileSync('src/views/AuthCallback.vue', 'utf8')

    expect(googleAuth).toContain('Este e-mail não tem permissão para criar conta neste ambiente.')
    expect(googleAuth).toContain('PUBLIC_SIGNUP_ENABLED')
    expect(callback).toContain('validateGoogleSignupAccess')
  })
})
