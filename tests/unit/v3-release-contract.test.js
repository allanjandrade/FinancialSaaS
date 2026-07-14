import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

describe('Version 3.2.0 release contract', () => {
  it('declares version 3.2.0 in package metadata and runtime app config', () => {
    const pkg = JSON.parse(read('package.json'))
    const lock = JSON.parse(read('package-lock.json'))

    expect(pkg.version).toBe('3.2.0')
    expect(lock.version).toBe('3.2.0')
    expect(lock.packages[''].version).toBe('3.2.0')

    expect(exists('src/config/app-version.js')).toBe(true)
    const appVersion = read('src/config/app-version.js')
    expect(appVersion).toContain("APP_VERSION = '3.2.0'")
    expect(appVersion).toContain("APP_RELEASE_CHANNEL = 'stable'")
    expect(appVersion).toContain("APP_RELEASE_DATE = '2026-07-14'")
  })

  it('shows the consolidated version in settings about without hardcoded 2.0.0 copy', () => {
    const settings = read('src/views/Settings.vue')

    expect(settings).toContain("import { APP_RELEASE_CHANNEL, APP_RELEASE_DATE, APP_VERSION } from '@/config/app-version.js'")
    expect(settings).toContain('data-testid="settings-app-version"')
    expect(settings).toContain('{{ APP_VERSION }}')
    expect(settings).not.toContain('<span>2.0.0</span>')
  })

  it('adds a dedicated v3 release validator and documentation trail', () => {
    const pkg = JSON.parse(read('package.json'))

    expect(pkg.scripts['validate:v3-release']).toBe('node scripts/validate-v3-release.js')
    expect(exists('scripts/validate-v3-release.js')).toBe(true)
    expect(read('scripts/validate-v3-release.js')).toContain("const currentVersion = '3.2.0'")
    expect(read('scripts/validate-v3-release.js')).toContain('Version ${currentVersion} validation: PASS')

    expect(exists('CHANGELOG.md')).toBe(true)
    expect(read('CHANGELOG.md')).toContain('## 3.2.0 - 2026-07-14')
    expect(read('CHANGELOG.md')).toContain('## 3.1.0 - 2026-07-13')
    expect(read('CHANGELOG.md')).toContain('## 3.0.0 - 2026-07-13')

    expect(exists('docs/releases/RELEASE3_2_0.md')).toBe(true)
    expect(read('docs/releases/RELEASE3_2_0.md')).toContain('# Release 3.2.0 - UX Operacional Integrado')

    expect(exists('docs/releases/RELEASE3_1_0.md')).toBe(true)
    expect(read('docs/releases/RELEASE3_1_0.md')).toContain('# Release 3.1.0 - Motor de Entrada e Conciliação')

    expect(exists('docs/releases/RELEASE3_0_0.md')).toBe(true)
    expect(read('docs/releases/RELEASE3_0_0.md')).toContain('# Release 3.0.0 - Product Readiness')

    const readme = read('README.md')
    expect(readme).toContain('Versão atual: 3.2.0')
    expect(readme).toContain('npm run validate:v3-release')
  })
})
