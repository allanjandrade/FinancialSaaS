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

function edgeErrorDetail(errorData, fallback) {
  const detail = errorData?.details || errorData?.error || errorData?.message
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (typeof detail?.message === 'string') return detail.message
  if (typeof detail?.code === 'string') return detail.code
  return fallback
}

function friendlyNetworkOcrError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/failed to fetch|network|cors|load failed/i.test(message)) {
    return new Error('OCR online indisponível. Tente novamente ou use CSV/PDF com texto selecionável.')
  }
  return error
}

export async function fetchStatementOcr(file, { extractedText = '' } = {}) {
  const supabase = window.supabase
  if (!supabase) {
    throw new Error('Supabase não inicializado')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) {
    throw new Error('Faca login para ler extratos')
  }

  const fileBase64 = await fileToBase64(file)
  const edgeUrl = `${window.SUPABASE_CONFIG.url}/functions/v1/statement-ocr`

  let response
  try {
    response = await fetch(edgeUrl, {
      method: 'POST',
      headers: edgeFunctionHeaders(token),
      body: JSON.stringify({
        fileBase64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name || 'extrato',
        extractedText,
      }),
    })
  } catch (error) {
    throw friendlyNetworkOcrError(error)
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro ao processar extrato' }))
    const statusText = `HTTP ${response.status}`
    const detail = edgeErrorDetail(errorData, statusText)
    throw new Error(`${statusText}: ${detail}`)
  }

  return response.json()
}
