function edgeFunctionHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

async function readJson(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

export async function createProductFromUrl(url, details = {}) {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Faca login para adicionar produto por link')

  const endpoint = `${window.SUPABASE_CONFIG.url}/functions/v1/product-from-url`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify({
      url,
      category: details.category,
      priority: details.priority,
      desiredDate: details.desiredDate,
      notes: details.notes,
      targetPrice: details.targetPrice,
    }),
  })
  const payload = await readJson(response)
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || payload?.details || `HTTP ${response.status}`)
    error.payload = payload
    error.status = response.status
    throw error
  }
  return payload
}
