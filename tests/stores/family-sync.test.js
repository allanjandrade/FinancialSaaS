import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/api/family-supabase.js', () => ({
  fetchMyMembership: vi.fn(),
  pullFinanceState: vi.fn(),
  pushFinanceState: vi.fn(),
  fetchFamilyMembers: vi.fn(),
  createFamilyOnRemote: vi.fn(),
  createInviteOnRemote: vi.fn(),
  fetchFamilyInvites: vi.fn(),
  acceptInviteToken: vi.fn(),
  joinFamilyByCode: vi.fn(),
  buildInviteUrl: (t) => `http://test/family?invite=${t}`,
  updateMemberRole: vi.fn(),
  removeMemberRemote: vi.fn(),
}))

vi.mock('@/stores/auth.js', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
  }),
}))

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb) => {
    cb('SUBSCRIBED')
    return mockChannel
  }),
}

vi.mock('@/lib/supabase-client.js', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      })),
    },
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  }),
  STORAGE_KEY: 'controle-financeiro-app-v2',
}))

import { useFinanceStore } from '@/stores/finance.js'
import { useFamilySyncStore } from '@/stores/family-sync.js'
import { fetchMyMembership, pullFinanceState, fetchFamilyMembers } from '@/api/family-supabase.js'

describe('useFamilySyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('teardown limpa estado remoto e realtime', () => {
    const sync = useFamilySyncStore()
    sync.remoteFamilyId = 'fam-1'
    sync.cloudEnabled = true
    sync.realtimeStatus = 'connected'
    sync.teardown()

    expect(sync.remoteFamilyId).toBeNull()
    expect(sync.cloudEnabled).toBe(false)
    expect(sync.realtimeStatus).toBe('offline')
  })

  it('bootstrap faz pull e inscreve realtime sem disparar push', async () => {
    fetchMyMembership.mockResolvedValue({
      family: { id: 'fam-1', name: 'Test', invite_code: 'ABC', created_at: '2026-01-01' },
      member: { id: 'mem-1' },
      user: { id: 'user-1' },
    })
    pullFinanceState.mockResolvedValue({
      data: { expenses: [], settings: { lastRemoteSyncAt: '2026-06-01T00:00:00Z' } },
      updated_at: '2026-06-01T12:00:00Z',
      family_id: 'fam-1',
    })
    fetchFamilyMembers.mockResolvedValue([
      { id: 'mem-1', userId: 'user-1', name: 'Allan', email: 'a@test.com', role: 'administrator' },
    ])

    const finance = useFinanceStore()
    const pushSpy = vi.spyOn(finance, 'saveState')

    const sync = useFamilySyncStore()
    const result = await sync.bootstrap()

    expect(result.joined).toBe(true)
    expect(sync.remoteFamilyId).toBe('fam-1')
    expect(sync.isRealtimeConnected).toBe(true)
    expect(pushSpy).toHaveBeenCalledWith({ skipCloudPush: true })
  })

  it('mantem o mes atual como periodo padrao ao aplicar estado remoto antigo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))

    pullFinanceState.mockResolvedValue({
      data: {
        expenses: [],
        settings: {
          year: 2026,
          selectedMonth: 6,
          lastRemoteSyncAt: '2026-07-10T10:00:00.000Z',
        },
      },
      updated_at: '2026-07-10T11:00:00.000Z',
      family_id: 'fam-1',
    })

    const finance = useFinanceStore()
    const sync = useFamilySyncStore()

    await sync.pullAndMergeState('fam-1')

    expect(finance.state.settings.year).toBe(2026)
    expect(finance.state.settings.selectedMonth).toBe(7)
    expect(finance.selectedKey).toBe(202607)
  })
})
