import { normalizeExpenseCategory, normalizePaymentMethod } from '@/constants/finance'
import { parseBrDate, parseBrMoney } from '@/utils/ai-receipt.js'

const MAX_XML_BYTES = 1024 * 1024

function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || ''
}

function numberFromXml(node, selector) {
  return parseBrMoney(text(node, selector))
}

export function normalizeReceiptItem(raw = {}) {
  const quantity = Number(raw.quantity ?? raw.quantidade ?? 1)
  const totalPrice = Number(raw.totalPrice ?? raw.preco_total ?? raw.total ?? 0)
  const unitPrice = Number(raw.unitPrice ?? raw.preco_unitario ?? raw.unit_price ?? 0)
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  const safeTotal = Number.isFinite(totalPrice) && totalPrice > 0
    ? totalPrice
    : unitPrice * safeQuantity
  const safeUnit = Number.isFinite(unitPrice) && unitPrice > 0
    ? unitPrice
    : safeTotal / safeQuantity

  return {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: String(raw.name ?? raw.nome ?? raw.productName ?? '').trim(),
    category: normalizeExpenseCategory(raw.category || raw.categoria || 'Mercado'),
    quantity: safeQuantity,
    unit: String(raw.unit ?? raw.unidade ?? 'un').trim() || 'un',
    unitPrice: Number(safeUnit.toFixed(4)),
    totalPrice: Number(safeTotal.toFixed(2)),
    barcode: String(raw.barcode ?? raw.codigo_barras ?? raw.ean ?? '').trim(),
  }
}

export function normalizeReceiptDraft(raw = {}) {
  const items = Array.isArray(raw.items || raw.itens)
    ? (raw.items || raw.itens).map(normalizeReceiptItem).filter((item) => item.name && item.totalPrice > 0)
    : []
  const itemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const total = parseBrMoney(raw.total ?? raw.valor ?? raw.valorTotal) || itemsTotal || null
  const date = parseBrDate(raw.purchaseDate || raw.data || raw.data_compra) || new Date().toISOString().split('T')[0]

  return {
    receiptKey: String(raw.receiptKey || raw.chave || raw.chave_acesso || '').replace(/\D/g, ''),
    establishmentName: String(raw.establishmentName || raw.estabelecimento || raw.nome_estabelecimento || '').trim(),
    cnpj: String(raw.cnpj || raw.establishmentCnpj || '').replace(/\D/g, ''),
    purchaseDate: date,
    total,
    paymentMethod: normalizePaymentMethod(raw.paymentMethod || raw.metodo || raw.forma_pagamento || 'Transferencia'),
    sourceDocument: raw.sourceDocument || '',
    source: raw.source || 'receipt_import',
    confidence: Number(raw.confidence ?? raw.confianca ?? 0),
    items,
  }
}

export function receiptDuplicateKey(draft) {
  const date = draft.purchaseDate || ''
  const total = draft.total ? Number(draft.total).toFixed(2) : '0.00'
  if (draft.receiptKey) return `key:${draft.receiptKey}`
  return `fingerprint:${draft.cnpj || 'sem-cnpj'}:${date}:${total}`
}

export function parseNfceXml(xmlText) {
  const source = String(xmlText || '')
  if (source.length > MAX_XML_BYTES) throw new Error('XML muito grande')
  if (/<!doctype\b|<!entity\b/i.test(source)) throw new Error('XML invalido')

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) throw new Error('XML invalido')

  const infNFe = doc.querySelector('infNFe')
  const ide = doc.querySelector('ide')
  const emit = doc.querySelector('emit')
  const total = doc.querySelector('ICMSTot')
  const pag = doc.querySelector('pag detPag') || doc.querySelector('detPag')
  const receiptKey = infNFe?.getAttribute('Id')?.replace(/^NFe/i, '') || text(doc, 'chNFe')
  const rawDate = text(ide || doc, 'dhEmi') || text(ide || doc, 'dEmi')
  const paymentCode = text(pag || doc, 'tPag')

  const items = [...doc.querySelectorAll('det')].map((det) => {
    const prod = det.querySelector('prod') || det
    return normalizeReceiptItem({
      name: text(prod, 'xProd'),
      barcode: text(prod, 'cEAN') || text(prod, 'cProd'),
      quantity: numberFromXml(prod, 'qCom'),
      unit: text(prod, 'uCom') || 'un',
      unitPrice: numberFromXml(prod, 'vUnCom'),
      totalPrice: numberFromXml(prod, 'vProd'),
      category: 'Mercado',
    })
  })

  return normalizeReceiptDraft({
    receiptKey,
    establishmentName: text(emit || doc, 'xNome'),
    cnpj: text(emit || doc, 'CNPJ'),
    purchaseDate: rawDate,
    total: numberFromXml(total || doc, 'vNF'),
    paymentMethod: paymentMethodFromNfceCode(paymentCode),
    sourceDocument: 'xml',
    source: 'receipt_import',
    confidence: 100,
    items,
  })
}

export function paymentMethodFromNfceCode(code) {
  const normalized = String(code || '').trim()
  const map = {
    '01': 'Dinheiro',
    '03': 'Credito',
    '04': 'Debito',
    '10': 'VA',
    '11': 'VR',
    '17': 'Pix',
  }
  return map[normalized] || 'Transferencia'
}

export function normalizeProductName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function findMatchingProduct(products, item) {
  if (item.barcode) {
    const barcodeMatch = products.find((product) => product.barcode && product.barcode === item.barcode)
    if (barcodeMatch) return barcodeMatch
  }

  const target = normalizeProductName(item.name)
  if (!target) return null
  return products.find((product) => {
    const candidate = normalizeProductName(product.name)
    if (!candidate) return false
    return candidate === target || candidate.includes(target) || target.includes(candidate)
  }) || null
}
