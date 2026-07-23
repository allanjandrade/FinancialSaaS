import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { useFinanceStore } from '@/stores/finance.js'
import { createProductFromUrl } from '@/api/product-from-url.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

vi.mock('@/api/product-from-url.js', () => ({
  createProductFromUrl: vi.fn(),
}))

vi.mock('@/utils/ai-autofill.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    completeAutofill: (product) => ({ category: 'Outros', priority: 'Media', ...product }),
  }
})

describe('new purchase user scope', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    window.supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })),
      },
    }
    createProductFromUrl.mockReset()
  })

  it('requires an authenticated user before saving a wishlist item', async () => {
    window.supabase.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: null }))
    const workflow = usePurchaseWorkflow()

    await expect(workflow.saveIdentifiedProduct({ name: 'Item A' })).rejects.toThrow('Usuário não autenticado')
  })

  it('rejects manual user_id in the purchase payload', async () => {
    const workflow = usePurchaseWorkflow()

    await expect(workflow.saveIdentifiedProduct({ name: 'Item A', user_id: 'user-b' })).rejects.toThrow('usuário autenticado')
  })

  it('preserves free text and incomplete auto-part descriptions as visible names', async () => {
    const workflow = usePurchaseWorkflow()

    const freeText = await workflow.identifyFromText('Item secreto A')
    expect(freeText.name).toBe('Item secreto A')
    expect(freeText.product_identity).toBe(null)

    const incompletePart = await workflow.identifyFromText('Lanterna traseira Punto')
    expect(incompletePart.name).toBe('Lanterna traseira Punto')
    expect(incompletePart.product_identity).toMatchObject({
      match_policy: 'strict',
      vehicle_model: 'Punto',
    })
  })

  it('saves the item only in the logged user scoped state', async () => {
    const workflow = usePurchaseWorkflow()
    const finance = useFinanceStore()

    const item = await workflow.saveIdentifiedProduct({
      name: 'Item secreto A',
      description: 'Descricao original preservada',
      value: 120,
    })

    expect(item.name).toBe('Item secreto A')
    expect(item.description).toBe('Descricao original preservada')
    expect(finance.activeUserId).toBe('user-a')
    expect(finance.state.wishlist).toHaveLength(1)
    expect(finance.state.wishlist[0]).not.toHaveProperty('user_id')
  })

  it('keeps link-created items saved locally when the remote product function fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createProductFromUrl.mockRejectedValue(Object.assign(
      new Error('Nao conseguimos confirmar que o anuncio encontrado e o mesmo produto do link informado.'),
      { status: 409 },
    ))
    const workflow = usePurchaseWorkflow()
    const finance = useFinanceStore()

    try {
      const item = await workflow.addProductFromUrl('https://www.amazon.com.br/dp/B0B3BHT71L?tag=tracking', {
        category: 'Automotivo',
        priority: 'Alta',
      })

      expect(item).toMatchObject({
        name: 'Amazon B0B3BHT71L',
        marketplace: 'Amazon',
        canonicalUrl: 'https://www.amazon.com.br/dp/B0B3BHT71L',
        identity_locked: true,
        priceStatus: 'pending_quote',
      })
      expect(finance.state.wishlist).toHaveLength(1)
      expect(JSON.parse(localStorage.getItem(finance.getStorageKey())).wishlist).toHaveLength(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})
