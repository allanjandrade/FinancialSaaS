import { describe, expect, it } from 'vitest'
import { formatCurrency } from '@/utils/financial-planner.js'
import { formatAuditDetails, maskEmail } from '@/utils/privacy.js'

describe('UI safety helpers', () => {
  it('formats zero as a valid monetary value', () => {
    expect(formatCurrency(0)).toContain('0,00')
    expect(formatCurrency(null)).toBe('Preço indisponível')
  })

  it('masks email addresses in audit details', () => {
    expect(maskEmail('allan@example.com')).toBe('a***@example.com')
    expect(formatAuditDetails('{"name":"Allan","email":"allan@example.com"}'))
      .toBe('Nome: Allan · E-mail: a***@example.com')
  })
})
