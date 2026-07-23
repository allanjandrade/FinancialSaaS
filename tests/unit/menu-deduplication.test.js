import { describe, expect, it } from 'vitest'
import { NAV_GROUPS } from '@/router/navigation.js'

describe('menu deduplication', () => {
  it('keeps secondary workflows out of the main menu', () => {
    const items = NAV_GROUPS.flatMap((group) => group.items)
    const labels = items.map((item) => item.label)
    const paths = items.map((item) => item.path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(labels).not.toContain('Posso comprar?')
    expect(labels).not.toContain('Histórico de ações')
    expect(labels).not.toContain('Simulações')
    expect(labels).not.toContain('Ações inteligentes')
    expect(labels).not.toContain('Alertas')
    expect(labels).not.toContain('Metas')
    expect(items.find((item) => item.path === '/admin')).toMatchObject({ adminOnly: true })
    expect(items.find((item) => item.path === '/operational')).toMatchObject({ operationalOnly: true })
    expect(paths).not.toContain('/purchase-simulator')
    expect(paths).not.toContain('/ai-actions?tab=history')
    expect(paths).not.toContain('/simulations')
    expect(paths).not.toContain('/ai-actions')
    expect(paths).not.toContain('/automations')
    expect(paths).not.toContain('/goals')
  })
})
