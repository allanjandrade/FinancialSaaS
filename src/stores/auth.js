import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '@/router'
import { useFamilySyncStore } from '@/stores/family-sync.js'
import { useFinanceStore } from '@/stores/finance.js'
import { useProfileStore } from '@/stores/profileStore.js'
import { signInWithGoogle as startGoogleSignIn } from '@/domain/auth/googleAuth.js'
import { validateStrongPassword } from '@/domain/auth/passwordPolicy.js'
import { resetAuthenticatedContext } from '@/lib/authenticated-context.js'
import { cleanupSupabaseRealtime, friendlySupabaseError } from '@/lib/supabase-auth.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const loading = ref(false)
  const initialized = ref(false)
  let previousUserId = null
  let authSubscription = null

  const isAuthenticated = computed(() => !!session.value)

  async function cleanupSignedOutRuntime() {
    resetAuthenticatedContext()
    await cleanupSupabaseRealtime(window.supabase)
  }

  function applySession(nextSession) {
    const nextUser = nextSession?.user || null
    const nextUserId = nextUser?.id || null

    if (nextUserId !== previousUserId) {
      useFamilySyncStore().teardown()
      useFinanceStore().setActiveUser(nextUserId)
    }

    session.value = nextSession || null
    user.value = nextUser
    useProfileStore().hydrateFromUser(nextUser)
    previousUserId = nextUserId
  }

  async function init() {
    if (initialized.value) return

    const supabase = window.supabase
    if (!supabase) {
      initialized.value = true
      return
    }

    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      applySession(currentSession)

      authSubscription?.unsubscribe?.()
      const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          console.log('Usuário deslogou com sucesso.')
          cleanupSignedOutRuntime()
          applySession(null)
          if (router.currentRoute.value.meta.requiresAuth === true) {
            router.push('/login')
          }
          return
        }

        applySession(newSession)
      })
      authSubscription = authListener?.subscription || null
    } catch (error) {
      console.error('Auth initialization error:', error)
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function signIn(email, password) {
    const supabase = window.supabase
    if (!supabase) throw new Error('Supabase not initialized')

    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      applySession(data.session)
      return { success: true }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        success: false,
        error: friendlySupabaseError(error, 'Não foi possível entrar. Confira seus dados.'),
      }
    } finally {
      loading.value = false
    }
  }

  async function signInWithGoogle(options = {}) {
    const supabase = window.supabase
    if (!supabase) throw new Error('Supabase not initialized')

    loading.value = true
    try {
      const { data, error } = await startGoogleSignIn(supabase, options)
      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Google sign in error:', error)
      return {
        success: false,
        error: friendlySupabaseError(error, 'Não foi possível iniciar o acesso com Google.'),
      }
    } finally {
      loading.value = false
    }
  }

  async function signUp({ email, password, metadata = {} }) {
    const supabase = window.supabase
    if (!supabase) throw new Error('Supabase not initialized')

    loading.value = true
    try {
      validateStrongPassword(password)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      applySession(data.session || session.value)
      return { success: true, data }
    } catch (error) {
      console.error('Sign up error:', error)
      return {
        success: false,
        error: friendlySupabaseError(error, 'Não foi possível criar a conta. Tente novamente.'),
      }
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const supabase = window.supabase
    loading.value = true
    try {
      await cleanupSignedOutRuntime()
      if (supabase) await supabase.auth.signOut()
      applySession(null)
    } catch (error) {
      console.error('Sign out error:', error)
      applySession(null)
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated,
    init,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
  }
})
