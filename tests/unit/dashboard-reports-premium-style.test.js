import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('dashboard and reports functional visual contract', () => {
  it('does not use editorial typography or ink/gold overrides', () => {
    const css = fs.readFileSync('src/styles/main.css', 'utf8')
    const dashboard = fs.readFileSync('src/views/Home.vue', 'utf8')
    const reports = fs.readFileSync('src/views/Reports.vue', 'utf8')

    expect(css).not.toContain('DM+Serif+Display')
    expect(css).not.toContain('Syne')
    expect(dashboard).not.toContain('--premium-ink')
    expect(dashboard).not.toContain('--premium-gold')
    expect(dashboard).not.toContain("font-family: 'DM Serif Display'")
    expect(dashboard).not.toContain("font-family: 'Syne'")
    expect(reports).not.toContain('class="reports-premium"')
    expect(reports).not.toContain('.reports-premium')
    expect(reports).not.toContain('--premium-ink')
    expect(reports).not.toContain('--premium-gold')
    expect(reports).not.toContain("font-family: 'DM Serif Display'")
    expect(reports).not.toContain("font-family: 'Syne'")
  })

  it('keeps existing dashboard and reports financial calculations intact', () => {
    const dashboard = fs.readFileSync('src/views/Home.vue', 'utf8')
    const reports = fs.readFileSync('src/views/Reports.vue', 'utf8')

    expect(dashboard).toContain('const monthData = computed(() => financeStore.calcMonth(selectedMonth.value))')
    expect(dashboard).toContain('const availableBalance = computed(() => monthData.value.cashBalance - monthData.value.cardBill)')
    expect(dashboard).toContain('const periodIncomeTotal = computed(() => sumAmounts(periodIncomes.value))')
    expect(dashboard).toContain('const periodExpenseTotal = computed(() => sumAmounts(periodExpenses.value))')
    expect(reports).toContain('const current = computed(() => aggregateMonth(selectedYear.value, normalizeMonth(selectedMonth.value)))')
    expect(reports).toContain('return { income: incomes, expense: expenses, balance: incomes - expenses }')
    expect(reports).toContain("const category = expense.category || 'Outros'")
    expect(dashboard).toContain('const selectedMonth = computed(() => normalizeMonth(financeStore.state.settings.selectedMonth))')
    expect(reports).toContain('const selectedMonth = ref(normalizeMonth(financeStore.state.settings.selectedMonth))')
  })

  it('does not render synthetic dashboard data when the user has no real rows', () => {
    const dashboard = fs.readFileSync('src/views/Home.vue', 'utf8')

    expect(dashboard).toContain('v-if="hasPredictiveData"')
    expect(dashboard).toContain('const hasPredictiveData = computed')
    expect(dashboard).toContain('v-if="budgetRows.length"')
    expect(dashboard).toContain('Sem orçamento executado no período.')
    expect(dashboard).not.toContain("return [\n    { name: 'Alimentacao'")
    expect(dashboard).not.toContain("name: 'Moradia', spent: 0")
  })
})
