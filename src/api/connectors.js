async function invokeConnector(payload) {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Faça login para configurar conectores')

  const response = await fetch(`${window.SUPABASE_CONFIG.url}/functions/v1/connector-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: window.SUPABASE_CONFIG?.anonKey || '',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.details || error.error || 'Erro ao sincronizar conector')
  }
  return response.json()
}

export function registerConnector(config) {
  return invokeConnector({ action: 'register', ...config })
}

export function ingestConnectorRecords(payload) {
  return invokeConnector({ action: 'ingest', ...payload })
}
