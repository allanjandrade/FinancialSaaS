<template>
  <main class="wishlist-page">
    <section class="page-head">
      <div>
        <p class="eyebrow">Inteligência</p>
        <h1>Wishlist</h1>
        <p>Produtos salvos, status de cotação e próximas decisões de compra.</p>
      </div>
      <router-link
        v-if="canCreateWishlistItem"
        class="primary-button"
        data-testid="wishlist-add-link"
        to="/purchases/new"
      >
        <Plus :size="18" />
        Nova compra
      </router-link>
      <button v-else class="primary-button" data-testid="wishlist-add-disabled" type="button" disabled>
        <Plus :size="18" />
        Nova compra
      </button>
    </section>

    <section
      v-if="wishlistPermissionMessage"
      class="permission-banner"
      data-testid="wishlist-limit-banner"
      role="status"
    >
      <ShieldAlert :size="20" />
      <p>{{ wishlistPermissionMessage }}</p>
    </section>

    <section v-if="openPriceAlerts.length" class="price-alerts">
      <div class="section-title">
        <div>
          <p class="eyebrow">Alertas ativos</p>
          <h2>Oportunidades encontradas</h2>
        </div>
        <BellRing :size="22" />
      </div>
      <article v-for="alert in openPriceAlerts" :key="alert.id" class="price-alert-row">
        <div>
          <strong>{{ alert.productName }}</strong>
          <p>{{ alert.message }}</p>
        </div>
        <div class="alert-actions">
          <a v-if="safeAlertUrl(alert)" :href="safeAlertUrl(alert)" target="_blank" rel="noopener" class="primary-button">Ver oferta</a>
          <button class="secondary-button" type="button" @click="dismissAlert(alert.id)">Marcar como visto</button>
        </div>
      </article>
    </section>

    <EmptyState
      v-if="!wishlist.length"
      :icon="Package"
      title="Nenhum produto salvo"
      description="Comece por uma descrição ou link de produto para comparar preços e planejar a compra."
      action-label="Adicionar produto"
      action-to="/purchases/new"
    />

    <section v-else class="wishlist-sections">
      <section class="predictive-ranking" data-testid="wishlist-predictive-ranking" aria-labelledby="wishlist-ranking-title">
        <div class="section-title ranking-title">
          <div>
            <p class="eyebrow">Análise preditiva</p>
            <h2 id="wishlist-ranking-title">Ranking recomendado</h2>
            <p>Prioridade calculada por necessidade, urgência, impacto prático, viabilidade, risco e preferência.</p>
          </div>
          <span>{{ predictiveRanking.length }}</span>
        </div>

        <div class="ranking-list">
          <article v-for="entry in predictiveRanking" :key="entry.id || entry.name" class="ranking-card">
            <div class="rank-index">#{{ entry.rank }}</div>
            <div class="ranking-copy">
              <div class="ranking-head">
                <h3>{{ entry.name }}</h3>
                <span class="decision-pill" :class="decisionClass(entry.decision)">{{ entry.decision }}</span>
              </div>
              <p>{{ entry.analystJustification }}</p>
              <div class="ranking-metrics">
                <span>Score {{ entry.priorityScore.toFixed(2) }}</span>
                <span>{{ formatWishlistPrice(entry.cost) }}</span>
                <span>{{ delayLabel(entry) }}</span>
              </div>
            </div>
            <div class="ranking-actions">
              <a
                v-if="purchaseUrl(findWishlistItem(entry))"
                class="primary-button"
                data-testid="wishlist-ranking-buy-link"
                :href="purchaseUrl(findWishlistItem(entry))"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink :size="16" />
                {{ purchaseButtonLabel(findWishlistItem(entry)) }}
              </a>
              <button class="secondary-button" type="button" @click="simulatePurchase(entry)">
                <BarChart3 :size="16" />
                Simular Compra
              </button>
              <button class="secondary-button" type="button" @click="compareRankingItem(entry)">
                <GitCompareArrows :size="16" />
                Comparar Item
              </button>
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="purchaseDecision"
        class="purchase-decision"
        data-testid="wishlist-purchase-decision"
        role="status"
      >
        <div>
          <p class="eyebrow">Posso comprar?</p>
          <h2>{{ decisionTitle(purchaseDecision) }}</h2>
          <p>{{ purchaseDecision.item_name }} - {{ purchaseDecision.priceLabel || 'Cotação pendente' }}</p>
        </div>
        <div class="decision-summary">
          <div>
            <span>Recomendação</span>
            <strong :class="decisionToneClass(purchaseDecision.recommendation)">
              {{ recommendationText(purchaseDecision.recommendation) }}
            </strong>
          </div>
          <div>
            <span>Impacto mensal</span>
            <strong>{{ formatDecisionImpact(purchaseDecision) }}</strong>
          </div>
          <div>
            <span>Lançamento</span>
            <strong>{{ purchaseDecision.would_write_transaction ? 'Cria lançamento' : 'Não salva automaticamente' }}</strong>
          </div>
        </div>
        <ul v-if="purchaseDecision.reasons?.length">
          <li v-for="reason in purchaseDecision.reasons" :key="reason">{{ reason }}</li>
        </ul>
        <div v-if="purchaseDecisionLink.href" class="decision-actions">
          <a
            class="primary-button"
            data-testid="wishlist-decision-buy-link"
            :href="purchaseDecisionLink.href"
            target="_blank"
            rel="noopener"
          >
            <ExternalLink :size="16" />
            {{ purchaseDecisionLinkLabel }}
          </a>
        </div>
      </section>

      <section v-for="group in wishlistGroups" :key="group.key" v-show="group.items.length" class="wishlist-section">
        <div class="section-title">
          <div>
            <h2>{{ group.title }}</h2>
            <p>{{ group.description }}</p>
          </div>
          <span>{{ group.items.length }}</span>
        </div>

        <div class="wishlist-grid">
          <article v-for="item in group.items" :key="item.id" class="wish-card">
            <div class="wish-image">
              <img v-if="safeImageUrl(item.imageUrl)" :src="safeImageUrl(item.imageUrl)" :alt="item.name" />
              <Package v-else :size="34" />
            </div>

            <div class="wish-body">
              <div class="wish-title-row">
                <h2>{{ item.name }}</h2>
                <span class="status-pill" :class="statusClass(item)">{{ statusLabel(item) }}</span>
              </div>
              <p class="meta">
                {{ item.marketplace || 'Loja pendente' }} - {{ itemCode(item) }} - {{ item.category || 'Outros' }}
              </p>
              <p v-if="item.identity_locked" class="meta technical-meta">
                Produto travado pelo link informado. Nenhuma oferta parecida será usada como melhor preço.
              </p>
              <p v-if="item.product_identity" class="meta technical-meta">
                {{ describeProductIdentity(item.product_identity) }} - {{ itemStatus(item).description }}
              </p>

              <div class="metrics">
                <div>
                  <span>Melhor oferta compatível</span>
                  <strong>{{ formatWishlistPrice(bestPrice(item)) }}</strong>
                </div>
                <div>
                  <span>Preço com frete</span>
                  <strong>{{ formatWishlistPrice(comparablePrice(item)) }}</strong>
                </div>
                <div>
                  <span>Histórico</span>
                  <strong>
                    {{ historySummary(item).count ? `Menor ${formatWishlistPrice(historySummary(item).lowest)}` : 'Sem histórico' }}
                  </strong>
                </div>
                <div>
                  <span>Decisão financeira</span>
                  <strong>{{ decisionText(item) }}</strong>
                </div>
              </div>

              <div
                v-if="goodOfferPurchaseUrl(item)"
                class="good-offer-callout"
                data-testid="wishlist-good-offer"
              >
                <div>
                  <strong>Oferta boa identificada</strong>
                  <span>Preço compatível e compra recomendada para o seu momento.</span>
                </div>
                <a
                  class="primary-button"
                  data-testid="wishlist-good-offer-buy-link"
                  :href="goodOfferPurchaseUrl(item)"
                  target="_blank"
                  rel="noopener"
                >
                  <ExternalLink :size="16" />
                  Comprar item
                </a>
              </div>

              <details class="monitor-details">
                <summary>{{ item.monitorPrice ? 'Busca diária ativa' : 'Configurar alerta de preço' }}</summary>
                <form class="monitor-settings" @submit.prevent="saveMonitor(item)">
                  <label class="monitor-toggle">
                    <input
                      type="checkbox"
                      :checked="item.monitorPrice"
                      @change="toggleMonitor(item, $event.target.checked)"
                    />
                    Busca diária ativa
                  </label>
                  <label>
                    <span>Alertar abaixo de</span>
                    <input
                      v-model="targetPrices[item.id]"
                      type="number"
                      min="0.01"
                      step="0.01"
                      :placeholder="item.targetPrice ? String(item.targetPrice) : 'Qualquer novo menor preço'"
                    />
                  </label>
                  <button class="secondary-button" type="submit">Salvar alerta</button>
                </form>
              </details>

              <form v-if="isPending(item)" class="manual-price" @submit.prevent="saveManualPrice(item)">
                <label>
                  <span>Preço manual opcional</span>
                  <input
                    v-model="manualPrices[item.id]"
                    type="number"
                    min="0.01"
                    step="0.01"
                    :placeholder="item.value ? String(item.value) : 'Ex: 277.00'"
                  />
                </label>
                <button class="secondary-button" type="submit">Salvar preço</button>
              </form>
            </div>

            <div class="wish-actions">
              <a
                v-if="purchaseUrl(item)"
                class="primary-button"
                data-testid="wishlist-buy-link"
                :href="purchaseUrl(item)"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink :size="16" />
                {{ purchaseLinkLabel(item) }}
              </a>
              <button class="secondary-button" type="button" :disabled="refreshingId === item.id" @click="refresh(item)">
                <RefreshCcw :size="16" />
                {{ refreshingId === item.id ? 'Atualizando' : 'Atualizar preço' }}
              </button>
              <router-link class="secondary-button" :to="`/purchases/${item.id}`">
                Detalhes
              </router-link>
              <button class="danger-button" type="button" @click="deleteItem(item)">
                <Trash2 :size="16" />
                Excluir
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
    <ContextualAssistant context-type="purchases" />
    <ConfirmModal
      :show="pendingDeleteItem != null"
      title="Excluir item da wishlist"
      :message="deleteMessage"
      confirm-label="Excluir"
      cancel-label="Cancelar"
      destructive
      @confirm="confirmDeleteItem"
      @cancel="pendingDeleteItem = null"
    />
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BarChart3, BellRing, ExternalLink, GitCompareArrows, Package, Plus, RefreshCcw, ShieldAlert, Trash2 } from 'lucide-vue-next'
import EmptyState from '@/components/EmptyState.vue'
import ContextualAssistant from '@/components/ContextualAssistant.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useNotification } from '@/composables/useNotification'
import { usePlanAccess } from '@/composables/usePlanAccess'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { useWishlistPredictiveEngine } from '@/composables/useWishlistPredictiveEngine'
import { formatCurrency } from '@/utils/financial-planner.js'
import {
  buildWishlistPurchaseSimulation,
  formatWishlistPrice,
} from '@/utils/wishlist-decision.js'
import { useFinanceStore } from '@/stores/finance.js'
import {
  describeProductIdentity,
  hasCompatiblePrice,
  isAcceptedCompatibleOffer,
  requiresCompatiblePrice,
} from '@/utils/productIdentity.js'
import {
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'
import { purchaseLinkForItem } from '@/utils/purchase-link.js'
import { normalizeExternalUrl, normalizeImageUrl } from '@/utils/safe-url.js'

const workflow = usePurchaseWorkflow()
const planAccess = usePlanAccess()
const predictiveEngine = useWishlistPredictiveEngine()
const financeStore = useFinanceStore()
const { showToast } = useNotification()
const refreshingId = ref('')
const manualPrices = ref({})
const targetPrices = ref({})
const purchaseDecision = ref(null)
const purchaseDecisionItem = ref(null)
const pendingDeleteItem = ref(null)
const wishlist = workflow.wishlist
const purchaseContext = computed(() => workflow.buildContext())
const openPriceAlerts = computed(() => (financeStore.state.priceMonitorAlerts || [])
  .filter((alert) => alert.status === 'open'))
const deleteMessage = computed(() => pendingDeleteItem.value
  ? `Deseja excluir "${pendingDeleteItem.value.name}" da sua lista? Essa ação removerá o item da wishlist.`
  : '')

const monthlySavingsCapacity = computed(() => Math.max(
  0,
  Number(financeStore.state.settings.monthlySavingsCapacity ?? purchaseContext.value.monthlySurplus ?? 0),
))
const currentSavings = computed(() => Math.max(0, Number(purchaseContext.value.currentBalance || 0)))
const wishlistLimit = computed(() => planAccess.access.value.limits?.wishlist_items)
const canUseWishlist = computed(() => planAccess.canUse('wishlist_items'))
const wishlistLimitReached = computed(() =>
  Number.isFinite(wishlistLimit.value) && wishlist.value.length >= Number(wishlistLimit.value),
)
const canCreateWishlistItem = computed(() => canUseWishlist.value && !wishlistLimitReached.value)
const wishlistPermissionMessage = computed(() => {
  if (!canUseWishlist.value) return 'Wishlist indisponível para o plano atual.'
  if (wishlistLimitReached.value) return `Limite de ${wishlistLimit.value} itens da wishlist atingido neste plano.`
  return ''
})

const pendingItems = computed(() => wishlist.value.filter((item) => isPending(item)))
const quotedItems = computed(() => wishlist.value.filter((item) => !isPending(item)))
const predictiveRanking = computed(() => predictiveEngine.buildWishlistPurchaseRanking({
  items: wishlist.value,
  monthlySavingsCapacity: monthlySavingsCapacity.value,
  currentSavings: currentSavings.value,
}))
const wishlistGroups = computed(() => [
  {
    key: 'quoted',
    title: 'Com preço para avaliar',
    description: 'Itens com oferta compatível, histórico ou recomendação financeira.',
    items: quotedItems.value,
  },
  {
    key: 'pending',
    title: 'Buscando preço',
    description: 'Itens salvos que ainda precisam de oferta compatível.',
    items: pendingItems.value,
  },
])
const purchaseDecisionLink = computed(() => (
  purchaseDecisionItem.value ? purchaseLinkForItem(purchaseDecisionItem.value) : { href: '', label: '', direct: false }
))
const purchaseDecisionLinkLabel = computed(() => (
  purchaseDecisionLink.value.direct ? 'Comprar item' : purchaseDecisionLink.value.label
))

function isPending(item) {
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return true
  return item.priceStatus !== 'quoted' && !workflow.offersFor(item).length
}

function bestPrice(item) {
  return comparablePrice(item)
}

function potentialSavings(item) {
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return 'Aguardando compatibilidade'
  const offers = workflow.offersFor(item)
    .filter((offer) => Number(offer.total || offer.totalPrice || 0) > 0)
    .filter((offer) => !requiresCompatiblePrice(item) || isAcceptedCompatibleOffer(offer))
  if (offers.length < 2) return 'A monitorar'
  const totals = offers.map((offer) => Number(offer.total || offer.totalPrice))
  return formatCurrency(Math.max(...totals) - Math.min(...totals))
}

function itemStatus(item) {
  return productSearchStatus(item)
}

function itemCode(item) {
  return canonicalProductCode(item)
}

function comparablePrice(item) {
  return totalComparablePrice(item)
}

function historySummary(item) {
  return priceHistorySummary(item)
}

function purchaseUrl(item) {
  return purchaseLinkForItem(item).href
}

function safeAlertUrl(alert) {
  return normalizeExternalUrl(alert?.url)
}

function safeImageUrl(value) {
  return normalizeImageUrl(value)
}

function purchaseLinkLabel(item) {
  return purchaseLinkForItem(item).label
}

function purchaseButtonLabel(item) {
  const link = purchaseLinkForItem(item)
  return link.direct ? 'Comprar item' : link.label
}

function isGoodOffer(item) {
  return Boolean(workflow.analysisFor(item)?.buyTodayRecommended)
}

function goodOfferPurchaseUrl(item) {
  const link = purchaseLinkForItem(item)
  if (!link.direct || !isGoodOffer(item)) return ''
  return link.href
}

function decisionText(item) {
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return 'Aguardando preço confiável'
  const analysis = workflow.analysisFor(item)
  if (!analysis) return isPending(item) ? 'Aguardar cotação' : 'A monitorar'
  return analysis.buyTodayRecommended ? 'Comprar' : 'Aguardar'
}

function delayLabel(entry) {
  const delayDays = entry.comparison?.delayDays
  if (delayDays == null) return 'Sem atraso relevante'
  if (delayDays <= 0) return 'Sem atraso'
  return `Atrasa ${delayDays} dias`
}

function decisionClass(decision) {
  if (decision === 'Comprar à vista') return 'buy'
  if (decision === 'Alto custo de oportunidade') return 'risk'
  if (decision === 'Adiar') return 'wait'
  return 'simulate'
}

function selectedReferenceDate() {
  const today = new Date()
  const year = Number(financeStore.state.settings?.year) || today.getFullYear()
  const month = Number(financeStore.state.settings?.selectedMonth) || today.getMonth() + 1
  return new Date(year, month - 1, 15, 12, 0, 0)
}

function findWishlistItem(entry) {
  return wishlist.value.find((item) => item.id === entry?.id)
    || wishlist.value.find((item) => item.name === entry?.name)
    || entry
}

function recommendationText(recommendation) {
  if (recommendation === 'comprar') return 'Comprar'
  if (recommendation === 'inviavel agora') return 'Inviável agora'
  return 'Esperar'
}

function decisionToneClass(recommendation) {
  if (recommendation === 'comprar') return 'buy'
  if (recommendation === 'inviavel agora') return 'risk'
  return 'wait'
}

function decisionTitle(result) {
  if (result.status === 'quote_pending') return 'Cotação pendente'
  if (result.recommendation === 'comprar') return 'Compra viável agora'
  if (result.recommendation === 'inviavel agora') return 'Compra inviável agora'
  return 'Melhor esperar'
}

function formatDecisionImpact(result) {
  if (!result?.canSimulate) return 'Aguardando preço'
  return formatWishlistPrice(result.monthly_impact)
}

function simulatePurchase(entry) {
  const item = findWishlistItem(entry)
  const result = buildWishlistPurchaseSimulation(item, financeStore.state, selectedReferenceDate(), {
    price: entry?.cost,
  })
  purchaseDecision.value = result
  purchaseDecisionItem.value = item

  if (!result.canSimulate) {
    showToast(`${result.item_name || entry.name}: cotação pendente.`, 'warning')
    return
  }

  showToast(
    `${result.item_name || entry.name}: ${recommendationText(result.recommendation).toLowerCase()}.`,
    result.recommendation === 'comprar' ? 'success' : 'warning',
  )
}

function compareRankingItem(entry) {
  const delay = delayLabel(entry).toLowerCase()
  showToast(`${entry.name}: ${delay}.`, 'info')
}

function statusLabel(item) {
  return itemStatus(item).label
}

function statusClass(item) {
  return itemStatus(item).tone
}

function parseManualPrice(raw) {
  const normalized = String(raw || '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

function saveManualPrice(item) {
  const value = parseManualPrice(manualPrices.value[item.id] || item.value)
  if (!value) {
    showToast('Informe um valor manual válido.', 'warning')
    return
  }

  try {
    workflow.setManualPrice(item.id, value)
    manualPrices.value[item.id] = ''
    showToast('Preço manual salvo. Cotação automática segue pendente.', 'success')
  } catch (error) {
    showToast(error.message || 'Falha ao salvar preço manual', 'error')
  }
}

function monitorTarget(item) {
  const raw = targetPrices.value[item.id] ?? item.targetPrice
  const value = Number(String(raw || '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

function toggleMonitor(item, enabled) {
  workflow.setPriceMonitoring(item.id, enabled, monitorTarget(item))
  showToast(enabled ? 'Busca diária ativada.' : 'Busca diária desativada.', 'success')
}

function saveMonitor(item) {
  workflow.setPriceMonitoring(item.id, true, monitorTarget(item))
  showToast(
    monitorTarget(item) ? 'Preço-alvo salvo.' : 'Alerta para novo menor preço ativado.',
    'success',
  )
}

function dismissAlert(alertId) {
  workflow.dismissPriceAlert(alertId)
}

function deleteItem(item) {
  pendingDeleteItem.value = item
}

function confirmDeleteItem() {
  if (!pendingDeleteItem.value) return
  financeStore.deleteWishlistItem(pendingDeleteItem.value.id)
  pendingDeleteItem.value = null
  showToast('Item excluído da sua wishlist.', 'success')
}

async function refresh(item) {
  refreshingId.value = item.id
  try {
    const updated = await workflow.refreshItemPrices(item)
    if (updated.priceDiagnostics?.length) {
      console.debug('PRICE_QUOTE_DIAGNOSTICS', {
        itemId: item.id,
        diagnostics: updated.priceDiagnostics,
      })
    }
    showToast(
      updated.priceStatus === 'quoted' ? 'Preço atualizado.' : 'Cotação pendente.',
      updated.priceStatus === 'quoted' ? 'success' : 'warning',
    )
  } catch (error) {
    console.warn('PRICE_REFRESH_ERROR', error)
    showToast('Cotação pendente. Tente novamente mais tarde.', 'warning')
  } finally {
    refreshingId.value = ''
  }
}
</script>

<style scoped>
.wishlist-page { max-width: 1180px; margin: 0 auto; padding: 1rem 1.25rem 2rem; display: grid; gap: 1rem; }
.page-head, .empty-panel, .section-title {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  box-shadow: none;
}
/* Fluid ledger exception: repeated product/result tile. */
.wish-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
}
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem; }
.page-head h1 { margin: 0.15rem 0; font-family: var(--font-display); font-size: var(--page-title-size); font-weight: var(--page-title-weight); line-height: var(--page-title-line-height); letter-spacing: 0; }
.wish-card h2, .section-title h2 { margin: 0.15rem 0; }
.page-head p, .meta, .empty-panel p, .section-title p { color: var(--text-secondary); }
.page-head p:not(.eyebrow) { font-family: var(--font-sans); font-size: var(--page-subtitle-size); line-height: 1.5; }
.eyebrow { margin: 0; color: var(--accent-hover); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; letter-spacing: var(--eyebrow-letter-spacing); text-transform: uppercase; }
.empty-panel { text-align: center; padding: 2rem; color: var(--text-muted); }
.empty-panel h2 { color: var(--text-primary); }
.wishlist-sections, .wishlist-section, .wishlist-grid { display: grid; gap: 0.85rem; }
.section-title { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.85rem 1rem; }
.section-title > span { min-width: 32px; min-height: 32px; display: grid; place-items: center; border-radius: 999px; background: var(--blue-dim); color: var(--accent-hover); font-weight: 800; }
.permission-banner {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.12);
  color: var(--text-primary);
}
.permission-banner p { margin: 0; color: var(--text-secondary); font-size: 0.88rem; }
.permission-banner svg { flex: 0 0 auto; color: var(--warning); }
.predictive-ranking {
  display: grid;
  gap: 0.8rem;
  padding: 0.85rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}
.ranking-title { padding: 0; border: 0; box-shadow: none; background: transparent; }
.ranking-list { display: grid; gap: 0.65rem; }
.ranking-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}
.rank-index {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--blue-dim);
  color: var(--accent-hover);
  font-weight: 900;
}
.ranking-copy { min-width: 0; }
.ranking-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.ranking-head h3 { margin: 0; font-size: 1rem; line-height: 1.3; color: var(--text-primary); }
.ranking-copy p { margin: 0.35rem 0 0; color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; }
.ranking-metrics { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.65rem; }
.ranking-metrics span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 800;
}
.decision-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 900;
  white-space: nowrap;
}
.decision-pill.buy { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.decision-pill.wait { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.decision-pill.risk { color: #f87171; background: rgba(248, 113, 113, 0.12); }
.decision-pill.simulate { color: var(--accent-hover); background: var(--blue-dim); }
.ranking-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }
.purchase-decision {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}
.purchase-decision h2 { margin: 0.15rem 0; font-size: 1.05rem; line-height: 1.3; }
.purchase-decision p { margin: 0; color: var(--text-secondary); }
.purchase-decision ul {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding-left: 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.45;
}
.decision-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; }
.decision-summary div {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.65rem;
  background: var(--bg-hover);
}
.decision-summary span { display: block; margin-bottom: 0.25rem; color: var(--text-secondary); font-size: 0.75rem; }
.decision-summary strong { font-size: 0.9rem; color: var(--text-primary); }
.decision-summary strong.buy { color: #34d399; }
.decision-summary strong.wait { color: #fbbf24; }
.decision-summary strong.risk { color: #f87171; }
.wish-card { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 1rem; align-items: center; padding: 0.85rem; }
.wish-image { width: 112px; aspect-ratio: 1; border-radius: 8px; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; color: var(--text-muted); overflow: hidden; }
.wish-image img { width: 100%; height: 100%; object-fit: cover; }
.wish-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.wish-title-row h2 { font-size: 1rem; line-height: 1.35; }
.technical-meta { font-size: 0.72rem; overflow-wrap: anywhere; }
.monitor-details { margin-top: 0.7rem; border-top: 1px solid var(--border-color); padding-top: 0.65rem; }
.monitor-details summary { cursor: pointer; color: var(--accent-hover); font-size: 0.8rem; font-weight: 700; }
.monitor-details[open] summary { margin-bottom: 0.55rem; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; margin-top: 0.75rem; }
.metrics div { border: 1px solid var(--border-color); border-radius: 8px; padding: 0.65rem; background: var(--bg-hover); }
.metrics span, .manual-price span { display: block; color: var(--text-secondary); font-size: 0.75rem; margin-bottom: 0.25rem; }
.price-alerts { display: grid; gap: 0.65rem; padding: 0.85rem; background: var(--bg-panel); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 8px; }
.price-alert-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; border-radius: 8px; background: rgba(52, 211, 153, 0.08); }
.price-alert-row p { margin: 0.25rem 0 0; color: var(--text-secondary); }
.alert-actions, .monitor-settings { display: flex; align-items: end; gap: 0.6rem; flex-wrap: wrap; }
.monitor-settings { margin-top: 0; }
.monitor-settings label { min-width: 180px; }
.monitor-settings input[type='number'] { width: 100%; }
.monitor-toggle { display: flex; align-items: center; gap: 0.45rem; min-height: 38px; color: var(--text-secondary); }
.monitor-toggle input { width: auto; }
.metrics strong { font-size: 0.92rem; }
.good-offer-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgba(52, 211, 153, 0.35);
  border-radius: 8px;
  background: rgba(52, 211, 153, 0.08);
}
.good-offer-callout div { min-width: 0; }
.good-offer-callout strong {
  display: block;
  color: #34d399;
  font-size: 0.9rem;
  line-height: 1.35;
}
.good-offer-callout span {
  display: block;
  margin-top: 0.15rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}
.good-offer-callout .primary-button {
  flex: 0 0 auto;
  white-space: nowrap;
}
.manual-price { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 0.55rem; margin-top: 0.75rem; }
.manual-price input { width: 100%; padding: 0.65rem; }
.status-pill { border-radius: 999px; padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
.status-pill.success { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.info { color: var(--accent-hover); background: var(--blue-dim); }
.status-pill.warning,
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.status-pill.danger { color: #f87171; background: rgba(248, 113, 113, 0.12); }
.wish-actions { display: grid; gap: 0.5rem; }
.wish-actions .primary-button,
.wish-actions .secondary-button,
.wish-actions .danger-button { width: 100%; }
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  background: rgba(248, 113, 113, 0.08);
  color: #f87171;
  font-weight: 700;
  cursor: pointer;
}
@media (max-width: 860px) {
  .page-head, .wish-card, .section-title { grid-template-columns: 1fr; align-items: stretch; }
  .page-head, .section-title { flex-direction: column; align-items: flex-start; }
  .ranking-card { grid-template-columns: 1fr; align-items: stretch; }
  .rank-index { width: 100%; }
  .ranking-head, .ranking-actions { flex-direction: column; align-items: stretch; }
  .wish-image { width: 100%; max-height: 180px; }
  .metrics, .manual-price, .decision-summary { grid-template-columns: 1fr; }
  .good-offer-callout { flex-direction: column; align-items: stretch; }
  .good-offer-callout .primary-button { width: 100%; }
}
</style>
