import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationBell from '@/components/NotificationBell.vue'
import { useAuthStore } from '@/stores/auth.js'
import {
  SUPABASE_CONNECTIVITY_MESSAGE,
  cleanupSupabaseRealtime,
  invokeAuthenticatedFunction,
} from '@/lib/supabase-auth.js'
import {
  loadAuthenticatedContext,
  resetAuthenticatedContext,
} from '@/lib/authenticated-context.js'

const mocks = vi.hoisted(() => ({
  familyTeardown: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/router', () => ({
  default: {
    currentRoute: { value: { meta: { requiresAuth: true } } },
    push: mocks.routerPush,
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({
    teardown: mocks.familyTeardown,
  }),
}))

function loggedOutSupabase() {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
    removeAllChannels: vi.fn(async () => []),
    removeChannel: vi.fn(),
  }
}

function loggedInSupabase({ invoke, from } = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'token',
            user: { id: 'user-1', email: 'u@test.com' },
          },
        },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(),
    },
    functions: {
      invoke: invoke || vi.fn(async () => ({ data: {}, error: null })),
    },
    from: from || vi.fn(),
    channel: vi.fn(),
    removeAllChannels: vi.fn(async () => []),
    removeChannel: vi.fn(),
  }
}

function notificationQuery(result) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    abortSignal: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return query
}

describe('Supabase connectivity and authenticated boot guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetAuthenticatedContext()
    window.supabase = null
  })

  it('usuario deslogado nao chama entitlements-resolve nem admin-current-user', async () => {
    const supabase = loggedOutSupabase()

    const entitlements = await invokeAuthenticatedFunction('entitlements-resolve', {}, { supabase })
    const admin = await invokeAuthenticatedFunction('admin-current-user', {}, { supabase })

    expect(entitlements.skipped).toBe(true)
    expect(admin.skipped).toBe(true)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('usuario deslogado nao inicia realtime nem consulta notificacoes', () => {
    window.supabase = loggedOutSupabase()
    mount(NotificationBell, { global: { plugins: [createPinia()] } })

    expect(window.supabase.channel).not.toHaveBeenCalled()
    expect(window.supabase.from).not.toHaveBeenCalled()
  })

  it('logout limpa subscriptions realtime', async () => {
    const supabase = loggedInSupabase()
    window.supabase = supabase

    const auth = useAuthStore()
    auth.session = { user: { id: 'user-1', email: 'u@test.com' } }
    auth.user = auth.session.user

    await auth.signOut()

    expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1)
    expect(auth.session).toBeNull()
  })

  it('cleanup realtime usa removeAllChannels quando disponivel', async () => {
    const supabase = { removeAllChannels: vi.fn(async () => ['ok']) }

    await cleanupSupabaseRealtime(supabase)

    expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1)
  })

  it('erro de rede no login mostra mensagem de conectividade', async () => {
    const error = Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError' })
    window.supabase = {
      auth: {
        signInWithPassword: vi.fn(async () => {
          throw error
        }),
      },
    }

    const auth = useAuthStore()
    const result = await auth.signIn('user@test.com', 'secret')

    expect(result.success).toBe(false)
    expect(result.error).toBe(SUPABASE_CONNECTIVITY_MESSAGE)
  })

  it('falha em notificacoes nao quebra contexto autenticado', async () => {
    const from = vi.fn(() => notificationQuery({
      data: null,
      error: Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }),
    }))
    window.supabase = loggedInSupabase({
      from,
      invoke: vi.fn(async (name) => {
        if (name === 'admin-current-user') return { data: { is_admin: false, role: 'user', permissions: [] }, error: null }
        if (name === 'entitlements-resolve') return { data: { plan_code: 'free', features: {}, limits: {} }, error: null }
        return { data: {}, error: null }
      }),
    })

    const result = await loadAuthenticatedContext({ force: true })

    expect(result.skipped).toBe(false)
    expect(result.admin.role).toBe('user')
    expect(result.warning).toBe(SUPABASE_CONNECTIVITY_MESSAGE)
  })

  it('falha em entitlements nao causa retry infinito nem nova chamada no cache', async () => {
    const connectivityError = Object.assign(new Error('Failed to fetch'), { name: 'FunctionsFetchError' })
    const invoke = vi.fn(async () => ({ data: null, error: connectivityError }))
    window.supabase = loggedInSupabase({ invoke })

    const first = await loadAuthenticatedContext({ force: true, preloadNotifications: false })
    const second = await loadAuthenticatedContext({ preloadNotifications: false })

    expect(first.warning).toBe(SUPABASE_CONNECTIVITY_MESSAGE)
    expect(second.reason).toBe('cached')
    expect(invoke).toHaveBeenCalledTimes(4)
  })
})
