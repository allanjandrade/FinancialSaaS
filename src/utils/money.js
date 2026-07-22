export function formatMoney(value, { empty = 'R$ 0,00' } = {}) {
  if (value === null || value === undefined || value === '') return empty
  const num = Number(value)
  if (!Number.isFinite(num)) return empty
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMoneyInput(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const cleaned = String(raw).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (!cleaned) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

export function formatMoneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
