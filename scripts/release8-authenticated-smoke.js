import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { normalizeProductIdentity } from '../src/utils/productIdentity.js'
import { chooseBestCompatibleOffer, scoreProductCandidate } from '../src/utils/productCandidateScoring.js'

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
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
const admin = createClient(baseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(baseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

async function selectExistingMember(familyId) {
  const { data, error } = await admin
    .from('family_members')
    .select('user_id,email')
    .eq('family_id', familyId)
    .limit(10)
  if (error) throw error
  for (const member of data || []) {
    if (!member.user_id) continue
    const email = member.email || await loadAuthEmail(member.user_id)
    if (email) return { userId: member.user_id, email }
  }
  throw new Error('Nenhum membro com email encontrado para gerar sessao temporaria.')
}

async function createTemporarySession(familyId) {
  const member = await selectExistingMember(familyId)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: member.email,
  })
  if (error) throw error
  const tokenHash = data?.properties?.hashed_token
  assert(tokenHash, 'Token temporario de magic link nao foi gerado.')
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (verifyError) throw verifyError
  assert(verified.session?.access_token, 'Sessao temporaria nao foi criada.')
  assert(verified.user?.id === member.userId, 'Sessao temporaria nao pertence ao membro selecionado.')
  return verified.session.access_token
}

async function invokeFunction(slug, body, token, expected = 200) {
  const response = await fetch(`${baseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    throw new Error(`${slug} retornou ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

function assertProductIdentityGate() {
  const identity = normalizeProductIdentity('lanterna tras ld punto')
  assert(JSON.stringify(identity.must_match_terms) === JSON.stringify(['lanterna', 'traseira', 'punto', 'direita']), 'Identidade canonica incorreta.')
  assert(identity.side_required === true, 'Lado direito precisa ser obrigatorio.')

  const candidates = [
    { title: 'Lanterna Traseira Direita Fiat Punto 2008 2009', total: 320 },
    { title: 'Lanterna Traseira Palio', total: 180 },
    { title: 'Lanterna Traseira Siena', total: 170 },
    { title: 'Lanterna Traseira Universal', total: 120 },
    { title: 'Lanterna Traseira Esquerda Fiat Punto', total: 250 },
  ]

  assert(scoreProductCandidate(candidates[0], identity).compatible === true, 'Item Fiat Punto direito deveria ser compativel.')
  for (const candidate of candidates.slice(1)) {
    assert(scoreProductCandidate(candidate, identity).compatible === false, `${candidate.title} nao pode passar na identidade.`)
  }
  const best = chooseBestCompatibleOffer(candidates, identity)
  assert(best.status === 'found_compatible', 'Melhor oferta compativel nao foi encontrada.')
  assert(best.best.total === 320, 'Preco menor incompativel venceu a identidade.')
}

const before = await readFinanceState()
const beforeData = JSON.stringify(before.data)
const token = await createTemporarySession(before.family_id)

await invokeFunction('automation-config', { action: 'list_templates' }, null, 401)
const templates = await invokeFunction('automation-config', { action: 'list_templates' }, token)
const templateIds = new Set((templates.templates || []).map((template) => template.id))
for (const templateId of ['wishlist_target_price_reached', 'goal_deadline_risk', 'budget_category_above_limit']) {
  assert(templateIds.has(templateId), `Template remoto ausente: ${templateId}`)
}

await invokeFunction('price-search', { query: '' }, null, 401)
const priceSearch = await invokeFunction('price-search', { query: '' }, token)
assert(priceSearch?.summary?.status === 'pending_quote', 'Price-search vazio deve responder sem cotacao e sem escrita.')

assertProductIdentityGate()

const after = await readFinanceState()
assert(JSON.stringify(after.data) === beforeData, 'Smoke remoto deixou residuo em finance_states.')

console.info('Release 8 smoke remoto: PASS, sem residuo financeiro')
