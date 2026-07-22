import { getSupabaseClient } from '@/lib/supabase-client.js'

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function isSchemaUnavailable(error) {
  return ['PGRST205', '42P01', '42703'].includes(error?.code) || error?.status === 404
}

async function hashPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function syncFinancialDocumentProjection(familyId, document) {
  if (import.meta.env.MODE === 'test') return false
  if (!isUuid(familyId) || !document?.id) return false
  const supabase = getSupabaseClient()
  if (!supabase) return false

  const metadata = {
    type: document.type,
    referenceYear: document.referenceYear,
    referenceMonth: document.referenceMonth,
    amount: document.amount,
    notes: document.notes,
    incomeId: document.incomeId,
    entryKind: document.entryKind,
    entryId: document.entryId,
    category: document.category,
    size: document.size,
  }
  const { error } = await supabase.from('financial_documents').upsert({
    family_id: familyId,
    source_type: document.sourceType || 'income_document',
    source_id: document.id,
    document_type: document.type || document.entryKind || 'other',
    title: document.label || document.fileName || '',
    mime_type: document.mimeType || null,
    storage_bucket: document.storage === 'cloud' ? 'income-documents' : null,
    storage_path: document.storagePath || null,
    content_hash: await hashPayload({ id: document.id, metadata }),
    extraction_method: 'metadata',
    metadata,
    occurred_at: document.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'family_id,source_type,source_id' })

  if (error && !isSchemaUnavailable(error)) throw error
  return !error
}

export async function syncFinancialEventProjection(familyId, event) {
  if (import.meta.env.MODE === 'test') return false
  if (!isUuid(familyId) || !event?.dedupeKey) return false
  const supabase = getSupabaseClient()
  if (!supabase) return false
  const payloadHash = await hashPayload(event.payload || event)
  const { error } = await supabase.from('financial_events').upsert({
    family_id: familyId,
    event_type: event.eventType,
    source_type: event.sourceType,
    source_id: event.sourceId || null,
    dedupe_key: event.dedupeKey,
    occurred_at: event.occurredAt,
    amount: event.amount ?? null,
    currency: event.currency || 'BRL',
    description: event.description || '',
    category: event.category || null,
    counterparty: event.counterparty || null,
    payload_hash: payloadHash,
    payload: event.payload || {},
    is_internal_transfer: Boolean(event.isInternalTransfer),
    transfer_group_id: event.transferGroupId || null,
    transfer_confidence: event.transferConfidence ?? null,
    transfer_confirmed_at: event.transferConfirmedAt || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'family_id,dedupe_key' })

  if (error && !isSchemaUnavailable(error)) throw error
  return !error
}
