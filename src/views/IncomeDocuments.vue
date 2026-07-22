<template>
  <div class="income-docs-view">
    <section class="panel hero">
      <h1>Comprovantes de entrada</h1>
      <p>
        Guarde holerites, informes de rendimentos, comprovantes de PIX/TED e outros documentos.
        Os arquivos ficam na nuvem (com login) ou neste dispositivo.
      </p>
    </section>

    <section class="panel upload-panel">
      <h2>Enviar documento</h2>
      <form class="upload-form" @submit.prevent="handleUpload">
        <div
          class="dropzone"
          :class="{ dragover: isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <FileUp :size="32" />
          <p>Arraste PDF ou imagem aqui, ou clique para escolher</p>
          <span class="hint">Máx. 12 MB · PDF, JPG, PNG, WEBP</span>
          <input
            ref="fileInput"
            type="file"
            class="sr-only"
            accept=".pdf,image/jpeg,image/png,image/webp"
            @change="onFilePick"
          />
        </div>

        <p v-if="selectedFile" class="selected-file">
          <FileText :size="16" />
          {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
          <button type="button" class="link-btn" @click="clearFile">Remover</button>
        </p>

        <div class="form-grid">
          <label>
            Tipo
            <select v-model="form.type" required>
              <option v-for="(label, key) in documentLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
          <label>
            Referência (ano)
            <input v-model.number="form.referenceYear" type="number" min="2000" max="2100" required />
          </label>
          <label>
            Mês (opcional)
            <select v-model="form.referenceMonth">
              <option :value="null">—</option>
              <option v-for="(name, idx) in financeStore.monthNames" :key="idx" :value="idx + 1">
                {{ name }}
              </option>
            </select>
          </label>
          <label>
            Valor líquido / total (opcional)
            <input v-model.number="form.amount" type="number" step="0.01" min="0" placeholder="Para vincular à receita" />
          </label>
          <label class="full">
            Descrição
            <input v-model="form.label" placeholder="Ex.: Holerite março/2026 — Empresa X" />
          </label>
          <label class="full">
            Observações
            <textarea v-model="form.notes" rows="2" placeholder="Anotações sobre o documento" />
          </label>
          <label class="full checkbox">
            <input v-model="form.createIncome" type="checkbox" />
            Registrar também como receita no mês de referência
          </label>
        </div>

        <button type="submit" class="primary-button" :disabled="!selectedFile || uploading">
          <Loader2 v-if="uploading" class="spin" :size="18" />
          <Upload v-else :size="18" />
          {{ uploading ? 'Enviando...' : 'Salvar comprovante' }}
        </button>
      </form>
    </section>

    <section class="panel filters">
      <label>
        Filtrar tipo
        <select v-model="filterType">
          <option value="">Todos</option>
          <option v-for="(label, key) in documentLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>
        Ano
        <select v-model="filterYear">
          <option value="">Todos</option>
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </label>
    </section>

    <section class="panel list-panel">
      <h2>Arquivos salvos ({{ documents.length }})</h2>
      <EmptyState
        v-if="documents.length === 0"
        :icon="FileText"
        title="Nenhum comprovante salvo"
        description="Envie um holerite, informe ou comprovante para manter suas entradas organizadas."
        action-label="Selecionar arquivo"
        @action="fileInput?.click()"
      />
      <ul v-else class="doc-list">
        <li v-for="doc in documents" :key="doc.id" class="doc-card">
          <div class="doc-icon" :class="doc.type">
            <FileText />
          </div>
          <div class="doc-body">
            <strong>{{ doc.label || documentLabels[doc.type] }}</strong>
            <span class="doc-meta">
              {{ documentLabels[doc.type] }}
              · {{ periodLabel(doc) }}
              <span v-if="doc.amount"> · {{ formatCurrency(doc.amount) }}</span>
            </span>
            <span class="doc-file">{{ doc.fileName }} · {{ storageLabel(doc) }}</span>
          </div>
          <div class="doc-actions">
            <button type="button" class="icon-btn" title="Visualizar" @click="previewDoc = doc">
              <Eye :size="18" />
            </button>
            <button type="button" class="icon-btn" title="Registrar receita" @click="registerIncomeFromDoc(doc)">
              <DollarSign :size="18" />
            </button>
            <button type="button" class="icon-btn danger" title="Excluir" @click="removeDoc(doc)">
              <Trash2 :size="18" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <IncomeDocumentPreviewModal
      :show="previewDoc != null"
      :document="previewDoc"
      :title="previewDoc?.label"
      @close="previewDoc = null"
    />

    <ConfirmModal
      :show="confirmDelete"
      title="Excluir comprovante"
      message="O arquivo será removido da nuvem ou deste dispositivo. Continuar?"
      @confirm="confirmRemove"
      @cancel="confirmDelete = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import { useIncomeDocumentUpload } from '@/composables/useIncomeDocumentUpload'
import { INCOME_DOCUMENT_LABELS } from '@/constants/income-documents.js'
import { removeIncomeDocumentFile } from '@/api/income-documents-storage.js'
import IncomeDocumentPreviewModal from '@/components/IncomeDocumentPreviewModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { FileUp, FileText, Upload, Loader2, Eye, Trash2, DollarSign } from 'lucide-vue-next'

const financeStore = useFinanceStore()
const router = useRouter()
const { showToast } = useNotification()
const { uploading, uploadDocument } = useIncomeDocumentUpload()

const documentLabels = INCOME_DOCUMENT_LABELS
const fileInput = ref(null)
const selectedFile = ref(null)
const isDragging = ref(false)
const previewDoc = ref(null)
const confirmDelete = ref(false)
const docToDelete = ref(null)
const filterType = ref('')
const filterYear = ref('')

const form = ref({
  type: 'holerite',
  label: '',
  referenceYear: new Date().getFullYear(),
  referenceMonth: new Date().getMonth() + 1,
  amount: null,
  notes: '',
  createIncome: true,
})

const yearOptions = computed(() => {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2, y - 3]
})

const documents = computed(() =>
  financeStore.getIncomeDocuments({
    type: filterType.value || undefined,
    year: filterYear.value || undefined,
  }),
)

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function periodLabel(doc) {
  const m = doc.referenceMonth
  const monthName = m ? financeStore.monthNames[m - 1] : ''
  return m ? `${monthName}/${doc.referenceYear}` : String(doc.referenceYear)
}

function storageLabel(doc) {
  if (doc.storage === 'cloud') return 'Nuvem'
  return 'Neste aparelho'
}

function onFilePick(e) {
  const file = e.target.files?.[0]
  if (file) selectedFile.value = file
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
}

async function handleUpload() {
  if (!selectedFile.value) return
  try {
    let incomeId = null
    if (form.value.createIncome && form.value.amount > 0) {
      const month = form.value.referenceMonth || new Date().getMonth() + 1
      const date = `${form.value.referenceYear}-${String(month).padStart(2, '0')}-01`
      const income = financeStore.addIncome({
        date,
        type: form.value.type === 'holerite' ? 'Salário' : 'Outros',
        description: form.value.label || documentLabels[form.value.type],
        amount: form.value.amount,
      })
      incomeId = income?.id
    }

    const { bucketMissing } = await uploadDocument({
      file: selectedFile.value,
      type: form.value.type,
      label: form.value.label,
      referenceYear: form.value.referenceYear,
      referenceMonth: form.value.referenceMonth,
      amount: form.value.amount,
      notes: form.value.notes,
      incomeId,
    })

    if (bucketMissing) {
      showToast('Salvo neste aparelho. Aplique a migração do bucket income-documents no Supabase para nuvem.', 'warning')
    } else {
      showToast('Comprovante salvo com sucesso!', 'success')
    }
    clearFile()
    form.value.label = ''
    form.value.notes = ''
    form.value.amount = null
  } catch (err) {
    showToast(err.message || 'Erro ao enviar', 'error')
  }
}

function registerIncomeFromDoc(doc) {
  if (doc.incomeId) {
    showToast('Já vinculado a uma receita.', 'info')
    return
  }
  const month = doc.referenceMonth || new Date().getMonth() + 1
  const amount = doc.amount || 0
  if (amount <= 0) {
    showToast('Defina um valor no documento ou informe manualmente em Lançar.', 'warning')
    router.push('/entries')
    return
  }
  const income = financeStore.addIncome({
    date: `${doc.referenceYear}-${String(month).padStart(2, '0')}-01`,
    type: doc.type === 'holerite' ? 'Salário' : 'Outros',
    description: doc.label || documentLabels[doc.type],
    amount,
  })
  financeStore.linkDocumentToIncome(doc.id, income.id)
  showToast('Receita registrada e vinculada ao comprovante.', 'success')
}

function removeDoc(doc) {
  docToDelete.value = doc
  confirmDelete.value = true
}

async function confirmRemove() {
  confirmDelete.value = false
  const doc = docToDelete.value
  if (!doc) return
  try {
    await removeIncomeDocumentFile(doc)
    financeStore.deleteIncomeDocument(doc.id)
    showToast('Comprovante excluído.', 'success')
  } catch (err) {
    showToast(err.message || 'Erro ao excluir', 'error')
  }
  docToDelete.value = null
}
</script>

<style scoped>
.income-docs-view {
  padding: 2rem;
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.hero h1 {
  margin: 0 0 0.35rem;
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.hero p {
  margin: 0;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
  line-height: 1.5;
}

.panel {
  background: var(--bg-panel);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  border: 1px solid var(--border-color);
}

.upload-form h2,
.list-panel h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.dropzone {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  transition: border-color 0.2s, background 0.2s;
}

.dropzone.dragover,
.dropzone:hover {
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.06);
}

.dropzone p {
  margin: 0.5rem 0 0;
  color: var(--text-primary);
  font-weight: 500;
}

.hint {
  font-size: 0.75rem;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.link-btn {
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.8rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  padding: 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-input, var(--bg-shell));
  color: var(--text-primary);
}

.checkbox {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem !important;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.doc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.doc-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-hover);
}

.doc-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent);
}

.doc-icon.informe_rendimentos {
  background: var(--blue-dim);
  color: var(--accent);
}

.doc-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.doc-meta,
.doc-file {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.doc-actions {
  display: flex;
  gap: 0.35rem;
}

.icon-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  border-radius: 8px;
  padding: 0.4rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.icon-btn.danger:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.4);
}

.empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
