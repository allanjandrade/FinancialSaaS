export function meterUsage(event = {}) {
  const safeMetadata = sanitizeMetadata(event.metadata || {})
  return {
    user_id: event.user_id,
    event_type: String(event.event_type || ''),
    quantity: Math.max(1, Math.floor(Number(event.quantity || 1))),
    cost_estimate: Math.max(0, Number(event.cost_estimate || 0)),
    metadata: safeMetadata,
  }
}

export function summarizeUsage(events = []) {
  const summary = {}
  for (const event of events) {
    const metered = meterUsage(event)
    summary[metered.event_type] = (summary[metered.event_type] || 0) + metered.quantity
  }
  return summary
}

function sanitizeMetadata(metadata) {
  const forbidden = ['finance_states', 'expenses', 'incomes', 'authorization', 'secret', 'card_number', 'gateway_payload']
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !forbidden.includes(String(key).toLowerCase())))
}
