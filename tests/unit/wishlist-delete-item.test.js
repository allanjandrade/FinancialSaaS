import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFinanceStore } from '@/stores/finance.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

describe('wishlist delete item isolation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('owner can delete own wishlist item', () => {
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    const item = store.addWishlistItem({ name: 'Item A' })

    store.deleteWishlistItem(item.id)

    expect(store.state.wishlist).toEqual([])
  })

  it('switching users prevents deleting an item from another user cache', () => {
    const store = useFinanceStore()
    store.setActiveUser('user-a')
    const item = store.addWishlistItem({ name: 'Item A' })

    store.setActiveUser('user-b')
    store.deleteWishlistItem(item.id)

    expect(store.state.wishlist).toEqual([])
    store.setActiveUser('user-a')
    expect(store.state.wishlist[0].id).toBe(item.id)
  })
})
