import { describe, expect, it } from 'vitest'
import { formatMoneyInput, parseMoneyInput } from '@/utils/money.js'
import { toUserFriendlyError } from '@/domain/errors/userFriendlyErrors.js'
import fs from 'node:fs'

describe('premium UX foundations', () => {
  it('keeps money input empty until user types', () => {
    expect(formatMoneyInput(null)).toBe('')
    expect(parseMoneyInput('')).toBe(null)
    expect(parseMoneyInput('1.234,56')).toBe(1234.56)
  })

  it('translates technical errors to friendly copy', () => {
    expect(toUserFriendlyError({ code: 401, message: 'JWT expired' }))
      .toContain('sessão expirou')
    expect(toUserFriendlyError({ code: 409, message: 'duplicate key value violates unique constraint' }))
      .toContain('Já existe um registro')
  })

  it('ships core UI primitives', () => {
    for (const file of [
      'src/components/ui/AppInput.vue',
      'src/components/ui/AppMoneyInput.vue',
      'src/components/ui/AppButton.vue',
      'src/components/ui/AppTabs.vue',
      'src/components/ui/AppSkeleton.vue',
      'src/domain/errors/userFriendlyErrors.js',
    ]) {
      expect(fs.existsSync(file)).toBe(true)
    }
  })

  it('styles tabs as secondary navigation with underline', () => {
    const tabs = fs.readFileSync('src/components/ui/AppTabs.vue', 'utf8')
    expect(tabs).toContain('app-tabs__tab--active::after')
    expect(tabs).not.toContain('background: var(--accent)')
  })
})
