import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { familyDashboardAmount } from '@/domain/family/familySharing.js'

describe('Release 11.3 family dashboard mode', () => {
  it('switches between my impact and family total', () => {
    const entry = {
      amount: 400,
      participants: [
        { user_id: 'me', calculated_amount: 200 },
        { user_id: 'partner', calculated_amount: 200 },
      ],
    }

    expect(familyDashboardAmount(entry, 'mine', 'me')).toBe(200)
    expect(familyDashboardAmount(entry, 'family', 'me')).toBe(400)
  })

  it('exposes the scope toggle in dashboard and reports', () => {
    const dashboard = fs.readFileSync('src/views/Home.vue', 'utf8')
    const reports = fs.readFileSync('src/views/Reports.vue', 'utf8')
    const family = fs.readFileSync('src/views/Family.vue', 'utf8')

    expect(dashboard).toContain('data-testid="family-dashboard-mode"')
    expect(reports).toContain('data-testid="family-dashboard-mode"')
    expect(family).toContain('Minha visão')
    expect(family).toContain('Família')
  })
})
