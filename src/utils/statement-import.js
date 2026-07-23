import { extractNativeDocumentText } from './native-document-extraction.js'
import { fetchStatementOcr } from './statement-ocr-api.js'

export const STATEMENT_FILE_ACCEPT = '.csv,text/csv,.pdf,application/pdf,image/jpeg,image/png,image/webp'

const DATE_HEADERS = ['data', 'date', 'dt', 'lancamento', 'movimento']
const DESCRIPTION_HEADERS = ['descricao', 'descrição', 'historico', 'histórico', 'memo', 'detalhe', 'favorecido']
const AMOUNT_HEADERS = ['valor', 'amount', 'montante']
const DEBIT_HEADERS = ['debito', 'débito', 'debit', 'saida', 'saída', 'retirada']
const CREDIT_HEADERS = ['credito', 'crédito', 'credit', 'entrada', 'recebido']
const TYPE_HEADERS = ['tipo', 'natureza', 'operacao', 'operação']

const IGNORE_LINE = /\b(?:saldo|total|limite|agencia|agência|conta|extrato|periodo|período|pagina|página)\b/i
const DEBIT_HINT = /\b(?:d|db|debito|débito|debit|saida|saída|pagamento|compra|tarifa|saque)\b/i
const CREDIT_HINT = /\b(?:c|cr|credito|crédito|credit|entrada|recebido|salario|salário|deposito|depósito|ted recebido|pix recebido)\b/i

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLines(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function countDelimiter(line, delimiter) {
  let count = 0
  let quoted = false
  for (const char of String(line || '')) {
    if (char === '"') quoted = !quoted
    else if (!quoted && char === delimiter) count += 1
  }
  return count
}

function detectDelimiter(line) {
  const candidates = [';', ',', '\t']
  return candidates
    .map((delimiter) => ({ delimiter, count: countDelimiter(line, delimiter) }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ';'
}

function splitDelimitedLine(line, delimiter) {
  const cells = []
  let cell = ''
  let quoted = false
  const chars = String(line || '').split('')

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]
    const next = chars[i + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      i += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && char === delimiter) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += char
  }

  cells.push(cell.trim())
  return cells
}

function findColumn(headers, names, reject = []) {
  const normalizedNames = names.map(normalizeText)
  const normalizedReject = reject.map(normalizeText)
  return headers.findIndex((header) => {
    const normalized = normalizeText(header)
    if (normalizedReject.some((item) => normalized.includes(item))) return false
    return normalizedNames.some((name) => normalized === name || normalized.includes(name))
  })
}

function parseDate(value, fallbackYear) {
  const source = String(value || '').trim()
  const iso = source.match(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = source.match(/\b(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{2,4}))?\b/)
  if (!br) return null

  const day = br[1].padStart(2, '0')
  const month = br[2].padStart(2, '0')
  const rawYear = br[3] || fallbackYear
  if (!rawYear) return null
  const year = String(rawYear).length === 2 ? `20${rawYear}` : String(rawYear)
  return `${year}-${month}-${day}`
}

function inferFallbackYear(text) {
  return String(text || '').match(/\b(20\d{2}|19\d{2})\b/)?.[1] || new Date().getFullYear()
}

function parseAbsMoney(value) {
  const match = String(value || '').match(/\(?-?\s*(?:R\$\s*)?\d[\d.,]*\)?/)
  if (!match) return null

  let s = match[0]
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[()]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!s || s === '-' || s === ',') return null

  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    s = comma > dot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (comma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }

  const parsed = Math.abs(Number(s))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function moneySign(value) {
  const raw = String(value || '')
  if (/[-−]/.test(raw) || /\(.+\)/.test(raw)) return -1
  return 1
}

function findMoneyTokens(line) {
  return [...String(line || '').matchAll(/(?:R\$\s*)?\(?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?\s*(?:[CD])?|(?:R\$\s*)?\(?-?\s*\d+,\d{2}\)?\s*(?:[CD])?|(?:R\$\s*)?\(?-?\s*\d+\.\d{2}\)?\s*(?:[CD])?/gi)]
    .map((match) => match[0].trim())
}

function inferDirection(context, signedAmount) {
  if (signedAmount < 0) return 'expense'
  const normalized = normalizeText(context)
  if (/\b(?:c|cr|credito|credit|entrada|recebido)\b/.test(normalized)) return 'income'
  if (/\b(?:d|db|debito|debit|saida|pagamento|compra|tarifa|saque)\b/.test(normalized)) return 'expense'
  if (CREDIT_HINT.test(context) && !DEBIT_HINT.test(context)) return 'income'
  if (DEBIT_HINT.test(context)) return 'expense'
  return signedAmount >= 0 ? 'income' : 'expense'
}

function cleanDescription(value) {
  const description = String(value || '')
    .replace(/\b\d{1,2}[/. -]\d{1,2}(?:[/. -]\d{2,4})?\b/g, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d+,\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/(?:R\$\s*)?\(?-?\s*\d+\.\d{2}\)?\s*(?:[CD])?/gi, ' ')
    .replace(/\b(?:c|d|cr|db)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return description || 'Movimentação de extrato'
}

function shouldIgnore(description, raw) {
  const text = `${description} ${raw}`
  if (!description || description === 'Movimentação de extrato') return false
  if (!IGNORE_LINE.test(text)) return false
  return !/\b(?:pix|ted|doc|boleto|compra|pagamento|deposito|depósito|salario|salário|tarifa)\b/i.test(text)
}

function makeStatementRow({ date, description, signedAmount, raw, index, source }) {
  const direction = inferDirection(raw, signedAmount)
  const amount = Number(Math.abs(signedAmount).toFixed(2))
  if (!date || !amount || shouldIgnore(description, raw)) return null

  return {
    id: `${source}-${date}-${index}-${amount.toFixed(2)}-${normalizeText(description).slice(0, 28)}`,
    date,
    description: description.slice(0, 80),
    amount,
    kind: direction,
    source,
    raw,
    confidence: description ? 92 : 76,
  }
}

function uniqueRows(rows) {
  const seen = new Set()
  return rows.filter((row) => {
    if (!row) return false
    const key = `${row.date}|${row.kind}|${row.amount.toFixed(2)}|${normalizeText(row.description)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseStatementCsv(text) {
  const lines = normalizeLines(text)
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = splitDelimitedLine(lines[0], delimiter)
  const dateIndex = findColumn(headers, DATE_HEADERS)
  const descriptionIndex = findColumn(headers, DESCRIPTION_HEADERS)
  const amountIndex = findColumn(headers, AMOUNT_HEADERS, ['saldo'])
  const debitIndex = findColumn(headers, DEBIT_HEADERS)
  const creditIndex = findColumn(headers, CREDIT_HEADERS)
  const typeIndex = findColumn(headers, TYPE_HEADERS)
  const fallbackYear = inferFallbackYear(text)

  const rows = lines.slice(1).map((line, index) => {
    const cells = splitDelimitedLine(line, delimiter)
    const raw = cells.join(' ')
    const date = parseDate(dateIndex >= 0 ? cells[dateIndex] : raw, fallbackYear)
    const description = cleanDescription(descriptionIndex >= 0 ? cells[descriptionIndex] : raw)
    const typeHint = typeIndex >= 0 ? cells[typeIndex] : ''

    const debitAmount = debitIndex >= 0 ? parseAbsMoney(cells[debitIndex]) : null
    const creditAmount = creditIndex >= 0 ? parseAbsMoney(cells[creditIndex]) : null
    const amountCell = amountIndex >= 0 ? cells[amountIndex] : findMoneyTokens(raw).at(-1)
    const amount = parseAbsMoney(amountCell)

    let signedAmount = null
    if (creditAmount != null) signedAmount = creditAmount
    else if (debitAmount != null) signedAmount = -debitAmount
    else if (amount != null) signedAmount = amount * moneySign(amountCell)
    if (signedAmount == null) return null

    const context = `${raw} ${typeHint}`
    const direction = inferDirection(context, signedAmount)
    signedAmount = direction === 'expense' ? -Math.abs(signedAmount) : Math.abs(signedAmount)

    return makeStatementRow({
      date,
      description,
      signedAmount,
      raw,
      index,
      source: 'csv',
    })
  })

  return uniqueRows(rows)
}

export function parseStatementText(text) {
  const lines = normalizeLines(text)
  const fallbackYear = inferFallbackYear(text)
  const rows = lines.map((line, index) => {
    const date = parseDate(line, fallbackYear)
    if (!date) return null
    const tokens = findMoneyTokens(line)
    const amountToken = tokens.at(-1)
    const amount = parseAbsMoney(amountToken)
    if (!amount) return null

    const direction = inferDirection(line, moneySign(amountToken) * amount)
    const signedAmount = direction === 'expense' ? -amount : amount
    return makeStatementRow({
      date,
      description: cleanDescription(line),
      signedAmount,
      raw: line,
      index,
      source: 'ocr',
    })
  })

  return uniqueRows(rows)
}

export function parseStatementTextByType(text, fileName = '') {
  return /\.csv$/i.test(fileName) ? parseStatementCsv(text) : parseStatementText(text)
}

export function normalizeStatementOcrRows(rows = []) {
  return uniqueRows((Array.isArray(rows) ? rows : []).map((row, index) => {
    const raw = JSON.stringify(row)
    const date = parseDate(row.date || row.data, inferFallbackYear(raw))
    const description = cleanDescription(row.description || row.descricao || row.histórico || row.historico || row.memo)
    const amount = parseAbsMoney(row.amount ?? row.valor)
    if (!amount) return null

    const kind = normalizeText(row.kind || row.tipo || row.natureza)
    const signedAmount = kind.includes('expense') || kind.includes('despesa') || kind.includes('debito')
      ? -amount
      : amount

    return makeStatementRow({
      date,
      description,
      signedAmount,
      raw,
      index,
      source: 'ocr',
    })
  }))
}

export function isSupportedStatementFile(file) {
  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  return (
    type === 'text/csv' ||
    name.endsWith('.csv') ||
    type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    type.startsWith('image/')
  )
}

async function readFileText(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsText(file)
  })
}

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
  })
  const pdf = await loadingTask.promise
  const pages = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => item.str || '').join(' '))
    }
  } finally {
    await pdf.destroy?.()
  }

  return pages.join('\n').trim()
}

export async function extractStatementFileText(file) {
  if (!isSupportedStatementFile(file)) {
    throw new Error('Formato não suportado. Envie CSV, PDF ou imagem.')
  }

  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  if (type === 'text/csv' || name.endsWith('.csv')) return readFileText(file)
  if (type === 'application/pdf' || name.endsWith('.pdf')) return extractPdfText(file)
  if (type.startsWith('image/')) return extractNativeDocumentText(file)
  return ''
}

export async function parseStatementFile(file, options = {}) {
  const text = await extractStatementFileText(file)
  const hasText = String(text || '').trim()
  const rows = hasText ? parseStatementTextByType(text, file?.name) : []
  if (rows.length) return rows

  const isCsv = String(file?.name || '').toLowerCase().endsWith('.csv') || String(file?.type || '').toLowerCase() === 'text/csv'
  if (!isCsv) {
    const fetchOcr = options.fetchOcr || fetchStatementOcr
    const remote = await fetchOcr(file, { extractedText: text || '' }).catch((err) => {
      if (hasText) return { rows: [] }
      throw err
    })
    const remoteRows = normalizeStatementOcrRows(remote?.rows || remote)
    if (remoteRows.length) return remoteRows
  }

  if (!hasText) {
    throw new Error('Não foi possível extrair texto do arquivo. Use CSV, PDF com texto selecionável ou uma imagem nítida.')
  }

  if (!rows.length) {
    throw new Error('Nenhum lançamento foi reconhecido. O arquivo precisa ter data, descrição e valor.')
  }
}
