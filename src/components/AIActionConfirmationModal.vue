<template>
  <div class="ai-action-overlay" role="presentation" @click.self="$emit('close')">
    <section class="ai-action-modal" role="dialog" aria-modal="true" aria-labelledby="ai-action-title" data-testid="ai-action-confirmation">
      <header><div><small>Revisão obrigatória</small><h2 id="ai-action-title">{{ draft.preview.title }}</h2></div><button type="button" aria-label="Fechar" @click="$emit('close')"><X :size="20" /></button></header>
      <p>{{ draft.preview.summary }}</p>
      <dl><template v-for="(value, name) in visiblePayload" :key="name"><dt>{{ fieldLabel(name) }}</dt><dd>{{ displayValue(value) }}</dd></template></dl>
      <div class="safety-note"><ShieldCheck :size="20" /><span>A IA não confirma esta ação. Somente este clique pode executar uma operação, uma única vez.</span></div>
      <p v-if="error" class="modal-error">{{ error }}</p>
      <footer><button type="button" class="secondary" :disabled="busy" @click="$emit('close')">Cancelar</button><button type="button" class="primary" data-testid="ai-action-confirm" :disabled="busy" @click="confirm"><Loader2 v-if="busy" class="spin" :size="18" /><Check v-else :size="18" />{{ busy ? 'Confirmando' : 'Confirmar ação' }}</button></footer>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Check, Loader2, ShieldCheck, X } from 'lucide-vue-next'
import { confirmAiAction } from '@/api/ai-actions.js'
const props = defineProps({ draft: { type: Object, required: true }, confirmationToken: { type: String, required: true } })
const emit = defineEmits(['close', 'confirmed'])
const busy = ref(false); const error = ref('')
const visiblePayload = computed(() => props.draft?.preview?.payload || {})
const labels = { kind: 'Tipo', amount: 'Valor', date: 'Data', description: 'Descrição', category: 'Categoria', payment: 'Pagamento', name: 'Nome', priority: 'Prioridade', desiredDate: 'Data desejada', title: 'Título', message: 'Mensagem', severity: 'Severidade', frequency: 'Frequência', dayOfMonth: 'Dia do mês', transactionId: 'Lançamento', transactionIds: 'Lançamentos' }
const fieldLabel = (name) => labels[name] || name
const displayValue = (value) => typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : Array.isArray(value) ? value.join(', ') : (value ?? 'Não informado')
async function confirm() { busy.value = true; error.value = ''; try { const result = await confirmAiAction({ draftId: props.draft.id, confirmationToken: props.confirmationToken }); emit('confirmed', result) } catch (cause) { error.value = cause?.message || 'Não foi possível confirmar.' } finally { busy.value = false } }
</script>

<style scoped>
.ai-action-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:1rem;background:rgba(4,4,8,.78);backdrop-filter:blur(8px)}.ai-action-modal{width:min(560px,100%);max-height:90vh;overflow:auto;padding:1.25rem;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border-color));border-radius:16px;background:var(--bg-panel);box-shadow:0 24px 80px rgba(0,0,0,.5);color:var(--text-primary)}header{display:flex;justify-content:space-between;gap:1rem}header small{color:var(--accent-hover);font-family:var(--font-sans);font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:var(--eyebrow-letter-spacing)}h2{margin:.2rem 0;font-size:1.2rem}header button{border:0;background:transparent;color:var(--text-secondary);cursor:pointer}dl{display:grid;grid-template-columns:minmax(100px,.45fr) 1fr;gap:.55rem;margin:1rem 0;padding:1rem;border-radius:10px;background:var(--bg-hover)}dt{color:var(--text-muted);font-size:.78rem}dd{margin:0;overflow-wrap:anywhere;font-weight:650}.safety-note{display:flex;gap:.65rem;padding:.8rem;border:1px solid rgba(52,211,153,.25);border-radius:10px;background:rgba(52,211,153,.08);color:var(--text-secondary);font-size:.82rem}.modal-error{color:#fb7185}footer{display:flex;justify-content:flex-end;gap:.65rem;margin-top:1rem}footer button{display:flex;align-items:center;gap:.4rem;padding:.7rem .9rem;border-radius:9px;font-weight:750;cursor:pointer}.secondary{border:1px solid var(--border-color);background:var(--bg-hover);color:var(--text-primary)}.primary{border:0;background:var(--accent);color:white}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
</style>
