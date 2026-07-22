function normalizeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function quantityLabel(value, singular, plural) {
  const count = normalizeCount(value)
  const label = Math.abs(count) === 1 ? singular : plural
  return `${count} ${label}`
}

export function monthCountLabel(value) {
  return quantityLabel(value, 'mês', 'meses')
}

export function dayCountLabel(value) {
  return quantityLabel(value, 'dia', 'dias')
}
