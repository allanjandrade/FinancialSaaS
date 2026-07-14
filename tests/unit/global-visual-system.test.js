import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('global visual system contract', () => {
  it('uses the landing/login concept across every authentication flow', () => {
    const sharedStyles = read('src/styles/main.css')
    const authFiles = [
      'src/views/Login.vue',
      'src/views/Signup.vue',
      'src/views/ForgotPassword.vue',
      'src/views/ResetPassword.vue',
      'src/views/AuthCallback.vue',
    ]

    expect(sharedStyles).toContain('--public-page-bg: #f8fafc')
    expect(sharedStyles).toContain('.auth-shell')
    expect(sharedStyles).toContain('.auth-form-card')
    expect(sharedStyles).toContain('.auth-panel-card')
    expect(sharedStyles).toContain('.auth-proof-grid')
    expect(sharedStyles).toContain('.auth-shell--single')

    for (const file of authFiles) {
      const source = read(file)
      expect(source).toContain('class="auth-page')
      expect(source).toContain('class="auth-shell')
      expect(source).toContain('class="auth-form-card')
      expect(source).not.toContain('class="auth-card"')
    }
  })

  it('centralizes authenticated page spacing, surfaces and legacy page heads', () => {
    const main = read('src/styles/main.css')
    const pageShell = read('src/components/layout/PageShell.vue')
    const pageHeader = read('src/components/layout/PageHeader.vue')

    expect(main).toContain('.route-view > :is(')
    expect(main).toContain('.page-head')
    expect(main).toContain('.section-title')
    expect(main).toContain('.panel,')
    expect(main).toContain('.app-card')
    expect(main).toContain('background: var(--gradient-panel)')
    expect(pageShell).toContain('gap: var(--section-gap)')
    expect(pageShell).toContain('align-content: start')
    expect(pageHeader).toContain('background: transparent')
    expect(pageHeader).toContain('border-bottom: 1px solid var(--border-color)')
  })

  it('centralizes button hierarchy across legacy and new pages', () => {
    const main = read('src/styles/main.css')

    expect(main).toContain('/* Unified action buttons */')
    expect(main).toContain(':is(button, a).primary-button')
    expect(main).toContain('.submit-entry')
    expect(main).toContain(':is(button, a).secondary-button')
    expect(main).toContain('.danger-button')
    expect(main).toContain('form button[type="submit"]:not(.secondary-button):not(.danger-button):not(.ghost-button)')
    expect(main).toContain('.paywall-card > button')
    expect(main).toContain('.first-step-card:not(.complete) > button')
    expect(main).toContain('button[data-testid="billing-portal-button"]')
    expect(main).toContain('.panel-header button')
    expect(main).toContain('.admin-panel section > button')
    expect(main).toContain('.quick-questions button')
    expect(main).toContain('.suggestion-grid button')
    expect(main).toContain('.message-feedback button')
    expect(main).toContain('background: var(--gradient-accent) !important')
    expect(main).toContain('color-mix(in srgb, var(--bg-panel) 86%, var(--bg-hover)) !important')
  })

  it('anchors release 3.2 visual hierarchy in shared UI components', () => {
    const button = read('src/components/ui/AppButton.vue')
    const badge = read('src/components/ui/AppBadge.vue')
    const actionMenu = read('src/components/ui/AppActionMenu.vue')
    const main = read('src/styles/main.css')

    expect(button).toContain('.app-button--destructive')
    expect(button).toContain('background: var(--expense-dim)')
    expect(button).toContain('color: var(--danger)')
    expect(button).toContain('aria-busy')
    expect(badge).toContain('background: var(--income-dim)')
    expect(badge).toContain('background: var(--savings-dim)')
    expect(badge).toContain('background: var(--expense-dim)')
    expect(actionMenu).toContain('aria-haspopup="menu"')
    expect(actionMenu).toContain('@keydown.esc')
    expect(main).toContain('/* Release 3.2 component hierarchy */')
  })

  it('keeps public legal and fallback pages on the same light surface system', () => {
    const legalShell = read('src/views/legal/LegalShell.vue')
    const notFound = read('src/views/NotFound.vue')

    expect(legalShell).toContain('--public-page-bg: #f8fafc')
    expect(legalShell).toContain('background: var(--public-page-bg)')
    expect(legalShell).toContain('color: var(--public-text-primary)')
    expect(legalShell).toContain('var(--public-surface)')

    expect(notFound).toContain('class="not-found-card"')
    expect(notFound).toContain('background: var(--bg-panel)')
    expect(notFound).toContain('box-shadow: var(--shadow-card)')
  })
})
