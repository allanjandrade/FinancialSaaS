import { describe, expect, it } from 'vitest'
import {
  parseProductText,
  parseReceiptText,
} from '../../supabase/functions/_shared/deterministic-ocr.ts'

describe('deterministic OCR parsing', () => {
  it('extracts core receipt fields without a generative model', () => {
    const result = parseReceiptText(`
      Mercado Central Ltda
      CNPJ 12.345.678/0001-90
      Data 10/06/2026
      Pagamento PIX
      Valor total R$ 123,45
    `)

    expect(result.estabelecimento).toBe('Mercado Central Ltda')
    expect(result.valor).toBe(123.45)
    expect(result.data).toBe('2026-06-10')
    expect(result.metodo).toBe('Pix')
    expect(result.categoria).toBe('Mercado')
  })

  it('extracts product name and price before AI fallback', () => {
    const result = parseProductText(`
      Mercado Livre
      Smartphone Samsung Galaxy A55 256GB
      R$ 1.899,90
    `)

    expect(result.nome).toContain('Smartphone Samsung')
    expect(result.valor).toBe(1899.9)
    expect(result.marketplace).toBe('Mercado Livre')
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })
})
