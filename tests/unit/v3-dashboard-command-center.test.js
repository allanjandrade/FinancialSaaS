import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('V3 dashboard command center integration', () => {
  it('renders the command center as the main dashboard from the V3 domain engine', () => {
    const router = fs.readFileSync('src/router/index.js', 'utf8')
    const commandCenter = fs.readFileSync('src/views/CommandCenter.vue', 'utf8')

    expect(router).toContain("path: '/dashboard'")
    expect(router).toContain("component: () => import('@/views/CommandCenter.vue')")
    expect(commandCenter).toContain("import { buildV3CommandCenter, v3CommandFactsForAI } from '@/domain/v3/commandCenter.js'")
    expect(commandCenter).toContain("import { buildV3OperatingSystem } from '@/domain/v3/financialOperatingSystem.js'")
    expect(commandCenter).toContain('data-testid="v3-operating-system-map"')
    expect(commandCenter).toContain('Central de Comando')
  })

  it('keeps the V3 release validator tied to functional command center signals', () => {
    const validator = fs.readFileSync('scripts/validate-v3-release.js', 'utf8')

    expect(validator).toContain('src/domain/v3/commandCenter.js')
    expect(validator).toContain('src/domain/v3/financialOperatingSystem.js')
    expect(validator).toContain('data-testid="v3-operating-system-map"')
    expect(validator).toContain('buildV3CommandCenter')
  })
})
