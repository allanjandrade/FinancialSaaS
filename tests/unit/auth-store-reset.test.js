import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.js'
import { useFinanceStore } from '@/stores/finance.js'

const teardown = vi.fn()

vi.mock('@/router', () => ({
  default: {
    currentRoute: { value: { meta: {} } },
    push: vi.fn(),
  },
}))

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({
    teardown,
    applyingRemote: false,
    schedulePush: vi.fn(),
  }),
}))

describe('auth store reset on user change', () => {
  let authCallback

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    teardown.mockClear()
    authCallback = null
    window.supabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-a', email: 'a@test.com' } } },
        })),
        onAuthStateChange: vi.fn((cb) => {
          authCallback = cb
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
    }
  })

  it('loads the scoped store for the current user and resets on session switch', async () => {
    const auth = useAuthStore()
    await auth.init()
    const finance = useFinanceStore()

    expect(finance.activeUserId).toBe('user-a')
    finance.state.wishlist = [{ id: 'secret-a', name: 'Item A' }]

    authCallback('SIGNED_IN', { user: { id: 'user-b', email: 'b@test.com' } })

    expect(finance.activeUserId).toBe('user-b')
    expect(finance.state.wishlist).toEqual([])
    expect(teardown).toHaveBeenCalled()
  })

  it('clears financial memory on sign out', async () => {
    const auth = useAuthStore()
    await auth.init()
    const finance = useFinanceStore()
    finance.state.wishlist = [{ id: 'secret-a', name: 'Item A' }]

    authCallback('SIGNED_OUT', null)

    expect(finance.activeUserId).toBeNull()
    expect(finance.state.wishlist).toEqual([])
  })
})
