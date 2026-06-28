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

  it('PurchaseWishlist uses human product-search labels instead of technical AI labels', () => {
    const source = wishlist()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain('productSearchStatus(item)')
    expect(source).not.toContain('Status IA')
    expect(source).not.toContain('Aguardando cotacao compativel')
    expect(source).not.toContain('Compatibilidade pendente')
  })

  it('PurchaseDetail exposes product, price, offers, compatibility and financial decision sections', () => {
    const source = detail()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain('Produto')
    expect(source).toContain('Preco')
    expect(source).toContain('Ofertas')
    expect(source).toContain('Compatibilidade')
    expect(source).toContain('Decisao financeira')
    expect(source).not.toContain('Pendente de cotacao compativel')
  })
})
