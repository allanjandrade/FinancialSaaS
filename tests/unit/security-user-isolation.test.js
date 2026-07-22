import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance.js'
import { FINANCE_STORAGE_KEY, getUserScopedKey } from '@/lib/userScopedStorage.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

describe('security user isolation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('does not hydrate global financial state without an authenticated user', () => {
    localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({ incomes: [{ description: 'A', amount: 111.11 }] }))
    const store = useFinanceStore()

    expect(store.state.incomes).toEqual([])
    expect(localStorage.getItem(FINANCE_STORAGE_KEY)).not.toBeNull()
  })

  it('switching users clears memory and loads only the new user cache', () => {
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, 'user-a'), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6 },
      incomes: [{ id: 'income-a', date: '2026-06-01', amount: 111.11, type: 'Salario' }],
      wishlist: [{ id: 'wish-a', name: 'Item secreto A' }],
    }))
    localStorage.setItem(getUserScopedKey(FINANCE_STORAGE_KEY, 'user-b'), JSON.stringify({
      settings: { year: 2026, selectedMonth: 6 },
      incomes: [],
      wishlist: [],
    }))

    const store = useFinanceStore()
    store.setActiveUser('user-a')
    expect(store.state.incomes[0].id).toBe('income-a')
    expect(store.state.wishlist[0].id).toBe('wish-a')

    store.setActiveUser('user-b')
    expect(store.state.incomes).toEqual([])
    expect(store.state.wishlist).toEqual([])
  })

  it('wishlist creation requires an active user', () => {
    const store = useFinanceStore()
    expect(() => store.addWishlistItem({ name: 'Item sem dono' })).toThrow('Usuario autenticado obrigatorio')
  })
})
