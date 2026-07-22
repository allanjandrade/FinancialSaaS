const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.RELEASE8_SMOKE_EMAIL
const password = process.env.RELEASE8_SMOKE_PASSWORD

if (!projectUrl || !anonKey) {
  console.error('BLOCKED: configure SUPABASE_URL e SUPABASE_ANON_KEY para o smoke autenticado final.')
  process.exit(2)
}

if (!email || !password) {
  console.error('BLOCKED: configure RELEASE8_SMOKE_EMAIL e RELEASE8_SMOKE_PASSWORD para o smoke autenticado final.')
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

const identity = {
  original_text: 'lanterna tras ld punto',
  normalized_text: 'lanterna traseira lado direito fiat punto',
  product_type: 'auto_part',
  part_name: 'lanterna traseira',
  side: 'right',
  vehicle_make: 'Fiat',
  vehicle_model: 'Punto',
  must_match_terms: ['lanterna', 'traseira', 'punto', 'direita'],
  negative_terms: ['palio', 'siena', 'hilux'],
  match_policy: 'strict',
  side_required: true,
}

const priceResponse = await fetch(`${projectUrl}/functions/v1/price-search`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${tokenBody.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'Lanterna traseira direita Fiat Punto 2008',
    productIdentity: identity,
    product_identity: identity,
  }),
})
const priceBody = await jsonResponse(priceResponse)
const summary = {
  http_status: priceResponse.status,
  status: priceBody?.status,
  provider: priceBody?.provider,
  cache_hit: priceBody?.cache?.hit,
  accepted: priceBody?.accepted?.length || priceBody?.accepted_candidates?.length || 0,
  ambiguous: priceBody?.ambiguous?.length || priceBody?.ambiguous_candidates?.length || 0,
  rejected: priceBody?.rejected?.length || priceBody?.rejected_candidates?.length || 0,
  has_best_compatible_offer: Boolean(priceBody?.best_compatible_offer),
  has_legacy_best_offer: Boolean(priceBody?.best_offer),
  error: priceBody?.error || null,
}

console.log(JSON.stringify(summary, null, 2))

if (!priceResponse.ok) process.exit(1)
if (priceBody?.error || priceBody?.status === 'provider_error') process.exit(1)
if (priceBody?.provider !== 'valueserp_google_shopping') process.exit(1)
if (priceBody?.best_offer) process.exit(1)

console.log('Release 8 final smoke remoto: PASS, P0 encerrados e pronto para Release 9')
