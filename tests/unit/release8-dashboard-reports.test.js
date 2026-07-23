import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('Release 8 dashboard and reports responsibilities', () => {
  it('keeps dashboard operational and reports historical', () => {
    const home = fs.readFileSync(path.join(root, 'src/views/Home.vue'), 'utf8')
    const hero = fs.readFileSync(path.join(root, 'src/components/ExecutiveHero.vue'), 'utf8')
    const assistant = fs.readFileSync(path.join(root, 'src/components/ContextualAssistant.vue'), 'utf8')
    const reports = fs.readFileSync(path.join(root, 'src/views/Reports.vue'), 'utf8')
    expect(hero).toContain('Como estou agora?')
    expect(hero).toContain('Próxima melhor ação')
    expect(hero).toContain('Você pode gastar')
    expect(hero).toContain('até o fim do mês')
    expect(home).toContain('Minha visão')
    expect(home).toContain('Evolução')
    expect(home).toContain('últimos 6 meses')
    expect(home).toContain('Lançamentos recentes')
    expect(home).toContain('Lançamento rápido')
    expect(home).toContain('Orçamento mensal')
    expect(home).toContain('sem ação financeira automática')
    expect(assistant).toContain('O que merece minha atenção agora?')
    expect(assistant).toContain('Como está minha projeção para o fim do mês?')
    expect(assistant).toContain('Atenção')
    expect(home).toContain('ContextualAssistant context-type="dashboard"')
    expect(reports).toContain('Análise do período')
    expect(reports).toContain('reports-period-filter')
    expect(reports).toContain('reports-category-analysis')
    expect(reports).toContain('reports-trends')
  })
})
