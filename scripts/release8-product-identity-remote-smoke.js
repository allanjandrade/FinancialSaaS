import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { normalizeProductIdentity } from '../src/utils/productIdentity.js'

function loadDotEnv() {
  if (!fs.existsSync('.env')) return
  const content = fs.readFileSync('.env', 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

loadDotEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para rodar o smoke.')
}

const baseUrl = url.replace(/\/$/, '')
const admin = createClient(baseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(baseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readFinanceState() {
  const { data, error } = await admin
    .from('finance_states')
    .select('family_id,data,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  assert(data?.family_id && data?.data, 'Estado financeiro remoto nao encontrado.')
  return data
}

async function loadAuthEmail(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) return ''
  return data?.user?.email || ''
}

async function createTemporarySession(familyId) {
  const { data: members, error } = await admin
    .from('family_members')
    .select('user_id,email')
    .eq('family_id', familyId)
    .limit(10)
  if (error) throw error
  for (const member of members || []) {
    if (!member.user_id) continue
    const email = member.email || await loadAuthEmail(member.user_id)
    if (!email) continue
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw link.error
    const tokenHash = link.data?.properties?.hashed_token
    assert(tokenHash, 'Token temporario nao foi gerado.')
    const verified = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (verified.error) throw verified.error
    assert(verified.data.session?.access_token, 'Sessao temporaria nao foi criada.')
    return verified.data.session.access_token
  }
  throw new Error('Nenhum membro com email encontrado para gerar sessao temporaria.')
}

async function invokePriceSearch(token, body, expected = 200) {
  const response = await fetch(`${baseUrl}/functions/v1/price-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    throw new Error(`price-search retornou ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

const before = await readFinanceState()
const beforeData = JSON.stringify(before.data)
const token = await createTemporarySession(before.family_id)
const productIdentity = normalizeProductIdentity('lanterna tras ld punto')

await invokePriceSearch(null, { query: 'lanterna tras ld punto', product_identity: productIdentity }, 401)
const result = await invokePriceSearch(token, { query: 'lanterna tras ld punto', product_identity: productIdentity })

assert(result.product_identity?.match_policy === 'strict', 'Contrato remoto nao retornou identidade strict.')
assert('best_compatible_offer' in result, 'Contrato remoto nao retornou best_compatible_offer.')
assert(Array.isArray(result.accepted_candidates), 'Contrato remoto nao retornou accepted_candidates.')
assert(Array.isArray(result.rejected_candidates), 'Contrato remoto nao retornou rejected_candidates.')
assert(!('best_offer' in result), 'Contrato remoto nao pode retornar best_offer legado.')

const forbidden = /\b(siena|palio|hilux|universal)\b/i
for (const candidate of result.accepted_candidates) {
  assert(!forbidden.test(candidate.title || ''), `Candidato incompativel aceito: ${candidate.title}`)
  assert(Number(candidate.match_score || candidate.match?.score || 0) >= 0.85, `Candidato aceito sem score minimo: ${candidate.title}`)
  assert(candidate.compatibility_status === 'accepted', `Candidato aceito sem status accepted: ${candidate.title}`)
}
if (result.best_compatible_offer) {
  assert(!forbidden.test(result.best_compatible_offer.title || ''), `Melhor oferta incompativel: ${result.best_compatible_offer.title}`)
  assert(Number(result.best_compatible_offer.match_score || result.best_compatible_offer.match?.score || 0) >= 0.85, 'Melhor oferta sem score minimo.')
}
if (!result.best_compatible_offer) {
  assert(['not_found', 'found_ambiguous'].includes(result.status), `Status sem melhor oferta invalido: ${result.status}`)
}

const after = await readFinanceState()
assert(JSON.stringify(after.data) === beforeData, 'Smoke remoto deixou residuo em finance_states.')

console.info('Release 8.1 smoke remoto: PASS, preco compativel validado em fluxo real')
