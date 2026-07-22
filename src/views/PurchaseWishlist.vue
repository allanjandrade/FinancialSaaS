<template>
  <main class="wishlist-page">
    <section class="page-head">
      <div>
        <p class="eyebrow">Planejamento</p>
        <h1>Compras</h1>
        <p>Produtos salvos, status de cotacao e proximas decisoes de compra.</p>
      </div>
      <router-link class="primary-button" to="/purchases/new">
        <Plus :size="18" />
        Nova compra
      </router-link>
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
          <a v-if="alert.url" :href="alert.url" target="_blank" rel="noopener" class="primary-button">Ver oferta</a>
          <button class="secondary-button" type="button" @click="dismissAlert(alert.id)">Marcar como visto</button>
        </div>
      </article>
    </section>

    <EmptyState
      v-if="!wishlist.length"
      :icon="Package"
      title="Nenhum produto salvo"
      description="Comece por uma descricao ou link de produto para comparar precos e planejar a compra."
      action-label="Adicionar produto"
      action-to="/purchases/new"
    />

    <section v-else class="wishlist-sections">
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
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
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
                Produto travado pelo link informado. Nenhuma oferta parecida sera usada como melhor preco.
              </p>
              <p v-if="item.product_identity" class="meta technical-meta">
                {{ describeProductIdentity(item.product_identity) }} - {{ itemStatus(item).description }}
              </p>

              <div class="metrics">
                <div>
                  <span>Melhor oferta compativel</span>
                  <strong>{{ formatCurrency(bestPrice(item)) }}</strong>
                </div>
                <div>
                  <span>Preco com frete</span>
                  <strong>{{ formatCurrency(comparablePrice(item)) }}</strong>
                </div>
                <div>
                  <span>Historico</span>
                  <strong>
                    {{ historySummary(item).count ? `Menor ${formatCurrency(historySummary(item).lowest)}` : 'Sem historico' }}
                  </strong>
                </div>
                <div>
                  <span>Decisao financeira</span>
                  <strong>{{ decisionText(item) }}</strong>
                </div>
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
                  <span>Preco manual opcional</span>
                  <input
                    v-model="manualPrices[item.id]"
                    type="number"
                    min="0.01"
                    step="0.01"
                    :placeholder="item.value ? String(item.value) : 'Ex: 277.00'"
                  />
                </label>
                <button class="secondary-button" type="submit">Salvar preco</button>
              </form>
            </div>

            <div class="wish-actions">
              <button class="secondary-button" type="button" :disabled="refreshingId === item.id" @click="refresh(item)">
                <RefreshCcw :size="16" />
                {{ refreshingId === item.id ? 'Atualizando' : 'Atualizar preco' }}
              </button>
              <router-link class="primary-button" :to="`/purchases/${item.id}`">
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
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BellRing, Package, Plus, RefreshCcw, Trash2 } from 'lucide-vue-next'
import EmptyState from '@/components/EmptyState.vue'
import ContextualAssistant from '@/components/ContextualAssistant.vue'
import { useNotification } from '@/composables/useNotification'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { formatCurrency } from '@/utils/financial-planner.js'
import { useFinanceStore } from '@/stores/finance.js'
import {
  describeProductIdentity,
  hasCompatiblePrice,
  isAcceptedCompatibleOffer,
  requiresCompatiblePrice,
} from '@/utils/productIdentity.js'
import {
  bestComparableOffer,
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'

const workflow = usePurchaseWorkflow()
const financeStore = useFinanceStore()
const { showToast } = useNotification()
const refreshingId = ref('')
const manualPrices = ref({})
const targetPrices = ref({})
const wishlist = workflow.wishlist
const openPriceAlerts = computed(() => (financeStore.state.priceMonitorAlerts || [])
  .filter((alert) => alert.status === 'open'))

const pendingItems = computed(() => wishlist.value.filter((item) => isPending(item)))
const quotedItems = computed(() => wishlist.value.filter((item) => !isPending(item)))
const wishlistGroups = computed(() => [
  {
    key: 'quoted',
    title: 'Com preco para avaliar',
    description: 'Itens com oferta compativel, historico ou recomendacao financeira.',
    items: quotedItems.value,
  },
  {
    key: 'pending',
    title: 'Buscando preco',
    description: 'Itens salvos que ainda precisam de oferta compativel.',
    items: pendingItems.value,
  },
])

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

function currentOffer(item) {
  return bestComparableOffer(item)
}

function comparablePrice(item) {
  return totalComparablePrice(item)
}

function historySummary(item) {
  return priceHistorySummary(item)
}

function decisionText(item) {
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return 'Aguardando preco confiavel'
  const analysis = workflow.analysisFor(item)
  if (!analysis) return isPending(item) ? 'Aguardar cotacao' : 'A monitorar'
  return analysis.buyTodayRecommended ? 'Comprar' : 'Aguardar'
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
    showToast('Informe um valor manual valido.', 'warning')
    return
  }

  try {
    workflow.setManualPrice(item.id, value)
    manualPrices.value[item.id] = ''
    showToast('Preco manual salvo. Cotacao automatica segue pendente.', 'success')
  } catch (error) {
    showToast(error.message || 'Falha ao salvar preco manual', 'error')
  }
}

function monitorTarget(item) {
  const raw = targetPrices.value[item.id] ?? item.targetPrice
  const value = Number(String(raw || '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

function toggleMonitor(item, enabled) {
  workflow.setPriceMonitoring(item.id, enabled, monitorTarget(item))
  showToast(enabled ? 'Busca diaria ativada.' : 'Busca diaria desativada.', 'success')
}

function saveMonitor(item) {
  workflow.setPriceMonitoring(item.id, true, monitorTarget(item))
  showToast(
    monitorTarget(item) ? 'Preco-alvo salvo.' : 'Alerta para novo menor preco ativado.',
    'success',
  )
}

function dismissAlert(alertId) {
  workflow.dismissPriceAlert(alertId)
}

function deleteItem(item) {
  const confirmed = window.confirm('Deseja excluir este item da sua lista?\nEssa ação removerá o item da sua wishlist.')
  if (!confirmed) return
  financeStore.deleteWishlistItem(item.id)
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
      updated.priceStatus === 'quoted' ? 'Preco atualizado.' : 'Cotacao pendente.',
      updated.priceStatus === 'quoted' ? 'success' : 'warning',
    )
  } catch (error) {
    console.warn('PRICE_REFRESH_ERROR', error)
    showToast('Cotacao pendente. Tente novamente mais tarde.', 'warning')
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
.page-head h1, .wish-card h2, .section-title h2 { margin: 0.15rem 0; }
.page-head p, .meta, .empty-panel p, .section-title p { color: var(--text-secondary); }
.eyebrow { margin: 0; color: var(--accent-hover); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.empty-panel { text-align: center; padding: 2rem; color: var(--text-muted); }
.empty-panel h2 { color: var(--text-primary); }
.wishlist-sections, .wishlist-section, .wishlist-grid { display: grid; gap: 0.85rem; }
.section-title { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.85rem 1rem; }
.section-title > span { min-width: 32px; min-height: 32px; display: grid; place-items: center; border-radius: 999px; background: var(--blue-dim); color: var(--accent-hover); font-weight: 800; }
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
.manual-price { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 0.55rem; margin-top: 0.75rem; }
.manual-price input { width: 100%; padding: 0.65rem; }
.status-pill { border-radius: 999px; padding: 0.3rem 0.6rem; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
.status-pill.success { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.info { color: var(--accent-hover); background: var(--blue-dim); }
.status-pill.warning,
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.status-pill.danger { color: #f87171; background: rgba(248, 113, 113, 0.12); }
.wish-actions { display: grid; gap: 0.5rem; }
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
  .wish-image { width: 100%; max-height: 180px; }
  .metrics, .manual-price { grid-template-columns: 1fr; }
}
</style>
