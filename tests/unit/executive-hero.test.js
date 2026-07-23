import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExecutiveHero from '@/components/ExecutiveHero.vue'

const baseSummary = {
  safeToSpend: 0,
  status: 'Atenção',
  risk: 'attention',
  mainRisk: 'Cadastre sua primeira receita para calcularmos sua capacidade segura de gastos.',
  nextAction: 'Cadastrar receita mensal',
}

function mountHero(summary = {}) {
  return mount(ExecutiveHero, {
    props: {
      summary: {
        ...baseSummary,
        ...summary,
      },
    },
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a data-testid="router-link"><slot /></a>',
        },
      },
    },
  })
}

describe('ExecutiveHero', () => {
  it('troca o gasto seguro por orientação quando falta renda real', () => {
    const wrapper = mountHero({ needsIncomeSetup: true })

    expect(wrapper.text()).toContain('Cadastre sua primeira receita para calcularmos sua capacidade segura de gastos.')
    expect(wrapper.text()).not.toContain('Voce pode gastar')
    expect(wrapper.text()).not.toContain('Você pode gastar R$ 0,00')
  })

  it('emite foco no lançamento rápido quando a próxima ação é cadastrar receita', async () => {
    const wrapper = mountHero({ needsIncomeSetup: true })

    await wrapper.get('[data-testid="hero-review-action"]').trigger('click')

    expect(wrapper.emitted('focus-quick-income')).toHaveLength(1)
  })
})
