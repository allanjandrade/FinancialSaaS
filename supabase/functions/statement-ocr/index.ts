import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  assertBase64Size,
  authErrorDetails,
  requireAuthenticatedUser,
} from '../_shared/auth.ts'
import { extractTextWithConfiguredOcr } from '../_shared/deterministic-ocr.ts'

type StatementRow = {
  date: string
  description: string
  amount: number
  kind: 'income' | 'expense'
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = value.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})\b/)
  if (!br) return null
  const year = br[3].length === 2 ? `20${br[3]}` : br[3]
  return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
}

function parseMoney(value: unknown): number | null {
  const match = String(value || '').match(/\(?-?\s*(?:R\$\s*)?\d[\d.,]*\)?/)
  if (!match) return null
  let s = match[0]
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[()]/g, '')
    .replace(/[^\d,.-]/g, '')
  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (comma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const parsed = Math.abs(Number(s))
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null
}

function moneySign(value: string): number {
  return /[-−]/.test(value) || /\(.+\)/.test(value) ? -1 : 1
}

function moneyTokens(line: string): string[] {
  return [...line.matchAll(/(?:R\$\s*)?\(?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?\s*(?:[CD])?|(?:R\$\s*)?\(?-?\s*\d+,\d{2}\)?\s*(?:[CD])?|(?:R\$\s*)?\(?-?\s*\d+\.\d{2}\)?\s*(?:[CD])?/gi)]
    .map((match) => match[0].trim())
}

function inferKind(line: string, signedAmount: number): 'income' | 'expense' {
  const normalized = normalizeText(line)
  if (signedAmount < 0) return 'expense'
  if (/\b(?:d|db|debito|debit|saida|pagamento|compra|tarifa|saque)\b/.test(normalized)) return 'expense'
  return 'income'
}

function cleanDescription(line: string): string {
  return line
    .replace(/\b\d{1,2}[/. -]\d{1,2}(?:[/. -]\d{2,4})?\b/g, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d+,\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d+\.\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/\b(?:c|d|cr|db)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Movimentacao de extrato'
}

function parseRowsFromText(text: string): StatementRow[] {
  const rows = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => {
      const date = parseDate(line)
      const amountToken = moneyTokens(line).at(-1)
      const amount = parseMoney(amountToken)
      if (!date || !amount) return null
      const signedAmount = moneySign(amountToken || '') * amount
      return {
        date,
        description: cleanDescription(line),
        amount,
        kind: inferKind(line, signedAmount),
      }
    })
    .filter((row): row is StatementRow => Boolean(row))

  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.date}|${row.kind}|${row.amount}|${normalizeText(row.description)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeAiRows(value: unknown): StatementRow[] {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray((value as Record<string, unknown>)?.rows)
      ? (value as Record<string, unknown>).rows
      : []

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return null
    const record = row as Record<string, unknown>
    const date = parseDate(String(record.date || record.data || ''))
    const amount = parseMoney(record.amount ?? record.valor)
    const description = cleanDescription(String(record.description || record.descricao || record.historico || ''))
    const kindText = normalizeText(record.kind || record.tipo || record.natureza)
    const kind = kindText.includes('expense') || kindText.includes('despesa') || kindText.includes('debito')
      ? 'expense'
      : 'income'
    return date && amount ? { date, description, amount, kind } : null
  }).filter((row): row is StatementRow => Boolean(row))
}

async function extractRowsWithGemini(cleanBase64: string, mimeType: string): Promise<StatementRow[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return []

  const prompt = [
    'Extraia lancamentos de extrato bancario brasileiro.',
    'Retorne somente JSON valido no formato {"rows":[{"date":"YYYY-MM-DD","description":"texto","amount":123.45,"kind":"income|expense"}]}.',
    'Use expense para debitos, compras, tarifas, pagamentos e valores negativos.',
    'Use income para creditos, depositos, salario, PIX recebido e entradas.',
    'Ignore saldo, total, cabecalho, rodape, limite e informacoes da conta.',
  ].join(' ')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: cleanBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(45000),
    },
  )

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    console.warn('[statement-ocr] Gemini error:', response.status, data)
    return []
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    return normalizeAiRows(JSON.parse(text))
  } catch {
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo nao permitido', 405)
  }

  try {
    await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const cleanBase64 = String(body.fileBase64 || body.imagemBase64 || '').split(',').pop() || ''
    const mimeType = String(body.mimeType || 'image/jpeg')
    const extractedText = String(body.extractedText || '').trim()

    if (!cleanBase64) {
      return errorResponse('Arquivo obrigatorio', 400)
    }

    assertBase64Size(cleanBase64)

    const deterministicText = extractedText || await extractTextWithConfiguredOcr(cleanBase64, mimeType).catch(() => '')
    const deterministicRows = parseRowsFromText(deterministicText)
    if (deterministicRows.length) {
      return jsonResponse({ rows: deterministicRows, provider: 'deterministic' })
    }

    const aiRows = await extractRowsWithGemini(cleanBase64, mimeType)
    if (aiRows.length) {
      return jsonResponse({ rows: aiRows, provider: 'gemini' })
    }

    return errorResponse('Nenhum lancamento foi reconhecido no extrato', 422)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return errorResponse('Erro ao processar extrato', 500, message)
  }
})
