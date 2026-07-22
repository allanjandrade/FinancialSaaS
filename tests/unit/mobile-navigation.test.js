import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from '@/components/Sidebar.vue'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: {
      email: 'qa@example.com',
      user_metadata: { name: 'QA' },
    },
  }),
}))

vi.mock('@/stores/profileStore.js', () => ({
  useProfileStore: () => ({
    avatarUrl: '',
    displayName: 'QA',
  }),
}))

vi.mock('@/lib/authenticated-context.js', () => ({
  loadAuthenticatedContext: vi.fn().mockResolvedValue(null),
  useAuthenticatedContext: () => ({
    access: {
      value: {
        isAdmin: false,
        isOperationalAdmin: false,
        isPremium: true,
        features: {},
        limits: {},
      },
    },
  }),
}))

async function render(path = '/dashboard') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/command-center', component: { template: '<div />' } },
      { path: '/dashboard', component: { template: '<div />' } },
      { path: '/analysis', component: { template: '<div />' } },
      { path: '/entries', component: { template: '<div />' } },
      { path: '/structure', component: { template: '<div />' } },
      { path: '/card', component: { template: '<div />' } },
      { path: '/benefit', component: { template: '<div />' } },
      { path: '/reports', component: { template: '<div />' } },
      { path: '/plan', component: { template: '<div />' } },
      { path: '/subscriptions', component: { template: '<div />' } },
      { path: '/purchases', component: { template: '<div />' } },
      { path: '/advisor', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
      { path: '/family', component: { template: '<div />' } },
      { path: '/billing', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  await router.isReady()
  return mount(Sidebar, { global: { plugins: [createPinia(), router] } })
}

describe('mobile navigation', () => {
  it('provides bottom navigation and drawer with the lean financial menu', async () => {
    const wrapper = await render('/plan')

    expect(wrapper.get('[data-testid="mobile-bottom-nav"]').text()).toContain('Início')
    expect(wrapper.get('[data-testid="mobile-bottom-nav"]').text()).toContain('Lançamentos')
    expect(wrapper.get('[data-testid="mobile-bottom-nav"]').text()).toContain('Planejamento')

    await wrapper.get('[aria-label="Abrir menu Mais"]').trigger('click')

    const drawerText = wrapper.get('[data-testid="mobile-more-drawer"]').text()
    expect(wrapper.get('[data-testid="mobile-more-drawer"]').classes()).toContain('open')
    expect(drawerText).toContain('Operação')
    expect(drawerText).toContain('Wishlist')
    expect(drawerText).toContain('Configurações')
    expect(drawerText).not.toContain('Metas')
    expect(drawerText).not.toContain('Simulações')
    expect(drawerText).not.toContain('Posso comprar?')
  })
})
