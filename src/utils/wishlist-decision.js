import { simulatePlannedPurchase } from '@/utils/planning-engine.js'

export const WISHLIST_QUOTE_PENDING_LABEL = 'Cotação pendente'

function positiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatWishlistPrice(value) {
  const price = positiveNumber(value)
  if (!price) return WISHLIST_QUOTE_PENDING_LABEL
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

export function resolveWishlistPrice(item, fallbackPrice = null) {
  return [
    fallbackPrice,
    item?.currentPrice,
    item?.lastQuotedPrice,
    item?.value,
    item?.valor,
    item?.price,
    item?.cost,
  ].map(positiveNumber).find(Boolean) || null
}

export function resolveWishlistRecommendation(decision) {
  if (decision === 'can_buy_now') return 'comprar'
  if (decision === 'not_recommended' || decision === 'card_risk') return 'inviavel agora'
  return 'esperar'
}

function plannedPaymentType(item = {}) {
  const raw = String(item.plannedPaymentMethod || item.paymentMethod || item.formaPagamentoPlanejada || '').toLowerCase()
  if (raw.includes('card') || raw.includes('cart') || raw.includes('credit')) return 'credit'
  return item.payment_type || item.paymentType || 'cash'
}

export function buildWishlistPurchaseSimulation(item, state, referenceDate = new Date(), options = {}) {
  const price = resolveWishlistPrice(item, options.price)
  if (!price) {
    return {
      item_name: item?.name || '',
      amount: 0,
      canSimulate: false,
      status: 'quote_pending',
      recommendation: 'esperar',
      priceLabel: WISHLIST_QUOTE_PENDING_LABEL,
      monthly_impact: 0,
      would_write_transaction: false,
      reasons: ['Cotação pendente: informe um preço manual ou confirme uma oferta compatível antes de decidir.'],
    }
  }

  const paymentType = plannedPaymentType(item)
  const result = simulatePlannedPurchase({
    item_name: item?.name || '',
    amount: price,
    payment_type: paymentType,
    installments: Math.max(1, Number(item?.plannedInstallments || item?.installments || 1)),
    category: item?.category || 'Outros',
    purchase_date: referenceDate.toISOString().slice(0, 10),
  }, state, referenceDate)

  return {
    ...result,
    canSimulate: true,
    status: result.decision,
    recommendation: resolveWishlistRecommendation(result.decision),
    priceLabel: formatWishlistPrice(price),
  }
}
