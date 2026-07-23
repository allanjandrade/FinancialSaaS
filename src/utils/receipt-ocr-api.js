import { extractNativeDocumentText } from './native-document-extraction.js'

function edgeFunctionHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Falha ao ler o arquivo'))
        return
      }
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Envia imagem para /functions/v1/receipt-ocr (nunca /chat).
 */
export async function fetchReceiptOcr(file) {
  const supabase = window.supabase
  if (!supabase) {
    throw new Error('Supabase não inicializado')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) {
    throw new Error('Faça login para escanear comprovantes')
  }

  const imagemBase64 = await fileToBase64(file)
  const extractedText = await extractNativeDocumentText(file)
  const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/receipt-ocr`

  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify({
      imagemBase64,
      mimeType: file.type || 'image/jpeg',
      extractedText,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao processar comprovante' }))
    const statusText = `HTTP ${response.status}`
    const detail = errorData?.details || errorData?.error || statusText
    throw new Error(`${statusText}: ${detail}`)
  }

  return response.json()
}
