import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFamilySyncStore } from '@/stores/family-sync.js'
import { useFinanceStore } from '@/stores/finance.js'
import { pullFinanceState } from '@/api/family-supabase.js'

vi.mock('@/api/family-supabase.js', () => ({
  fetchMyMembership: vi.fn(),
  createFamilyOnRemote: vi.fn(),
  createInviteOnRemote: vi.fn(),
  fetchFamilyInvites: vi.fn(),
  fetchFamilyMembers: vi.fn(),
  acceptInviteToken: vi.fn(),
  joinFamilyByCode: vi.fn(),
  pullFinanceState: vi.fn(),
  pushFinanceState: vi.fn(),
  buildInviteUrl: vi.fn((token) => `/family/invite/${token}`),
  updateMemberRole: vi.fn(),
  removeMemberRemote: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true, user: { id: 'user-a' } }),
}))

vi.mock('@/lib/supabase-client.js', () => ({
  getSupabaseClient: () => ({
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}))

vi.mock('@/lib/supabase-auth.js', () => ({
  getActiveSession: vi.fn(async () => ({ session: { user: { id: 'user-a' } } })),
}))

describe('family sync local dirty state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T22:02:00.000Z'))
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not overwrite a newly saved wishlist item with a stale remote pull', async () => {
    const financeStore = useFinanceStore()
    const familySync = useFamilySyncStore()
    financeStore.setActiveUser('user-a')
    financeStore.state.settings.lastRemoteSyncAt = '2026-07-07T22:00:00.000Z'

    financeStore.addWishlistItem({
      id: 'local-wish-1',
      name: 'Lanterna Traseira Direita Fiat Punto 2008',
      value: 78.9,
      category: 'Transporte',
      priceStatus: 'quoted',
    })

    pullFinanceState.mockResolvedValue({
      family_id: 'family-a',
      updated_at: '2026-07-07T22:01:00.000Z',
      data: {
        settings: { lastRemoteSyncAt: '2026-07-07T22:01:00.000Z' },
        wishlist: [],
      },
    })

    await familySync.pullAndMergeState('family-a')

    expect(financeStore.state.wishlist).toHaveLength(1)
    expect(financeStore.state.wishlist[0]).toMatchObject({
      id: 'local-wish-1',
      name: 'Lanterna Traseira Direita Fiat Punto 2008',
    })
  })
})
