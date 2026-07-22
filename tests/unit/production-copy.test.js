import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const files = [
  'src/views/public/Landing.vue',
  'src/views/public/Pricing.vue',
  'src/views/Signup.vue',
  'src/views/AuthCallback.vue',
  'src/views/Billing.vue',
  'src/components/billing/PaywallCard.vue',
  'src/domain/access-control.js',
]

describe('Release 11.2 production copy', () => {
  it('removes beta, waitlist and tester-only language from product surfaces', () => {
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
    expect(source).not.toMatch(/acesso antecipado|testers autorizados|Avise-me quando liberar|ainda não liberado|Premium em acesso/i)
    expect(fs.readFileSync('src/views/Billing.vue', 'utf8')).toContain('Assinar Premium')
    expect(fs.readFileSync('src/views/public/Pricing.vue', 'utf8')).toContain('Premium anual')
  })
})
