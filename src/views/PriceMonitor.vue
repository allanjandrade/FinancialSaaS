<template>
  <div class="price-monitor">
    <section class="hero-band">
      <div>
        <p class="eyebrow">Consumo recorrente</p>
        <h2>Monitor de flutuação de preços</h2>
        <p>
          Registre o preço real pago em mercado, farmácia, feira ou açougue. O app cria histórico,
          calcula médias e recomenda o melhor momento de compra.
        </p>
      </div>
      <button class="primary-button import-button" type="button" @click="openImportPicker" :disabled="importing">
        <Upload :size="18" />
        {{ importing ? 'Processando' : 'Importar compra' }}
      </button>
      <div class="hero-metrics">
        <div>
          <span>Produtos</span>
          <strong>{{ monitoredRows.length }}</strong>
        </div>
        <div>
          <span>Registros</span>
          <strong>{{ financeStore.state.priceRecords.length }}</strong>
        </div>
        <div>
          <span>Alertas</span>
          <strong>{{ openAlerts.length }}</strong>
        </div>
      </div>
    </section>

    <input
      ref="importInputRef"
      class="hidden-input"
      type="file"
      accept="image/*,.pdf,.xml,text/xml,application/xml,application/pdf"
      @change="handleImportSelected"
    />

    <details class="panel qr-panel">
      <summary>Importar por QR Code, chave NFC-e ou XML</summary>
      <div class="section-head compact">
        <div>
          <h3>QR Code ou chave NFC-e</h3>
          <p>Cole a URL do QR Code, a chave de acesso ou o XML baixado da nota.</p>
        </div>
      </div>
      <div class="qr-row">
        <input v-model.trim="qrText" placeholder="Cole aqui a URL, chave de acesso ou XML da NFC-e" />
        <button class="secondary-button" type="button" @click="processQrText" :disabled="importing || !qrText">
          Processar
        </button>
      </div>
    </details>

    <section v-if="receiptDraft" class="panel review-panel">
      <div class="section-head">
        <div>
          <h3>Revisar compra importada</h3>
          <p>A nota só será salva depois da confirmação. Corrija qualquer leitura antes de importar.</p>
        </div>
        <button class="secondary-button" type="button" @click="receiptDraft = null">Descartar</button>
      </div>

      <div v-if="duplicateWarning" class="duplicate-warning">
        Esta nota parece ja ter sido importada. Confira antes de salvar novamente.
      </div>

      <div class="receipt-summary-grid">
        <label>
          Estabelecimento
          <input v-model.trim="receiptDraft.establishmentName" />
        </label>
        <label>
          CNPJ
          <input v-model.trim="receiptDraft.cnpj" />
        </label>
        <label>
          Data
          <input v-model="receiptDraft.purchaseDate" type="date" />
        </label>
        <label>
          Total
          <input v-model.number="receiptDraft.total" type="number" min="0.01" step="0.01" />
        </label>
        <label>
          Pagamento
          <select v-model="receiptDraft.paymentMethod">
            <option v-for="method in financeStore.paymentMethods" :key="method" :value="method">
              {{ method }}
            </option>
          </select>
        </label>
      </div>

      <div class="items-review">
        <div class="items-head">
          <strong>Itens da compra</strong>
          <span>{{ receiptDraft.items.length }} itens</span>
        </div>
        <div class="items-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Qtd</th>
                <th>Un</th>
                <th>Unitario</th>
                <th>Total</th>
                <th>Codigo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in receiptDraft.items" :key="item.id">
                <td><input v-model.trim="item.name" /></td>
                <td>
                  <select v-model="item.category">
                    <option v-for="category in productCategories" :key="category" :value="category">
                      {{ category }}
                    </option>
                  </select>
                </td>
                <td><input v-model.number="item.quantity" type="number" min="0.01" step="0.01" @input="syncItemTotal(item)" /></td>
                <td><input v-model.trim="item.unit" /></td>
                <td><input v-model.number="item.unitPrice" type="number" min="0.01" step="0.01" @input="syncItemTotal(item)" /></td>
                <td><input v-model.number="item.totalPrice" type="number" min="0.01" step="0.01" /></td>
                <td><input v-model.trim="item.barcode" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="review-actions">
        <span>Total dos itens: {{ formatCurrency(itemsTotal) }}</span>
        <button class="primary-button" type="button" @click="confirmReceiptImport">
          Confirmar importação
        </button>
      </div>
    </section>

    <section v-if="openAlerts.length" class="action-alerts">
      <div>
        <p class="eyebrow">Ação recomendada</p>
        <strong>{{ openAlertsSummary }}</strong>
      </div>
      <span v-for="alert in openAlerts.slice(0, 3)" :key="alert.id">
        {{ productName(alert.product_id) }} · {{ formatCurrency(alert.target_price) }}
      </span>
    </section>

    <div class="monitor-grid">
      <section class="panel input-panel">
        <div class="section-head">
          <div>
            <h3>Novo preço pago</h3>
            <p>Dados reais do usuário entram antes de qualquer fonte externa.</p>
          </div>
          <Receipt :size="22" />
        </div>

        <form class="price-form" @submit.prevent="saveManualPrice">
          <label>
            Produto
            <input v-model.trim="form.name" list="product-list" required placeholder="Ex.: Cafe 500g" />
            <datalist id="product-list">
              <option v-for="product in financeStore.state.products" :key="product.id" :value="product.name" />
            </datalist>
          </label>

          <div class="form-row">
            <label>
              Marca
              <input v-model.trim="form.brand" placeholder="Opcional" />
            </label>
            <label>
              Categoria
              <select v-model="form.category">
                <option v-for="category in productCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </label>
          </div>

          <div class="form-row">
            <label>
              Unidade
              <select v-model="form.default_unit">
                <option value="un">Unidade</option>
                <option value="kg">Kg</option>
                <option value="g">Gramas</option>
                <option value="l">Litro</option>
                <option value="ml">Ml</option>
                <option value="cx">Caixa</option>
                <option value="pct">Pacote</option>
              </select>
            </label>
            <label>
              Codigo de barras
              <input v-model.trim="form.barcode" inputmode="numeric" placeholder="Opcional" />
            </label>
          </div>

          <div class="form-row">
            <label>
              Loja
              <input v-model.trim="form.storeName" required placeholder="Ex.: Assai, Drogasil" />
            </label>
            <label>
              Data da compra
              <input v-model="form.collected_at" type="date" required />
            </label>
          </div>

          <div class="form-row">
            <label>
              Preço pago
              <input v-model.number="form.price" type="number" min="0.01" step="0.01" required />
            </label>
            <label>
              Quantidade comprada
              <input v-model.number="form.quantity" type="number" min="0.01" step="0.01" />
            </label>
          </div>

          <div class="form-row">
            <label>
              Preço-alvo
              <input v-model.number="form.target_price" type="number" min="0" step="0.01" placeholder="Opcional" />
            </label>
            <label>
              Frequencia de compra
              <select v-model.number="form.purchase_frequency_days">
                <option :value="7">Semanal</option>
                <option :value="15">Quinzenal</option>
                <option :value="30">Mensal</option>
                <option :value="60">Bimestral</option>
                <option :value="90">Trimestral</option>
              </select>
            </label>
          </div>

          <label>
            Observação
            <textarea v-model.trim="form.notes" rows="3" placeholder="Ex.: promocao, cupom, atacado" />
          </label>

          <div class="form-actions">
            <button class="secondary-button" type="button" @click="clearForm">Limpar</button>
            <button class="primary-button" type="submit">
              <Plus :size="18" />
              Salvar preço
            </button>
          </div>
        </form>
      </section>

      <section class="panel recommendations-panel">
        <div class="section-head">
          <div>
            <h3>Recomendações</h3>
            <p>Calculadas com base no histórico real salvo.</p>
          </div>
          <TrendingUp :size="22" />
        </div>

        <div v-if="!monitoredRows.length" class="empty-state">
          Cadastre o primeiro preço pago para iniciar o histórico.
        </div>

        <div v-else class="recommendation-list">
          <article
            v-for="row in monitoredRows"
            :key="row.product.id"
            class="product-card"
            :class="recommendationClass(row.stats.recommendation)"
          >
            <div class="card-top">
              <div>
                <h4>{{ row.product.name }}</h4>
                <p>{{ row.product.brand || 'Sem marca' }} · {{ row.product.category }} · {{ row.product.default_unit }}</p>
              </div>
              <span class="status-pill">{{ row.stats.recommendation }}</span>
            </div>

            <div class="price-line">
              <span>Preço atual</span>
              <strong>{{ formatCurrencyOrEmpty(row.stats.current_price) }}</strong>
            </div>

            <div class="stats-grid">
              <div>
                <span>Media 30d</span>
                <strong>{{ formatCurrencyOrEmpty(row.stats.average_price_30_days) }}</strong>
              </div>
              <div>
                <span>Media 90d</span>
                <strong>{{ formatCurrencyOrEmpty(row.stats.average_price_90_days) }}</strong>
              </div>
              <div>
                <span>Menor 30d</span>
                <strong>{{ formatCurrencyOrEmpty(row.stats.lowest_price_30_days) }}</strong>
              </div>
              <div>
                <span>Variação</span>
                <strong :class="variationClass(row.stats.variation_percentual)">
                  {{ formatPercent(row.stats.variation_percentual) }}
                </strong>
              </div>
            </div>

            <div class="insight-box">
              {{ row.stats.recommendation_text }}
            </div>

            <div class="card-foot">
              <span>Economia potencial: {{ formatCurrency(row.stats.savings_potential) }}</span>
              <span>Gasto mensal estimado: {{ formatCurrency(row.stats.estimated_monthly_spend) }}</span>
            </div>
          </article>
        </div>
      </section>
    </div>

    <section class="panel history-panel">
      <div class="section-head">
        <div>
          <h3>Histórico de preços</h3>
          <p>Cada novo preço gera um registro independente. Nada é sobrescrito.</p>
        </div>
        <BellRing :size="22" />
      </div>

      <div v-if="openAlerts.length" class="alert-strip">
        <span v-for="alert in openAlerts" :key="alert.id">
          Alerta: {{ productName(alert.product_id) }} atingiu o alvo de {{ formatCurrency(alert.target_price) }}.
        </span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Loja</th>
              <th>Preço</th>
              <th>Unidade</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in recentRecords" :key="record.id">
              <td>{{ formatDate(record.collected_at) }}</td>
              <td>{{ productName(record.product_id) }}</td>
              <td>{{ storeName(record.store_id) }}</td>
              <td>{{ formatCurrency(record.price) }}</td>
              <td>{{ formatCurrency(record.unit_price) }}</td>
              <td>{{ record.source }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BellRing, Plus, Receipt, TrendingUp, Upload } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import { fetchReceiptOcr } from '@/utils/receipt-ocr-api.js'
import { normalizeReceiptDraft, parseNfceXml } from '@/utils/market-receipt-import.js'
import { quantityLabel } from '@/utils/pt-br-copy.js'

const financeStore = useFinanceStore()
const { showToast } = useNotification()

const productCategories = ['Mercado', 'Acougue', 'Feira', 'Farmacia', 'Limpeza', 'Pet', 'Casa', 'Outros']

const today = new Date().toISOString().split('T')[0]
const form = ref(defaultForm())
const importInputRef = ref(null)
const importing = ref(false)
const receiptDraft = ref(null)
const qrText = ref('')

const monitoredRows = computed(() => financeStore.monitoredProducts()
  .sort((a, b) => {
    const av = a.stats.variation_percentual ?? -999
    const bv = b.stats.variation_percentual ?? -999
    return bv - av
  }))

const openAlerts = computed(() => financeStore.state.priceAlerts.filter((alert) => alert.status === 'open'))
const openAlertsSummary = computed(() => {
  const count = openAlerts.value.length
  const label = quantityLabel(count, 'preço', 'preços')
  return `${label} ${count === 1 ? 'atingiu' : 'atingiram'} o alvo definido`
})

const recentRecords = computed(() => [...financeStore.state.priceRecords]
  .sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at))
  .slice(0, 20))

const duplicateWarning = computed(() => receiptDraft.value
  ? financeStore.hasImportedMarketReceipt(receiptDraft.value)
  : false)

const itemsTotal = computed(() => (receiptDraft.value?.items || [])
  .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0))

function defaultForm() {
  return {
    name: '',
    brand: '',
    category: 'Mercado',
    barcode: '',
    default_unit: 'un',
    storeName: '',
    collected_at: today,
    price: '',
    quantity: 1,
    target_price: '',
    usual_quantity: 1,
    purchase_frequency_days: 30,
    notes: '',
  }
}

function saveManualPrice() {
  const record = financeStore.recordManualPrice({
    product: {
      name: form.value.name,
      brand: form.value.brand,
      category: form.value.category,
      barcode: form.value.barcode,
      default_unit: form.value.default_unit,
    },
    storeName: form.value.storeName,
    price: form.value.price,
    quantity: form.value.quantity,
    target_price: form.value.target_price || null,
    usual_quantity: form.value.usual_quantity || form.value.quantity || 1,
    purchase_frequency_days: form.value.purchase_frequency_days,
    collected_at: new Date(`${form.value.collected_at}T12:00:00`).toISOString(),
    source: 'manual',
    notes: form.value.notes,
  })

  if (!record) {
    showToast('Informe um produto e um preço válido.', 'error')
    return
  }
  showToast('Preço salvo no histórico.', 'success')
  clearForm()
}

function clearForm() {
  form.value = defaultForm()
}

function openImportPicker() {
  importInputRef.value?.click()
}

async function handleImportSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  await processImportFile(file)
}

async function processImportFile(file) {
  importing.value = true
  try {
    if (isXmlFile(file)) {
      const xml = await file.text()
      receiptDraft.value = parseNfceXml(xml)
    } else {
      const raw = await fetchReceiptOcr(file)
      receiptDraft.value = normalizeReceiptDraft({
        ...raw,
        establishmentName: raw.estabelecimento,
        purchaseDate: raw.data,
        total: raw.valor,
        paymentMethod: raw.metodo,
        items: raw.itens,
        receiptKey: raw.chave,
        sourceDocument: file.type || file.name,
      })
    }

    if (!receiptDraft.value.items.length) {
      showToast('Documento lido, mas nenhum item foi identificado. Tente XML/NFC-e ou revise o arquivo.', 'warning')
    } else {
      showToast('Compra lida. Revise os itens antes de salvar.', 'success')
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Falha ao importar compra.', 'error')
  } finally {
    importing.value = false
  }
}

function isXmlFile(file) {
  return file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')
}

function processQrText() {
  if (!qrText.value) return
  try {
    if (qrText.value.trim().startsWith('<')) {
      receiptDraft.value = parseNfceXml(qrText.value)
      showToast('XML processado. Revise os itens antes de salvar.', 'success')
      return
    }
    const key = qrText.value.match(/\d{44}/)?.[0] || ''
    receiptDraft.value = normalizeReceiptDraft({
      receiptKey: key,
      sourceDocument: qrText.value,
      source: 'receipt_import',
      items: [],
    })
    showToast('Chave identificada. Para extrair itens automaticamente, envie o XML ou uma imagem/PDF do cupom.', 'info')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Não foi possível processar o texto informado.', 'error')
  }
}

function syncItemTotal(item) {
  const quantity = Number(item.quantity || 0)
  const unitPrice = Number(item.unitPrice || 0)
  if (quantity > 0 && unitPrice > 0) {
    item.totalPrice = Number((quantity * unitPrice).toFixed(2))
  }
}

function confirmReceiptImport() {
  if (!receiptDraft.value) return
  const result = financeStore.importMarketReceipt(receiptDraft.value)
  if (!result.ok) {
    const message = result.reason === 'duplicate'
      ? 'Esta nota ja foi importada.'
      : 'Revise total e itens antes de confirmar.'
    showToast(message, 'error')
    return
  }
  showToast(`Compra importada com ${result.records.length} itens.`, 'success')
  receiptDraft.value = null
  qrText.value = ''
}

function productName(id) {
  return financeStore.state.products.find((product) => product.id === id)?.name || 'Produto'
}

function storeName(id) {
  return financeStore.state.stores.find((store) => store.id === id)?.name || 'Loja'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatCurrencyOrEmpty(value) {
  if (value == null || Number(value) <= 0) return 'Sem dados'
  return formatCurrency(value)
}

function formatPercent(value) {
  if (value == null) return 'Sem dados'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function recommendationClass(value) {
  return {
    COMPRAR: 'buy',
    NORMAL: 'normal',
    AGUARDAR: 'wait',
    ALERTA_ALTA: 'high-alert',
  }[value] || 'normal'
}

function variationClass(value) {
  if (value == null) return ''
  if (value <= -10) return 'good'
  if (value >= 10) return 'bad'
  return ''
}
</script>

<style scoped>
.price-monitor {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hero-band {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  border-radius: var(--radius-lg);
}

.eyebrow {
  color: var(--accent-cyan);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
  font-weight: 700;
}

.hero-band h2,
.section-head h3 {
  color: var(--text-primary);
  font-weight: 700;
}

.hero-band h2 {
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
  margin: 0.2rem 0;
}

.hero-band p,
.section-head p {
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, 82px);
  gap: 0.5rem;
}

.import-button {
  white-space: nowrap;
  align-self: center;
}

.hidden-input {
  display: none;
}

.qr-panel {
  padding: 0.85rem 1rem;
}
.qr-panel summary { cursor: pointer; color: var(--accent-cyan); font-size: 0.86rem; font-weight: 700; }
.qr-panel[open] summary { margin-bottom: 0.8rem; }

.section-head.compact {
  margin-bottom: 0.75rem;
}

.qr-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

.qr-row input {
  padding: 0.75rem;
  width: 100%;
}

.hero-metrics div,
.stats-grid div {
  padding: 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
}

.hero-metrics span,
.stats-grid span,
.price-line span,
.card-foot {
  color: var(--text-muted);
  font-size: 0.76rem;
}

.hero-metrics strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.12rem;
}

.action-alerts {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(52, 211, 153, 0.38);
  border-radius: var(--radius-lg);
  background: rgba(52, 211, 153, 0.07);
}
.action-alerts div { margin-right: auto; }
.action-alerts p { margin: 0 0 0.15rem; }
.action-alerts span { padding: 0.45rem 0.65rem; border-radius: 999px; background: var(--bg-panel); color: var(--text-secondary); font-size: 0.78rem; }

.monitor-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.18fr) minmax(340px, 0.82fr);
  gap: 1rem;
  align-items: start;
}
.recommendations-panel { order: 1; }
.input-panel { order: 2; }

.review-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.duplicate-warning {
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-sm);
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.35);
  color: var(--warning);
  font-weight: 700;
  font-size: 0.86rem;
}

.receipt-summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.receipt-summary-grid label,
.items-review label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 700;
}

.receipt-summary-grid input,
.receipt-summary-grid select,
.items-table-wrap input,
.items-table-wrap select {
  width: 100%;
  padding: 0.55rem;
}

.items-review {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.items-head,
.review-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem;
  background: var(--bg-input);
  color: var(--text-secondary);
}

.items-head strong {
  color: var(--text-primary);
}

.items-table-wrap {
  overflow-x: auto;
}

.items-table-wrap table {
  min-width: 980px;
}

.items-table-wrap td,
.items-table-wrap th {
  padding: 0.55rem;
}

.items-table-wrap td:nth-child(1) {
  min-width: 260px;
}

.panel {
  padding: 1.1rem;
}

.section-head,
.card-top,
.price-line,
.card-foot {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.section-head {
  margin-bottom: 1rem;
  color: var(--accent-hover);
}

.price-form,
.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.price-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 600;
}

.price-form input,
.price-form select,
.price-form textarea {
  padding: 0.75rem;
  width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.product-card {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
}

.product-card.buy {
  border-color: rgba(52, 211, 153, 0.38);
}

.product-card.wait,
.product-card.high-alert {
  border-color: rgba(251, 191, 36, 0.38);
}

.product-card h4 {
  font-size: 1rem;
  color: var(--text-primary);
}

.product-card p {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

.status-pill {
  white-space: nowrap;
  border-radius: var(--radius-pill);
  padding: 0.32rem 0.6rem;
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent-hover);
  font-size: 0.72rem;
  font-weight: 800;
}

.price-line {
  margin: 0.9rem 0;
  align-items: center;
}

.price-line strong {
  font-size: 1.25rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.stats-grid strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.88rem;
}

.good {
  color: var(--success);
}

.bad {
  color: var(--warning);
}

.insight-box {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  background: rgba(59, 130, 246, 0.08);
  color: var(--text-secondary);
  font-size: 0.86rem;
}

.card-foot {
  margin-top: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.empty-state {
  padding: 1.5rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: var(--bg-input);
  text-align: center;
}

.alert-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.alert-strip span {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  background: rgba(251, 191, 36, 0.12);
  color: var(--warning);
  font-size: 0.82rem;
  font-weight: 700;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.85rem;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
  color: var(--text-secondary);
  font-size: 0.86rem;
}

th {
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 0.72rem;
}

@media (max-width: 980px) {
  .hero-band,
  .monitor-grid {
    grid-template-columns: 1fr;
  }

  .hero-metrics,
  .stats-grid,
  .receipt-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qr-row {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 620px) {
  .price-monitor {
    padding: 1rem;
  }

  .form-row,
  .hero-metrics,
  .stats-grid,
  .receipt-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
