import { describe, expect, it, beforeEach } from 'vitest'
import {
  FINANCE_STORAGE_KEY,
  getUserScopedItem,
  getUserScopedKey,
  migrateLegacyStorageToUserScope,
  setActiveStorageUser,
  setUserScopedItem,
} from '@/lib/userScopedStorage.js'

describe('user scoped storage', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveStorageUser(null)
  })

  it('requires user_id to build a financial storage key', () => {
    expect(() => getUserScopedKey(FINANCE_STORAGE_KEY)).toThrow('userId required')
    expect(getUserScopedKey(FINANCE_STORAGE_KEY, 'user-a')).toBe('controle-financeiro-app-v2:user-a')
  })

  it('keeps two users isolated in localStorage', () => {
    setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify({ owner: 'a' }), 'user-a')
    setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify({ owner: 'b' }), 'user-b')

    expect(JSON.parse(getUserScopedItem(FINANCE_STORAGE_KEY, 'user-a')).owner).toBe('a')
    expect(JSON.parse(getUserScopedItem(FINANCE_STORAGE_KEY, 'user-b')).owner).toBe('b')
  })

  it('migrates a legacy key only into the authenticated user scope and removes the global key', () => {
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({ wishlist: [{ id: 'old' }] }))
    migrateLegacyStorageToUserScope(FINANCE_STORAGE_KEY, 'user-a')

    expect(localStorage.getItem(FINANCE_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(getUserScopedItem(FINANCE_STORAGE_KEY, 'user-a')).wishlist[0].id).toBe('old')
    expect(getUserScopedItem(FINANCE_STORAGE_KEY, 'user-b')).toBeNull()
  })
})
