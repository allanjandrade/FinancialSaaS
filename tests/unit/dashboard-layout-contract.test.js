import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('dashboard layout contract', () => {
  it('uses a 70/30 two-column desktop grid', () => {
    const grid = fs.readFileSync(path.join(root, 'src/components/layout/DashboardGrid.vue'), 'utf8')

    expect(grid).toContain('grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr);')
  })

  it('keeps the principal dashboard less dense with secondary sections collapsed', () => {
    const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')

    expect(home).toContain('data-testid="dashboard-secondary-toggle"')
    expect(home).toContain('class="dashboard-secondary-details"')
    expect(home).toContain('Mais análises')
    expect(home.indexOf('data-dashboard-section="quick-entry"')).toBeLessThan(
      home.indexOf('data-testid="dashboard-secondary-toggle"'),
    )
  })

  it('groups the principal dashboard into focused tabs', () => {
    const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')

    expect(home).toContain('role="tablist"')
    expect(home).toContain('data-testid="dashboard-tabs"')
    expect(home).toContain("key: 'summary'")
    expect(home).toContain("key: 'expenses'")
    expect(home).toContain("key: 'goals'")
    expect(home).toContain("key: 'analysis'")
    expect(home).toContain("key: 'data-entry'")
    expect(home).toContain('data-dashboard-tab-panel="data-entry"')
    expect(home.indexOf('data-dashboard-tab-panel="data-entry"')).toBeLessThan(
      home.indexOf('data-dashboard-section="quick-entry"'),
    )
  })

  it('keeps quick entry as the main content of the data entry tab, not in the page footer', () => {
    const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')

    expect(home.indexOf('data-dashboard-tab-panel="data-entry"')).toBeLessThan(
      home.indexOf('<DashboardGrid'),
    )
  })

  it('places a highlighted data-entry action before the initial dashboard metrics', () => {
    const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')

    expect(home).toContain('data-testid="dashboard-data-entry-cta"')
    expect(home).toContain('openDataEntryTab')
    expect(home.indexOf('data-testid="dashboard-data-entry-cta"')).toBeLessThan(
      home.indexOf('data-dashboard-section="dashboard-kpis"'),
    )
  })
})
