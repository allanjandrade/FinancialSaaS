<template>
  <main class="detail-page">
    <router-link class="back-link" to="/purchases">
      <ArrowLeft :size="16" />
      Voltar para wishlist
    </router-link>

    <section v-if="!item" class="empty-panel">
      <Package :size="42" />
      <h1>Produto nao encontrado</h1>
    </section>

    <template v-else>
      <section class="product-panel">
        <div class="product-media">
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
          <Package v-else :size="48" />
        </div>
        <div class="product-main">
          <div class="title-row">
            <div>
              <p class="eyebrow">Detalhe do produto</p>
              <h1>{{ item.name }}</h1>
              <p>{{ item.marketplace || 'Marketplace pendente' }} · {{ item.category || 'Outros' }}</p>
            </div>
            <span class="status-pill" :class="uiStatus.tone">
              {{ uiStatus.label }}
            </span>
          </div>

          <div class="hero-metrics">
            <div>
              <span>Preco atual</span>
              <strong>{{ comparableTotal ? formatCurrency(comparableTotal) : 'Nao encontrado' }}</strong>
            </div>
            <div>
              <span>Menor historico</span>
              <strong>{{ historySummary.lowest ? formatCurrency(historySummary.lowest) : 'Sem historico' }}</strong>
            </div>
            <div>
              <span>Decisao financeira</span>
              <strong>{{ analysis ? (analysis.buyTodayRecommended ? 'Comprar' : 'Aguardar') : 'Pendente' }}</strong>
            </div>
          </div>

          <div class="action-row">
            <button class="secondary-button" type="button" :disabled="refreshing" @click="refresh">
              <RefreshCcw :size="16" />
              {{ refreshing ? 'Atualizando...' : 'Atualizar precos' }}
            </button>
            <a v-if="item.canonicalUrl || item.originalLink" class="primary-button" :href="item.canonicalUrl || item.originalLink" target="_blank" rel="noopener">
              Ver anuncio
            </a>
            <button v-if="compatibleRequired || rejectedCandidates.length" class="secondary-button" type="button" @click="showRejected = !showRejected">
              Ver rejeitados
            </button>
          </div>
          <div v-if="item.identity_locked" class="identity-box">
            <span>Produto</span>
            <strong>{{ item.name }}</strong>
            <small>Codigo canonico: {{ canonicalCode }}</small>
            <small>URL canonica: {{ item.canonicalUrl || item.originalLink || 'Nao informada' }}</small>
          </div>
          <p v-if="compatibleRequired && !compatiblePriceReady" class="identity-warning">
            Ainda nao encontramos uma oferta compativel para este produto. Produtos parecidos ficam separados e nao entram como melhor preco.
          </p>
        </div>
      </section>

      <section class="grid-two">
        <article class="panel">
          <h2>Decisao financeira</h2>
          <div v-if="analysis" class="decision-box" :class="analysis.buyTodayRecommended ? 'ok' : 'wait'">
            <strong>{{ analysis.status }}</strong>
            <p>{{ analysis.recommendation }}</p>
            <p>{{ analysis.strategy }}</p>
          </div>
          <p v-else class="muted">A decisao financeira sera calculada quando houver preco compativel identificado.</p>
        </article>

        <article class="panel">
          <h2>Preco</h2>
          <div v-if="intelligence.decision === 'price_identity_pending'" class="decision-box wait">
            <strong>Compatibilidade pendente</strong>
            <p>{{ intelligence.message }}</p>
          </div>
          <div v-else class="mini-grid">
            <div>
              <span>Oportunidade</span>
              <strong>{{ intelligence.opportunity.score }}/100</strong>
            </div>
            <div>
              <span>Necessidade</span>
              <strong>{{ intelligence.necessity.score }}/100</strong>
            </div>
          </div>
          <p v-if="intelligence.decision !== 'price_identity_pending'" class="muted">{{ intelligence.opportunity.verdict }}</p>
        </article>
      </section>

      <section class="grid-two">
        <article class="panel">
          <h2>Historico</h2>
          <div v-if="historyRows.length" class="history">
            <article v-for="snap in historyRows" :key="snap.at" class="history-entry">
              <div class="history-head">
                <span>{{ formatDate(snap.at) }}</span>
                <strong>{{ formatCurrency(snap.total) }}</strong>
                <small>{{ snap.marketplace || snap.source }}</small>
              </div>
              <div v-if="snap.offers.length" class="history-offers">
                <div v-for="(offer, index) in snap.offers" :key="`${snap.at}-${offer.marketplace}-${offer.total}`" class="history-offer">
                  <span class="offer-position">{{ index + 1 }}º</span>
                  <div>
                    <strong>{{ offer.marketplace || 'Loja' }}</strong>
                    <small v-if="offer.title">{{ offer.title }}</small>
                  </div>
                  <strong>{{ formatCurrency(offer.total) }}</strong>
                  <a v-if="offer.url" :href="offer.url" target="_blank" rel="noopener">Comprar</a>
                  <span v-else class="muted">Link indisponivel</span>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="muted">Nenhum preco compativel encontrado ainda.</p>
          <details v-if="rejectedCandidates.length" :open="showRejected" class="rejected-box" @toggle="showRejected = $event.target.open">
            <summary>Compatibilidade</summary>
            <p>Ignoramos estes produtos porque nao parecem compativeis com o item cadastrado.</p>
            <article v-for="candidate in rejectedCandidates" :key="`${candidate.title}-${candidate.total}`" class="rejected-row">
              <span>{{ candidate.title }}</span>
              <strong>{{ formatCurrency(candidate.total || candidate.price) }}</strong>
              <small>{{ candidate.reason || candidate.match_reason }}</small>
            </article>
          </details>
        </article>

        <article class="panel">
          <h2>Chat contextual</h2>
          <div class="chips">
            <button v-for="question in questions" :key="question" type="button" @click="ask(question)">
              {{ question }}
            </button>
          </div>
          <form class="chat-form" @submit.prevent="ask(customQuestion)">
            <input v-model="customQuestion" placeholder="Pergunte sobre este produto" />
            <button class="secondary-button" type="submit">Perguntar</button>
          </form>
          <p v-if="answer" class="answer">{{ answer }}</p>
        </article>
      </section>

      <section class="panel marketplace-comparison">
        <div class="section-head">
          <div>
            <p class="eyebrow">Ofertas</p>
            <h2>Ofertas compativeis</h2>
          </div>
          <span>{{ comparisonOffers.length }} melhor(es) oferta(s)</span>
        </div>
        <div v-if="!comparisonOffers.length" class="pending-box">
          <p>Nenhum preco compativel encontrado ainda.</p>
        </div>
        <div v-else class="offers-grid">
          <article v-for="offer in comparisonOffers" :key="`${offer.marketplace}-${offer.total}`" class="offer-card">
            <span>{{ offer.marketplace }}</span>
            <strong>{{ formatCurrency(offer.total || offer.totalPrice || offer.price) }}</strong>
            <p>{{ offer.title || offer.seller || 'Oferta encontrada' }}</p>
            <a v-if="offer.url" :href="offer.url" target="_blank" rel="noopener">Abrir oferta</a>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Package, RefreshCcw } from 'lucide-vue-next'
import { useNotification } from '@/composables/useNotification'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { answerDecisionQuestion, formatCurrency } from '@/utils/financial-planner.js'
import { hasCompatiblePrice, isAcceptedCompatibleOffer, requiresCompatiblePrice } from '@/utils/productIdentity.js'
import {
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'

const route = useRoute()
const { showToast } = useNotification()
const workflow = usePurchaseWorkflow()
const refreshing = ref(false)
const showRejected = ref(false)
const customQuestion = ref('')
const answer = ref('')
const questions = ['Posso comprar isso hoje?', 'Vale esperar?', 'Compromete minha reserva?']

const item = computed(() => workflow.wishlist.value.find((wish) => wish.id === route.params.id))
const offers = computed(() => workflow.offersFor(item.value))
const compatibleRequired = computed(() => requiresCompatiblePrice(item.value))
const compatiblePriceReady = computed(() => hasCompatiblePrice(item.value))
const uiStatus = computed(() => productSearchStatus(item.value || {}))
const canonicalCode = computed(() => canonicalProductCode(item.value || {}))
const comparableTotal = computed(() => totalComparablePrice(item.value || {}))
const historySummary = computed(() => priceHistorySummary(item.value || {}))
const compatibleTotal = computed(() => Number(comparableTotal.value || 0))
const rejectedCandidates = computed(() => item.value?.last_rejected_candidates || item.value?.rejected_candidates || [])
const comparisonOffers = computed(() => [...offers.value]
  .filter((offer) => Number(offer.total || offer.totalPrice || offer.price || 0) > 0)
  .filter((offer) => !compatibleRequired.value || isAcceptedCompatibleOffer(offer))
  .sort((a, b) => Number(a.total || a.totalPrice || a.price) - Number(b.total || b.totalPrice || b.price))
  .slice(0, 10))
const best = computed(() => workflow.bestOffersFor(item.value))
const analysis = computed(() => workflow.analysisFor(item.value))
const intelligence = computed(() => workflow.intelligenceFor(item.value || {}))
const currentTopOffers = computed(() => [...offers.value]
  .filter((offer) => Number(offer.total || offer.totalPrice || offer.price || 0) > 0)
  .filter((offer) => !compatibleRequired.value || isAcceptedCompatibleOffer(offer))
  .sort((a, b) => Number(a.total || a.totalPrice || a.price) - Number(b.total || b.totalPrice || b.price))
  .slice(0, 3)
  .map((offer) => ({
    ...offer,
    total: Number(offer.total || offer.totalPrice || offer.price),
  })))
const historyRows = computed(() => (item.value?.priceHistory || [])
  .filter((snapshot) => !compatibleRequired.value || isAcceptedCompatibleOffer(snapshot))
  .slice()
  .reverse()
  .slice(0, 6)
  .map((snapshot, index) => ({
    ...snapshot,
    offers: Array.isArray(snapshot.offers) && snapshot.offers.length
      ? snapshot.offers.filter((offer) => !compatibleRequired.value || isAcceptedCompatibleOffer(offer)).slice(0, 3)
      : index === 0
        ? currentTopOffers.value
        : [],
  })))

async function refresh() {
  if (!item.value) return
  refreshing.value = true
  try {
    const updated = await workflow.refreshItemPrices(item.value)
    showToast(updated.priceStatus === 'quoted' ? 'Preco compativel atualizado.' : 'Cotacao compativel pendente.', updated.priceStatus === 'quoted' ? 'success' : 'warning')
  } catch (error) {
    showToast(error.message || 'Falha ao atualizar preco', 'error')
  } finally {
    refreshing.value = false
  }
}

function ask(question) {
  const q = String(question || '').trim()
  if (!q || !item.value) return
  customQuestion.value = ''
  const currentAnalysis = analysis.value || {
    buyTodayRecommended: false,
    strategy: 'Aguardar cotacao',
    recommendation: 'Ainda nao ha preco real para concluir a analise.',
    status: 'Compatibilidade pendente',
    reasons: ['Cotacao pendente. Atualize precos para completar a analise.'],
    installments: [],
    savingsPlan: { months: 0 },
    monthlySavingNeeded: 0,
  }
  answer.value = answerDecisionQuestion(q, item.value, currentAnalysis, best.value)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-'
}
</script>

<style scoped>
.detail-page { max-width: 1180px; margin: 0 auto; padding: 1rem 1.25rem 2rem; display: grid; gap: 1rem; }
.back-link { color: var(--accent-hover); text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700; }
.product-panel, .panel, .empty-panel {
  background: var(--surface-ledger);
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  box-shadow: none;
}
.product-panel { display: grid; grid-template-columns: 280px minmax(0, 1fr); overflow: hidden; }
.product-media { min-height: 280px; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
.product-media img { width: 100%; height: 100%; object-fit: contain; }
.product-main, .panel, .empty-panel { padding: 1rem; }
.title-row, .section-head, .action-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.identity-box { display: grid; gap: 0.2rem; margin-top: 0.75rem; padding: 0.7rem 0; border-top: 1px solid var(--border-color); color: var(--text-secondary); }
.identity-box strong { color: var(--text-primary); overflow-wrap: anywhere; }
.identity-box span, .identity-box small { font-size: 0.78rem; }
.title-row h1 { margin: 0.15rem 0; font-size: 1.6rem; }
.title-row p, .muted, .offer-card p, .pending-box, .section-head span { color: var(--text-secondary); }
.eyebrow { margin: 0; color: var(--accent-hover); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.hero-metrics, .mini-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.7rem; margin: 1rem 0; }
.mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.hero-metrics div, .mini-grid div, .offer-card, .pending-box {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--bg-hover);
}
.hero-metrics span, .mini-grid span { display: block; color: var(--text-secondary); font-size: 0.75rem; margin-bottom: 0.25rem; }
.hero-metrics strong, .mini-grid strong { font-size: 1rem; }
.grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.status-pill { border-radius: 999px; padding: 0.35rem 0.7rem; font-size: 0.78rem; font-weight: 800; }
.status-pill.success { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.info { color: var(--accent-hover); background: var(--blue-dim); }
.status-pill.warning,
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.status-pill.danger { color: #f87171; background: rgba(248, 113, 113, 0.12); }
.decision-box { border-radius: 8px; padding: 0.75rem; border: 1px solid var(--border-color); }
.decision-box.ok { border-color: rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.08); }
.decision-box.wait { border-color: rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.08); }
.offers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.7rem; }
.offer-card span { color: var(--text-secondary); font-size: 0.8rem; }
.offer-card strong { display: block; margin: 0.35rem 0; font-size: 1.1rem; }
.offer-card a { color: var(--accent-hover); font-weight: 700; }
.history { display: grid; gap: 0.65rem; }
.history-entry { border: 1px solid var(--border-color); border-radius: 8px; padding: 0.7rem; background: var(--bg-hover); }
.history-head { display: grid; grid-template-columns: 1fr auto auto; gap: 0.6rem; align-items: center; color: var(--text-secondary); }
.history-offers { display: grid; gap: 0.4rem; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid var(--border-color); }
.history-offer { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto auto; gap: 0.65rem; align-items: center; }
.history-offer div { min-width: 0; }
.history-offer div strong, .history-offer div small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-offer div small { color: var(--text-secondary); margin-top: 0.15rem; }
.history-offer a { color: var(--accent-hover); font-weight: 700; text-decoration: none; }
.offer-position { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; background: var(--blue-dim); color: var(--accent-hover); font-weight: 800; }
.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.chips button { border: 1px solid var(--border-color); background: var(--bg-hover); color: var(--text-primary); border-radius: 999px; padding: 0.45rem 0.65rem; cursor: pointer; }
.chat-form { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.chat-form input { flex: 1; padding: 0.7rem; }
.answer { margin: 0.75rem 0 0; background: var(--bg-hover); border-radius: 8px; padding: 0.75rem; color: var(--text-secondary); }
.identity-warning, .rejected-box {
  margin-top: 0.75rem;
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 8px;
  padding: 0.75rem;
  background: rgba(251, 191, 36, 0.08);
  color: var(--text-secondary);
}
.rejected-box summary { cursor: pointer; color: var(--text-primary); font-weight: 800; }
.rejected-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.35rem 0.7rem; padding: 0.55rem 0; border-top: 1px solid var(--border-color); }
.rejected-row span { min-width: 0; overflow-wrap: anywhere; }
.rejected-row small { grid-column: 1 / -1; color: var(--text-secondary); }
@media (max-width: 860px) {
  .product-panel, .grid-two, .hero-metrics, .mini-grid { grid-template-columns: 1fr; }
  .title-row, .section-head, .action-row { align-items: flex-start; flex-direction: column; }
  .history-offer { grid-template-columns: 32px minmax(0, 1fr) auto; }
  .history-offer > a, .history-offer > .muted { grid-column: 2 / -1; }
}
</style>
