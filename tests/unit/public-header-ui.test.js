import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import PublicHeader from '@/components/public/PublicHeader.vue'

describe('Release 11 public header UI', () => {
  it('renders brand, secondary links and primary account CTA', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/pricing', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
        { path: '/signup', component: { template: '<div />' } },
      ],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(PublicHeader, { global: { plugins: [router] } })
    expect(wrapper.get('[data-testid="public-header"]').text()).toContain('Controle Financeiro')
    expect(wrapper.text()).toContain('Planos')
    expect(wrapper.text()).toContain('Entrar')
    expect(wrapper.text()).toContain('Criar conta')
    expect(wrapper.get('.primary-link').text()).toBe('Criar conta')
  })
})
