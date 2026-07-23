import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const projectUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY

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
    body: { email, password, email_confirm: true, user_metadata: { family_sharing_smoke: true } },
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
  const data = await readJson(response)
  return { response, data }
}

async function mustInvoke(name, accessToken, body = {}) {
  const result = await invoke(name, accessToken, body)
  if (!result.response.ok) {
    throw new Error(`${name} failed ${result.response.status}: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

async function createLegacyPrivateFinanceState(user, accessToken) {
  const family = await rest('families?select=id', {
    token: serviceRoleKey,
    method: 'POST',
    prefer: 'return=representation',
    body: { name: `Family Sharing Private ${Date.now()}` },
  })
  if (!family.response.ok || !family.data?.[0]?.id) {
    throw new Error(`legacy family failed ${family.response.status}: ${JSON.stringify(family.data)}`)
  }
  const familyId = family.data[0].id
  const state = await rest('finance_states?select=id,user_id,data', {
    token: accessToken,
    method: 'POST',
    prefer: 'return=representation',
    body: {
      family_id: familyId,
      user_id: user.id,
      data: {
        settings: { year: 2026, selectedMonth: 6 },
        expenses: [{ id: crypto.randomUUID(), date: '2026-06-27', amount: 123.45, category: 'Privado', description: 'Private Release 11.3 Smoke' }],
        incomes: [],
        wishlist: [],
      },
    },
  })
  if (!state.response.ok) {
    throw new Error(`private finance state failed ${state.response.status}: ${JSON.stringify(state.data)}`)
  }
  return familyId
}

async function cleanup({ userA, userB, familyGroupId, legacyFamilyId }) {
  if (familyGroupId) {
    await rest(`shared_entry_participants?shared_entry_id=in.(select id from shared_entries where family_group_id='${familyGroupId}')`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`shared_entries?family_group_id=eq.${encodeURIComponent(familyGroupId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`family_invites?family_group_id=eq.${encodeURIComponent(familyGroupId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`family_memberships?family_group_id=eq.${encodeURIComponent(familyGroupId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`family_groups?id=eq.${encodeURIComponent(familyGroupId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
  }
  for (const user of [userA, userB].filter(Boolean)) {
    await rest(`finance_states?user_id=eq.${encodeURIComponent(user.id)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
    await rest(`family_members?user_id=eq.${encodeURIComponent(user.id)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
  }
  if (legacyFamilyId) {
    await rest(`families?id=eq.${encodeURIComponent(legacyFamilyId)}`, { token: serviceRoleKey, method: 'DELETE' }).catch(() => undefined)
  }
  for (const user of [userA, userB].filter(Boolean)) {
    await admin(`users/${user.id}`, { method: 'DELETE' }).catch(() => undefined)
  }
}

function runStaticValidation() {
  execFileSync('node', ['scripts/validate-family-sharing.js'], { stdio: 'inherit' })
  execFileSync('node', ['scripts/validate-family-rls.js'], { stdio: 'inherit' })
  execFileSync('node', ['scripts/validate-shared-entries.js'], { stdio: 'inherit' })
}

if (!projectUrl || !anonKey || !serviceRoleKey) {
  runStaticValidation()
  console.log(JSON.stringify({
    status: 'BLOCKED',
    reason: 'SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sao obrigatorias para smoke remoto.',
  }, null, 2))
  process.exit(2)
}

const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const password = `Family-${crypto.randomBytes(10).toString('hex')}!1a`
const emailA = `family-a-${suffix}@example.com`
const emailB = `family-b-${suffix}@example.com`

let userA = null
let userB = null
let familyGroupId = null
let legacyFamilyId = null

try {
  runStaticValidation()
  userA = await createUser(emailA, password)
  userB = await createUser(emailB, password)
  const [tokenA, tokenB] = await Promise.all([token(emailA, password), token(emailB, password)])

  const created = await mustInvoke('family-create-group', tokenA, { name: `Release 11.3 Smoke ${suffix}` })
  familyGroupId = created.family?.id
  const invited = await mustInvoke('family-send-invite', tokenA, {
    family_group_id: familyGroupId,
    email: emailB,
    role: 'member',
    message: 'Smoke Release 11.3',
  })
  const accepted = await mustInvoke('family-accept-invite', tokenB, { token: invited.token })
  const entryResult = await mustInvoke('shared-entry-create', tokenA, {
    family_group_id: familyGroupId,
    description: 'Mercado Release 11.3 Smoke',
    amount: 400,
    category: 'Mercado',
    entry_date: '2026-06-27',
    paid_by_user_id: userA.id,
    participant_user_ids: [userA.id, userB.id],
    split_method: 'equal',
  })
  const entryId = entryResult.entry?.id

  const [listA, listB] = await Promise.all([
    mustInvoke('shared-entry-list', tokenA, { family_group_id: familyGroupId }),
    mustInvoke('shared-entry-list', tokenB, { family_group_id: familyGroupId }),
  ])
  legacyFamilyId = await createLegacyPrivateFinanceState(userA, tokenA)
  const privateReadByB = await rest(`finance_states?user_id=eq.${encodeURIComponent(userA.id)}&select=id,data`, { token: tokenB })
  if (!privateReadByB.response.ok) {
    throw new Error(`private read by B failed ${privateReadByB.response.status}: ${JSON.stringify(privateReadByB.data)}`)
  }

  await mustInvoke('family-remove-member', tokenA, { family_group_id: familyGroupId, member_user_id: userB.id })
  const removedRead = await invoke('shared-entry-list', tokenB, { family_group_id: familyGroupId })

  const aEntry = (listA.entries || []).find((entry) => entry.id === entryId)
  const bEntry = (listB.entries || []).find((entry) => entry.id === entryId)
  const output = {
    status: 'PASS',
    family_created: Boolean(familyGroupId),
    invite_sent: Boolean(invited.invite?.id && invited.token),
    invite_accepted: Boolean(accepted.membership?.id),
    shared_entry_visible_to_member_a: Boolean(aEntry),
    shared_entry_visible_to_member_b: Boolean(bEntry),
    member_a_individual_amount: aEntry?.my_amount,
    member_b_individual_amount: bEntry?.my_amount,
    family_total_amount: aEntry?.family_total,
    private_entry_visible_to_member_b: Array.isArray(privateReadByB.data) && privateReadByB.data.length > 0,
    removed_member_can_read_shared_entries: removedRead.response.ok,
  }

  if (!output.family_created) throw new Error('Familia compartilhada nao foi criada.')
  if (!output.invite_sent) throw new Error('Convite nao foi gerado.')
  if (!output.invite_accepted) throw new Error('Convite nao foi aceito.')
  if (!output.shared_entry_visible_to_member_a || !output.shared_entry_visible_to_member_b) throw new Error('Lancamento compartilhado nao ficou visivel aos membros.')
  if (output.member_a_individual_amount !== 200 || output.member_b_individual_amount !== 200 || output.family_total_amount !== 400) throw new Error('Rateio compartilhado incorreto.')
  if (output.private_entry_visible_to_member_b) throw new Error('Membro B viu estado financeiro privado do membro A.')
  if (output.removed_member_can_read_shared_entries) throw new Error('Membro removido ainda le lancamentos compartilhados.')

  console.log(JSON.stringify(output, null, 2))
} finally {
  await cleanup({ userA, userB, familyGroupId, legacyFamilyId })
}
