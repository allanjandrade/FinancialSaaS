import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('Release 8 layout contract', () => {
  it('provides PageShell and ResponsiveGrid and avoids known fixed broken grids in new views', () => {
    for (const file of [
      'src/components/layout/PageShell.vue',
      'src/components/layout/ResponsiveGrid.vue',
      'src/views/Plan.vue',
      'src/views/Goals.vue',
      'src/views/Budget.vue',
      'src/views/PurchaseSimulator.vue',
      'src/views/Reports.vue',
    ]) {
      expect(fs.existsSync(path.join(root, file))).toBe(true)
    }

    const grid = fs.readFileSync(path.join(root, 'src/components/layout/ResponsiveGrid.vue'), 'utf8')
    expect(grid).toContain('repeat(4, minmax(0, 1fr))')
    expect(grid).toContain('repeat(2, minmax(0, 1fr))')
    expect(grid).toContain('grid-template-columns: 1fr')
  })
})
