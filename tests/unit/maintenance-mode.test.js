import { describe, expect, it } from 'vitest'
import { isMaintenanceBlocked } from '@/domain/production-go-live.js'

describe('Release 11 maintenance mode', () => {
  it('blocks non-essential actions while preserving essential access', () => {
    expect(isMaintenanceBlocked({ maintenanceMode: true, essential: false })).toBe(true)
    expect(isMaintenanceBlocked({ maintenanceMode: true, essential: true })).toBe(false)
    expect(isMaintenanceBlocked({ maintenanceMode: false, essential: false })).toBe(false)
  })
})
