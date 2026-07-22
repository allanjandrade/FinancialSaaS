const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.RELEASE10_SMOKE_EMAIL || process.env.RELEASE9_SMOKE_EMAIL || process.env.RELEASE8_SMOKE_EMAIL
const password = process.env.RELEASE10_SMOKE_PASSWORD || process.env.RELEASE9_SMOKE_PASSWORD || process.env.RELEASE8_SMOKE_PASSWORD

if (!projectUrl || !anonKey) {
  console.error('BLOCKED: configure SUPABASE_URL e SUPABASE_ANON_KEY.')
  process.exit(2)
}

if (!email || !password) {
  console.error('BLOCKED: configure RELEASE10_SMOKE_EMAIL e RELEASE10_SMOKE_PASSWORD.')
  process.exit(2)
}

async function json(response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : null } catch { return { raw: text } }
}

async function invoke(name, token, body = {}, auth = true) {
  const response = await fetch(`${projectUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { response, data: await json(response) }
}

const authResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const authBody = await json(authResponse)
if (!authResponse.ok || !authBody?.access_token) {
  console.error(JSON.stringify({ step: 'auth', status: authResponse.status, body: authBody }, null, 2))
  process.exit(1)
}

const token = authBody.access_token
const status = await invoke('billing-subscription-status', token)
const forged = await invoke('billing-subscription-status', token, { user_id: '00000000-0000-4000-8000-000000000000' })
const noJwt = await invoke('billing-create-checkout', token, { plan_code: 'premium_monthly' }, false)
const badWebhook = await fetch(`${projectUrl}/functions/v1/billing-webhook`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: '{}' })
const entitlements = await invoke('entitlements-resolve', token)
const checkout = await invoke('billing-create-checkout', token, { plan_code: 'premium_monthly' })

if (!status.response.ok) throw new Error(`subscription-status ${status.response.status}`)
if (forged.response.status !== 403) throw new Error(`forged user_id expected 403 got ${forged.response.status}`)
if (noJwt.response.status !== 401) throw new Error(`checkout sem JWT expected 401 got ${noJwt.response.status}`)
if (![401, 403].includes(badWebhook.status)) throw new Error(`webhook invalido expected 401/403 got ${badWebhook.status}`)
if (!entitlements.response.ok) throw new Error(`entitlements ${entitlements.response.status}`)
if (!checkout.response.ok || checkout.data?.financial_payload_sent !== false) throw new Error('checkout inseguro')

console.log(JSON.stringify({
  status: 'PASS',
  subscription: status.data?.subscription?.status,
  forged_user_id_status: forged.response.status,
  checkout_without_jwt_status: noJwt.response.status,
  invalid_webhook_status: badWebhook.status,
  financial_payload_sent: checkout.data?.financial_payload_sent,
}, null, 2))
console.log('Release 10 remote smoke: PASS')
