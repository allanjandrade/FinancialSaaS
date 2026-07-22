import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para rodar o smoke.')
}

const baseUrl = url.replace(/\/$/, '')
const admin = createClient(baseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(baseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const suffix = crypto.randomUUID()
const createdAutomationIds = []
const createdRunIds = []
const createdNotificationIds = []
let familyId = null
let smokeUserId = null

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function invokeConfig(token, body, expected = 200) {
  const response = await fetch(`${baseUrl}/functions/v1/automation-config`, {
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
    throw new Error(`automation-config retornou ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

async function invokeRunner(body, bearer, expected = 200) {
  const response = await fetch(`${baseUrl}/functions/v1/run-automations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    throw new Error(`run-automations retornou ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
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

async function countUserAutomations(userId) {
  const { count, error } = await admin
    .from('user_automations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count || 0
}

async function selectExistingMember(targetFamilyId) {
  const { data: members, error } = await admin
    .from('family_members')
    .select('user_id,email')
    .eq('family_id', targetFamilyId)
    .limit(10)
  if (error) throw error
  for (const member of members || []) {
    if (!member.user_id) continue
    const email = member.email || await loadAuthEmail(member.user_id)
    if (email) {
      smokeUserId = member.user_id
      return { user_id: member.user_id, email }
    }
  }
  throw new Error('Nenhum membro com email encontrado para gerar sessao temporaria.')
}

async function loadAuthEmail(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) return ''
  return data?.user?.email || ''
}

async function createTemporarySession(targetFamilyId) {
  const member = await selectExistingMember(targetFamilyId)
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
  assert(verified.user?.id === member.user_id, 'Sessao temporaria nao pertence ao membro selecionado.')
  return verified.session.access_token
}

async function createAutomation(token, name, cooldownHours = 24) {
  const result = await invokeConfig(token, {
    action: 'create_automation',
    template_id: 'cash_balance_below',
    name,
    parameters: { threshold: 999999999 },
    cadence: 'daily',
    cooldown_hours: cooldownHours,
    timezone: 'America/Sao_Paulo',
  }, 201)
  assert(result.automation?.id, 'Automacao nao retornou id.')
  createdAutomationIds.push(result.automation.id)
  return result.automation
}

async function forceDue(automationId, patch = {}) {
  const { error } = await admin
    .from('user_automations')
    .update({ next_run_at: new Date(Date.now() - 60_000).toISOString(), ...patch })
    .eq('id', automationId)
  if (error) throw error
}

async function getRuns(automationId) {
  const { data, error } = await admin
    .from('automation_runs')
    .select('id,automation_id,status,triggered,dedupe_key,result_payload,error_code,error_message,started_at')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
  if (error) throw error
  for (const run of data || []) createdRunIds.push(run.id)
  return data || []
}

async function getNotificationsForRuns(runIds) {
  if (!runIds.length) return []
  const { data, error } = await admin
    .from('in_app_notifications')
    .select('id,source,source_id,title,message,read_at,payload')
    .in('source_id', runIds)
  if (error) throw error
  for (const notification of data || []) createdNotificationIds.push(notification.id)
  return data || []
}

async function cleanup() {
  if (createdRunIds.length) {
    await admin.from('in_app_notifications').delete().in('source_id', [...new Set(createdRunIds)])
  }
  if (createdNotificationIds.length) {
    await admin.from('in_app_notifications').delete().in('id', [...new Set(createdNotificationIds)])
  }
  if (createdAutomationIds.length) {
    await admin.from('user_automations').delete().in('id', [...new Set(createdAutomationIds)])
  }
}

try {
  const before = await readFinanceState()
  familyId = before.family_id
  const beforeData = JSON.stringify(before.data)
  const token = await createTemporarySession(familyId)

  await invokeConfig(null, { action: 'list_templates' }, 401)
  const initialAutomationCount = await countUserAutomations(smokeUserId)
  await invokeConfig(token, {
    action: 'create_automation',
    template_id: 'cash_balance_below',
    name: 'Smoke Release 5 forged',
    parameters: { threshold: 1 },
    user_id: smokeUserId,
  }, 403)
  await invokeConfig(token, {
    action: 'create_automation',
    template_id: 'cash_balance_below',
    name: 'Smoke Release 5 blocked script',
    parameters: { threshold: 1, script: 'return true' },
  }, 403)
  assert(await countUserAutomations(smokeUserId) === initialAutomationCount, 'Rejeicoes criaram automacao indevida.')

  const templates = await invokeConfig(token, { action: 'list_templates' })
  assert((templates.templates || []).some((template) => template.id === 'cash_balance_below'), 'Template permitido nao apareceu.')

  const automation = await createAutomation(token, `Smoke Release 5 primary ${suffix}`)
  await invokeConfig(token, { action: 'pause_automation', automation_id: automation.id })
  await invokeConfig(token, { action: 'resume_automation', automation_id: automation.id })

  await invokeRunner({ limit: 1 }, null, 401)
  await invokeRunner({ limit: 1 }, anonKey, 403)

  const firstRun = await invokeRunner({ limit: 5, reference_date: '2026-06-18' }, serviceRoleKey)
  const firstProcessed = firstRun.processed.find((item) => item.automation_id === automation.id)
  assert(firstProcessed?.status === 'success', 'Primeira execucao nao foi sucesso.')
  assert(firstProcessed.triggered === true, 'Primeira execucao nao disparou alerta.')
  assert(firstProcessed.notification_created === true, 'Primeira execucao nao criou notificacao in-app.')

  const firstRuns = await getRuns(automation.id)
  const successRun = firstRuns.find((run) => run.status === 'success' && run.triggered)
  assert(successRun?.id, 'Log de sucesso nao encontrado.')
  const firstNotifications = await getNotificationsForRuns([successRun.id])
  assert(firstNotifications.length === 1, 'Notificacao in-app do primeiro run nao foi criada exatamente uma vez.')
  await invokeConfig(token, { action: 'mark_notification_read', notification_id: firstNotifications[0].id })

  await forceDue(automation.id)
  const duplicateRun = await invokeRunner({ limit: 5, reference_date: '2026-06-18' }, serviceRoleKey)
  const duplicateProcessed = duplicateRun.processed.find((item) => item.automation_id === automation.id)
  assert(duplicateProcessed?.status === 'skipped', 'Execucao duplicada nao foi ignorada.')
  assert(duplicateProcessed.code === 'DUPLICATE_DEDUPE_KEY', 'Dedupe nao retornou o codigo esperado.')
  const afterDuplicateNotifications = await getNotificationsForRuns([successRun.id])
  assert(afterDuplicateNotifications.length === 1, 'Dedupe criou notificacao duplicada.')

  const cooldownAutomation = await createAutomation(token, `Smoke Release 5 cooldown ${suffix}`, 24)
  await forceDue(cooldownAutomation.id, { last_triggered_at: new Date().toISOString() })
  const cooldownRun = await invokeRunner({ limit: 5, reference_date: '2026-06-18' }, serviceRoleKey)
  const cooldownProcessed = cooldownRun.processed.find((item) => item.automation_id === cooldownAutomation.id)
  assert(cooldownProcessed?.status === 'skipped', 'Cooldown nao ignorou a execucao.')
  assert(cooldownProcessed.code === 'COOLDOWN_ACTIVE', 'Cooldown nao retornou o codigo esperado.')
  assert(cooldownProcessed.notification_created === false, 'Cooldown criou notificacao indevida.')

  const listed = await invokeConfig(token, { action: 'list_user_automations', limit: 20 })
  assert((listed.runs || []).some((run) => run.automation_id === automation.id), 'Logs nao apareceram para usuario autenticado.')
  const notifications = await invokeConfig(token, { action: 'list_notifications', limit: 20 })
  assert((notifications.notifications || []).some((item) => item.source === 'automation'), 'Notificacoes in-app nao apareceram para usuario autenticado.')

  const after = await readFinanceState()
  assert(JSON.stringify(after.data) === beforeData, 'Automacoes alteraram finance_states.')

  console.table({
    templateAllowed: 'OK',
    identityOverrideBlockedBeforeWrite: 'OK',
    dangerousPayloadBlockedBeforeWrite: 'OK',
    serviceRunnerProtected: 'OK',
    lockClaimedDueAutomation: 'OK',
    dedupeNoDuplicateAlert: 'OK',
    cooldownNoDuplicateAlert: 'OK',
    logsVisible: 'OK',
    inAppNotificationOnly: 'OK',
    financialResidue: 'NONE',
  })
  console.info('Release 5 smoke remoto: PASS, sem residuo financeiro')
} finally {
  await cleanup()
}
