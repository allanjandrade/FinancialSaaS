import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFinanceStore } from '@/stores/finance'
import { getSupabaseClient } from '@/lib/supabase-client.js'
import { getActiveSession } from '@/lib/supabase-auth.js'
import { FINANCE_STORAGE_KEY, setUserScopedItem } from '@/lib/userScopedStorage.js'
import { ensureFamilyMode } from '@/utils/family-migrate.js'
import {
  fetchMyMembership,
  createFamilyOnRemote,
  createInviteOnRemote,
  fetchFamilyInvites,
  fetchFamilyMembers,
  acceptInviteToken,
  joinFamilyByCode,
  pullFinanceState,
  pushFinanceState,
  buildInviteUrl,
  updateMemberRole,
  removeMemberRemote,
} from '@/api/family-supabase.js'

let pushTimer = null

export const useFamilySyncStore = defineStore('familySync', () => {
  const remoteFamilyId = ref(null)
  const remoteInviteCode = ref('')
  const membership = ref(null)
  const syncing = ref(false)
  const syncError = ref(null)
  const lastRemoteSyncAt = ref(null)
  const cloudEnabled = ref(false)
  const applyingRemote = ref(false)
  const realtimeStatus = ref('offline')
  const lastRemoteEditor = ref(null)

  let pushInFlight = false
  let realtimeChannel = null

  const hasRemoteFamily = computed(() => Boolean(remoteFamilyId.value))
  const isRealtimeConnected = computed(() => realtimeStatus.value === 'connected')

  function timestamp(value) {
    const time = new Date(value || 0).getTime()
    return Number.isFinite(time) ? time : 0
  }

  function localStateBoundary(settings = {}) {
    return Math.max(
      timestamp(settings.lastRemoteSyncAt),
      timestamp(settings.lastLocalChangeAt),
    )
  }

  function applyCurrentPeriodDefault(target) {
    const now = new Date()
    target.settings = {
      ...(target.settings || {}),
      year: now.getFullYear(),
      selectedMonth: now.getMonth() + 1,
    }
    return target
  }

  function getSupabase() {
    return getSupabaseClient()
  }

  function mergeRemotePayload(remote, financeStore) {
    const merged = {
      ...financeStore.state,
      ...remote.data,
      settings: {
        ...financeStore.state.settings,
        ...(remote.data.settings || {}),
        lastRemoteSyncAt: remote.updated_at,
        lastLocalChangeAt: remote.updated_at,
      },
      family: {
        ...(remote.data.family || {}),
        id: remote.family_id || remoteFamilyId.value,
        remote: true,
      },
    }
    applyCurrentPeriodDefault(merged)
    financeStore.state = merged
    ensureFamilyMode(financeStore.state)
    lastRemoteSyncAt.value = remote.updated_at
    if (financeStore.activeUserId) {
      setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify(financeStore.state), financeStore.activeUserId)
    }
  }

  function applyRemoteRow(row, { notify = true } = {}) {
    if (!row?.data || applyingRemote.value || pushInFlight) return false

    const financeStore = useFinanceStore()
    const remoteTime = new Date(row.updated_at || 0).getTime()
    const localTime = localStateBoundary(financeStore.state.settings)

    if (localTime && remoteTime <= localTime) return false

    const previousAlertKeys = new Set(
      (financeStore.state.priceMonitorAlerts || []).map((alert) => alert.dedupeKey || alert.id),
    )
    applyingRemote.value = true
    try {
      mergeRemotePayload(
        { data: row.data, updated_at: row.updated_at, family_id: row.family_id },
        financeStore,
      )
      lastRemoteEditor.value = row.updated_by || null
      if (notify) {
        const priceAlert = (financeStore.state.priceMonitorAlerts || []).find(
          (alert) => alert.status === 'open' && !previousAlertKeys.has(alert.dedupeKey || alert.id),
        )
        window.dispatchEvent(
          new CustomEvent('finance-remote-update', {
            detail: { updatedAt: row.updated_at, priceAlert: priceAlert || null },
          }),
        )
      }
      return true
    } finally {
      applyingRemote.value = false
    }
  }

  function unsubscribeRealtime() {
    const supabase = getSupabase()
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel)
    }
    realtimeChannel = null
    realtimeStatus.value = 'offline'
  }

  async function subscribeRealtime(familyId, userId) {
    unsubscribeRealtime()
    const supabase = getSupabase()
    const { session } = await getActiveSession(supabase)
    if (!supabase || !familyId || !userId || session?.user?.id !== userId) return

    realtimeChannel = supabase
      .channel(`family-finance:${familyId}:${userId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'finance_states',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) applyRemoteRow(payload.new)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'finance_states',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) applyRemoteRow(payload.new)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeStatus.value = 'connected'
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          realtimeStatus.value = 'offline'
        }
      })
  }

  function teardown() {
    unsubscribeRealtime()
    clearTimeout(pushTimer)
    pushTimer = null
    remoteFamilyId.value = null
    remoteInviteCode.value = ''
    membership.value = null
    cloudEnabled.value = false
    syncError.value = null
    lastRemoteSyncAt.value = null
    lastRemoteEditor.value = null
    applyingRemote.value = false
  }

  async function bootstrap() {
    syncError.value = null
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !getSupabase()) {
      cloudEnabled.value = false
      unsubscribeRealtime()
      return { joined: false }
    }

    try {
      const result = await fetchMyMembership()
      if (!result?.member) {
        cloudEnabled.value = true
        unsubscribeRealtime()
        return { joined: false }
      }

      membership.value = result
      remoteFamilyId.value = result.family.id
      remoteInviteCode.value = result.family.invite_code || ''
      cloudEnabled.value = true

      await pullAndMergeState(result.family.id)
      await syncMembersFromRemote(result.family.id, result.user.id)

      const financeStore = useFinanceStore()
      financeStore.state.family = {
        id: result.family.id,
        name: result.family.name,
        adminMemberId: financeStore.state.familyMembers.find((m) => m.role === 'administrator')?.id,
        createdAt: result.family.created_at,
        inviteCode: result.family.invite_code,
        remote: true,
      }
      financeStore.state.settings.familyModeEnabled = true
      financeStore.saveState({ skipCloudPush: true })

      await subscribeRealtime(result.family.id, result.user.id)

      return { joined: true, family: result.family }
    } catch (err) {
      syncError.value = err.message
      cloudEnabled.value = false
      unsubscribeRealtime()
      return { joined: false, error: err.message }
    }
  }

  async function pullAndMergeState(familyId) {
    syncing.value = true
    applyingRemote.value = true
    try {
      const remote = await pullFinanceState(familyId)
      const financeStore = useFinanceStore()
      const localTime = localStateBoundary(financeStore.state.settings)

      if (remote?.data) {
        const remoteTime = new Date(remote.updated_at || 0).getTime()

        if (!localTime || remoteTime >= localTime) {
          mergeRemotePayload(remote, financeStore)
        }
      } else {
        if (financeStore.activeUserId) {
          setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify(financeStore.state), financeStore.activeUserId)
        }
      }
    } finally {
      applyingRemote.value = false
      syncing.value = false
    }
  }

  async function syncMembersFromRemote(familyId, currentUserId) {
    const members = await fetchFamilyMembers(familyId)
    const financeStore = useFinanceStore()

    financeStore.state.familyMembers = members.map((m) => ({
      id: m.supabaseId || m.id,
      supabaseMemberId: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
    }))

    const me = financeStore.state.familyMembers.find((m) => m.userId === currentUserId)
    if (me) {
      financeStore.state.settings.currentMemberId = me.id
    }
  }

  function schedulePush() {
    if (!cloudEnabled.value || !remoteFamilyId.value || applyingRemote.value) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => pushNow(), 1500)
  }

  async function pushNow() {
    if (!remoteFamilyId.value || applyingRemote.value) return
    const financeStore = useFinanceStore()
    pushInFlight = true
    syncing.value = true
    syncError.value = null
    try {
      const payload = JSON.parse(JSON.stringify(financeStore.state))
      payload.settings = {
        ...payload.settings,
        lastRemoteSyncAt: new Date().toISOString(),
      }
      const result = await pushFinanceState(remoteFamilyId.value, payload)
      const syncedAt = result?.updated_at || new Date().toISOString()
      lastRemoteSyncAt.value = syncedAt
      financeStore.state.settings.lastRemoteSyncAt = syncedAt
      financeStore.state.settings.lastLocalChangeAt = syncedAt
      if (financeStore.activeUserId) {
        setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify(financeStore.state), financeStore.activeUserId)
      }
    } catch (err) {
      syncError.value = err.message
    } finally {
      pushInFlight = false
      syncing.value = false
    }
  }

  async function createRemoteFamily(name) {
    const family = await createFamilyOnRemote(name)
    remoteFamilyId.value = family.id
    remoteInviteCode.value = family.invite_code
    cloudEnabled.value = true
    await bootstrap()
    await pushNow()
    return family
  }

  async function inviteRemote({ email, method }) {
    if (!remoteFamilyId.value) throw new Error('Crie ou entre em uma família primeiro')
    const invite = await createInviteOnRemote({
      familyId: remoteFamilyId.value,
      email,
      method,
    })
    await pushNow()
    return { ...invite, url: buildInviteUrl(invite.token) }
  }

  async function listRemoteInvites() {
    if (!remoteFamilyId.value) return []
    return fetchFamilyInvites(remoteFamilyId.value)
  }

  async function acceptRemoteInvite(token, displayName) {
    const result = await acceptInviteToken(token, displayName)
    await bootstrap()
    await pushNow()
    return result
  }

  async function joinRemoteByCode(code, displayName) {
    const result = await joinFamilyByCode(code, displayName)
    await bootstrap()
    await pushNow()
    return result
  }

  async function changeRemoteMemberRole(supabaseMemberId, role) {
    await updateMemberRole(supabaseMemberId, role)
    if (remoteFamilyId.value) {
      const { user } = membership.value || {}
      await syncMembersFromRemote(remoteFamilyId.value, user?.id)
    }
    schedulePush()
  }

  async function removeRemoteMember(supabaseMemberId) {
    await removeMemberRemote(supabaseMemberId)
    if (remoteFamilyId.value && membership.value?.user) {
      await syncMembersFromRemote(remoteFamilyId.value, membership.value.user.id)
    }
    schedulePush()
  }

  return {
    remoteFamilyId,
    remoteInviteCode,
    membership,
    syncing,
    syncError,
    lastRemoteSyncAt,
    cloudEnabled,
    applyingRemote,
    realtimeStatus,
    isRealtimeConnected,
    lastRemoteEditor,
    hasRemoteFamily,
    bootstrap,
    teardown,
    schedulePush,
    pushNow,
    pullAndMergeState,
    createRemoteFamily,
    inviteRemote,
    listRemoteInvites,
    acceptRemoteInvite,
    joinRemoteByCode,
    changeRemoteMemberRole,
    removeRemoteMember,
    buildInviteUrl,
  }
})
