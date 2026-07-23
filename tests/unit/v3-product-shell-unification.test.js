import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import router from '@/router/index.js'
import { NAV_GROUPS, ROUTE_META, isItemActive, metaForPath } from '@/router/navigation.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3 product shell unification', () => {
  it('makes the command center the authenticated home and moves the old dashboard to analysis', () => {
    const routerSource = read('src/router/index.js')
    const fallbackSource = read('scripts/generate-spa-route-fallbacks.js')
    const dashboard = router.resolve('/dashboard')
    const analysis = router.resolve('/analysis')

    expect(dashboard.matched.length).toBeGreaterThan(0)
    expect(analysis.matched.length).toBeGreaterThan(0)
    expect(ROUTE_META['/dashboard']?.title).toBe('Comando')
    expect(ROUTE_META['/analysis']?.title).toBe('Análises')
    expect(routerSource).toContain("path: '/dashboard'")
    expect(routerSource).toContain("component: () => import('@/views/CommandCenter.vue')")
    expect(routerSource).toContain("path: '/analysis'")
    expect(routerSource).toContain("component: () => import('@/views/Home.vue')")
    expect(fallbackSource).toContain("'/analysis'")
    expect(fallbackSource).toContain("'/command-center'")
  })

  it('reduces the main navigation to one home entry and keeps analysis under intelligence', () => {
    const groups = NAV_GROUPS.map((group) => [group.label, group.items.map((item) => item.label)])

    expect(groups).toEqual([
      ['Início', ['Comando']],
      ['Inteligência', ['Análises', 'Relatórios', 'Planejamento', 'Wishlist', 'Consultor']],
      ['Operação', ['Lançamentos', 'Contas', 'Cartões', 'Benefícios', 'Assinaturas', 'Família']],
      ['Configurações', ['Perfil', 'Segurança', 'Integrações', 'Admin', 'Operacional']],
    ])
    expect(isItemActive('/dashboard', '/dashboard')).toBe(true)
    expect(isItemActive('/command-center', '/dashboard')).toBe(true)
    expect(metaForPath('/analysis').breadcrumb).toEqual(['Inteligência', 'Análises'])
  })

  it('renders one operating-system map in the command center instead of another isolated card', () => {
    const commandCenter = read('src/views/CommandCenter.vue')
    const validator = read('scripts/validate-v3-release.js')

    expect(commandCenter).toContain("import FinancialOSMap from '@/components/v3/FinancialOSMap.vue'")
    expect(commandCenter).toContain('data-testid="v3-operating-system-map"')
    expect(commandCenter).toContain('to="/analysis"')
    expect(commandCenter).not.toContain('Voltar ao dashboard')
    expect(validator).toContain('src/components/v3/FinancialOSMap.vue')
    expect(validator).toContain('data-testid="v3-operating-system-map"')
  })
})
