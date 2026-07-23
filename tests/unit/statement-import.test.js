import { describe, expect, it } from 'vitest'
import {
  parseStatementFile,
  parseStatementCsv,
  parseStatementText,
} from '@/utils/statement-import.js'

describe('statement import parser', () => {
  it('normalizes CSV statement rows into income and expense drafts', () => {
    const rows = parseStatementCsv(`
Data;Descricao;Valor
01/06/2026;PIX MERCADO CENTRAL;-123,45
02/06/2026;SALARIO ACME;3.500,00
03/06/2026;Saldo do dia;4.000,00
`)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      date: '2026-06-01',
      description: 'PIX MERCADO CENTRAL',
      kind: 'expense',
    })
    expect(rows[0].amount).toBeCloseTo(123.45)
    expect(rows[1]).toMatchObject({
      date: '2026-06-02',
      description: 'SALARIO ACME',
      kind: 'income',
    })
    expect(rows[1].amount).toBeCloseTo(3500)
  })

  it('parses OCR text extracted from PDF or image statements', () => {
    const rows = parseStatementText(`
      04/06/2026 PIX PADARIA -18,90
      05/06/2026 TED CLIENTE 980,00 C
      06/06/2026 TARIFA PACOTE 39,90 D
    `)

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.kind)).toEqual(['expense', 'income', 'expense'])
    expect(rows[0]).toMatchObject({ date: '2026-06-04', description: 'PIX PADARIA' })
    expect(rows[1]).toMatchObject({ date: '2026-06-05', description: 'TED CLIENTE' })
    expect(rows[2]).toMatchObject({ date: '2026-06-06', description: 'TARIFA PACOTE' })
    expect(rows[2].amount).toBeCloseTo(39.9)
  })

  it('falls back to remote OCR rows when local image text extraction is empty', async () => {
    const file = new File(['image-bytes'], 'extrato.png', { type: 'image/png' })
    const rows = await parseStatementFile(file, {
      fetchOcr: async () => ({
        rows: [
          { date: '2026-06-07', description: 'PIX FARMACIA', amount: 72.45, kind: 'expense' },
          { date: '2026-06-08', description: 'PIX RECEBIDO CLIENTE', amount: 180, kind: 'income' },
        ],
      }),
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-06-07', description: 'PIX FARMACIA', kind: 'expense' })
    expect(rows[1]).toMatchObject({ date: '2026-06-08', description: 'PIX RECEBIDO CLIENTE', kind: 'income' })
  })
})
