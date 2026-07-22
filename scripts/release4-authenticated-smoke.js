(async () => {
  const supabase = window.supabase
  if (!supabase) throw new Error('Cliente Supabase nao encontrado nesta pagina')
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData?.session
  if (!session?.access_token) throw new Error('Entre no aplicativo antes de executar o smoke')
  const baseUrl = String(window.SUPABASE_CONFIG?.url || supabase.supabaseUrl || '').replace(/\/$/, '')
  const headers = { 'Content-Type': 'application/json', apikey: window.SUPABASE_CONFIG?.anonKey || '', Authorization: `Bearer ${session.access_token}` }
  const invoke = async (slug, body, expected = 200) => {
    const response = await fetch(`${baseUrl}/functions/v1/${slug}`, { method: 'POST', headers, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => null)
    if (response.status !== expected) throw new Error(`${slug} retornou ${response.status}: ${JSON.stringify(payload)}`)
    return payload
  }
  const readState = async () => {
    const { data, error } = await supabase.from('finance_states').select('family_id,data,updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    return data
  }
  const before = await readState()
  const beforeData = JSON.stringify(before.data)
  const suffix = crypto.randomUUID()
  const proposed = await invoke('propose-action', {
    action_type: 'add_to_wishlist',
    payload: { name: `Smoke Release 4 ${suffix}`, value: null, category: 'Outros', priority: 'Baixa', notes: 'Item temporario de certificacao' },
    idempotency_key: `smoke-propose-${suffix}`,
  }, 201)
  const afterProposal = await readState()
  if (JSON.stringify(afterProposal.data) !== beforeData) throw new Error('A proposta alterou finance_states antes da confirmacao')
  const confirmBody = { draft_id: proposed.draft.id, confirmation_token: proposed.confirmation_token, idempotency_key: `smoke-confirm-${suffix}` }
  const confirmed = await invoke('confirm-action', confirmBody)
  const confirmedAgain = await invoke('confirm-action', confirmBody)
  if (confirmed.log_id !== confirmedAgain.log_id) throw new Error('A confirmacao idempotente retornou logs diferentes')
  const afterConfirm = await readState()
  if (!(afterConfirm.data.wishlist || []).some((item) => item.name === `Smoke Release 4 ${suffix}`)) throw new Error('Item temporario nao foi criado')
  const forged = await invoke('confirm-action', { ...confirmBody, user_id: session.user.id, idempotency_key: `forged-${suffix}` }, 403)
  if (forged?.error?.code !== 'FORBIDDEN') throw new Error('Override de identidade nao foi rejeitado')
  const revertBody = { log_id: confirmed.log_id, idempotency_key: `smoke-revert-${suffix}` }
  await invoke('revert-action', revertBody)
  await invoke('revert-action', revertBody)
  const afterRevert = await readState()
  if (JSON.stringify(afterRevert.data) !== beforeData) throw new Error('A reversao nao restaurou exatamente o conteudo financeiro original')
  console.table({ proposalWithoutWrite: 'OK', explicitConfirmation: 'OK', idempotency: 'OK', identityProtection: 'OK', operationSpecificRevert: 'OK' })
  console.info('Release 4 smoke remoto: PASS, sem residuo financeiro')
})()
