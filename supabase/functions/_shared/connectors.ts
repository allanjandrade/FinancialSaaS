export const CONNECTOR_TYPES = [
  'open_finance',
  'document',
  'email',
  'marketplace',
  'manual',
] as const

export type ConnectorType = (typeof CONNECTOR_TYPES)[number]

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

export async function sha256Connector(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined && record[key] !== '') return record[key]
  }
  return null
}

function normalizeDate(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export async function normalizeConnectorRecord(
  connectorType: ConnectorType,
  raw: Record<string, unknown>,
  index: number,
) {
  const externalId = String(firstValue(raw, ['id', 'externalId', 'transactionId', 'documentId', 'messageId', 'itemId']) || '')
  const occurredAt = normalizeDate(firstValue(raw, [
    'occurredAt',
    'bookedAt',
    'date',
    'createdAt',
    'publishedAt',
    'collectedAt',
  ]))
  const eventTypes: Record<ConnectorType, string> = {
    open_finance: 'financial_transaction',
    document: 'document_discovered',
    email: 'email_document_discovered',
    marketplace: 'price_observation',
    manual: 'manual_event',
  }
  const eventType = String(raw.eventType || raw.type || eventTypes[connectorType])
  const payload = {
    connectorType,
    ...raw,
    canonical: {
      externalId: externalId || null,
      occurredAt,
      amount: firstValue(raw, ['amount', 'value', 'price', 'total']),
      description: firstValue(raw, ['description', 'title', 'name', 'subject']),
    },
  }
  const payloadHash = await sha256Connector(stableJson(payload))
  const dedupeKey = String(raw.dedupeKey || externalId || `${eventType}:${occurredAt}:${index}:${payloadHash}`)

  return {
    external_id: externalId || null,
    event_type: eventType,
    dedupe_key: dedupeKey,
    payload_hash: payloadHash,
    occurred_at: occurredAt,
    payload,
  }
}

export function isConnectorType(value: string): value is ConnectorType {
  return CONNECTOR_TYPES.includes(value as ConnectorType)
}
