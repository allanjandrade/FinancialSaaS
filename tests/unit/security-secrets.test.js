import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return full
  })
}

describe('frontend secret safety', () => {
  it('does not expose provider or service-role secret names in browser code', () => {
    const files = walk('src').filter((file) => /\.(js|vue|ts|css|html)$/.test(file))
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

    expect(source).not.toMatch(/VALUE_SERP_API_KEY|DATAFORSEO|SUPABASE_SERVICE_ROLE|service_role/i)
    expect(source).not.toContain('https://api.valueserp.com')
    expect(source).not.toContain('generativelanguage.googleapis.com')
  })
})
