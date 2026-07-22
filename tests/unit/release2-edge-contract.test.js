import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const functions = [
  'financial-snapshot',
  'benefit-burn-rate',
  'card-risk',
  'month-end-projection',
  'category-anomalies',
  'purchase-simulation',
  'recurring-suggestions',
]

describe('Release 2 Edge Function contract', () => {
  it.each(functions)('%s uses the shared authenticated engine handler', (name) => {
    const source = readFileSync(resolve(`supabase/functions/${name}/index.ts`), 'utf8')
    expect(source).toContain('handleFinancialEngineRequest')
    expect(source).not.toMatch(/body\.(user_id|userId|created_by|createdBy)/)
  })
})
