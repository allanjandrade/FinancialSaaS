import { describe, expect, it } from 'vitest'
import router from '@/router/index.js'
import { NAV_GROUPS, isItemActive, metaForPath } from '@/router/navigation.js'

describe('simulations navigation', () => {
  it('keeps can-i-buy available by route without duplicating it in the main menu', () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))

    expect(labels).not.toContain('Simulações')
    expect(labels).not.toContain('Posso comprar?')
    expect(router.resolve('/simulations').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/simulations/can-i-buy').matched.length).toBeGreaterThan(0)
    expect(metaForPath('/simulations/can-i-buy').breadcrumb).toEqual(['Planejamento', 'Simulações', 'Posso comprar?'])
    expect(isItemActive('/simulations/can-i-buy', '/plan')).toBe(true)
  })
})
