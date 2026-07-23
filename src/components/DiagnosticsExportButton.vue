<template>
  <button type="button" class="secondary-button" data-testid="diagnostics-export" :disabled="loading" @click="handleExport">
    <Download />
    <span>{{ loading ? 'Exportando' : 'Exportar diagnostico' }}</span>
  </button>
</template>

<script setup>
import { ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { exportDiagnostics } from '@/api/operational-insights.js'

const props = defineProps({
  periodDays: {
    type: Number,
    default: 7,
  },
})

const emit = defineEmits(['exported', 'error'])
const loading = ref(false)

async function handleExport() {
  loading.value = true
  try {
    const payload = await exportDiagnostics(props.periodDays)
    const diagnostics = payload.diagnostics
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diagnostico-release-6-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    emit('exported', diagnostics)
  } catch (error) {
    emit('error', error)
  } finally {
    loading.value = false
  }
}
</script>
