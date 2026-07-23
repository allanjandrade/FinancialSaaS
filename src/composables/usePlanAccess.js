import { onMounted } from 'vue'
import { canUseEntitledFeature } from '@/domain/access-control.js'
import { loadAuthenticatedContext, useAuthenticatedContext } from '@/lib/authenticated-context.js'

export function usePlanAccess() {
  const { access, admin, entitlements, loading } = useAuthenticatedContext()

  const canUse = (featureKey) => canUseEntitledFeature(access.value, featureKey)

  async function refresh() {
    return loadAuthenticatedContext()
  }

  onMounted(refresh)

  return {
    access,
    admin,
    canUse,
    entitlements,
    loading,
    refresh,
  }
}
