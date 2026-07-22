(async () => {
  const supabase = window.supabase
  if (!supabase) throw new Error('Cliente Supabase nao encontrado nesta pagina')

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData?.session
  if (!session?.access_token) throw new Error('Entre no aplicativo antes de executar o smoke test')

  const configUrl = window.SUPABASE_CONFIG?.url
  const clientUrl = supabase.supabaseUrl
  const supabaseUrl = String(configUrl || clientUrl || '').replace(/\/$/, '')
  if (!supabaseUrl) throw new Error('URL do Supabase nao encontrada')

  const now = new Date()
  const referenceDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  async function invoke(name, body) {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const text = await response.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { raw: text }
    }
    if (!response.ok) {
      throw new Error(`${name} retornou ${response.status}: ${JSON.stringify(payload)}`)
    }
    if (!payload?.result) throw new Error(`${name} retornou uma resposta sem result`)
    return payload.result
  }

  const checks = [
    {
      name: 'financial-snapshot',
      body: { referenceDate },
      validate: (result) => {
        if (typeof result.netWorth !== 'number') throw new Error('netWorth ausente')
        if (result.benefitsExcludedFromNetWorth !== true) throw new Error('VA/VR nao foi marcado como excluido')
        if (!result.period || !Array.isArray(result.warnings)) throw new Error('auditoria incompleta')
      },
    },
    {
      name: 'benefit-burn-rate',
      body: { benefitType: 'VA', referenceDate },
      validate: (result) => {
        const statuses = ['safe', 'attention', 'risk', 'depleted', 'insufficient_data']
        if (!statuses.includes(result.status)) throw new Error('status de beneficio invalido')
        if (!result.period || !Array.isArray(result.warnings)) throw new Error('auditoria incompleta')
      },
    },
    {
      name: 'card-risk',
      body: { referenceDate },
      validate: (result) => {
        const levels = ['safe', 'attention', 'risk', 'critical', 'insufficient_data']
        if (!levels.includes(result.riskLevel)) throw new Error('nivel de risco invalido')
        if (!Array.isArray(result.reasons)) throw new Error('motivos ausentes')
      },
    },
    {
      name: 'month-end-projection',
      body: { referenceDate },
      validate: (result) => {
        if (typeof result.confidence !== 'number') throw new Error('confianca ausente')
        if (result.confidence < 0 || result.confidence > 1) throw new Error('confianca fora da faixa')
      },
    },
    {
      name: 'category-anomalies',
      body: { referenceDate, lookbackMonths: 3 },
      validate: (result) => {
        if (!Array.isArray(result.anomalies)) throw new Error('lista de anomalias ausente')
        if (!result.assumptions) throw new Error('premissas ausentes')
      },
    },
    {
      name: 'purchase-simulation',
      body: {
        referenceDate,
        amount: 100,
        paymentMethod: 'credit_card',
        installments: 1,
        category: 'Teste diagnostico',
        description: 'Simulacao temporaria sem gravacao',
      },
      validate: (result) => {
        const decisions = ['safe', 'attention', 'wait', 'avoid', 'insufficient_data']
        if (!decisions.includes(result.recommendedDecision)) throw new Error('decisao invalida')
        if (!Array.isArray(result.reasons) || !result.reasons.length) throw new Error('justificativas ausentes')
      },
    },
    {
      name: 'recurring-suggestions',
      body: { referenceDate, lookbackMonths: 6 },
      validate: (result) => {
        if (!Array.isArray(result.suggestions)) throw new Error('sugestoes ausentes')
        if (!result.assumptions) throw new Error('premissas ausentes')
      },
    },
  ]

  const results = []
  for (const check of checks) {
    try {
      const result = await invoke(check.name, check.body)
      check.validate(result)
      results.push({ endpoint: check.name, status: 'OK', detail: 'Resposta autenticada e valida' })
    } catch (error) {
      results.push({ endpoint: check.name, status: 'FALHOU', detail: error.message })
    }
  }

  console.table(results)
  const failures = results.filter((item) => item.status !== 'OK')
  if (failures.length) {
    throw new Error(`Smoke remoto falhou em ${failures.length} endpoint(s)`)
  }
  console.info(`Release 2 smoke remoto: 7/7 OK em ${referenceDate}`)
  return results
})()
