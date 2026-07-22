async function invokeKnowledge(payload) {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Faça login para acessar a base de conhecimento')

  const response = await fetch(`${window.SUPABASE_CONFIG.url}/functions/v1/embeddings`, {
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
    throw new Error(error.details || error.error || 'Erro na base de conhecimento')
  }
  return response.json()
}

export function indexKnowledgeDocument(document) {
  return invokeKnowledge({ action: 'index', ...document })
}

export function searchKnowledge(familyId, query, options = {}) {
  return invokeKnowledge({ action: 'search', familyId, query, ...options })
}
