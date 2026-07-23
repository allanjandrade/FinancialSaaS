import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoots = ['src/styles', 'src/components', 'src/views']
const sourceFiles = sourceRoots.flatMap((root) => collectFiles(root))

function collectFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath)
    return /\.(css|vue)$/.test(entry.name) ? [fullPath] : []
  })
}

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

describe('typography consistency contract', () => {
  it('does not import or reference custom display fonts', () => {
    const forbidden = [
      'fonts.googleapis',
      'DM Serif',
      'Syne',
      'IBM Plex',
      'Georgia',
    ]

    for (const file of sourceFiles) {
      const source = read(file)
      for (const token of forbidden) {
        expect(source, `${file} must not reference ${token}`).not.toContain(token)
      }
    }
  })

  it('keeps page title typography centralized in global tokens', () => {
    const css = read('src/styles/main.css')
    const pageHeader = read('src/components/layout/PageHeader.vue')
    const pageShell = read('src/components/layout/PageShell.vue')
    const breadcrumb = read('src/components/layout/Breadcrumb.vue')

    expect(css).toContain('--font-display: var(--font-sans)')
    expect(css).toContain('--page-title-size: var(--text-2xl)')
    expect(css).toContain('--page-title-weight: 700')
    expect(css).toContain('--eyebrow-letter-spacing: 0.04em')
    expect(pageHeader).toContain('font-family: var(--font-display)')
    expect(pageHeader).toContain('font-size: var(--page-title-size)')
    expect(pageHeader).toContain('font-weight: var(--page-title-weight)')
    expect(pageShell).toContain('width: min(var(--content-max), 100%)')
    expect(breadcrumb).toContain('width: min(var(--content-max), 100%)')
  })

  it('does not use excessive letter spacing in app page styles', () => {
    const excessive = /letter-spacing:\s*(?:0\.0[5-9]|0\.[1-9]|[1-9])/
    for (const file of sourceFiles) {
      expect(read(file), `${file} has excessive letter-spacing`).not.toMatch(excessive)
    }
  })
})
