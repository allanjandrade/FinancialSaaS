(async () => {
  const supabase = window.supabase
  if (!supabase) throw new Error('Cliente Supabase nao encontrado nesta pagina')

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData?.session
  if (!session?.access_token) throw new Error('Entre no aplicativo antes de executar o teste')

  const supabaseUrl = String(window.SUPABASE_CONFIG?.url || supabase.supabaseUrl || '').replace(/\/$/, '')
  if (!supabaseUrl) throw new Error('URL do Supabase nao encontrada')

  const now = new Date()
  const referenceDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const checks = [
    ['financial-snapshot', { referenceDate }],
    ['benefit-burn-rate', { benefitType: 'VA', referenceDate }],
    ['card-risk', { referenceDate }],
    ['month-end-projection', { referenceDate }],
    ['category-anomalies', { referenceDate, lookbackMonths: 3 }],
    ['purchase-simulation', {
      referenceDate,
      amount: 100,
      paymentMethod: 'credit_card',
      installments: 1,
      category: 'Teste diagnostico',
    }],
    ['recurring-suggestions', { referenceDate, lookbackMonths: 6 }],
  ]

  async function request(name, body, token) {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await response.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { raw: text }
    }
    return { status: response.status, payload }
  }

  const results = []
  for (const [name, body] of checks) {
    const unauthenticated = await request(name, body, null)
    const unauthenticatedOk = unauthenticated.status === 401
    results.push({
      endpoint: name,
      check: 'sem JWT',
      status: unauthenticatedOk ? 'OK' : 'FALHOU',
      detail: `HTTP ${unauthenticated.status}`,
    })

    const identityOverride = await request(name, {
      ...body,
      user_id: '00000000-0000-4000-8000-000000000000',
    }, session.access_token)
    const overrideOk = identityOverride.status >= 400 && identityOverride.status < 500
    results.push({
      endpoint: name,
      check: 'user_id proibido',
      status: overrideOk ? 'OK' : 'FALHOU',
      detail: `HTTP ${identityOverride.status}`,
    })
  }

  console.table(results)
  const failures = results.filter((item) => item.status !== 'OK')
  const serverErrors = results.filter((item) => item.detail === 'HTTP 500')
  if (failures.length || serverErrors.length) {
    throw new Error(`Certificacao de seguranca falhou em ${failures.length || serverErrors.length} verificacao(oes)`)
  }
  console.info('Release 2 seguranca remota: 14/14 OK')
  return results
})()
