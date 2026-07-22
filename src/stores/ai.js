import { defineStore } from 'pinia'
import { ref } from 'vue'
import { marked } from 'marked'
import { useFinanceStore } from '@/stores/finance'
import {
  normalizeReceiptData,
  tryParseFinancialJson,
  formatConfirmedExpenseMessage,
  addExpenseFromNormalized,
} from '@/utils/ai-receipt.js'
import { fetchReceiptOcr } from '@/utils/receipt-ocr-api.js'
import { answerSubscriptionQuestion } from '@/utils/subscriptions.js'

const BLOCKED_MARKDOWN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
  'base',
])

const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction'])
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function edgeFunctionHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

function isSafeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return false

  const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase()
  if (compact.startsWith('javascript:') || compact.startsWith('data:') || compact.startsWith('vbscript:')) return false
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return true

  try {
    const base = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://app.local'
    return SAFE_PROTOCOLS.has(new URL(raw, base).protocol)
  } catch {
    return false
  }
}

function stripUnsafeHtmlFallback(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src|xlink:href|action|formaction)=(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*'|[^\s>]+)/gi, '')
}

function sanitizeMarkdownHtml(html) {
  if (typeof document === 'undefined') return stripUnsafeHtmlFallback(html)

  const template = document.createElement('template')
  template.innerHTML = String(html || '')

  for (const node of [...template.content.querySelectorAll('*')]) {
    const tagName = node.tagName.toLowerCase()
    if (BLOCKED_MARKDOWN_TAGS.has(tagName)) {
      node.remove()
      continue
    }

    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        node.removeAttribute(attribute.name)
        continue
      }

      if (URL_ATTRIBUTES.has(name) && !isSafeUrl(attribute.value)) {
        node.removeAttribute(attribute.name)
      }
    }

    if (tagName === 'a' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noreferrer noopener')
    }
  }

  return template.innerHTML
}

export const useAIStore = defineStore('ai', () => {
  const messages = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pendingFile = ref(null)
  const receiptDraft = ref(null)

  function saveExpenseFromReceipt(extractedData) {
    return addExpenseFromNormalized(extractedData, useFinanceStore())
  }

  function closeReceiptReview() {
    receiptDraft.value = null
  }

  function confirmReceiptFromReview(normalized) {
    const saved = saveExpenseFromReceipt(normalized)
    closeReceiptReview()
    return saved
  }

  function openManualReceiptFallback(reason = '') {
    receiptDraft.value = {
      valor: null,
      estabelecimento: '',
      data: new Date().toISOString().split('T')[0],
      metodo: '',
      categoria: '',
      confianca: 0,
      tipoDocumento: 'Preenchimento manual',
      observacoes: reason ? `OCR indisponível: ${reason}` : 'OCR indisponível',
      ocrProvider: 'Manual',
      manualFallback: true,
    }
    messages.value.push({
      role: 'assistant',
      content: 'Não foi possível ler o comprovante. O formulário manual foi aberto para revisão; nada foi salvo automaticamente.',
      isMarkdown: false,
      timestamp: new Date().toISOString(),
    })
    return receiptDraft.value
  }

  async function sendMessage(message) {
    if (!message.trim() && !pendingFile.value) return

    loading.value = true
    error.value = null

    if (message.trim()) {
      messages.value.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      })
    }

    if (pendingFile.value) {
      const file = pendingFile.value
      pendingFile.value = null
      try {
        await processReceiptFile(file, message.trim())
      } catch (err) {
        console.error('[AI] Receipt error:', err)
        error.value = err.message
        messages.value.push({
          role: 'assistant',
          content: `**Erro ao processar comprovante:** ${err.message}`,
          isMarkdown: true,
          isError: true,
          timestamp: new Date().toISOString()
        })
      } finally {
        loading.value = false
      }
      return
    }

    const financeStore = useFinanceStore()
    const subscriptionAnswer = answerSubscriptionQuestion(message.trim(), financeStore.state)
    if (subscriptionAnswer.handled) {
      messages.value.push({
        role: 'assistant',
        content: subscriptionAnswer.content,
        isMarkdown: true,
        timestamp: new Date().toISOString()
      })
      loading.value = false
      return
    }

    try {
      const supabase = window.supabase
      if (!supabase) {
        throw new Error('Supabase not initialized')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        messages.value.push({
          role: 'assistant',
          content: '⚠️ **Autenticação necessária**\n\nPara usar o assistente IA, você precisa estar autenticado. Por favor, faça login para continuar.',
          isMarkdown: true,
          timestamp: new Date().toISOString()
        })
        loading.value = false
        return
      }

      const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/chat`

      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: edgeFunctionHeaders(token),
        body: JSON.stringify({
          message: message.trim(),
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || errorData.detail || `Server error (${response.status})`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const aiResponse = data.response || ''

      const financialJson = tryParseFinancialJson(aiResponse)
      if (financialJson) {
        const normalized = normalizeReceiptData(financialJson)
        receiptDraft.value = {
          ...normalized,
          confianca: 0,
          tipoDocumento: 'Outros',
          observacoes: '',
        }
        return
      }

      messages.value.push({
        role: 'assistant',
        content: aiResponse || 'No response received',
        isMarkdown: true,
        timestamp: new Date().toISOString()
      })

    } catch (err) {
      console.error('[AI] Error:', err)
      error.value = err.message

      let errorContent = `**Erro:** ${err.message}\n\n`
      if (err.message.includes('500') || err.message.includes('Server error')) {
        errorContent += 'O servidor da IA está enfrentando problemas temporários.\n\n'
        errorContent += '**Soluções possíveis:**\n'
        errorContent += '- Verifique se o provedor de IA esta configurado nas Edge Functions\n'
        errorContent += '- Tente novamente em alguns instantes\n'
      } else {
        errorContent += 'Por favor, tente novamente.'
      }

      messages.value.push({
        role: 'assistant',
        content: errorContent,
        isMarkdown: true,
        isError: true,
        timestamp: new Date().toISOString()
      })
    } finally {
      loading.value = false
    }
  }

  async function processReceiptFile(file, userMessage = '') {
    try {
      if (userMessage) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await sendMessageWithImage(userMessage, dataUrl, file.type)
        return
      }
      await processReceiptWithAI(file)
    } catch (error) {
      console.warn('[OCR] Fallback manual ativado:', error.message)
      openManualReceiptFallback(error.message)
    }
  }

  async function sendMessageWithImage(message, dataUrl, mimeType) {
    const supabase = window.supabase
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Unauthorized')

    const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/chat`
    const response = await fetch(edgeUrl, {
      method: 'POST',
      headers: edgeFunctionHeaders(token),
      body: JSON.stringify({
        message,
        image: { data: dataUrl, mimeType },
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to send message with image')
    }

    const data = await response.json()
    const aiResponse = data.response || ''

    const financialJson = tryParseFinancialJson(aiResponse)
    if (financialJson) {
      const normalized = normalizeReceiptData(financialJson)
      receiptDraft.value = {
        ...normalized,
        confianca: 0,
        tipoDocumento: 'Outros',
        observacoes: '',
      }
      return
    }

    messages.value.push({
      role: 'assistant',
      content: aiResponse,
      isMarkdown: true,
      timestamp: new Date().toISOString()
    })
  }

  async function processReceiptWithAI(file) {
    const raw = await fetchReceiptOcr(file)
    receiptDraft.value = raw
    return raw
  }

  function clearMessages() {
    messages.value = []
    error.value = null
  }

  function setPendingFile(file) {
    pendingFile.value = file
  }

  function clearPendingFile() {
    pendingFile.value = null
  }

  function renderMarkdown(content) {
    try {
      return sanitizeMarkdownHtml(marked.parse(String(content || '')))
    } catch {
      return sanitizeMarkdownHtml(String(content || ''))
    }
  }

  return {
    messages,
    loading,
    error,
    pendingFile,
    receiptDraft,
    sendMessage,
    clearMessages,
    setPendingFile,
    clearPendingFile,
    closeReceiptReview,
    confirmReceiptFromReview,
    openManualReceiptFallback,
    renderMarkdown,
  }
})
