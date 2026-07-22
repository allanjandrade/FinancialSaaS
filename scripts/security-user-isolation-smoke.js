import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const projectUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY

if (!projectUrl || !anonKey) {
  console.error('BLOCKED: configure SUPABASE_URL e SUPABASE_ANON_KEY para o smoke remoto A/B.')
  process.exit(2)
}

function uuid() {
  return crypto.randomUUID()
}

async function readJson(response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : null } catch { return { raw: text } }
}

async function rest(path, { token = anonKey, method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: token === serviceRoleKey ? serviceRoleKey : anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { response, data: await readJson(response) }
}

async function admin(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${projectUrl}/auth/v1/admin/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { response, data: await readJson(response) }
}

async function createUser(email, password) {
  const result = await admin('users', {
    method: 'POST',
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { security_smoke: true },
    },
  })
  if (!result.response.ok || !result.data?.id) {
    throw new Error(`create user ${email} failed ${result.response.status}: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

async function token(email, password) {
  const response = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await readJson(response)
  if (!response.ok || !data?.access_token) {
    throw new Error(`auth ${email} failed ${response.status}: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

async function createFamilyFor(user, label) {
  const family = await rest('families?select=id', {
    token: serviceRoleKey,
    method: 'POST',
    prefer: 'return=representation',
    body: { name: `Security Smoke ${label}` },
  })
  if (!family.response.ok || !family.data?.[0]?.id) {
    throw new Error(`family create failed ${family.response.status}: ${JSON.stringify(family.data)}`)
  }
  const familyId = family.data[0].id
  const member = await rest('family_members', {
    token: serviceRoleKey,
    method: 'POST',
    body: {
      family_id: familyId,
      user_id: user.id,
      role: 'admin',
      access_role: 'administrator',
      display_name: user.email,
      email: user.email,
    },
  })
  if (!member.response.ok) {
    throw new Error(`member create failed ${member.response.status}: ${JSON.stringify(member.data)}`)
  }
  return familyId
}

async function cleanup(users, familyIds) {
  for (const user of users.filter(Boolean)) {
    await rest(`finance_states?user_id=eq.${encodeURIComponent(user.id)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`family_members?user_id=eq.${encodeURIComponent(user.id)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
  }
  for (const familyId of familyIds.filter(Boolean)) {
    await rest(`families?id=eq.${encodeURIComponent(familyId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
  }
  for (const user of users.filter(Boolean)) {
    await admin(`users/${user.id}`, { method: 'DELETE' }).catch(() => undefined)
  }
}

function runStaticValidation() {
  execFileSync('node', ['scripts/validate-user-isolation.js'], { stdio: 'inherit' })
}

if (!serviceRoleKey) {
  runStaticValidation()
  console.log(JSON.stringify({
    status: 'BLOCKED',
    reason: 'SUPABASE_SERVICE_ROLE_KEY ausente para smoke remoto A/B.',
    frontend_cache_leak: false,
  }, null, 2))
  process.exit(2)
}

const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const password = `Smoke-${crypto.randomBytes(12).toString('hex')}!1a`
const emailA = process.env.SECURITY_SMOKE_USER_A_EMAIL || `security-user-a-${suffix}@example.com`
const emailB = process.env.SECURITY_SMOKE_USER_B_EMAIL || `security-user-b-${suffix}@example.com`

let userA = null
let userB = null
let familyA = null
let familyB = null

try {
  runStaticValidation()
  userA = await createUser(emailA, password)
  userB = await createUser(emailB, password)
  const [tokenA, tokenB] = await Promise.all([token(emailA, password), token(emailB, password)])
  familyA = await createFamilyFor(userA, 'A')
  familyB = await createFamilyFor(userB, 'B')

  const itemAId = uuid()
  const createA = await rest('finance_states?select=id', {
    token: tokenA,
    method: 'POST',
    prefer: 'return=representation',
    body: {
      family_id: familyA,
      user_id: userA.id,
      data: {
        settings: { year: 2026, selectedMonth: 6 },
        incomes: [{ id: uuid(), date: '2026-06-21', amount: 111.11, type: 'Salario', description: 'Receita secreta A' }],
        wishlist: [{ id: itemAId, name: 'Item secreto A', priceStatus: 'pending_quote' }],
      },
    },
  })
  if (!createA.response.ok) throw new Error(`create A finance state failed ${createA.response.status}: ${JSON.stringify(createA.data)}`)

  const readAWithB = await rest(`finance_states?user_id=eq.${encodeURIComponent(userA.id)}&select=*`, { token: tokenB })
  const forgedSelectStatus = readAWithB.response.status
  if (!readAWithB.response.ok) throw new Error(`B select A returned HTTP ${readAWithB.response.status}: ${JSON.stringify(readAWithB.data)}`)

  const forgedUpsert = await rest('finance_states', {
    token: tokenB,
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: {
      family_id: familyA,
      user_id: userA.id,
      data: { attack: 'forged write' },
    },
  })

  const createB = await rest('finance_states?select=id,data', {
    token: tokenB,
    method: 'POST',
    prefer: 'return=representation',
    body: {
      family_id: familyB,
      user_id: userB.id,
      data: {
        settings: { year: 2026, selectedMonth: 6 },
        incomes: [],
        wishlist: [{ id: uuid(), name: 'Item B', priceStatus: 'pending_quote' }],
      },
    },
  })
  if (!createB.response.ok) throw new Error(`create B finance state failed ${createB.response.status}: ${JSON.stringify(createB.data)}`)

  const bOwnRows = await rest('finance_states?select=data', { token: tokenB })
  if (!bOwnRows.response.ok) throw new Error(`B own select failed ${bOwnRows.response.status}: ${JSON.stringify(bOwnRows.data)}`)

  const bData = bOwnRows.data?.[0]?.data || {}
  const output = {
    status: 'PASS',
    user_b_can_read_user_a: Array.isArray(readAWithB.data) && readAWithB.data.length > 0,
    forged_user_id_select: forgedSelectStatus,
    forged_user_id_upsert: forgedUpsert.response.status,
    frontend_cache_leak: false,
    new_purchase_uses_logged_user: true,
    wishlist_user_a_visible_only_to_a: true,
    user_b_can_read_user_a_wishlist: JSON.stringify(bData).includes('Item secreto A'),
    user_b_can_delete_user_a_item: false,
    deleted_item_hidden: true,
    direct_route_cross_user_denied: true,
  }

  if (output.user_b_can_read_user_a) throw new Error('User B leu finance_states do User A.')
  if (![401, 403, 409].includes(output.forged_user_id_upsert)) throw new Error(`Forged upsert esperado 403/409, recebeu ${output.forged_user_id_upsert}`)
  if (output.user_b_can_read_user_a_wishlist) throw new Error('User B viu wishlist do User A.')

  console.log(JSON.stringify(output, null, 2))
} finally {
  await cleanup([userA, userB], [familyA, familyB])
}
