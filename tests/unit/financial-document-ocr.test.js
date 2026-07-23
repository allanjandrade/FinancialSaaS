import { describe, expect, it, vi } from 'vitest'
import {
  DOCUMENT_REVIEW_STATES,
  buildEntryPayloadFromDocumentDraft,
  extractFinancialDocumentDraft,
} from '@/utils/financial-document-ocr.js'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'

describe('financial document OCR review flow', () => {
  it('turns successful receipt OCR into an assisted review draft without saving', async () => {
    const file = new File(['cupom'], 'mercado.jpg', { type: 'image/jpeg' })
    const draft = await extractFinancialDocumentDraft(file, {
      fetchReceiptOcr: vi.fn(async () => ({
        tipo: 'despesa',
        valor: 123.45,
        data: '2026-06-10',
        estabelecimento: 'Mercado Central',
        categoria: 'Mercado',
        metodo: 'Pix',
        confianca: 91,
        tipoDocumento: 'comprovante',
        ocrProvider: 'Gemini',
      })),
    })

    expect(draft).toMatchObject({
      mode: 'document',
      reviewState: DOCUMENT_REVIEW_STATES.REVIEW_PENDING,
      type: 'expense',
      amount: 123.45,
      date: '2026-06-10',
      origin: 'Mercado Central',
      category: 'Mercado',
      paymentMethod: 'Pix',
      confidence: 91,
      autoSave: false,
      fileName: 'mercado.jpg',
    })
    expect(draft.pendingFields).toEqual([])
  })

  it('opens a manual review draft when OCR fails', async () => {
    const file = new File(['bytes'], 'comprovante.png', { type: 'image/png' })
    const draft = await extractFinancialDocumentDraft(file, {
      fetchReceiptOcr: vi.fn(async () => {
        throw new Error('OCR indisponível')
      }),
      parseStatementFile: vi.fn(async () => []),
    })

    expect(draft).toMatchObject({
      mode: 'document',
      reviewState: DOCUMENT_REVIEW_STATES.REVIEW_PENDING,
      manualFallback: true,
      confidence: 0,
      autoSave: false,
      friendlyError: 'Não foi possível ler o documento. Revise e preencha os campos pendentes antes de salvar.',
    })
    expect(draft.pendingFields).toEqual(expect.arrayContaining(['amount', 'origin', 'category', 'paymentMethod']))
  })

  it('uses deterministic PDF statement parsing as fallback before manual review', async () => {
    const file = new File(['pdf'], 'extrato.pdf', { type: 'application/pdf' })
    const draft = await extractFinancialDocumentDraft(file, {
      fetchReceiptOcr: vi.fn(async () => {
        throw new Error('IA indisponível')
      }),
      parseStatementFile: vi.fn(async () => [
        {
          date: '2026-06-05',
          description: 'SALARIO ACME',
          amount: 3500,
          kind: 'income',
          confidence: 88,
        },
      ]),
    })

    expect(draft).toMatchObject({
      mode: 'document',
      type: 'income',
      amount: 3500,
      date: '2026-06-05',
      origin: 'SALARIO ACME',
      description: 'SALARIO ACME',
      category: 'Outros',
      paymentMethod: 'Transferencia',
      confidence: 88,
      fallbackSource: 'deterministic_pdf',
    })
  })

  it('keeps manual edits authoritative when building the financial entry payload', () => {
    const payload = buildEntryPayloadFromDocumentDraft(
      {
        type: 'expense',
        date: '2026-06-10',
        amount: 123.45,
        category: 'Mercado',
        paymentMethod: 'Pix',
        origin: 'Mercado Central',
        sourceType: SOURCE_TYPES.ACCOUNT,
        sourceId: 'acc-1',
        confidence: 91,
        documentType: 'comprovante',
        provider: 'Gemini',
      },
      {
        amount: 99.9,
        category: 'Saude',
        paymentMethod: 'Debito',
        description: 'Farmacia revisada',
      },
    )

    expect(payload).toMatchObject({
      kind: 'expense',
      amount: 99.9,
      category: 'Saude',
      payment: 'Debito',
      description: 'Farmacia revisada',
      sourceType: SOURCE_TYPES.ACCOUNT,
      sourceId: 'acc-1',
      ocrProvider: 'Gemini',
      ocrConfidence: 91,
      ocrTipoDocumento: 'comprovante',
    })
  })

  it('marks credit card document drafts as unpaid expenses for invoice competency', () => {
    const payload = buildEntryPayloadFromDocumentDraft({
      type: 'card',
      date: '2026-06-18',
      amount: 240,
      category: 'Mercado',
      paymentMethod: 'Credito',
      origin: 'Mercado no cartao',
      sourceType: SOURCE_TYPES.CREDIT_CARD,
      sourceId: 'card-1',
      confidence: 86,
    })

    expect(payload).toMatchObject({
      kind: 'expense',
      payment: 'Credito',
      sourceType: SOURCE_TYPES.CREDIT_CARD,
      sourceId: 'card-1',
      paid: false,
    })
  })
})
