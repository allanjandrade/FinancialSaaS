import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import Reports from '@/views/Reports.vue'
import { useFinanceStore } from '@/stores/finance.js'

vi.mock('@/composables/usePlanAccess.js', () => ({
  usePlanAccess: () => ({
    canUse: () => true,
  }),
}))

async function mountReports() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const financeStore = useFinanceStore()
  financeStore.state.settings = {
    ...financeStore.state.settings,
    year: 2026,
    selectedMonth: 6,
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/reports', component: Reports }],
  })
  router.push('/reports')
  await router.isReady()

  const wrapper = mount(Reports, {
    global: {
      plugins: [pinia, router],
      stubs: {
        PageShell: {
          template: '<main data-testid="reports-page"><slot name="actions" /><slot /></main>',
        },
        ResponsiveGrid: {
          template: '<section><slot /></section>',
        },
        ContextualAssistant: {
          template: '<aside />',
        },
      },
    },
  })

  return { wrapper, financeStore }
}

describe('reports period filter', () => {
  it('acompanha o mes atual quando o periodo do store muda apos montar a tela', async () => {
    const { wrapper, financeStore } = await mountReports()
    const select = wrapper.get('[data-testid="reports-period-filter"] select')

    expect(select.element.value).toBe('6')

    financeStore.state.settings.selectedMonth = 7
    await nextTick()

    expect(select.element.value).toBe('7')
  })
})
