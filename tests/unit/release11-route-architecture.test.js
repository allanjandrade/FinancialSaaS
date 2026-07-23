import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { currentPlanLabel } from '@/domain/billing/plans.js'
import appRouter from '@/router/index.js'

describe('Release 11 route architecture', () => {
  it('keeps AI actions separate from new purchase', () => {
    const routeSource = fs.readFileSync('src/router/index.js', 'utf8')
    const aiHub = fs.readFileSync('src/views/AIActionHub.vue', 'utf8')
    const purchaseNew = fs.readFileSync('src/views/PurchaseNew.vue', 'utf8')

    expect(routeSource).toContain("component: () => import('@/views/AIActionHub.vue')")
    expect(routeSource).not.toMatch(/path:\s*'\/ai-actions'[\s\S]{0,140}PurchaseNew\.vue/)
    expect(aiHub).toContain('Inteligência financeira')
    expect(aiHub).toContain('Buscar produto por descrição')
    expect(purchaseNew).toContain('Nova compra')
    expect(purchaseNew).toContain('Descreva o produto')
    expect(purchaseNew).not.toContain('Consultar meu mês')
  })

  it('uses precise plan labels', () => {
    expect(currentPlanLabel('free')).toBe('Plano atual: Grátis')
    expect(currentPlanLabel('premium_monthly')).toBe('Plano atual: Premium mensal')
    expect(currentPlanLabel('premium_annual')).toBe('Plano atual: Premium anual')
  })

  it('keeps legacy compras routes mapped to canonical wishlist routes', () => {
    const fallbackSource = fs.readFileSync('scripts/generate-spa-route-fallbacks.js', 'utf8')

    expect(appRouter.resolve('/compras').matched.length).toBeGreaterThan(0)
    expect(appRouter.resolve('/compras/nova').matched.length).toBeGreaterThan(0)
    expect(appRouter.resolve('/compras/produto/wish-1').matched.length).toBeGreaterThan(0)
    expect(appRouter.resolve('/compras/wish-1').matched.length).toBeGreaterThan(0)
    expect(fallbackSource).toContain("'/compras/nova'")
    expect(fallbackSource).toContain("'/compras/produto'")
  })
})
