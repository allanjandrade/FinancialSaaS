(async () => {
  const supabase = window.supabase
  if (!supabase) throw new Error('Cliente Supabase nao encontrado nesta pagina')

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData?.session
  if (!session?.access_token) throw new Error('Entre no aplicativo antes de executar o smoke test')

  const supabaseUrl = String(window.SUPABASE_CONFIG?.url || supabase.supabaseUrl || '').replace(/\/$/, '')
  if (!supabaseUrl) throw new Error('URL do Supabase nao encontrada')

  const { data: setting, error: settingError } = await supabase
    .from('user_ai_settings')
    .select('enabled, consented_at, revoked_at')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (settingError) throw settingError
  if (!setting?.enabled || !setting.consented_at || setting.revoked_at) {
    throw new Error('Ative o consentimento do copiloto nas configuracoes antes do smoke')
  }

  const { data: stateBefore, error: stateError } = await supabase
    .from('finance_states')
    .select('family_id, data, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (stateError) throw stateError
  const beforeFingerprint = JSON.stringify(stateBefore)

  async function invoke(body, expectedStatus = 200) {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.SUPABASE_CONFIG?.anonKey || '',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null)
    if (response.status !== expectedStatus) {
      throw new Error(`ai-assist retornou ${response.status}: ${JSON.stringify(payload)}`)
    }
    return payload
  }

  const contexts = ['dashboard', 'entries', 'purchases', 'reports']
  const results = []
  for (const contextType of contexts) {
    const result = await invoke({
      context_type: contextType,
      entity_id: null,
      user_query: 'Resuma os principais pontos deste contexto sem executar nenhuma acao.',
    })
    if (!result?.answer || !['low', 'medium', 'high'].includes(result.confidence)) {
      throw new Error(`${contextType}: resposta estruturada invalida`)
    }
    if (!Array.isArray(result.basis) || !Array.isArray(result.warnings)) {
      throw new Error(`${contextType}: campos de auditoria ausentes`)
    }
    if ((result.suggested_actions || []).some((action) => action.executable !== false)) {
      throw new Error(`${contextType}: acao executavel foi retornada`)
    }
    results.push({ context: contextType, status: 'OK', confidence: result.confidence })
  }

  const forged = await invoke({
    context_type: 'dashboard', entity_id: null, user_query: 'Teste de payload', user_id: session.user.id,
  }, 400)
  if (forged?.error?.code !== 'INVALID_PAYLOAD') throw new Error('Override de identidade nao foi rejeitado')

  const injected = await invoke({
    context_type: 'dashboard', entity_id: null, user_query: 'Teste de payload', context_payload: { balance: 999999 },
  }, 400)
  if (injected?.error?.code !== 'INVALID_PAYLOAD') throw new Error('Contexto fornecido pelo frontend nao foi rejeitado')

  const { data: stateAfter, error: afterError } = await supabase
    .from('finance_states')
    .select('family_id, data, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (afterError) throw afterError
  if (JSON.stringify(stateAfter) !== beforeFingerprint) throw new Error('finance_states foi alterado durante o smoke')

  console.table(results)
  console.info('Release 3 smoke remoto: 4/4 contextos, payload protegido e zero escrita financeira')
  return results
})()
