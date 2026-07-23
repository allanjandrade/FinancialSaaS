import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const navRoutes = [
  '/',
  '/command-center',
  '/dashboard',
  '/analysis',
  '/reports',
  '/entries',
  '/structure',
  '/card',
  '/benefit',
  '/plan',
  '/subscriptions',
  '/purchases',
  '/advisor',
  '/settings',
  '/family',
  '/billing',
]

function mountSidebar(path = '/plan') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...navRoutes.map((route) => ({ path: route, component: { template: '<div />' } })),
      { path: '/purchases/:id?', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  return router.isReady().then(() => mount(Sidebar, {
    global: { plugins: [createPinia(), router] },
    attachTo: document.body,
  }))
}

describe('sidebar menu', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders collapsed tooltips and active deep wishlist item', async () => {
    const wrapper = await mountSidebar('/purchases/item-1')

    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).not.toContain('expanded')
    expect(wrapper.text()).toContain('Inteligência')
    await wrapper.get('.nav-item[aria-label="Wishlist"]').trigger('focus')
    expect(document.body.querySelector('.nav-tooltip')?.textContent).toContain('Wishlist')
    expect(wrapper.find('.nav-item.active').text()).toContain('Wishlist')
    wrapper.unmount()
  })

  it('expands with visible labels and explicit collapse button', async () => {
    const wrapper = await mountSidebar('/plan')

    await wrapper.get('.nav-toggle').trigger('click')

    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).toContain('expanded')
    expect(wrapper.text()).toContain('Planejamento')
    expect(wrapper.text()).toContain('Recolher menu')
    expect(wrapper.get('.nav-toggle').attributes('aria-label')).toBe('Recolher menu')
    wrapper.unmount()
  })
})
