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

async function invoke(name, token, body = {}) {
  const response = await fetch(`${projectUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

const current = await invoke('admin-current-user', token)
const forbidden = await invoke('admin-set-feature-override', token, { user_id: '00000000-0000-4000-8000-000000000000', feature_key: 'predictive_advisor', enabled: true })
const entitlements = await invoke('entitlements-resolve', token)
const testerStatus = await invoke('tester-status', token)

if (!current.response.ok) throw new Error(`admin-current-user ${current.response.status}`)
if (forbidden.response.status !== 403) throw new Error(`forged/unauthorized admin action expected 403 got ${forbidden.response.status}`)
if (!entitlements.response.ok) throw new Error(`entitlements ${entitlements.response.status}`)
if (!testerStatus.response.ok) throw new Error(`tester-status ${testerStatus.response.status}`)

console.log(JSON.stringify({
  status: 'PASS',
  admin_role: current.data?.role,
  unauthorized_admin_status: forbidden.response.status,
  entitlements_plan: entitlements.data?.plan_code,
  tester_active: testerStatus.data?.active || false,
}, null, 2))
console.log('Release 10 admin/testers remote smoke: PASS')
