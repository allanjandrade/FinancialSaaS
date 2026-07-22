export const DEFAULT_CATEGORY_KEYWORD_RULES = Object.freeze([
  {
    category: 'Mercado',
    keywords: ['mercado', 'supermercado', 'hortifruti', 'atacadao', 'atacadão', 'carrefour', 'extra'],
  },
  {
    category: 'Transporte',
    keywords: ['uber', '99', 'posto', 'combustivel', 'combustível', 'metro', 'metrô', 'onibus', 'ônibus'],
  },
  {
    category: 'Assinaturas',
    keywords: ['netflix', 'spotify', 'amazon prime', 'chatgpt', 'openai', 'icloud', 'google one'],
  },
  {
    category: 'Saúde',
    keywords: ['farmacia', 'farmácia', 'drogaria', 'consulta', 'laboratorio', 'laboratório'],
  },
  {
    category: 'Educação',
    keywords: ['curso', 'faculdade', 'escola', 'livro', 'material escolar'],
  },
])

export function suggestCategoryByKeyword(text, rules = DEFAULT_CATEGORY_KEYWORD_RULES) {
  const haystack = normalizeText(text)
  if (!haystack) return null

  for (const rule of rules) {
    const keyword = [...rule.keywords]
      .sort((a, b) => normalizeText(b).length - normalizeText(a).length)
      .find((item) => haystack.includes(normalizeText(item)))
    if (keyword) {
      return {
        category: rule.category,
        keyword,
        confidence: 'keyword',
      }
    }
  }

  return null
}

export function findCategoryKeywordSuggestions(state = {}, options = {}) {
  const limit = Number(options.limit || 5)
  return (Array.isArray(state.expenses) ? state.expenses : [])
    .filter((expense) => needsCategorySuggestion(expense))
    .map((expense) => {
      const suggestion = suggestCategoryByKeyword(expenseText(expense), options.rules)
      if (!suggestion) return null
      return {
        id: expense.id,
        description: expense.description || expense.origin || 'Lançamento sem descrição',
        currentCategory: expense.category || 'Sem categoria',
        ...suggestion,
      }
    })
    .filter(Boolean)
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 5)
}

export function buildSpendingAlert(state = {}, options = {}) {
  const referenceDate = parseDate(options.referenceDate || new Date())
  const periodDays = options.periodDays || 30
  const threshold = toNumber(options.threshold)
  const range = analysisRange(referenceDate, periodDays)
  const expenses = (Array.isArray(state.expenses) ? state.expenses : [])
    .filter((expense) => !isInternalTransfer(expense))
    .filter((expense) => {
      const date = parseDate(expense.date)
      return date && date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime()
    })

  const spent = roundCurrency(expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0))
  return {
    periodDays,
    periodLabel: analysisPeriodLabel(periodDays),
    spent,
    threshold,
    triggered: threshold > 0 && spent > threshold,
    expenseCount: expenses.length,
  }
}

export function analysisPeriodLabel(periodDays) {
  if (periodDays === 'month') return 'mês atual'
  const days = Math.max(1, Math.round(toNumber(periodDays, 30)))
  return days === 1 ? 'último dia' : `últimos ${days} dias`
}

function analysisRange(referenceDate, periodDays) {
  const ref = parseDate(referenceDate) || parseDate(new Date())
  const end = endOfDay(ref)
  if (periodDays === 'month') {
    return {
      start: startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1)),
      end,
    }
  }

  const days = Math.max(1, Math.round(toNumber(periodDays, 30)))
  const start = startOfDay(ref)
  start.setDate(start.getDate() - days + 1)
  return { start, end }
}

function expenseText(expense) {
  return [
    expense.description,
    expense.origin,
    expense.merchant,
    expense.payee,
    expense.name,
  ].filter(Boolean).join(' ')
}

function needsCategorySuggestion(expense) {
  const category = normalizeText(expense.category)
  return !category || category === 'outros' || category === 'sem categoria'
}

function isInternalTransfer(expense) {
  return Boolean(expense?.isInternalTransfer || expense?.transferId || expense?.transferGroupId || expense?.type === 'internal_transfer')
}

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value)
  const raw = String(value || '')
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundCurrency(value) {
  return Math.round(toNumber(value) * 100) / 100
}
