const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.RELEASE9_SMOKE_EMAIL || process.env.RELEASE8_SMOKE_EMAIL
const password = process.env.RELEASE9_SMOKE_PASSWORD || process.env.RELEASE8_SMOKE_PASSWORD

if (!projectUrl || !anonKey) {
  console.error('BLOCKED: configure SUPABASE_URL e SUPABASE_ANON_KEY para o smoke autenticado.')
  process.exit(2)
}

if (!email || !password) {
  console.error('BLOCKED: configure RELEASE9_SMOKE_EMAIL e RELEASE9_SMOKE_PASSWORD para o smoke autenticado.')
  process.exit(2)
}

async function jsonResponse(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

async function invoke(name, accessToken, body = {}) {
  const response = await fetch(`${projectUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await jsonResponse(response)
  if (!response.ok) {
    throw new Error(`${name} ${response.status}: ${JSON.stringify(data)}`)
  }
  return data
}

const tokenResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const tokenBody = await jsonResponse(tokenResponse)
if (!tokenResponse.ok || !tokenBody?.access_token) {
  console.error(JSON.stringify({ step: 'auth', http_status: tokenResponse.status, error: tokenBody?.error || tokenBody?.message || tokenBody }, null, 2))
  process.exit(1)
}

try {
  const snapshot = await invoke('predictive-snapshot', tokenBody.access_token, { referenceDate: '2026-06-15' })
  const scenario = await invoke('scenario-simulation', tokenBody.access_token, { scenario: 'critical', referenceDate: '2026-06-15' })
  const report = await invoke('advisor-report', tokenBody.access_token, { referenceDate: '2026-06-15' })
  const forbidden = await fetch(`${projectUrl}/functions/v1/advisor-report`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${tokenBody.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: '00000000-0000-4000-8000-000000000000' }),
  })

  if (forbidden.status !== 403) throw new Error(`identity override expected 403, got ${forbidden.status}`)
  if (snapshot?.source !== 'deterministic') throw new Error('snapshot nao deterministico')
  if (scenario?.scenario !== 'critical') throw new Error('cenario critico ausente')
  if (report?.aiMayExplainOnly !== true) throw new Error('relatorio permite IA indevida')

  console.log(JSON.stringify({
    status: 'PASS',
    snapshot: snapshot.summary,
    scenario: scenario.risk,
    recommendations: report.recommendations?.length || 0,
    forged_user_id_status: forbidden.status,
  }, null, 2))
  console.log('Release 9 remote smoke: PASS')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
