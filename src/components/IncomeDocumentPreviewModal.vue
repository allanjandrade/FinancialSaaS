<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal panel">
      <header class="modal-head">
        <div>
          <h3>{{ title }}</h3>
          <p class="meta">{{ fileName }}</p>
        </div>
        <button type="button" class="icon-close" aria-label="Fechar" @click="$emit('close')">
          <X :size="20" />
        </button>
      </header>
      <div v-if="loading" class="loading">Carregando documento...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else class="preview-body">
        <iframe v-if="isPdf" :src="objectUrl" class="preview-frame" title="Visualização PDF" />
        <img v-else-if="isImage" :src="objectUrl" alt="Comprovante" class="preview-image" />
        <p v-else class="muted">Visualização não disponível. Use baixar.</p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="secondary-button" @click="download">Baixar</button>
        <button type="button" class="primary-button" @click="$emit('close')">Fechar</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { createObjectUrlForDocument, downloadIncomeDocumentFile } from '@/api/income-documents-storage.js'

const props = defineProps({
  show: Boolean,
  document: { type: Object, default: null },
  title: { type: String, default: 'Comprovante' },
})

defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const objectUrl = ref('')

const fileName = computed(() => props.document?.fileName || '')
const isPdf = computed(() => props.document?.mimeType === 'application/pdf' || fileName.value.toLowerCase().endsWith('.pdf'))
const isImage = computed(() => props.document?.mimeType?.startsWith('image/'))

async function loadPreview() {
  if (!props.show || !props.document) return
  loading.value = true
  error.value = ''
  revokeUrl()
  try {
    objectUrl.value = await createObjectUrlForDocument(props.document)
  } catch (err) {
    error.value = err.message || 'Não foi possível abrir o arquivo.'
  } finally {
    loading.value = false
  }
}

function revokeUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

async function download() {
  if (!props.document) return
  try {
    const blob = await downloadIncomeDocumentFile(props.document)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.document.fileName || 'comprovante'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message
  }
}

watch(() => [props.show, props.document?.id], loadPreview, { immediate: true })
onUnmounted(revokeUrl)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal {
  width: min(920px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-head h3 {
  margin: 0;
  font-size: 1.1rem;
}

.meta {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.icon-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.preview-body {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  min-height: 280px;
}

.preview-frame {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: 8px;
  background: #fff;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
}

.loading,
.error,
.muted {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.error {
  color: #f87171;
}
</style>
