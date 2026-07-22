import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('automations view contract', () => {
  it('shows a predictive maturity promise before personalized automation recommendations', () => {
    const source = fs.readFileSync(path.join(root, 'src/views/Automations.vue'), 'utf8')

    expect(source).toContain('data-testid="automation-maturity-promise"')
    expect(source).toContain('Após 2-3 meses')
    expect(source).toContain('recomendações personalizadas')
    expect(source).toContain('histórico suficiente')
  })

  it('keeps only wishlist automation active in the current release', () => {
    const source = fs.readFileSync(path.join(root, 'src/views/Automations.vue'), 'utf8')

    expect(source).toContain("const ACTIVE_AUTOMATION_TEMPLATE_IDS = Object.freeze(['wishlist_target_price_reached'])")
    expect(source).toContain("templateId: 'wishlist_target_price_reached'")
    expect(source).toContain('availableTemplates')
    expect(source).toContain('Apenas wishlist ativa')
    expect(source).toContain('Criar alerta de wishlist')
  })

  it('adds local simple rules for category keywords, spending alerts and analysis period', () => {
    const source = fs.readFileSync(path.join(root, 'src/views/Automations.vue'), 'utf8')

    expect(source).toContain('data-testid="simple-automation-rules"')
    expect(source).toContain('Categoria automática por palavra-chave')
    expect(source).toContain('Alertas de gastos')
    expect(source).toContain('Período de análise')
    expect(source).toContain('analysisPeriodDays')
    expect(source).toContain('spendingAlertThreshold')
    expect(source).toContain('buildSpendingAlert')
    expect(source).toContain('findCategoryKeywordSuggestions')
  })
})
