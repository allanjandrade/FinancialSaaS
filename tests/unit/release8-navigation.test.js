import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('Release 8 navigation contract', () => {
  it('declares canonical planning routes and sidebar links', () => {
    const router = fs.readFileSync(path.join(root, 'src/router/index.js'), 'utf8')
    const sidebar = fs.readFileSync(path.join(root, 'src/components/Sidebar.vue'), 'utf8')
    const navigation = fs.readFileSync(path.join(root, 'src/router/navigation.js'), 'utf8')
    for (const route of ['/plan', '/goals', '/budget', '/simulations', '/simulations/can-i-buy']) {
      expect(router).toContain(route)
      expect(navigation).toContain(route)
    }
    expect(router).toContain('/purchase-simulator')
    expect(sidebar).toContain('NAV_GROUPS')
    expect(navigation).not.toContain('/plan#goals')
    expect(navigation).not.toContain('/plan#budget')
    expect(navigation).not.toContain("label: 'Posso comprar?'")
  })
})
