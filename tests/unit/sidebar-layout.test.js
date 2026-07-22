import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11.2 sidebar layout', () => {
  it('uses the brand logo, avatar footer and horizontal overflow guards', () => {
    const sidebar = fs.readFileSync('src/components/Sidebar.vue', 'utf8')
    const logo = fs.readFileSync('src/components/brand/AppLogo.vue', 'utf8')

    expect(sidebar).toContain('<AppLogo')
    expect(sidebar).toContain('<UserAvatar')
    expect(sidebar).toContain('sidebar-footer')
    expect(sidebar).toContain('overflow-x: hidden')
    expect(sidebar).toContain('text-overflow: ellipsis')
    expect(sidebar).not.toContain('<span>CF</span>')
    expect(logo).toContain('BrandMark')
  })
})
