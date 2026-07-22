import { describe, expect, it } from 'vitest'
import { parseNfceXml, receiptDuplicateKey } from '@/utils/market-receipt-import.js'

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35260612345678000190550010000000011000000010">
      <ide><dhEmi>2026-06-02T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000190</CNPJ><xNome>Mercado Teste</xNome></emit>
      <det nItem="1">
        <prod>
          <cProd>7891</cProd><cEAN>7891000000011</cEAN><xProd>Cafe 500g</xProd>
          <qCom>2.0000</qCom><uCom>UN</uCom><vUnCom>18.90</vUnCom><vProd>37.80</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>1002</cProd><xProd>Arroz 5kg</xProd>
          <qCom>1.0000</qCom><uCom>UN</uCom><vUnCom>24.50</vUnCom><vProd>24.50</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>62.30</vNF></ICMSTot></total>
      <pag><detPag><tPag>17</tPag></detPag></pag>
    </infNFe>
  </NFe>
</nfeProc>`

describe('market-receipt-import', () => {
  it('extrai dados e itens de XML NFC-e', () => {
    const draft = parseNfceXml(xml)

    expect(draft.establishmentName).toBe('Mercado Teste')
    expect(draft.cnpj).toBe('12345678000190')
    expect(draft.receiptKey).toBe('35260612345678000190550010000000011000000010')
    expect(draft.paymentMethod).toBe('Pix')
    expect(draft.total).toBe(62.3)
    expect(draft.items).toHaveLength(2)
    expect(draft.items[0]).toMatchObject({
      name: 'Cafe 500g',
      quantity: 2,
      unitPrice: 18.9,
      totalPrice: 37.8,
      barcode: '7891000000011',
    })
  })

  it('gera chave de duplicidade por chave da nota', () => {
    const draft = parseNfceXml(xml)
    expect(receiptDuplicateKey(draft)).toBe('key:35260612345678000190550010000000011000000010')
  })

  it('rejeita XML com DTD ou ENTITY antes de chamar o parser', () => {
    expect(() => parseNfceXml(`<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`))
      .toThrow(/XML invalido/)
  })

  it('rejeita XML grande demais antes de processar', () => {
    expect(() => parseNfceXml(`<nfeProc>${' '.repeat(1024 * 1024 + 1)}</nfeProc>`))
      .toThrow(/XML muito grande/)
  })
})
