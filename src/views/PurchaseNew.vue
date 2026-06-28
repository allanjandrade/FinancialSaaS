<template>
  <main class="purchase-page">
    <section class="purchase-hero">
      <div>
        <p class="eyebrow">Planejamento</p>
        <h1>Compras planejadas</h1>
        <p>Acompanhe produtos, compare precos e decida se vale comprar agora.</p>
      </div>
      <router-link class="secondary-button" to="/purchases">Ver compras</router-link>
    </section>

    <section class="purchase-shell">
      <div class="mode-switch" role="tablist" aria-label="Tipo de entrada" data-testid="product-input-tabs">
        <button type="button" :class="{ active: mode === 'text' }" @click="setMode('text')">
          <Pencil :size="18" />
          Buscar por descricao
        </button>
        <button type="button" :class="{ active: mode === 'link' }" data-testid="product-link-tab" @click="setMode('link')">
          <LinkIcon :size="18" />
          Adicionar por link
        </button>
        <button type="button" :class="{ active: mode === 'image' }" @click="setMode('image')">
          <ImageIcon :size="18" />
          Imagem
        </button>
      </div>

      <form class="conversation-card" @submit.prevent="identify">
        <label v-if="mode === 'text'" data-testid="product-description-tab">
          <span>Descreva o produto ou cole um link</span>
          <textarea
            ref="descriptionInput"
            v-model="inputValue"
            rows="4"
            placeholder="Ex: lanterna traseira direita Fiat Punto 2012"
          ></textarea>
          <small>Digite uma descricao para buscar candidatos ou cole um link para travar a identidade do produto.</small>
        </label>

        <label v-if="mode === 'link'">
          <span>Link do produto</span>
          <input
            v-model="inputValue"
            data-testid="product-link-input"
            inputmode="url"
            placeholder="Cole o link da Amazon, Mercado Livre ou outra loja"
          />
          <small data-testid="product-link-helper">Quando voce usa um link, monitoramos exatamente o produto informado e bloqueamos trocas por itens parecidos.</small>
        </label>

        <section v-if="mode === 'link' && multipleUrls.length > 1" class="multiple-links" data-testid="multiple-product-links">
          <div class="multiple-links-head">
            <div>
              <strong>Encontramos mais de um link</strong>
              <p>Escolha um produto para adicionar ou adicione todos separadamente.</p>
            </div>
            <button class="secondary-button" type="button" :disabled="busy" data-testid="add-all-product-links" @click="addAllLinks">
              Adicionar todos
            </button>
          </div>
          <article v-for="url in multipleUrls" :key="url" class="multiple-link-card" data-testid="multiple-product-card">
            <span>{{ url }}</span>
            <button class="secondary-button" type="button" :disabled="busy" @click="addSingleLink(url)">Adicionar este</button>
          </article>
        </section>

        <label v-if="mode === 'image'">
          <span>Print ou foto do anúncio</span>
          <input type="file" accept="image/*" @change="selectImage" />
        </label>

        <section class="optional-grid" aria-label="Dados opcionais da compra">
          <label>
            <span>Preço desejado</span>
            <input v-model="details.targetPrice" inputmode="decimal" placeholder="R$ 0,00" />
          </label>
          <label>
            <span>Categoria</span>
            <select v-model="details.category">
              <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label>
            <span>Prioridade</span>
            <select v-model="details.priority">
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </label>
          <label>
            <span>Data desejada</span>
            <input v-model="details.desiredDate" type="date" />
          </label>
          <label class="full">
            <span>Observações</span>
            <input v-model="details.notes" type="text" placeholder="Opcional" />
          </label>
        </section>

        <div class="form-actions">
          <button class="primary-button" type="submit" :disabled="busy || !canIdentify">
            <Search :size="18" />
            <span class="sr-only">Identificar produto</span>
            {{ busy ? progress || 'Procurando...' : primaryActionLabel }}
          </button>
          <button
            v-if="mode === 'text'"
            class="secondary-button"
            type="button"
            :disabled="busy || !inputValue.trim()"
            @click="saveWithoutSearch"
          >
            <Save :size="18" />
            Salvar sem buscar
          </button>
        </div>
      </form>
    </section>

    <section v-if="review" class="review-panel">
      <div class="review-media">
        <img v-if="review.imageUrl" :src="review.imageUrl" :alt="review.name" />
        <Package v-else :size="44" />
      </div>
      <form class="review-form" @submit.prevent="save">
        <div class="review-heading">
          <div>
            <p class="eyebrow">Revisao</p>
            <h2>Dados identificados</h2>
          </div>
          <span class="status-pill" :class="review.value ? 'quoted' : 'pending'">
            {{ review.value ? 'Preco identificado' : 'Cotacao pendente' }}
          </span>
        </div>

        <div class="review-grid">
          <label>
            <span>Nome</span>
            <input v-model="review.name" required />
          </label>
          <label>
            <span>Valor identificado</span>
            <input v-model.number="review.value" type="number" min="0.01" step="0.01" placeholder="R$ 0,00" />
          </label>
          <label>
            <span>Marketplace</span>
            <input v-model="review.marketplace" placeholder="Nao identificado" />
          </label>
          <label>
            <span>Marca</span>
            <input v-model="review.brand" placeholder="Opcional" />
          </label>
          <label>
            <span>Modelo</span>
            <input v-model="review.model" placeholder="Opcional" />
          </label>
        </div>

        <div v-if="reviewAttributes.length" class="product-attributes">
          <div class="attributes-heading">
            <span>Atributos identificados</span>
            <small>{{ Object.keys(review.attributes).length }} encontrados</small>
          </div>
          <dl>
            <div v-for="([label, value]) in reviewAttributes" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="review.canonicalUrl || review.marketplaceItemId" class="url-review">
          <div v-if="review.marketplaceItemId">
            <span>ID do anuncio</span>
            <strong>{{ review.marketplaceItemId }}</strong>
          </div>
          <div v-if="review.canonicalUrl">
            <span>URL sanitizada</span>
            <strong>{{ review.canonicalUrl }}</strong>
          </div>
        </div>

        <p v-if="review.hasVariation" class="soft-warning">
          Este anuncio possui variacoes. Confirme se esta e a opcao correta antes de salvar.
        </p>
        <p v-if="!review.value" class="soft-warning">
          Nao precisa informar valor manualmente. O produto sera salvo e a cotacao seguira pendente ate uma fonte oficial retornar preco.
        </p>
        <p v-else-if="review.liveResult?.message" class="soft-warning">{{ review.liveResult.message }}</p>

        <button class="primary-button" type="submit" :disabled="busy || !review.name">
          <Save :size="18" />
          <span class="sr-only">Salvar na wishlist</span>
          {{ busy ? progress || 'Salvando...' : 'Salvar na lista' }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ImageIcon, LinkIcon, Package, Pencil, Save, Search } from 'lucide-vue-next'
import { useNotification } from '@/composables/useNotification'
import { usePurchaseWorkflow } from '@/composables/usePurchaseWorkflow.js'
import { OFFICIAL_EXPENSE_CATEGORIES } from '@/constants/finance'
import { canonicalizeProductUrl, extractProductUrls } from '@/domain/products/canonicalizeProductUrl.js'

const router = useRouter()
const route = useRoute()
const { showToast } = useNotification()
const workflow = usePurchaseWorkflow()

const categories = OFFICIAL_EXPENSE_CATEGORIES
const mode = ref('text')
const inputValue = ref('')
const imageFile = ref(null)
const review = ref(null)
const descriptionInput = ref(null)
const details = reactive({
  targetPrice: '',
  category: OFFICIAL_EXPENSE_CATEGORIES[0],
  priority: 'Média',
  desiredDate: '',
  notes: '',
})
const reviewAttributes = computed(() =>
  Object.entries(review.value?.attributes || {})
    .filter(([label, value]) => label && value != null && String(value).trim())
    .slice(0, 10),
)
const busy = ref(false)
const progress = ref('')

const canIdentify = computed(() => (mode.value === 'image' ? Boolean(imageFile.value) : Boolean(inputValue.value.trim())))
const multipleUrls = computed(() => extractProductUrls(inputValue.value).filter(Boolean))
const primaryActionLabel = computed(() => {
  if (mode.value === 'link') return multipleUrls.value.length > 1 ? 'Escolher links' : 'Adicionar produto pelo link'
  return 'Pesquisar produto'
})

function isKnownShortLink(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return host === 'a.co' || host === 'amzn.to'
  } catch {
    return false
  }
}

function selectedProductUrl() {
  const urls = multipleUrls.value
  if (!urls.length) {
    showToast('Cole um link valido de produto.', 'warning')
    return ''
  }
  if (urls.length > 1) return ''

  const url = urls[0]
  const canonical = canonicalizeProductUrl(url)
  if (!canonical.ok && !isKnownShortLink(url)) {
    showToast(canonical.message || 'Link de produto invalido.', 'warning')
    return ''
  }
  return url
}

function parseOptionalPrice(value) {
  const normalized = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function withOptionalDetails(product, extra = {}) {
  const targetPrice = parseOptionalPrice(details.targetPrice)
  return {
    ...product,
    ...extra,
    category: details.category,
    priority: details.priority,
    desiredDate: details.desiredDate,
    notes: details.notes,
    targetPrice,
  }
}

function setMode(nextMode, options = {}) {
  mode.value = nextMode
  if (!options.keepInput) inputValue.value = ''
  imageFile.value = null
  review.value = null
}

function detectInputMode(value) {
  if (mode.value === 'image') return
  const urls = extractProductUrls(value)
  if (urls.length && mode.value !== 'link') {
    mode.value = 'link'
    imageFile.value = null
    review.value = null
  }
  if (!urls.length && mode.value === 'link' && value.trim() && !inputValue.value.includes('://')) {
    setMode('text', { keepInput: true })
  }
}

watch(inputValue, (value) => {
  detectInputMode(value)
})

function selectImage(event) {
  imageFile.value = event.target.files?.[0] || null
}

async function addSingleLink(url) {
  const canonical = canonicalizeProductUrl(url)
  if (!canonical.ok && !isKnownShortLink(url)) {
    showToast(canonical.message || 'Link de produto invalido.', 'warning')
    return
  }
  busy.value = true
  progress.value = 'Adicionando produto...'
  try {
    await workflow.addProductFromUrl(url, withOptionalDetails({}), (message) => { progress.value = message })
    showToast('Produto salvo pelo link. A cotacao segue travada no mesmo produto.', 'success')
    router.push('/purchases')
  } catch (error) {
    showToast(error.message || 'Falha ao adicionar produto pelo link', 'error')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

async function addAllLinks() {
  if (!multipleUrls.value.length) return
  busy.value = true
  progress.value = 'Adicionando produtos...'
  try {
    for (const url of multipleUrls.value) {
      await workflow.addProductFromUrl(url, withOptionalDetails({}), (message) => { progress.value = message })
    }
    showToast('Produtos salvos pelos links informados.', 'success')
    router.push('/purchases')
  } catch (error) {
    showToast(error.message || 'Falha ao adicionar todos os links', 'error')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

async function identify() {
  if (!canIdentify.value) return
  if (mode.value === 'link' && multipleUrls.value.length <= 1 && !selectedProductUrl()) return
  busy.value = true
  progress.value = ''
  try {
    if (mode.value === 'link') {
      if (multipleUrls.value.length > 1) return
      await workflow.addProductFromUrl(selectedProductUrl(), withOptionalDetails({}), (message) => { progress.value = message })
      showToast('Produto salvo pelo link. Vamos monitorar exatamente este item.', 'success')
      router.push('/purchases')
      return
    } else if (mode.value === 'image') {
      review.value = withOptionalDetails(await workflow.identifyFromImage(imageFile.value, (message) => { progress.value = message }))
    } else {
      review.value = withOptionalDetails(await workflow.identifyFromText(inputValue.value, (message) => { progress.value = message }))
    }

    if (!review.value.name) {
      showToast('Não consegui identificar o nome. Revise antes de salvar.', 'warning')
    }
  } catch (error) {
    showToast(error.message || 'Falha ao procurar produto', 'error')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

async function save() {
  if (!review.value?.name) return
  busy.value = true
  progress.value = 'Confirmando persistencia...'
  try {
    const saved = await workflow.saveIdentifiedProduct(withOptionalDetails(review.value))
    showToast('Produto salvo na lista. Cotação pendente.', saved.priceStatus === 'quoted' ? 'success' : 'warning')
    router.push('/purchases')
  } catch (error) {
    showToast(error.message || 'Falha ao salvar produto', 'error')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

async function saveWithoutSearch() {
  if (!inputValue.value.trim()) return
  busy.value = true
  progress.value = 'Salvando...'
  try {
    await workflow.saveIdentifiedProduct(withOptionalDetails({
      name: inputValue.value.trim(),
      description: inputValue.value.trim(),
      source: 'description',
    }, { skipLiveSearch: true }))
    showToast('Produto salvo sem busca de preço.', 'success')
    router.push('/purchases')
  } catch (error) {
    showToast(error.message || 'Falha ao salvar produto', 'error')
  } finally {
    busy.value = false
    progress.value = ''
  }
}

onMounted(async () => {
  if (route.query.mode === 'link' || route.query.mode === 'image' || route.query.mode === 'text') {
    mode.value = route.query.mode
  }
  await nextTick()
  descriptionInput.value?.focus()
})
</script>

<style scoped>
.purchase-page { max-width: 1080px; margin: 0 auto; padding: 1rem 1.25rem 2rem; display: grid; gap: 1rem; }
.purchase-hero, .purchase-shell, .review-panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: var(--shadow-card);
}
.purchase-hero { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.purchase-hero h1, .review-heading h2 { margin: 0.15rem 0; }
.purchase-hero p, .soft-warning { color: var(--text-secondary); }
.eyebrow { margin: 0; color: var(--accent-hover); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.mode-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1rem; }
.mode-switch button {
  min-height: 76px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 700;
  cursor: pointer;
}
.mode-switch button.active { border-color: var(--accent); background: rgba(59, 130, 246, 0.12); }
.conversation-card { display: grid; gap: 0.9rem; }
label { display: grid; gap: 0.4rem; color: var(--text-secondary); font-size: 0.88rem; }
input, textarea { width: 100%; padding: 0.8rem; }
.multiple-links { display: grid; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-hover); }
.multiple-links-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.multiple-links-head p { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.82rem; }
.multiple-link-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; padding: 0.65rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-panel); }
.multiple-link-card span { min-width: 0; overflow-wrap: anywhere; color: var(--text-secondary); font-size: 0.78rem; }
.optional-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
.optional-grid .full { grid-column: 1 / -1; }
.form-actions { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
.review-panel { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 1rem; }
.review-media { min-height: 220px; border-radius: 8px; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; color: var(--text-muted); overflow: hidden; }
.review-media img { width: 100%; height: 100%; object-fit: contain; }
.review-form { display: grid; gap: 0.9rem; }
.review-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
.product-attributes {
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-primary) 5%, var(--bg-surface));
}
.attributes-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.7rem; }
.attributes-heading span { color: var(--text-primary); font-size: 0.82rem; font-weight: 700; }
.attributes-heading small { color: var(--text-muted); font-size: 0.72rem; }
.product-attributes dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; margin: 0; }
.product-attributes dl > div { min-width: 0; padding: 0.55rem 0.65rem; border-radius: 8px; background: var(--bg-elevated); }
.product-attributes dt { color: var(--text-muted); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; }
.product-attributes dd { overflow: hidden; margin: 0.2rem 0 0; color: var(--text-primary); font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.url-review {
  display: grid;
  gap: 0.5rem;
  padding: 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}
.url-review span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.72rem;
  margin-bottom: 0.2rem;
}
.url-review strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.status-pill { border-radius: 999px; padding: 0.35rem 0.7rem; font-size: 0.78rem; font-weight: 800; }
.status-pill.quoted { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.soft-warning { margin: 0; padding: 0.7rem; border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 8px; background: rgba(251, 191, 36, 0.08); }
@media (max-width: 760px) {
  .purchase-hero, .review-heading { align-items: flex-start; flex-direction: column; }
  .mode-switch, .review-panel, .review-grid, .product-attributes dl, .optional-grid, .multiple-link-card { grid-template-columns: 1fr; }
  .multiple-links-head { align-items: stretch; flex-direction: column; }
  .optional-grid .full { grid-column: auto; }
  .form-actions > * { width: 100%; }
}
</style>
