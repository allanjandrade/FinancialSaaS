import { getSupabaseClient } from '@/lib/supabase-client.js'

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function isSchemaUnavailable(error) {
  return ['PGRST205', '42P01', '42703'].includes(error?.code) || error?.status === 404
}

function clientFor(familyId) {
  if (import.meta.env.MODE === 'test' || !isUuid(familyId)) return null
  return getSupabaseClient()
}

function positiveNumber(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') continue
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

function offerUrl(offer) {
  return offer?.url || offer?.link || offer?.productUrl || offer?.product_url || null
}

function firstOfferUrl(offers) {
  for (const offer of Array.isArray(offers) ? offers : []) {
    const direct = offerUrl(offer)
    if (direct) return direct
  }
  return null
}

async function finish(query) {
  const result = await query
  if (result.error && !isSchemaUnavailable(result.error)) throw result.error
  return result
}

export async function syncAuditLogProjection(familyId, entry) {
  const supabase = clientFor(familyId)
  if (!supabase || !entry?.action || !entry?.entityType) return false
  const { error } = await finish(supabase.from('audit_logs').insert({
    family_id: familyId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId || null,
    metadata: {
      localId: entry.id,
      memberId: entry.memberId || null,
      memberName: entry.memberName || null,
      details: entry.details || '',
    },
  }))
  return !error
}

export async function syncPurchaseProjection(familyId, item) {
  const supabase = clientFor(familyId)
  if (!supabase || !item?.id) return null
  const itemValue = positiveNumber(item.value, item.price)
  const manualPrice = item.manualPrice === true || item.priceMode === 'manual'
    ? itemValue
    : positiveNumber(item.manualPrice)
  const livePrice = positiveNumber(
    item.lastQuotedPrice,
    item.currentPrice,
    item.priceStatus === 'quoted' || item.priceMode === 'live' ? itemValue : null,
  )
  const currentPrice = livePrice || manualPrice || itemValue
  const status = item.priceStatus === 'pending_quote' ? 'quote_pending' : (item.status || (currentPrice ? 'quoted' : 'quote_pending'))
  const { data, error } = await finish(supabase.from('purchase_items').upsert({
    family_id: familyId,
    external_id: item.id,
    name: item.name || item.title || 'Item sem nome',
    status: ['quote_pending', 'quoted', 'purchased', 'archived'].includes(status) ? status : 'quote_pending',
    current_price: currentPrice,
    manual_price: manualPrice,
    target_price: positiveNumber(item.targetPrice),
    marketplace: item.marketplace || item.source || null,
    marketplace_item_id: item.marketplaceItemId || item.productId || null,
    original_url: offerUrl(item.best_compatible_offer)
      || offerUrl(item.bestCompatibleOffer)
      || firstOfferUrl(item.accepted_candidates)
      || firstOfferUrl(item.acceptedCandidates)
      || firstOfferUrl(item.marketplaceOffers)
      || item.url
      || item.originalUrl
      || item.originalLink
      || item.canonicalUrl
      || null,
    image_url: item.image || item.imageUrl || null,
    metadata: {
      monitorPrice: item.monitorPrice !== false,
      purchaseMotivation: item.purchaseMotivation || '',
      priceMode: item.priceMode || '',
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'family_id,external_id' }).select('id').single())
  if (error) return null
  return data?.id || null
}

export async function syncPurchasePriceProjection(familyId, item, snapshot) {
  const purchaseItemId = await syncPurchaseProjection(familyId, item)
  const supabase = clientFor(familyId)
  const price = positiveNumber(snapshot?.total, snapshot?.price)
  if (!supabase || !purchaseItemId || !price) return false
  const externalId = `${item.id}:${snapshot.at || new Date().toISOString()}:${price}`
  const { error } = await finish(supabase.from('purchase_price_history').upsert({
    purchase_item_id: purchaseItemId,
    family_id: familyId,
    external_id: externalId,
    price,
    store: snapshot.marketplace || null,
    source: snapshot.source || 'manual',
    url: offerUrl(snapshot) || firstOfferUrl(snapshot.offers) || null,
    collected_at: snapshot.at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'purchase_item_id,external_id' }))
  return !error
}

export async function deletePurchaseProjection(familyId, externalId) {
  const supabase = clientFor(familyId)
  if (!supabase || !externalId) return false
  const { error } = await finish(supabase.from('purchase_items').delete().eq('family_id', familyId).eq('external_id', externalId))
  return !error
}

export async function syncBenefitAccountProjection(familyId, wallet) {
  const supabase = clientFor(familyId)
  if (!supabase || !wallet?.id) return null
  const kind = ['va', 'vr'].includes(wallet.kind) ? wallet.kind : 'corporate'
  const { data, error } = await finish(supabase.from('benefit_accounts').upsert({
    family_id: familyId,
    external_id: wallet.id,
    name: wallet.name || 'Beneficio',
    provider: wallet.provider || null,
    kind,
    opening_balance: Number(wallet.openingBalance ?? wallet.balance ?? 0),
    active: wallet.active !== false,
    metadata: { memberId: wallet.memberId || null, corporateType: wallet.corporateType || '' },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'family_id,external_id' }).select('id').single())
  if (error) return null
  return data?.id || null
}

export async function syncBenefitTransactionProjection(familyId, wallet, transaction) {
  const accountId = await syncBenefitAccountProjection(familyId, wallet)
  const supabase = clientFor(familyId)
  const amount = positiveNumber(transaction?.amount)
  if (!supabase || !accountId || !amount || !transaction?.id) return false
  const { error } = await finish(supabase.from('benefit_transactions').upsert({
    benefit_account_id: accountId,
    family_id: familyId,
    external_id: transaction.id,
    transaction_type: transaction.type === 'credit' ? 'credit' : 'debit',
    amount,
    description: transaction.description || '',
    occurred_at: transaction.occurredAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'benefit_account_id,external_id' }))
  return !error
}

export async function deleteBenefitAccountProjection(familyId, externalId) {
  const supabase = clientFor(familyId)
  if (!supabase || !externalId) return false
  const { error } = await finish(supabase.from('benefit_accounts').delete().eq('family_id', familyId).eq('external_id', externalId))
  return !error
}
