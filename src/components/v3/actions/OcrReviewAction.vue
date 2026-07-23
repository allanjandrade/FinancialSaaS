<template>
  <section class="ocr-review-action" data-testid="v34-ocr-review-action">
    <div class="ocr-review-action__copy">
      <span>Revisão obrigatória</span>
      <h3>Confira a importação antes de criar dados financeiros</h3>
      <p>
        OCR e importação podem interpretar valores, datas ou descrições com baixa confiança.
        Revise o fluxo de lançamentos antes que qualquer dado financeiro seja criado.
      </p>
    </div>

    <AppButton variant="primary" @click="emit('route', execution)">
      Abrir lançamentos
    </AppButton>
  </section>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue'

defineProps({
  execution: { type: Object, default: null },
  modelValue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['route', 'update:modelValue'])
</script>

<style scoped>
.ocr-review-action {
  display: grid;
  gap: 0.9rem;
}

.ocr-review-action__copy {
  display: grid;
  gap: 0.35rem;
}

.ocr-review-action__copy span {
  color: var(--warning);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.ocr-review-action__copy h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.ocr-review-action__copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}
</style>
