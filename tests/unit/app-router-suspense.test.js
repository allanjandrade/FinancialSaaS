import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'

vi.mock('@/components/Sidebar.vue', () => ({
  default: { name: 'SidebarStub', template: '<nav />', emits: ['expanded-change', 'open', 'close'] },
}))

vi.mock('@/components/Topbar.vue', () => ({
  default: { name: 'TopbarStub', template: '<header />', emits: ['toggle-mobile-menu'] },
}))

vi.mock('@/components/layout/Breadcrumb.vue', () => ({
  default: { name: 'BreadcrumbStub', template: '<div />', props: ['items'] },
}))

vi.mock('@/components/ui/AppToast.vue', () => ({
  default: { name: 'AppToastStub', template: '<div />' },
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ initTheme: vi.fn() }),
}))

vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/lib/authenticated-context.js', () => ({
  loadAuthenticatedContext: vi.fn(async () => null),
}))

vi.mock('@/lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({})),
}))

vi.mock('@/utils/active-price-monitor.js', () => ({
  ensureActivePriceMonitoring: vi.fn(async () => null),
}))

describe('App router suspense shell', () => {
  let warnSpy
  let infoSpy
  let logSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    infoSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('wraps routed fragments with a single suspense root', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const FragmentRoute = { template: '<h1>Rota</h1><p>Conteudo</p>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/fragment', component: FragmentRoute }],
    })

    router.push('/fragment')
    await router.isReady()
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    })

    await router.isReady()
    await wrapper.vm.$nextTick()

    const warnings = [
      ...warnSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
      ...logSpy.mock.calls.flat(),
    ].join('\n')
    expect(warnings).not.toContain('<Suspense> is an experimental feature')
    expect(warnings).not.toContain('<Suspense> slots expect a single root node')
  })

  it('does not pass an empty router-view slot into suspense', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [],
    })

    router.push('/missing')
    await router.isReady()
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    })

    await wrapper.vm.$nextTick()

    const warnings = [
      ...warnSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
      ...logSpy.mock.calls.flat(),
    ].join('\n')
    expect(warnings).not.toContain('<Suspense> is an experimental feature')
    expect(warnings).not.toContain('<Suspense> slots expect a single root node')
  })
})
