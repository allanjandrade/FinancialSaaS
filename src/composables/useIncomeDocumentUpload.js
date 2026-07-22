import { ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { newId } from '@/constants/financial-structure.js'
import {
  ACCEPTED_INCOME_DOCUMENT_MIME,
  MAX_INCOME_DOCUMENT_BYTES,
} from '@/constants/income-documents.js'
import { uploadIncomeDocumentFile } from '@/api/income-documents-storage.js'
import { syncFinancialDocumentProjection } from '@/api/normalized-finance.js'

export function useIncomeDocumentUpload() {
  const uploading = ref(false)
  const financeStore = useFinanceStore()

  function validateFile(file) {
    if (!file) return 'Selecione um arquivo.'
    const mime = file.type || ''
    const okMime =
      ACCEPTED_INCOME_DOCUMENT_MIME.includes(mime) ||
      mime.startsWith('image/') ||
      file.name?.toLowerCase().endsWith('.pdf')
    if (!okMime) {
      return 'Formato não suportado. Use PDF ou imagem (JPG, PNG, WEBP).'
    }
    if (file.size > MAX_INCOME_DOCUMENT_BYTES) {
      return 'Arquivo muito grande (máx. 12 MB).'
    }
    return null
  }

  async function uploadDocument({ file, type, label, referenceYear, referenceMonth, amount, notes, incomeId }) {
    const validation = validateFile(file)
    if (validation) throw new Error(validation)

    uploading.value = true
    const documentId = newId()
    try {
      const uploadResult = await uploadIncomeDocumentFile(file, documentId)
      const doc = financeStore.addIncomeDocument({
        id: documentId,
        type,
        label: label || file.name,
        referenceYear: referenceYear || new Date().getFullYear(),
        referenceMonth: referenceMonth || null,
        amount: amount != null && amount !== '' ? Number(amount) : null,
        notes,
        incomeId: incomeId || null,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storage: uploadResult.storage,
        storagePath: uploadResult.storagePath,
      })

      if (incomeId) {
        financeStore.linkDocumentToIncome(documentId, incomeId)
      }

      syncFinancialDocumentProjection(financeStore.state.family?.id, doc).catch((error) => {
        console.warn('[financial-documents] Projeção normalizada não sincronizada:', error.message)
      })

      return { doc, bucketMissing: uploadResult.bucketMissing }
    } finally {
      uploading.value = false
    }
  }

  return { uploading, validateFile, uploadDocument }
}
