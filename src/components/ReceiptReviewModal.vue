<template>
  <transition name="fade">
    <div v-if="show" class="modal-overlay" @click="handleCancel">
      <div class="modal-content" @click.stop>
        <h3>Revisar despesa</h3>
        <p class="modal-subtitle">Confira os dados extraídos do comprovante antes de salvar.</p>

        <form class="review-form" @submit.prevent="handleConfirm">
          <div v-if="lowConfidence" class="low-confidence-warning" role="status">
            Não foi possível identificar com segurança. Selecione manualmente.
          </div>

          <label>
            Valor (R$)
            <input
              v-model.number="form.valor"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0,00"
              :class="{ 'field-low-confidence': lowConfidence && (!form.valor || form.valor <= 0) }"
            />
          </label>

          <label>
            Estabelecimento
            <input
              v-model="form.estabelecimento"
              type="text"
              maxlength="120"
              placeholder="Nome do estabelecimento"
            />
          </label>

          <label>
            Data
            <input v-model="form.data" type="date" required />
          </label>

          <label>
            Método de pagamento
            <select v-model="form.metodo" required :class="{ 'field-low-confidence': lowConfidence && !form.metodo }">
              <option value="" disabled>Selecione manualmente</option>
              <option v-for="method in paymentMethods" :key="method" :value="method">
                {{ method }}
              </option>
            </select>
          </label>

          <label>
            Categoria
            <select v-model="form.categoria" required :class="{ 'field-low-confidence': lowConfidence && !form.categoria }">
              <option value="" disabled>Selecione manualmente</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </label>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="handleCancel">Cancelar</button>
            <button type="submit" class="btn-confirm" :disabled="!canConfirm">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { normalizeReceiptData } from '@/utils/ai-receipt.js'
import { OFFICIAL_EXPENSE_CATEGORIES, OFFICIAL_PAYMENT_METHODS } from '@/constants/finance'

const props = defineProps({
  show: Boolean,
  draft: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const paymentMethods = OFFICIAL_PAYMENT_METHODS
const categories = OFFICIAL_EXPENSE_CATEGORIES

const form = reactive({
  valor: null,
  estabelecimento: '',
  data: '',
  metodo: '',
  categoria: '',
})

const lowConfidence = computed(() => {
  const c = Number(props.draft?.confianca ?? 0)
  return c < 80
})

watch(
  () => props.draft,
  (draft) => {
    if (!draft) return

    const confidence = Number(draft.confianca ?? 0)

    form.valor = draft.valor ?? null
    form.estabelecimento = draft.estabelecimento || ''
    form.data = draft.data || new Date().toISOString().split('T')[0]

    const suggestedMetodo = paymentMethods.includes(draft.metodo) ? draft.metodo : ''
    const suggestedCategoria = categories.includes(draft.categoria) ? draft.categoria : ''

    // Baixa confiança: obrigar preenchimento manual.
    if (confidence < 80) {
      form.metodo = ''
      form.categoria = ''
    } else {
      form.metodo = suggestedMetodo
      form.categoria = suggestedCategoria
    }
  },
  { immediate: true }
)

const canConfirm = computed(() => {
  const valorOk = form.valor != null && Number(form.valor) > 0
  const dataOk = Boolean(form.data)
  return valorOk && dataOk && Boolean(form.metodo) && Boolean(form.categoria)
})

function handleConfirm() {
  if (!canConfirm.value) return
  const normalized = normalizeReceiptData({
    valor: form.valor,
    estabelecimento: form.estabelecimento || null,
    data: form.data,
    metodo: form.metodo,
    categoria: form.categoria,
  })

  normalized.ocrProvider = props.draft?.ocrProvider || 'OCR'
  normalized.ocrConfidence = Number(props.draft?.confianca ?? 0)
  normalized.ocrDate = new Date().toISOString().split('T')[0]
  normalized.ocrTipoDocumento = props.draft?.tipoDocumento || ''
  normalized.ocrObservacoes = props.draft?.observacoes || ''

  emit('confirm', normalized)
}

function handleCancel() {
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}

.modal-subtitle {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.review-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.review-form input,
.review-form select {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.field-low-confidence {
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.low-confidence-warning {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #f59e0b;
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel,
.btn-confirm {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.btn-confirm {
  background: var(--accent);
  border: none;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
