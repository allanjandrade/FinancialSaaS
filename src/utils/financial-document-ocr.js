import { normalizeReceiptData } from '@/utils/ai-receipt.js'
import { fetchReceiptOcr as defaultFetchReceiptOcr } from '@/utils/receipt-ocr-api.js'
import { parseStatementFile as defaultParseStatementFile } from '@/utils/statement-import.js'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'

export const DOCUMENT_REVIEW_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  EXTRACTING: 'extracting',
  ERROR: 'error',
  REVIEW_PENDING: 'review_pending',
  READY_TO_SAVE: 'ready_to_save',
  SAVED: 'saved',
}

export const FINANCIAL_DOCUMENT_ACCEPT = '.csv,text/csv,.pdf,application/pdf,image/jpeg,image/png,image/webp'

const MANUAL_ERROR = 'Não foi possível ler o documento. Revise e preencha os campos pendentes antes de salvar.'

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function positiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeType(value, fallback = 'expense') {
  const text = stripAccents(value)
  if (text.includes('transfer')) return 'transfer'
  if (text.includes('benef') || /\bva\b|\bvr\b/.test(text)) return 'benefit'
  if (text.includes('cartao') || text.includes('fatura')) return 'card'
  if (text.includes('receita') || text.includes('income') || text.includes('salario') || text.includes('holerite')) return 'income'
  if (text.includes('despesa') || text.includes('expense') || text.includes('boleto') || text.includes('nota')) return 'expense'
  return fallback
}

function normalizePayment(value, type) {
  const text = stripAccents(value)
  if (text === 'va' || text.includes('vale aliment')) return 'VA'
  if (text === 'vr' || text.includes('vale refei')) return 'VR'
  if (text.includes('credito') || type === 'card') return 'Credito'
  if (text.includes('debito')) return 'Debito'
  if (text.includes('boleto')) return 'Boleto'
  if (text.includes('dinheiro')) return 'Dinheiro'
  if (text.includes('pix')) return 'Pix'
  if (text.includes('transfer')) return 'Transferencia'
  return type === 'income' || type === 'benefit' ? 'Transferencia' : ''
}

function sourceTypeForDraft(type, paymentMethod, explicitSourceType = '') {
  if (explicitSourceType) return explicitSourceType
  if (type === 'card' || stripAccents(paymentMethod).includes('credito')) return SOURCE_TYPES.CREDIT_CARD
  if (paymentMethod === 'VA') return SOURCE_TYPES.BENEFIT_VA
  if (paymentMethod === 'VR') return SOURCE_TYPES.BENEFIT_VR
  return SOURCE_TYPES.ACCOUNT
}

function isDeferredExpensePayment(paymentMethod, sourceType) {
  const payment = stripAccents(paymentMethod)
  return sourceType === SOURCE_TYPES.CREDIT_CARD || payment.includes('credito') || payment.includes('boleto')
}

function pendingFieldsFor(draft) {
  return [
    ['type', draft.type],
    ['amount', draft.amount],
    ['date', draft.date],
    ['origin', draft.origin || draft.description],
    ['category', draft.category],
    ['paymentMethod', draft.paymentMethod],
  ]
    .filter(([, value]) => value == null || value === '' || value === 0)
    .map(([field]) => field)
}

function baseDraft(file, patch = {}) {
  const type = normalizeType(patch.type || patch.tipo || patch.kind, 'expense')
  const paymentMethod = normalizePayment(patch.paymentMethod || patch.payment || patch.metodo || patch.metodo_pagamento, type)
  const draft = {
    mode: 'document',
    reviewState: DOCUMENT_REVIEW_STATES.REVIEW_PENDING,
    autoSave: false,
    manualFallback: Boolean(patch.manualFallback),
    file,
    fileName: file?.name || patch.fileName || 'documento',
    mimeType: file?.type || patch.mimeType || 'application/octet-stream',
    type,
    amount: positiveNumber(patch.amount ?? patch.valor),
    date: patch.date || patch.data || new Date().toISOString().split('T')[0],
    origin: patch.origin || patch.estabelecimento || patch.origem || patch.description || patch.descricao || '',
    description: patch.description || patch.descricao || patch.origin || patch.estabelecimento || patch.origem || '',
    category: patch.category || patch.categoria || (type === 'income' || type === 'benefit' ? 'Outros' : ''),
    paymentMethod,
    sourceType: sourceTypeForDraft(type, paymentMethod, patch.sourceType),
    sourceId: patch.sourceId || '',
    relatedId: patch.relatedId || '',
    confidence: Number(patch.confidence ?? patch.confianca ?? 0),
    provider: patch.provider || patch.ocrProvider || patch.fallbackSource || 'OCR',
    documentType: patch.documentType || patch.tipoDocumento || patch.tipo_documento || '',
    fallbackSource: patch.fallbackSource || '',
    friendlyError: patch.friendlyError || '',
    raw: patch.raw || null,
  }
  draft.pendingFields = pendingFieldsFor(draft)
  return draft
}

export function createManualDocumentDraft(file, reason = '') {
  return baseDraft(file, {
    manualFallback: true,
    amount: null,
    date: new Date().toISOString().split('T')[0],
    origin: '',
    category: '',
    paymentMethod: '',
    confidence: 0,
    provider: 'Manual',
    documentType: 'Preenchimento manual',
    friendlyError: MANUAL_ERROR,
    raw: { reason },
  })
}

function draftFromReceipt(file, raw) {
  const normalized = normalizeReceiptData(raw || {})
  const type = normalizeType(raw?.tipo || raw?.tipoDocumento || raw?.tipo_documento, 'expense')
  return baseDraft(file, {
    ...normalized,
    type,
    origin: normalized.estabelecimento,
    description: normalized.estabelecimento,
    amount: normalized.valor,
    date: normalized.data,
    category: normalized.categoria,
    paymentMethod: normalized.metodo,
    confidence: raw?.confianca ?? raw?.confidence ?? 0,
    provider: raw?.ocrProvider || raw?.provider || 'OCR',
    documentType: raw?.tipoDocumento || raw?.tipo_documento || '',
    raw,
  })
}

function draftFromStatementRow(file, row, fallbackSource) {
  const type = row.kind === 'income' ? 'income' : row.kind === 'transfer' ? 'transfer' : 'expense'
  return baseDraft(file, {
    type,
    amount: row.amount,
    date: row.date,
    origin: row.description,
    description: row.description,
    category: row.category || 'Outros',
    paymentMethod: row.paymentMethod || 'Transferencia',
    confidence: row.confidence ?? 82,
    provider: fallbackSource,
    fallbackSource,
    documentType: 'extrato',
    raw: row,
  })
}

async function parseDeterministicFallback(file, parseStatementFile) {
  try {
    return await parseStatementFile(file)
  } catch {
    return []
  }
}

export async function extractFinancialDocumentDraft(file, options = {}) {
  const fetchReceiptOcr = options.fetchReceiptOcr || defaultFetchReceiptOcr
  const parseStatementFile = options.parseStatementFile || defaultParseStatementFile
  const isPdf = String(file?.type || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
  const isCsv = String(file?.type || '').toLowerCase() === 'text/csv' || /\.csv$/i.test(file?.name || '')

  if (isCsv) {
    const rows = await parseDeterministicFallback(file, parseStatementFile)
    if (rows.length === 1) return draftFromStatementRow(file, rows[0], 'deterministic_csv')
    if (rows.length > 1) {
      return {
        mode: 'statement',
        reviewState: DOCUMENT_REVIEW_STATES.REVIEW_PENDING,
        autoSave: false,
        rows,
        file,
        fileName: file?.name || 'extrato.csv',
      }
    }
    return createManualDocumentDraft(file, 'CSV sem lancamentos reconhecidos')
  }

  try {
    return draftFromReceipt(file, await fetchReceiptOcr(file))
  } catch (error) {
    if (isPdf) {
      const rows = await parseDeterministicFallback(file, parseStatementFile)
      if (rows.length === 1) return draftFromStatementRow(file, rows[0], 'deterministic_pdf')
      if (rows.length > 1) {
        return {
          mode: 'statement',
          reviewState: DOCUMENT_REVIEW_STATES.REVIEW_PENDING,
          autoSave: false,
          rows,
          file,
          fileName: file?.name || 'extrato.pdf',
          fallbackSource: 'deterministic_pdf',
        }
      }
    }
    return createManualDocumentDraft(file, error?.message || 'OCR indisponível')
  }
}

export function buildEntryPayloadFromDocumentDraft(draft, overrides = {}) {
  const type = normalizeType(overrides.type || draft?.type, 'expense')
  const kind = type === 'income' || type === 'benefit' ? 'income' : type === 'transfer' ? 'transfer' : 'expense'
  const payment = overrides.paymentMethod ?? overrides.payment ?? draft?.paymentMethod
  const amount = positiveNumber(overrides.amount ?? draft?.amount)
  const description = overrides.description || draft?.description || draft?.origin || 'Documento revisado'
  const sourceType = overrides.sourceType || draft?.sourceType || sourceTypeForDraft(type, payment)

  return {
    kind,
    date: overrides.date || draft?.date || new Date().toISOString().split('T')[0],
    amount,
    category: overrides.category || draft?.category || 'Outros',
    type: overrides.category || draft?.category || 'Outros',
    payment,
    description,
    sourceType,
    sourceId: overrides.sourceId || draft?.sourceId || '',
    relatedId: overrides.relatedId || draft?.relatedId || '',
    paid: overrides.paid ?? (kind !== 'expense' || !isDeferredExpensePayment(payment, sourceType)),
    ocrProvider: draft?.provider || 'OCR',
    ocrConfidence: draft?.confidence ?? 0,
    ocrDate: new Date().toISOString().split('T')[0],
    ocrTipoDocumento: draft?.documentType || '',
    ocrObservacoes: draft?.friendlyError || '',
  }
}
