import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const purchaseNew = () => fs.readFileSync('src/views/PurchaseNew.vue', 'utf8')
const wishlist = () => fs.readFileSync('src/views/PurchaseWishlist.vue', 'utf8')
const detail = () => fs.readFileSync('src/views/PurchaseDetail.vue', 'utf8')

describe('product search UX contract', () => {
  it('PurchaseNew auto-detects pasted product links without losing the input value', () => {
    const source = purchaseNew()

    expect(source).toContain('Descreva o produto ou cole um link')
    expect(source).toContain('watch(inputValue')
    expect(source).toContain('detectInputMode')
    expect(source).toContain("mode.value = 'link'")
    expect(source).toContain('function setMode(nextMode, options = {})')
    expect(source).toContain("if (!options.keepInput) inputValue.value = ''")
  })

  it('PurchaseNew treats pending quotes as an actionable search state', () => {
    const source = purchaseNew()

    expect(source).toContain('Tenho um preço agora')
    expect(source).toContain('Buscando nas fontes de preço')
    expect(source).toContain('Salvar e continuar monitorando')
    expect(source).not.toContain('Não precisa informar valor manualmente')
  })

  it('PurchaseNew shows Buscape-style immediate result cards while typing', () => {
    const source = purchaseNew()

    expect(source).toContain('searchResults')
    expect(source).toContain('scheduleTextSearch')
    expect(source).toContain('saveSelectedResult')
    expect(source).toContain('class="result-card"')
    expect(source).toContain('@click="saveSelectedResult(result)"')
    expect(source).toContain('Resultados encontrados')
    expect(source).not.toContain('Cotando online')
  })

  it('PurchaseNew starts text search without an artificial debounce delay', () => {
    const source = purchaseNew()

    expect(source).toContain('function scheduleTextSearch(value)')
    expect(source).toContain('runTextSearch(query, runId)')
    expect(source).not.toContain('setTimeout')
    expect(source).not.toContain('clearTimeout')
  })

  it('PurchaseWishlist uses human product-search labels instead of technical AI labels', () => {
    const source = wishlist()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain('productSearchStatus(item)')
    expect(source).not.toContain('Status IA')
    expect(source).not.toContain('Aguardando cotação compatível')
    expect(source).not.toContain('Compatibilidade pendente')
  })

  it('PurchaseWishlist answers whether the user can buy with real financial simulation', () => {
    const source = wishlist()

    expect(source).toContain("from '@/utils/wishlist-decision.js'")
    expect(source).toContain("from '@/utils/purchase-link.js'")
    expect(source).toContain('buildWishlistPurchaseSimulation')
    expect(source).toContain('data-testid="wishlist-purchase-decision"')
    expect(source).toContain('data-testid="wishlist-buy-link"')
    expect(source).toContain('Cotação pendente')
    expect(source).not.toContain('Simulacao preparada')
  })

  it('PurchaseDetail exposes product, price, offers, compatibility and financial decision sections', () => {
    const source = detail()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain("from '@/utils/purchase-link.js'")
    expect(source).toContain('Produto')
    expect(source).toContain('Preço')
    expect(source).toContain('Ofertas')
    expect(source).toContain('Compatibilidade')
    expect(source).toContain('Decisão financeira')
    expect(source).toContain('data-testid="purchase-detail-buy-link"')
    expect(source).not.toContain('Pendente de cotação compatível')
  })
})
