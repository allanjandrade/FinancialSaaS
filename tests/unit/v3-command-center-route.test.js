import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3 command center route and UI contract', () => {
  it('promotes command center as the authenticated home with a compatibility route', () => {
    const router = read('src/router/index.js')
    const navigation = read('src/router/navigation.js')
    const sidebar = read('src/components/Sidebar.vue')

    expect(router).toContain("path: '/dashboard'")
    expect(router).toContain("name: 'dashboard'")
    expect(router).toContain("path: '/analysis'")
    expect(router).toContain("component: () => import('@/views/Home.vue')")
    expect(router).toContain("path: '/command-center'")
    expect(router).toContain("name: 'command-center'")
    expect(router).toContain("component: () => import('@/views/CommandCenter.vue')")
    expect(router).toContain("meta: authMeta('/command-center')")

    expect(navigation).toContain("{ path: '/dashboard', label: 'Comando', icon: 'commandCenter' }")
    expect(navigation).toContain("{ path: '/analysis', label: 'Análises', icon: 'dashboard' }")
    expect(navigation).toContain("'/command-center': { title: 'Central de Comando'")
    expect(navigation).toContain("current.pathname === '/command-center'")
    expect(sidebar).toContain('commandCenter:')
  })

  it('renders the command center with score, operating-system map, action plan and execution rails', () => {
    const view = read('src/views/CommandCenter.vue')

    expect(view).toContain('data-testid="command-center-page"')
    expect(view).toContain('data-testid="v3-financial-score"')
    expect(view).toContain('data-testid="v3-operating-system-map"')
    expect(view).toContain('data-testid="v3-action-plan"')
    expect(view).toContain('data-testid="v3-execution-rails"')
    expect(view).toContain('buildV3CommandCenter')
    expect(view).toContain('buildV3OperatingSystem')
    expect(view).toContain('v3CommandFactsForAI')
    expect(view).toContain('{{ command.score.label }} · {{ aiFacts.actions.length }} ações')
    expect(view).not.toContain('{{ aiFacts.level }}')
  })

  it('promotes the command center through release validation', () => {
    const validator = read('scripts/validate-v3-release.js')

    expect(validator).toContain('src/views/CommandCenter.vue')
    expect(validator).toContain('src/components/v3/FinancialOSMap.vue')
    expect(validator).toContain("path: '/dashboard'")
    expect(validator).toContain("path: '/analysis'")
    expect(validator).toContain("path: '/command-center'")
    expect(validator).toContain('v3CommandFactsForAI')
  })
})
