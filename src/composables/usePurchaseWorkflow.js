import { computed } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { OFFICIAL_EXPENSE_CATEGORIES } from '@/constants/finance'
import { autofillFromImage, autofillFromLink, completeAutofill } from '@/utils/ai-autofill.js'
import { enforceExactProductIdentity, fetchLiveMarketplaceOffers } from '@/utils/marketplace-prices-api.js'
import { pickBestOffers, suggestAlternatives } from '@/utils/marketplace-comparator.js'
import { buildPurchaseIntelligence } from '@/utils/purchase-intelligence.js'
import { evaluatePurchase } from '@/utils/financial-planner.js'
import { hasCompatiblePrice, isAcceptedCompatibleOffer, normalizeProductIdentity, requiresCompatiblePrice } from '@/utils/productIdentity.js'
import { normalizeProductDescription } from '@/domain/products/productDescriptionNormalizer.js'
import { canonicalizeProductUrl } from '@/domain/products/canonicalizeProductUrl.js'
import { createProductFromUrl } from '@/api/product-from-url.js'

const FORBIDDEN_WISHLIST_FIELDS = [
  'user_id',
  'userId',
  'owner_id',
  'ownerId',
  'created_by',
  'createdBy',
  'deleted_by',
  'deletedBy',
  'is_admin',
  'subscription_status',
]

function parsePriceFromText(text) {
  const content = String(text || '')
  const match = content.match(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?/)
  if (!match) return null
  const parsed = Number(match[0].replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeProduct(input) {
  return {
    name: input?.name || input?.nome || '',
    value: Number(input?.value || input?.valor || 0) > 0 ? Number(input.value || input.valor) : null,
    description: input?.description || '',
    notes: input?.notes || '',
    category: input?.category || OFFICIAL_EXPENSE_CATEGORIES[0],
    priority: input?.priority || 'Média',
    desiredDate: input?.desiredDate || '',
    originalLink: input?.originalLink || input?.originalUrl || input?.original_url || input?.link || '',
    originalUrl: input?.originalUrl || input?.original_url || input?.originalLink || input?.link || '',
    canonicalUrl: input?.canonicalUrl || input?.canonical_url || input?.originalLink || input?.link || '',
    imageUrl: input?.imageUrl || '',
    brand: input?.brand || input?.marca || '',
    model: input?.model || input?.modelo || '',
    attributes: input?.attributes && typeof input.attributes === 'object' ? { ...input.attributes } : {},
    marketplace: input?.marketplace || '',
    marketplaceItemId: input?.marketplaceItemId || input?.marketplace_item_id || '',
    product_identity_id: input?.product_identity_id || input?.productIdentityId || '',
    source_product_id: input?.source_product_id || input?.sourceProductId || '',
    id_type: input?.id_type || input?.idType || '',
    identity_locked: Boolean(input?.identity_locked || input?.identityLocked),
    identity_status: input?.identity_status || input?.identityStatus || '',
    identity_source: input?.identity_source || input?.identitySource || '',
    removedUrlParams: Array.isArray(input?.removedUrlParams) ? input.removedUrlParams : [],
    hasVariation: Boolean(input?.hasVariation),
    purchaseMotivation: input?.purchaseMotivation || '',
    liveResult: input?.liveResult || null,
    product_identity: input?.product_identity || input?.productIdentity || null,
    priceStatus: input?.priceStatus || input?.price_status || '',
    priceMode: input?.priceMode || input?.price_mode || '',
    priceSummary: input?.priceSummary || null,
    priceDiagnostics: Array.isArray(input?.priceDiagnostics) ? input.priceDiagnostics : [],
    price_search_status: input?.price_search_status || input?.priceSearchStatus || '',
    source: input?.source || '',
    skipLiveSearch: Boolean(input?.skipLiveSearch),
  }
}

function parseOptionalPrice(value) {
  const parsed = Number(String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function usePurchaseWorkflow() {
  const financeStore = useFinanceStore()
  const wishlist = computed(() => financeStore.state.wishlist || [])
  const monthData = computed(() => financeStore.calcMonth(financeStore.state.settings.selectedMonth))

  function rejectIdentityOverride(input) {
    const attempted = FORBIDDEN_WISHLIST_FIELDS.find((field) => input?.[field] != null)
    if (attempted) throw new Error('A compra deve pertencer ao usuário autenticado.')
  }

  async function requireLoggedUser() {
    const supabase = window.supabase
    if (!supabase?.auth?.getUser) throw new Error('Usuário não autenticado')
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user?.id) throw new Error('Usuário não autenticado')
    if (financeStore.activeUserId !== data.user.id) {
      financeStore.setActiveUser(data.user.id)
    }
    return data.user
  }

  function buildContext() {
    const adjustments =
      Number(financeStore.state.settings.monthlyRecurringExpenses || 0) +
      Number(financeStore.state.settings.monthlyDebtPayments || 0)

    return {
      monthlySurplus: Number(monthData.value.cashBalance || 0) - adjustments,
      emergencyReserveCurrent: financeStore.state.settings.emergencyReserveCurrent,
      emergencyReserveMinimum: financeStore.state.settings.emergencyReserveMinimum,
      currentBalance: monthData.value.cashBalance,
      cardLimit: financeStore.state.settings.cardLimit,
      cardBill: monthData.value.cardBill,
      activeGoalsValue: financeStore.state.settings.activeGoalsValue,
      familyMode: Boolean(financeStore.state.settings.familyModeEnabled),
      priorityQueue: financeStore.state.priorityQueue || [],
    }
  }

  function assertWishlistPersisted(itemId) {
    const inState = wishlist.value.find((item) => item.id === itemId)
    if (!inState) throw new Error('Item não encontrado na wishlist após salvar')

    const saved = JSON.parse(localStorage.getItem(financeStore.getStorageKey()) || '{}')
    const inStorage = Array.isArray(saved.wishlist) && saved.wishlist.some((item) => item.id === itemId)
    if (!inStorage) throw new Error('Item não persistido no armazenamento local')

    return inState
  }

  async function identifyFromLink(link, onProgress) {
    return normalizeProduct(await autofillFromLink(link, onProgress))
  }

  function persistWishlistItem(item) {
    if (!item?.id) {
      const created = financeStore.addWishlistItem(item)
      return assertWishlistPersisted(created.id)
    }

    const localIndex = financeStore.state.wishlist.findIndex((entry) => entry.id === item.id)
    if (localIndex < 0) {
      const created = financeStore.addWishlistItem(item)
      return assertWishlistPersisted(created.id)
    }

    const updated = financeStore.updateWishlistItem(item.id, item)
    if (!updated) throw new Error('Falha ao atualizar item salvo')
    return assertWishlistPersisted(updated.id)
  }

  function buildLocalLinkWishlistItem(link, details = {}, canonical) {
    const now = new Date().toISOString()
    const marketplace = canonical.marketplace || canonical.source || 'Link externo'
    const productId = canonical.source_product_id || canonical.sourceProductId || ''
    const rawTitle = String(canonical.title || '').trim()
    const titleIsOnlyId = productId && rawTitle.toUpperCase() === String(productId).toUpperCase()
    const productName = (!titleIsOnlyId && rawTitle)
      || [marketplace, productId].filter(Boolean).join(' ')
      || 'Produto pelo link'
    const productIdentity = {
      source: canonical.source,
      source_product_id: productId,
      id_type: canonical.id_type,
      canonical_url: canonical.canonical_url,
      title: canonical.title || productName,
      brand: canonical.brand || '',
      category: canonical.category || '',
      identity_source: 'url',
      identity_confidence: 1,
      match_policy: 'url_exact',
    }

    return {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
      name: productName,
      description: details.description || details.notes || '',
      notes: details.notes || '',
      value: null,
      targetPrice: parseOptionalPrice(details.targetPrice || details.desired_price),
      priority: details.priority || 'Media',
      category: details.category || canonical.category || OFFICIAL_EXPENSE_CATEGORIES[0],
      desiredDate: details.desiredDate || '',
      marketplace,
      brand: canonical.brand || '',
      model: '',
      attributes: {},
      imageUrl: canonical.image_url || canonical.imageUrl || '',
      originalLink: canonical.raw_url || link,
      originalUrl: canonical.raw_url || link,
      canonicalUrl: canonical.canonical_url,
      canonical_url: canonical.canonical_url,
      marketplaceItemId: productId,
      marketplace_item_id: productId,
      source: canonical.source,
      source_product_id: productId,
      id_type: canonical.id_type,
      product_identity_id: '',
      identity_locked: true,
      identity_status: 'confirmed',
      identity_source: 'url',
      product_identity: productIdentity,
      priceStatus: 'pending_quote',
      priceMode: 'pending_quote',
      price_search_status: 'quote_pending',
      priceSummary: { status: 'pending_quote', offerCount: 0 },
      priceDiagnostics: ['product-from-url:remote-fallback'],
      marketplaceOffers: [],
      accepted_candidates: [],
      ambiguous_candidates: [],
      last_rejected_candidates: [],
      best_compatible_offer: null,
      last_match_score: 0,
      last_match_reason: 'Produto travado pelo link informado. Aguardando preço do mesmo item.',
      monitorPrice: true,
      origin_label: 'Link do produto',
      created_at: now,
      updated_at: now,
    }
  }

  async function addProductFromUrl(link, details = {}, onProgress) {
    rejectIdentityOverride(details)
    await requireLoggedUser()
    onProgress?.('Confirmando identidade do link...')
    const canonical = canonicalizeProductUrl(link)
    if (!canonical.ok) throw new Error(canonical.message || 'Link de produto inválido.')

    try {
      const result = await createProductFromUrl(link, details)
      if (result?.item?.id) {
        return normalizeProduct(persistWishlistItem(result.item))
      }
      return normalizeProduct(result?.item || {})
    } catch {
      onProgress?.('Salvando localmente enquanto a sincronização remota falha...')
      const item = persistWishlistItem(buildLocalLinkWishlistItem(link, details, canonical))
      return normalizeProduct(item)
    }
  }

  async function identifyFromImage(file, onProgress) {
    return normalizeProduct(await autofillFromImage(file, onProgress))
  }

  function canAttemptLiveSearch() {
    const supabase = typeof window !== 'undefined' ? window.supabase : null
    return !supabase || Boolean(supabase.auth?.getSession)
  }

  function productFromText(text) {
    const value = parsePriceFromText(text)
    const normalized = normalizeProductDescription(String(text || '').replace(/R\$\s*[\d.,]+/g, '').trim())
    const identity = normalized.product_identity || null
    const hasCompleteStrictIdentity = identity?.match_policy === 'strict' && !normalized.needs_clarification
    const baseProduct = normalizeProduct({
      name: hasCompleteStrictIdentity ? normalized.normalized_query : normalized.raw_description,
      description: normalized.raw_description,
      value,
      product_identity: identity?.match_policy === 'strict' ? identity : null,
      price_search_status: 'quote_pending',
      source: 'description',
    })

    return { value, normalized, identity, baseProduct }
  }

  function offerPrice(offer) {
    const price = Number(offer?.total || offer?.totalPrice || offer?.price || 0)
    return Number.isFinite(price) && price > 0 ? price : null
  }

  function offerImageUrl(offer) {
    return offer?.imageUrl || offer?.image || offer?.thumbnailUrl || offer?.thumbnail || ''
  }

  function offerProductUrl(offer) {
    return offer?.url || offer?.link || offer?.productUrl || offer?.product_url || ''
  }

  function selectedQuoteState(liveResult) {
    if (!liveResult) return null
    const candidate = liveResult.best_compatible_offer
      || liveResult.best
      || (Array.isArray(liveResult.accepted_candidates) ? liveResult.accepted_candidates[0] : null)
      || (Array.isArray(liveResult.offers) ? liveResult.offers.find((offer) => offer.compatibility_status === 'accepted') : null)
      || (Array.isArray(liveResult.offers) ? liveResult.offers[0] : null)
    const total = offerPrice(candidate)
    if (!candidate || !total) return null

    const rawStatus = liveResult.status || ''
    const candidateAccepted = isAcceptedCompatibleOffer(candidate)
      || candidate.match?.accepted === true
      || candidate.match?.status === 'accepted'
    const score = Number(
      candidate.match_score
      || candidate.matchScore
      || candidate.match?.score
      || liveResult.score
      || (rawStatus === 'found_exact' ? 1 : 0)
      || (candidateAccepted ? 0.95 : 0),
    )
    const compatible = rawStatus === 'found_exact'
      || candidateAccepted
      || score >= 0.85
    if (!compatible) return null

    const status = rawStatus === 'found_exact' ? 'found_exact' : 'found_compatible'
    const offer = {
      ...candidate,
      price: Number(candidate.price || total),
      total,
      totalPrice: Number(candidate.totalPrice || total),
      compatibility_status: candidate.compatibility_status || 'accepted',
      match_score: score,
      match_reason: candidate.match_reason || candidate.match?.reason || liveResult.reason || 'Oferta compatível selecionada.',
    }
    const acceptedCandidates = [offer, ...(Array.isArray(liveResult.accepted_candidates) ? liveResult.accepted_candidates : [])]
    return {
      offer,
      acceptedCandidates,
      total,
      status,
      score,
      reason: offer.match_reason,
      fetchedAt: liveResult.fetchedAt || new Date().toISOString(),
      mode: liveResult.mode || 'live',
    }
  }

  function presentableSearchOffers(liveResult) {
    const strictIdentity = liveResult?.product_identity?.match_policy === 'strict'
      || liveResult?.product_identity?.match_policy === 'url_exact'
      || Boolean(liveResult?.best_compatible_offer)
      || Boolean(liveResult?.accepted_candidates?.length)
      || Boolean(liveResult?.ambiguous_candidates?.length)
      || Boolean(liveResult?.rejected_candidates?.length)
    const acceptedPool = [
      liveResult?.best_compatible_offer,
      ...(liveResult?.accepted_candidates || []),
      ...(liveResult?.offers || []).filter(isAcceptedCompatibleOffer),
    ].filter(Boolean)
    const pool = strictIdentity
      ? acceptedPool
      : [
          liveResult?.best_compatible_offer,
          ...(liveResult?.accepted_candidates || []),
          ...(liveResult?.offers || []),
        ].filter(Boolean)
    const seen = new Set()

    return pool
      .filter((offer) => offerPrice(offer) && offer.compatibility_status !== 'rejected')
      .filter((offer) => !strictIdentity || isAcceptedCompatibleOffer(offer))
      .filter((offer) => {
        const key = [
          offerProductUrl(offer),
          offer.title,
          offer.marketplace,
          offerPrice(offer),
        ].filter(Boolean).join('|').toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => offerPrice(a) - offerPrice(b))
  }

  function productFromSearchOffer(baseProduct, offer, liveResult, index = 0) {
    const metadata = liveResult?.metadata || {}
    const price = offerPrice(offer)
    const url = offerProductUrl(offer)
    const selectedLiveResult = {
      ...(liveResult || {}),
      status: liveResult?.status || 'found_compatible',
      offers: [offer],
      accepted_candidates: [offer],
      best_compatible_offer: offer,
      selected_offer_index: index,
    }

    return normalizeProduct({
      ...baseProduct,
      name: offer?.title || metadata.name || baseProduct.name,
      value: price,
      imageUrl: offerImageUrl(offer) || metadata.imageUrl || baseProduct.imageUrl || '',
      marketplace: offer?.marketplace || metadata.marketplace || baseProduct.marketplace || '',
      brand: metadata.brand || baseProduct.brand || '',
      model: metadata.model || baseProduct.model || '',
      attributes: metadata.attributes || baseProduct.attributes || {},
      originalLink: url || baseProduct.originalLink,
      originalUrl: url || baseProduct.originalUrl,
      canonicalUrl: url || baseProduct.canonicalUrl,
      priceStatus: 'quoted',
      priceMode: liveResult?.mode || 'live',
      price_search_status: selectedLiveResult.status,
      liveResult: selectedLiveResult,
    })
  }

  async function searchProductsByText(text, onProgress) {
    onProgress?.('Interpretando descricao...')
    const { normalized, baseProduct } = productFromText(text)

    if (normalized.needs_clarification || !canAttemptLiveSearch()) {
      return {
        query: normalized.normalized_query || normalized.raw_description,
        normalized,
        results: [],
        fallback: baseProduct,
        liveResult: null,
      }
    }

    onProgress?.('Buscando ofertas em lojas...')
    try {
      const liveResult = await runLivePriceSearch(baseProduct)
      const offers = presentableSearchOffers(liveResult)
      const bestOffer = liveResult.best_compatible_offer || pickBestOffers(offers).best || offers[0] || null
      const metadata = liveResult.metadata || {}
      const bestPrice = Number(bestOffer?.total || bestOffer?.totalPrice || bestOffer?.price || metadata.value || 0)
      const foundCompatible = Boolean(bestOffer && bestPrice > 0)
      const results = offers.map((offer, index) => productFromSearchOffer(baseProduct, offer, liveResult, index))

      onProgress?.('Preparando revisao com os dados encontrados...')
      const fallback = normalizeProduct({
        ...baseProduct,
        name: foundCompatible
          ? (bestOffer.title || metadata.name || baseProduct.name)
          : (metadata.name || baseProduct.name),
        value: foundCompatible ? bestPrice : baseProduct.value,
        imageUrl: bestOffer?.imageUrl || bestOffer?.image || metadata.imageUrl || baseProduct.imageUrl || '',
        marketplace: bestOffer?.marketplace || metadata.marketplace || baseProduct.marketplace || '',
        brand: metadata.brand || baseProduct.brand || '',
        model: metadata.model || baseProduct.model || '',
        attributes: metadata.attributes || baseProduct.attributes || {},
        priceStatus: foundCompatible ? 'quoted' : 'pending_quote',
        priceMode: liveResult.mode || (foundCompatible ? 'live' : 'pending_quote'),
        price_search_status: liveResult.status || 'quote_pending',
        liveResult: {
          ...liveResult,
          offers,
        },
      })
      return {
        query: normalized.normalized_query || normalized.raw_description,
        normalized,
        liveResult,
        results,
        fallback,
      }
    } catch (error) {
      onProgress?.('Busca indisponível. Mantendo produto para revisão manual...')
      const fallback = {
        ...baseProduct,
        priceDiagnostics: ['description-search:error'],
        liveResult: {
          offers: [],
          status: 'price_search_error',
          message: error?.message || 'Busca de preço indisponível.',
        },
      }
      return {
        query: normalized.normalized_query || normalized.raw_description,
        normalized,
        results: [],
        fallback,
        liveResult: fallback.liveResult,
      }
    }
  }

  async function identifyFromText(text, onProgress) {
    const search = await searchProductsByText(text, onProgress)
    return search.results[0] || search.fallback
  }

  async function runLivePriceSearch(product) {
    return fetchLiveMarketplaceOffers({
      nome: product.name || product.nome,
      name: product.name || product.nome,
      marca: product.brand || product.marca,
      brand: product.brand || product.marca,
      modelo: product.model || product.modelo,
      model: product.model || product.modelo,
      valor: product.value || product.valor,
      value: product.value || product.valor,
      marketplace: product.marketplace,
      marketplaceItemId: product.marketplaceItemId,
      source: product.source,
      source_product_id: product.source_product_id,
      id_type: product.id_type,
      identity_locked: product.identity_locked,
      identity_status: product.identity_status,
      originalLink: product.canonicalUrl || product.originalLink,
      originalUrl: product.originalUrl || product.originalLink,
      canonicalUrl: product.canonicalUrl || product.originalLink,
      product_identity: product.product_identity || product.productIdentity || null,
    })
  }

  function productIdentityKey(product) {
    const identity = product?.product_identity || product?.productIdentity || null
    const source = identity?.source || product?.source || ''
    const sourceProductId = identity?.source_product_id
      || identity?.sourceProductId
      || product?.source_product_id
      || product?.sourceProductId
      || product?.marketplaceItemId
      || product?.marketplace_item_id
      || ''
    if (source && sourceProductId) return `${source}:${sourceProductId}`.toLowerCase()

    const productIdentityId = product?.product_identity_id || product?.productIdentityId || ''
    if (productIdentityId) return `identity:${productIdentityId}`.toLowerCase()

    const canonicalUrl = product?.canonicalUrl || product?.canonical_url || ''
    if (canonicalUrl) return `url:${canonicalUrl}`.toLowerCase()

    return ''
  }

  function findWishlistPersistenceTarget(itemId, product) {
    const byId = wishlist.value.find((item) => item.id === itemId || String(item.id || '') === String(itemId || ''))
    if (byId) return byId

    const expectedIdentityKey = productIdentityKey(product)
    if (!expectedIdentityKey) return null
    return wishlist.value.find((item) => productIdentityKey(item) === expectedIdentityKey) || null
  }

  function persistMarketAnalysis(itemId, product, liveResult) {
    const exactResult = enforceExactProductIdentity(product, liveResult || {})
    const offers = exactResult.offers || []
    const compatibleBest = exactResult.best_compatible_offer || exactResult.best || null
    const best = compatibleBest ? { lowest: compatibleBest, best: compatibleBest, reason: compatibleBest.match_reason || exactResult.reason || '' } : pickBestOffers(offers)
    const current = findWishlistPersistenceTarget(itemId, product)
    const targetItemId = current?.id || itemId
    const metadata = exactResult.metadata || {}
    const productIdentity = exactResult.product_identity || product.product_identity || current?.product_identity || null
    const identityLocked = Boolean(product.identity_locked || current?.identity_locked || productIdentity?.match_policy === 'url_exact')
    const hasStrictIdentity = productIdentity?.match_policy === 'strict' || identityLocked
    const foundExact = exactResult.status === 'found_exact' && compatibleBest
    const foundCompatible = foundExact || (exactResult.status === 'found_compatible' && compatibleBest && Number(compatibleBest.match_score || compatibleBest.match?.score || exactResult.score || 0) >= 0.85)
    const compatibleTotal = Number(compatibleBest?.total || compatibleBest?.totalPrice || compatibleBest?.price || 0)
    const nextValue = foundCompatible
      ? compatibleTotal
      : hasStrictIdentity
        ? null
        : best.best?.total || product.value || current?.value || null
    const updated = financeStore.updateWishlistItem(targetItemId, {
      name: identityLocked ? (current?.name || product.name) : (metadata.name || compatibleBest?.title || current?.name || product.name),
      imageUrl: identityLocked
        ? (current?.imageUrl || product.imageUrl || compatibleBest?.imageUrl || compatibleBest?.image || '')
        : (metadata.imageUrl || compatibleBest?.imageUrl || compatibleBest?.image || current?.imageUrl || product.imageUrl || ''),
      brand: identityLocked ? (current?.brand || product.brand || '') : (metadata.brand || current?.brand || product.brand || ''),
      model: identityLocked ? (current?.model || product.model || '') : (metadata.model || current?.model || product.model || ''),
      attributes: identityLocked ? (current?.attributes || product.attributes || {}) : (metadata.attributes || current?.attributes || product.attributes || {}),
      marketplaceItemId: product.marketplaceItemId || current?.marketplaceItemId || metadata.marketplaceItemId || '',
      canonicalUrl: product.canonicalUrl || current?.canonicalUrl || product.originalLink || '',
      originalLink: product.originalLink || current?.originalLink || '',
      originalUrl: product.originalUrl || current?.originalUrl || product.originalLink || '',
      product_identity_id: product.product_identity_id || current?.product_identity_id || '',
      source: product.source || current?.source || '',
      source_product_id: product.source_product_id || current?.source_product_id || '',
      id_type: product.id_type || current?.id_type || '',
      identity_locked: identityLocked,
      identity_status: identityLocked ? 'confirmed' : (product.identity_status || current?.identity_status || ''),
      identity_source: identityLocked ? 'url' : (product.identity_source || current?.identity_source || ''),
      marketplaceOffers: offers,
      alternatives: suggestAlternatives({ nome: product.name, valor: product.value }),
      value: nextValue,
      marketplace: identityLocked ? (current?.marketplace || product.marketplace || '') : (product.marketplace || compatibleBest?.marketplace || ''),
      priceMode: exactResult.mode || '',
      priceStatus: foundCompatible || (!hasStrictIdentity && offers.length) ? 'quoted' : 'pending_quote',
      product_identity: productIdentity,
      price_search_status: hasStrictIdentity ? (exactResult.status || 'not_found') : exactResult.status || '',
      best_compatible_offer: foundCompatible ? compatibleBest : null,
      accepted_candidates: exactResult.accepted_candidates || offers,
      ambiguous_candidates: exactResult.ambiguous_candidates || [],
      last_match_score: foundCompatible ? Number(compatibleBest.match_score || compatibleBest.match?.score || exactResult.score || (foundExact ? 1 : 0)) : 0,
      last_match_reason: foundCompatible ? (compatibleBest.match_reason || compatibleBest.match?.reason || exactResult.reason || '') : (exactResult.reason || exactResult.message || 'Nenhum preço compatível encontrado ainda.'),
      last_rejected_candidates: exactResult.rejected_candidates || exactResult.rejected || [],
      priceDiagnostics: exactResult.diagnostics || [],
      priceSummary: exactResult.summary || null,
      sourcesUsed: exactResult.sourcesUsed || [],
      priceFetchedAt: exactResult.fetchedAt || new Date().toISOString(),
    })
    if (!updated) throw new Error('Falha ao atualizar item salvo')

    if (foundCompatible && compatibleBest) {
      financeStore.addPriceSnapshot(targetItemId, {
        price: compatibleBest.price,
        total: compatibleBest.total || compatibleBest.totalPrice || compatibleBest.price,
        marketplace: compatibleBest.marketplace,
        source: exactResult.mode === 'live' ? 'live' : 'estimated',
        title: compatibleBest.title,
        url: compatibleBest.url,
        match_score: compatibleBest.match_score || compatibleBest.match?.score,
        match_reason: compatibleBest.match_reason || compatibleBest.match?.reason,
        compatibility_status: 'accepted',
        offers,
      })
    }

    return assertWishlistPersisted(targetItemId)
  }

  async function quoteSavedProduct(itemId, product, initialLiveResult = null) {
    try {
      const liveResult = initialLiveResult || await runLivePriceSearch(product)
      const updated = persistMarketAnalysis(itemId, product, liveResult)
      if (updated.priceDiagnostics?.length) {
        console.debug('PRICE_QUOTE_DIAGNOSTICS', {
          itemId,
          diagnostics: updated.priceDiagnostics,
        })
      }
      return updated
    } catch (error) {
      console.debug('PRICE_QUOTE_BACKGROUND_FALLBACK', error)
      const persistedFallback = findWishlistPersistenceTarget(itemId, product)
      try {
        const updated = financeStore.updateWishlistItem(itemId, {
          priceStatus: 'pending_quote',
          priceMode: 'unavailable',
          priceDiagnostics: ['price-search:background-error'],
          priceFetchedAt: new Date().toISOString(),
        })
        return updated || persistedFallback || assertWishlistPersisted(itemId)
      } catch (recoveryError) {
        if (persistedFallback) return persistedFallback
        throw recoveryError
      }
    }
  }

  async function saveIdentifiedProduct(productInput) {
    rejectIdentityOverride(productInput)
    await requireLoggedUser()
    const product = normalizeProduct(productInput)
    const completed = completeAutofill(product, buildContext())
    rejectIdentityOverride(completed)
    const value = Number(completed.value || 0) > 0 ? Number(completed.value) : null
    const productIdentity = product.product_identity || normalizeProductIdentity([
      completed.name,
      completed.brand || product.brand,
      completed.model || product.model,
    ].filter(Boolean).join(' '))
    const strictIdentity = productIdentity.match_policy === 'strict' ? productIdentity : null

    if (!completed.name) throw new Error('Não foi possível identificar o produto')

    const initialQuote = selectedQuoteState(product.liveResult)
    const initialValue = initialQuote?.total || value

    const created = financeStore.addWishlistItem({
      name: completed.name,
      description: completed.description || '',
      notes: completed.notes || product.notes || '',
      value: initialValue,
      category: completed.category,
      priority: completed.priority,
      desiredDate: completed.desiredDate || '',
      marketplace: completed.marketplace || product.marketplace || '',
      brand: completed.brand || product.brand || '',
      model: completed.model || product.model || '',
      attributes: completed.attributes || product.attributes || {},
      imageUrl: completed.imageUrl || product.imageUrl || '',
      originalLink: product.originalLink,
      originalUrl: product.originalUrl || product.originalLink,
      canonicalUrl: product.canonicalUrl || product.originalLink,
      marketplaceItemId: product.marketplaceItemId,
      removedUrlParams: product.removedUrlParams,
      hasVariation: product.hasVariation,
      purchaseMotivation: completed.purchaseMotivation || product.purchaseMotivation || '',
      priceMode: initialQuote?.mode || 'pending_quote',
      priceStatus: initialQuote ? 'quoted' : 'pending_quote',
      priceSummary: initialQuote
        ? { status: 'quoted', offerCount: initialQuote.acceptedCandidates.length }
        : { status: 'pending_quote', offerCount: 0 },
      priceDiagnostics: [],
      priceFetchedAt: initialQuote?.fetchedAt || '',
      product_identity: strictIdentity,
      product_identity_id: product.product_identity_id,
      source: product.source,
      source_product_id: product.source_product_id,
      id_type: product.id_type,
      identity_locked: product.identity_locked,
      identity_status: product.identity_status,
      identity_source: product.identity_source,
      price_search_status: initialQuote?.status || (strictIdentity ? 'quote_pending' : ''),
      best_compatible_offer: initialQuote?.offer || null,
      accepted_candidates: initialQuote?.acceptedCandidates || [],
      ambiguous_candidates: [],
      last_match_score: initialQuote?.score || 0,
      last_match_reason: initialQuote?.reason || (strictIdentity ? 'Aguardando cotação compatível.' : ''),
      last_rejected_candidates: [],
      monitorPrice: true,
      targetPrice: product.targetPrice || null,
    })
    const persisted = assertWishlistPersisted(created.id)

    if (!product.skipLiveSearch && product.liveResult) {
      const quoteProduct = { ...completed, ...product, value: initialValue }
      try {
        return await quoteSavedProduct(created.id, quoteProduct, product.liveResult)
      } catch (error) {
        console.debug('PRICE_QUOTE_SAVE_FALLBACK', error)
        return persisted
      }
    }

    return persisted
  }

  async function refreshItemPrices(item) {
    const liveResult = await runLivePriceSearch(item)
    return persistMarketAnalysis(item.id, item, liveResult)
  }

  function setManualPrice(itemId, value) {
    const price = Number(value || 0)
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Informe um valor manual valido')
    }

    const updated = financeStore.updateWishlistItem(itemId, {
      value: price,
      manualPrice: true,
      manualPriceUpdatedAt: new Date().toISOString(),
      priceStatus: 'pending_quote',
      priceMode: 'manual',
    })
    if (!updated) throw new Error('Item não encontrado na wishlist')

    financeStore.addPriceSnapshot(itemId, {
      price,
      total: price,
      marketplace: updated.marketplace || 'Manual',
      source: 'manual',
    })

    return assertWishlistPersisted(itemId)
  }

  function offersFor(item) {
    return item?.marketplaceOffers || []
  }

  function bestOffersFor(item) {
    return pickBestOffers(offersFor(item))
  }

  function analysisFor(item) {
    if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) {
      return {
        decision: 'price_identity_pending',
        buyTodayRecommended: false,
        status: 'Compatibilidade pendente',
        recommendation: 'Ainda não há preço compatível suficiente para avaliar esta compra.',
        strategy: 'Revise a identidade do produto ou atualize a busca até encontrar oferta compatível.',
        reasons: ['Preço compatível pendente.'],
        installments: [],
        savingsPlan: { months: 0 },
        monthlySavingNeeded: 0,
      }
    }
    if (!Number(item?.value || 0)) return null
    return evaluatePurchase(item, buildContext())
  }

  function intelligenceFor(item) {
    return buildPurchaseIntelligence(item, buildContext(), offersFor(item))
  }

  function setPriceMonitoring(itemId, enabled, targetPrice = null) {
    const updated = financeStore.setWishlistPriceMonitor(itemId, enabled, targetPrice)
    if (!updated) throw new Error('Item não encontrado na wishlist')
    return updated
  }

  function dismissPriceAlert(alertId) {
    return financeStore.dismissPriceMonitorAlert(alertId)
  }

  return {
    wishlist,
    buildContext,
    identifyFromLink,
    addProductFromUrl,
    identifyFromImage,
    identifyFromText,
    searchProductsByText,
    saveIdentifiedProduct,
    refreshItemPrices,
    setManualPrice,
    offersFor,
    bestOffersFor,
    analysisFor,
    intelligenceFor,
    setPriceMonitoring,
    dismissPriceAlert,
  }
}
