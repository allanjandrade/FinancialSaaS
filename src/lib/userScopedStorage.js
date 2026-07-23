export const FINANCE_STORAGE_KEY = 'controle-financeiro-app-v2'

let activeStorageUserId = null

export function getUserScopedKey(baseKey, userId) {
  if (!userId) throw new Error('userId required for user scoped storage')
  return `${baseKey}:${userId}`
}

export function setActiveStorageUser(userId) {
  activeStorageUserId = userId || null
}

export function getActiveStorageUserId() {
  return activeStorageUserId
}

export function getUserScopedItem(baseKey, userId = activeStorageUserId) {
  return localStorage.getItem(getUserScopedKey(baseKey, userId))
}

export function setUserScopedItem(baseKey, value, userId = activeStorageUserId) {
  localStorage.setItem(getUserScopedKey(baseKey, userId), value)
}

export function removeUserScopedItem(baseKey, userId = activeStorageUserId) {
  localStorage.removeItem(getUserScopedKey(baseKey, userId))
}

export function migrateLegacyStorageToUserScope(baseKey, userId) {
  const scopedKey = getUserScopedKey(baseKey, userId)
  const scopedValue = localStorage.getItem(scopedKey)
  const legacyValue = localStorage.getItem(baseKey)
  if (!scopedValue && legacyValue) {
    localStorage.setItem(scopedKey, legacyValue)
  }
  if (legacyValue) localStorage.removeItem(baseKey)
}
