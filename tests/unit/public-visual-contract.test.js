import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public visual contrast contract', () => {
  it('keeps public pages readable independently from the app theme', () => {
    const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
    const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')
    const header = fs.readFileSync('src/components/public/PublicHeader.vue', 'utf8')
    const authBackground = fs.readFileSync('src/components/brand/AuthBackground.vue', 'utf8')

    for (const source of [landing, pricing]) {
      expect(source).toContain('--public-page-bg: #f8fafc')
      expect(source).toContain('--public-text-primary: #0f172a')
      expect(source).toContain('--public-text-secondary: #475569')
      expect(source).toContain('--auth-background: var(--public-page-bg)')
      expect(source).toContain('background: var(--public-page-bg)')
      expect(source).toContain('color: var(--public-text-primary)')
      expect(source).not.toContain('color: var(--text-primary);')
      expect(source).not.toContain('color: var(--text-secondary);')
    }

    expect(header).toContain('var(--public-text-primary, var(--text-primary))')
    expect(header).toContain('var(--public-text-secondary, var(--text-secondary))')
    expect(header).toContain('background: rgba(255, 255, 255, 0.88)')
    expect(header).toContain('border: 1px solid var(--public-border, var(--border-color))')
    expect(authBackground).toContain('background: var(--auth-background')
  })

  it('keeps landing page typography on global scale tokens', () => {
    const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')

    expect(landing).toContain('font-size: var(--page-title-size)')
    expect(landing).toContain('font-size: var(--page-subtitle-size)')
    expect(landing).not.toContain('font-size: 3rem')
    expect(landing).not.toContain('font-size: 2.25rem')
    expect(landing).not.toContain('font-size: 1.08rem')
  })

  it('keeps the landing hero, preview cards and footer aligned on desktop and mobile', () => {
    const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
    const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')

    expect(landing).toContain('class="landing-shell"')
    expect(landing).toContain('class="hero-copy"')
    expect(landing).toContain('class="product-preview hero-panel"')
    expect(landing).toContain('class="footer-links"')
    expect(landing).toContain('ledger-public-section')
    expect(landing).toContain('ledger-row-list')
    expect(pricing).toContain('ledger-pricing-table')
    expect(pricing).toContain('ledger-pricing-row')
    expect(pricing).toContain('class="price-stack"')
    expect(pricing).toContain('.price-stack')
    expect(landing).toContain('grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr)')
    expect(landing).toContain('align-items: center')
    expect(landing).toContain('grid-auto-rows: 1fr')
    expect(landing).toContain('grid-template-columns: minmax(140px, 1fr) minmax(120px, auto) minmax(88px, auto)')
    expect(landing).toContain('justify-content: space-between')
    expect(landing).toContain('.landing-shell { grid-template-columns: 1fr; padding-top: 2rem; }')
  })

  it('keeps the login screen visually aligned with the public landing system', () => {
    const login = fs.readFileSync('src/views/Login.vue', 'utf8')

    expect(login).toContain('--public-page-bg: #f8fafc')
    expect(login).toContain('--public-text-primary: #0f172a')
    expect(login).toContain('--auth-background: var(--public-page-bg)')
    expect(login).toContain('background: var(--public-page-bg)')
    expect(login).toContain('color: var(--public-text-primary)')
    expect(login).toContain('ledger-auth-page')
    expect(login).toContain('class="auth-shell"')
    expect(login).toContain('class="auth-form-card"')
    expect(login).toContain('class="auth-panel-card"')
    expect(login).toContain('class="auth-proof-grid"')
    expect(login).toContain('grid-template-columns: minmax(0, 0.95fr) minmax(340px, 0.85fr)')
    expect(login).toContain('align-items: stretch')
    expect(login).toContain('.auth-shell { grid-template-columns: 1fr; }')
    expect(login).not.toContain('color: var(--text-primary);')
  })

  it('keeps migrated public and auth copy accented in PT-BR', () => {
    const source = [
      fs.readFileSync('src/views/public/Landing.vue', 'utf8'),
      fs.readFileSync('src/views/Login.vue', 'utf8'),
      fs.readFileSync('src/views/Signup.vue', 'utf8'),
    ].join('\n')

    for (const term of ['Governanca', 'decisoes', 'Mes atual', 'Visao', 'criterio']) {
      expect(source).not.toContain(term)
    }
  })
})
