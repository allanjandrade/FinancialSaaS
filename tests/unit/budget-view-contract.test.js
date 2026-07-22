import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import Budget from '@/views/Budget.vue'
import { useFinanceStore } from '@/stores/finance.js'

function mountBudget(seed = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFinanceStore()
  Object.assign(store.state, {
    settings: {
      ...store.state.settings,
      year: 2026,
      selectedMonth: 7,
    },
    categoryBudgets: [],
    expenses: [],
    ...seed,
  })

  const wrapper = mount(Budget, {
    global: {
      plugins: [pinia],
      stubs: {
        PageShell: {
          template: '<main data-testid="budget-shell"><slot name="actions" /><slot /></main>',
        },
        EmptyState: {
          props: ['title', 'description', 'actionLabel'],
          emits: ['action'],
          template: `
            <section data-testid="budget-empty-state">
              <h2>{{ title }}</h2>
              <p>{{ description }}</p>
              <button type="button" @click="$emit('action')">{{ actionLabel }}</button>
            </section>
          `,
        },
      },
    },
  })

  return { wrapper, store }
}

describe('budget view contract', () => {
  it('shows common predictive category suggestions before the user personalizes budgets', () => {
    const { wrapper } = mountBudget()

    const options = wrapper.findAll('[data-testid="budget-category"] option').map((option) => option.text())

    expect(options).toEqual(['Mercado', 'Moradia', 'Transporte', 'Saúde', 'Assinaturas', 'Lazer'])
    expect(options).toHaveLength(6)
    expect(wrapper.get('[data-testid="budget-category-helper"]').text()).toContain('Consultor preditivo')
    expect(wrapper.get('[data-testid="budget-category-helper"]').text()).toContain('padrões comuns')
    expect(wrapper.get('[data-testid="budget-category-helper"]').text()).toContain('personalizar depois')
    expect(wrapper.get('[data-testid="budget-empty-state"]').text()).toContain('Nenhum orçamento definido')
  })
})
