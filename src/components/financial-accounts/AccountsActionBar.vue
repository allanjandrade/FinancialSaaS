<template>
  <section
    class="accounts-action-bar"
    :class="{ 'is-secondary-only': totalCount === 0 }"
    role="toolbar"
    aria-label="Ferramentas secundárias de contas financeiras"
  >
    <div v-if="totalCount > 0" class="bulk-group">
      <button type="button" class="action-button" @click="emit('toggleBulk')">
        <CheckSquare aria-hidden="true" :size="17" />
        Selecionar contas
      </button>
      <button type="button" class="action-button" :disabled="selectedCount === 0" @click="emit('bulkActivate')">
        <ToggleRight aria-hidden="true" :size="17" />
        Ativar
      </button>
      <button type="button" class="action-button" :disabled="selectedCount === 0" @click="emit('bulkDeactivate')">
        <ToggleLeft aria-hidden="true" :size="17" />
        Desativar
      </button>
      <button type="button" class="action-button" :disabled="selectedCount === 0" @click="emit('forceSync')">
        <RefreshCw aria-hidden="true" :size="17" />
        Forcar sync
      </button>
      <span>{{ selectedCount }} de {{ totalCount }} selecionadas</span>
    </div>

    <div class="import-group">
      <button type="button" class="action-button" :disabled="totalCount === 0" @click="emit('exportCsv')">
        <Download aria-hidden="true" :size="17" />
        Exportar
      </button>
      <button type="button" class="action-button" @click="openFilePicker">
        <Upload aria-hidden="true" :size="17" />
        Importar CSV
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        class="file-input"
        aria-label="Importar arquivo CSV de contas financeiras"
        @change="handleCsvFile"
      />
    </div>

    <div v-if="previewRows.length" class="csv-preview" role="status">
      <div class="preview-head">
        <strong>Prévia do CSV</strong>
        <button type="button" @click="clearPreview">Limpar</button>
      </div>
      <div class="preview-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="header in previewHeaders" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewRows" :key="index">
              <td v-for="header in previewHeaders" :key="header">{{ row[header] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CheckSquare, Download, RefreshCw, ToggleLeft, ToggleRight, Upload } from 'lucide-vue-next'

const props = defineProps({
  selectedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  csvPreview: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'toggleBulk',
  'bulkActivate',
  'bulkDeactivate',
  'forceSync',
  'exportCsv',
  'importCsv',
  'clearPreview',
])

const fileInput = ref(null)
const localPreview = ref([])
const previewRows = computed(() => (props.csvPreview.length ? props.csvPreview : localPreview.value))
const previewHeaders = computed(() => Object.keys(previewRows.value[0] || {}).slice(0, 5))

function openFilePicker() {
  fileInput.value?.click()
}

async function handleCsvFile(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const text = await file.text()
  const rows = parseCsvPreview(text)
  localPreview.value = rows
  emit('importCsv', { file, rows })
  event.target.value = ''
}

function parseCsvPreview(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)

  if (!lines.length) return []

  const headers = splitCsvLine(lines[0]).map((header, index) => header || `Coluna ${index + 1}`)

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || ''
      return row
    }, {})
  })
}

function splitCsvLine(line) {
  return String(line || '')
    .split(',')
    .map((cell) => cell.trim().replace(/^"|"$/g, ''))
}

function clearPreview() {
  localPreview.value = []
  emit('clearPreview')
}
</script>

<style scoped>
.accounts-action-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: start;
  padding: 0.56rem 0.62rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-family: var(--font-sans);
}

.accounts-action-bar.is-secondary-only {
  grid-template-columns: 1fr;
  padding-block: 0.35rem;
  border-color: transparent;
  background: transparent;
}

.bulk-group,
.import-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.accounts-action-bar.is-secondary-only .import-group {
  justify-content: flex-end;
}

.bulk-group span {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 800;
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.accounts-action-bar.is-secondary-only .action-button {
  background: transparent;
  color: var(--text-secondary);
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.csv-preview {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.preview-head strong {
  color: var(--text-primary);
  font-size: 0.85rem;
}

.preview-head button {
  min-height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
}

.preview-scroll {
  overflow-x: auto;
}

.csv-preview table {
  min-width: 520px;
}

.csv-preview th,
.csv-preview td {
  border-bottom: 1px solid var(--border-color);
  padding: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  text-align: left;
}

.csv-preview th {
  color: var(--text-muted);
  font-size: 0.7rem;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

@media (max-width: 680px) {
  .accounts-action-bar {
    grid-template-columns: 1fr;
  }

  .import-group,
  .action-button {
    width: 100%;
  }
}
</style>
