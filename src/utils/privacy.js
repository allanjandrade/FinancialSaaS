const AUDIT_LABELS = {
  name: 'Nome',
  email: 'E-mail',
  role: 'Perfil',
  status: 'Status',
}

export function maskEmail(value) {
  const email = String(value || '').trim()
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  return `${local.slice(0, 1)}***@${domain}`
}

function maskEmailsInText(value) {
  return String(value || '').replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (email) => maskEmail(email),
  )
}

export function formatAuditDetails(details) {
  if (details == null || details === '') return 'Sem detalhes adicionais'

  if (typeof details === 'object') return formatAuditObject(details)

  const text = String(details).trim()
  if (!text) return 'Sem detalhes adicionais'

  try {
    return formatAuditObject(JSON.parse(text))
  } catch {
    return maskEmailsInText(text)
  }
}

function formatAuditObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatAuditDetails(item)).join(' · ')
  }

  if (!value || typeof value !== 'object') return maskEmailsInText(value)

  const rows = Object.entries(value).map(([key, rawValue]) => {
    const label = AUDIT_LABELS[key] || key.replace(/_/g, ' ')
    const displayValue = key.toLowerCase().includes('email')
      ? maskEmail(rawValue)
      : typeof rawValue === 'object'
        ? formatAuditObject(rawValue)
        : maskEmailsInText(rawValue)
    return `${label}: ${displayValue}`
  })

  return rows.join(' · ') || 'Sem detalhes adicionais'
}
