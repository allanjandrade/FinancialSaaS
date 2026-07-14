import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import router from '@/router/index.js'
import { NAV_GROUPS, ROUTE_META, groupForPath, isItemActive, metaForPath } from '@/router/navigation.js'

const criticalRoutes = [
  '/dashboard',
  '/analysis',
  '/command-center',
  '/reports',
  '/entries',
  '/accounts',
  '/cards',
  '/benefits',
  '/structure',
  '/card',
  '/benefit',
  '/plan',
  '/goals',
  '/budget',
  '/subscriptions',
  '/purchases',
  '/simulations',
  '/simulations/can-i-buy',
  '/purchase-simulator',
  '/automations',
  '/ai',
  '/ai-actions',
  '/settings',
  '/family',
  '/operational',
]

describe('navigation contract', () => {
  it('defines metadata for every critical route', () => {
    for (const path of criticalRoutes) {
      const resolved = router.resolve(path)
      expect(resolved.matched.length, path).toBeGreaterThan(0)
      expect(resolved.name, path).not.toBe('not-found')
      const meta = resolved.meta.title ? resolved.meta : ROUTE_META[path]
      expect(meta?.title, path).toBeTruthy()
      expect(meta?.group, path).toBeTruthy()
      expect(meta?.breadcrumb?.length, path).toBeGreaterThan(1)
    }
  })

  it('keeps decision routes under the intelligence planning area', () => {
    expect(metaForPath('/reports').group).toBe('Inteligência')
    expect(metaForPath('/plan').group).toBe('Inteligência')
    expect(metaForPath('/subscriptions').group).toBe('Operação')
    expect(metaForPath('/family').group).toBe('Operação')
    expect(metaForPath('/subscriptions').breadcrumb).toEqual(['Operação', 'Assinaturas'])
    expect(metaForPath('/family').breadcrumb).toEqual(['Operação', 'Família'])
    expect(metaForPath('/purchases').breadcrumb).toEqual(['Inteligência', 'Wishlist'])
    expect(metaForPath('/simulations/can-i-buy').breadcrumb).toEqual(['Planejamento', 'Simulações', 'Posso comprar?'])
    expect(metaForPath('/purchase-simulator').breadcrumb).toEqual(['Planejamento', 'Simulações', 'Posso comprar?'])
    expect(metaForPath('/purchases/produto-1').breadcrumb).toEqual(['Inteligência', 'Wishlist', 'Produto'])
  })

  it('resolves active group and item for deep purchase routes', () => {
    expect(groupForPath('/purchases/produto-1')).toBe('Inteligência')
    expect(isItemActive('/purchases/produto-1', '/purchases')).toBe(true)
    expect(isItemActive('/purchases/produto-1', '/simulations')).toBe(false)
  })

  it('contains the restored lean financial menu architecture', () => {
    const groups = NAV_GROUPS.map((group) => [group.label, group.items.map((item) => item.label)])
    expect(groups).toEqual([
      ['Início', ['Comando']],
      ['Inteligência', ['Análises', 'Relatórios', 'Planejamento', 'Wishlist', 'Consultor']],
      ['Operação', ['Lançamentos', 'Contas', 'Cartões', 'Benefícios', 'Assinaturas', 'Família']],
      ['Configurações', ['Perfil', 'Segurança', 'Integrações', 'Admin', 'Operacional']],
    ])

    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))
    expect(labels).not.toContain('Dashboard')
    expect(labels).not.toContain('Visão Geral')
    expect(labels).not.toContain('Compras planejadas')
    expect(labels).not.toContain('Simulações')
    expect(labels).not.toContain('Metas')
    expect(labels).not.toContain('Alertas')
    expect(labels).not.toContain('Ações inteligentes')
    expect(labels).not.toContain('Posso comprar?')
    expect(labels).not.toContain('Histórico de ações')

    const items = NAV_GROUPS.flatMap((group) => group.items)
    expect(items.find((item) => item.path === '/admin')).toMatchObject({ adminOnly: true })
    expect(items.find((item) => item.path === '/operational')).toMatchObject({ operationalOnly: true })
  })

  it('keeps release 3.2 route hierarchy stable by group id', () => {
    expect(NAV_GROUPS.map((group) => group.id)).toEqual([
      'inicio',
      'inteligencia',
      'operacao',
      'configuracoes',
    ])

    const operation = NAV_GROUPS.find((group) => group.id === 'operacao')
    expect(operation.items.map((item) => item.path)).toEqual([
      '/entries',
      '/structure?tab=accounts',
      '/card',
      '/benefit',
      '/subscriptions',
      '/family',
    ])

    expect(metaForPath('/subscriptions').breadcrumb.at(0)).toBe(metaForPath('/family').breadcrumb.at(0))
    expect(groupForPath('/subscriptions')).toBe(groupForPath('/family'))
  })

  it('keeps settings menu entries wired to distinct settings tabs', () => {
    const settings = fs.readFileSync('src/views/Settings.vue', 'utf8')

    expect(isItemActive('/settings', '/settings')).toBe(true)
    expect(isItemActive('/settings?tab=security', '/settings')).toBe(false)
    expect(isItemActive('/settings?tab=security', '/settings?tab=security')).toBe(true)
    expect(isItemActive('/settings?tab=integrations', '/settings?tab=integrations')).toBe(true)

    expect(settings).toContain("id: 'security'")
    expect(settings).toContain("id: 'integrations'")
    expect(settings).toContain("activeTab === 'security'")
    expect(settings).toContain("activeTab === 'integrations'")
    expect(settings).toContain('SETTINGS_TAB_ALIASES')
    expect(settings).toContain("security: 'security'")
    expect(settings).toContain("integrations: 'integrations'")
    expect(settings).toContain('watch(')
    expect(settings).toContain('const router = useRouter()')
    expect(settings).toContain('@click="selectSettingsTab(section.id)"')
    expect(settings).toContain('function selectSettingsTab(tab)')
    expect(settings).toContain("path: '/settings'")
  })

  it('does not expose legacy planning aliases as extra public routes', () => {
    const routerSource = fs.readFileSync('src/router/index.js', 'utf8')
    const fallbackSource = fs.readFileSync('scripts/generate-spa-route-fallbacks.js', 'utf8')
    const intelligenceSource = fs.readFileSync('src/utils/financial-intelligence.js', 'utf8')

    for (const legacyPath of ['/planner', '/planejamento-financeiro']) {
      expect(router.resolve(legacyPath).name, legacyPath).toBe('not-found')
      expect(routerSource).not.toContain(`path: '${legacyPath}'`)
      expect(fallbackSource).not.toContain(`'${legacyPath}'`)
      expect(intelligenceSource).not.toContain(`'${legacyPath}'`)
    }
  })
})
