import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11 production config', () => {
  it('keeps production documents and public routes declared', () => {
    for (const file of [
      'docs/production/PRODUCTION_PROVIDER_DECISION.md',
      'docs/production/DOMAIN_SETUP.md',
      'docs/production/ENVIRONMENT_CHECKLIST.md',
      'docs/production/ROLLBACK_PLAN.md',
    ]) {
      expect(fs.existsSync(file), file).toBe(true)
    }
    const router = fs.readFileSync('src/router/index.js', 'utf8')
    for (const route of ['/privacy', '/terms', '/pricing', '/signup']) {
      expect(router).toContain(route)
    }
  })
})
