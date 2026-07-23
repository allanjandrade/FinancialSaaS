import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.1 public polish', () => {
  it('removes Facebook and keeps Google behind Supabase OAuth', () => {
    const login = fs.readFileSync('src/views/Login.vue', 'utf8')
    const signup = fs.readFileSync('src/views/Signup.vue', 'utf8')
    const auth = fs.readFileSync('src/stores/auth.js', 'utf8')
    const googleAuth = fs.readFileSync('src/domain/auth/googleAuth.js', 'utf8')

    expect(`${login}\n${signup}\n${auth}\n${googleAuth}`).not.toMatch(/facebook/i)
    expect(login).toContain('Continuar com Google')
    expect(signup).toContain('Continuar com Google')
    expect(googleAuth).toContain("provider: 'google'")
    expect(googleAuth).toContain('/auth/callback')
  })

  it('uses human copy on landing and privacy sections', () => {
    const landing = fs.readFileSync('src/views/public/Landing.vue', 'utf8')
    expect(landing).toContain('Controle Financeiro para operações com clareza')
    expect(landing).toContain('Privacidade e segurança')
    expect(landing).not.toMatch(/Billing|server-side|dados minimizados|logs/i)
  })

  it('keeps billing production-ready without beta copy', () => {
    const billing = fs.readFileSync('src/views/Billing.vue', 'utf8')
    const pricing = fs.readFileSync('src/views/public/Pricing.vue', 'utf8')
    expect(billing).toContain('Assinar Premium')
    expect(billing).toContain('Fazer upgrade')
    expect(billing).not.toMatch(/Avise-me quando liberar|Testar checkout Premium|acesso antecipado|testers autorizados/i)
    expect(pricing).toContain('R$ 16,58/mês')
    expect(pricing).toContain('R$ 199,00 cobrados ao ano')
  })

  it('settings has professional sections and working avatar contract', () => {
    const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')
    const avatarUploader = fs.readFileSync('src/components/profile/AvatarUploader.vue', 'utf8')
    for (const label of ['Conta', 'Segurança', 'Preferências', 'Privacidade e dados', 'Copiloto financeiro', 'Assinatura', 'Suporte', 'Sobre']) {
      expect(settings).toContain(label)
    }
    expect(avatarUploader).toContain('data-testid="avatar-change"')
    expect(settings).toContain('<AvatarUploader')
    expect(avatarUploader).toContain('até 2 MB')
    expect(settings).not.toMatch(/Gemini|servidor|suporte@financeiro\.app/i)
  })
})
