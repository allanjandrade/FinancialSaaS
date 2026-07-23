import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const suffix = crypto.randomUUID()
const email = `release6-smoke-${suffix}@example.invalid`
const password = `Release6-${suffix}!`
const marker = `release6-smoke-${suffix}`
let smokeUserId = null
let accessToken = null
let overrideId = null
let limitsCreated = false

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function invokeFunction(slug, body, token = accessToken, expected = 200) {
  const response = await fetch(`${baseUrl}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    throw new Error(`${slug} retornou ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

async function createTemporaryUser() {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { smoke: marker },
  })
  if (created.error) throw created.error
  smokeUserId = created.data.user?.id
  assert(smokeUserId, 'Usuario temporario nao foi criado.')

  const signedIn = await anon.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  accessToken = signedIn.data.session?.access_token
  assert(accessToken, 'Sessao temporaria nao foi criada.')
}

async function insertSystemEvent(row) {
  const { error } = await admin.from('system_events').insert({
    user_id: smokeUserId,
    source: 'system',
    event_type: 'release6_smoke_event',
    severity: 'info',
    status: 'success',
    function_name: 'release6-authenticated-smoke',
    correlation_id: marker,
    metadata: { marker, ...row.metadata },
    ...row,
  })
  if (error) throw error
}

async function countEvents(query = {}) {
  let request = admin
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', smokeUserId)
    .eq('correlation_id', marker)
  for (const [key, value] of Object.entries(query)) {
    request = request.eq(key, value)
  }
  const { count, error } = await request
  if (error) throw error
  return count || 0
}

async function disableDiagnosticsForSmokeUser() {
  const { data, error } = await admin
    .from('user_flag_overrides')
    .insert({
      user_id: smokeUserId,
      flag_key: 'diagnostics_export_enabled',
      enabled: false,
    })
    .select('id')
    .single()
  if (error) throw error
  overrideId = data.id
}

async function removeDiagnosticsOverride() {
  if (!overrideId) return
  const { error } = await admin.from('user_flag_overrides').delete().eq('id', overrideId)
  if (error) throw error
  overrideId = null
}

async function setSmokeLimits(diagnosticsExportsDailyLimit) {
  const { error } = await admin
    .from('user_operation_limits')
    .upsert({
      user_id: smokeUserId,
      ai_actions_daily_limit: 10,
      automations_limit: 20,
      automation_runs_daily_limit: 50,
      diagnostics_exports_daily_limit: diagnosticsExportsDailyLimit,
    })
  if (error) throw error
  limitsCreated = true
}

async function waitForEvent(eventType, attempts = 10) {
  for (let index = 0; index < attempts; index += 1) {
    const { data, error } = await admin
      .from('system_events')
      .select('id,event_type,metadata')
      .eq('user_id', smokeUserId)
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    if (data?.length) return data[0]
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Evento ${eventType} nao foi registrado.`)
}

function assertNoSensitiveLeak(value, context) {
  const serialized = JSON.stringify(value).toLowerCase()
  const forbidden = [
    serviceRoleKey.toLowerCase(),
    accessToken.toLowerCase(),
    'access_token',
    'refresh_token',
    'authorization',
    'service_role',
    'raw_prompt',
    'full_finance_state',
    'transactions":[',
    '"transactions":',
    'password',
    'secret',
  ]
  const leaked = forbidden.find((needle) => serialized.includes(needle))
  assert(!leaked, `${context} vazou dado sensivel: ${leaked}`)
}

async function cleanup() {
  await removeDiagnosticsOverride().catch(() => {})
  if (smokeUserId) {
    if (limitsCreated) {
      await admin.from('user_operation_limits').delete().eq('user_id', smokeUserId)
    }
    await admin.from('system_events').delete().eq('user_id', smokeUserId)
    await admin.auth.admin.deleteUser(smokeUserId)
  }
}

try {
  await createTemporaryUser()

  await invokeFunction('operational-insights', { action: 'summary' }, null, 401)
  await invokeFunction('operational-insights', { action: 'summary', user_id: crypto.randomUUID() }, accessToken, 403)

  await insertSystemEvent({
    event_type: 'release6_smoke_visible',
    metadata: {
      marker,
      visible: true,
      access_token: 'must-not-return',
      raw_prompt: 'must-not-return',
      full_finance_state: { forbidden: true },
    },
  })
  await insertSystemEvent({
    source: 'ai_action',
    event_type: 'release6_smoke_ai_action',
    metadata: { marker, action_type: 'none' },
  })
  await insertSystemEvent({
    source: 'automation',
    event_type: 'release6_smoke_automation',
    metadata: { marker, template_id: 'none' },
  })

  const summary = await invokeFunction('operational-insights', { action: 'summary', period_days: 1 })
  assert(summary.summary?.totals?.events >= 3, 'Resumo operacional nao encontrou eventos do usuario.')
  assert((summary.summary?.feature_flags || []).some((flag) => flag.key === 'operational_panel_enabled' && flag.enabled), 'Flag do painel operacional nao esta ativa.')
  assertNoSensitiveLeak(summary, 'Resumo operacional')

  const recent = await invokeFunction('operational-insights', { action: 'recent_events', period_days: 1, limit: 20 })
  const visible = (recent.events || []).find((event) => event.event_type === 'release6_smoke_visible')
  assert(visible, 'Lista operacional nao retornou o evento do smoke.')
  assertNoSensitiveLeak(recent, 'Lista operacional')

  await invokeFunction('operational-insights', { action: 'ai_actions_audit', period_days: 1, limit: 20 })
  await invokeFunction('operational-insights', { action: 'automations_audit', period_days: 1, limit: 20 })

  await disableDiagnosticsForSmokeUser()
  const blockedByFlag = await invokeFunction('operational-insights', { action: 'export_diagnostics', period_days: 1 }, accessToken, 403)
  assert(blockedByFlag.error?.code === 'FEATURE_DISABLED', 'Feature flag nao bloqueou o diagnostico.')
  await removeDiagnosticsOverride()

  await setSmokeLimits(1)
  const diagnostic = await invokeFunction('operational-insights', { action: 'export_diagnostics', period_days: 1, limit: 20 })
  assert(diagnostic.diagnostics?.environment?.release === '6', 'Diagnostico nao identifica a Release 6.')
  assert(diagnostic.diagnostics?.financial_validation_summary?.transactions_included === false, 'Diagnostico incluiu transacoes.')
  assert(diagnostic.diagnostics?.financial_validation_summary?.complete_state_included === false, 'Diagnostico incluiu estado financeiro completo.')
  assertNoSensitiveLeak(diagnostic, 'Diagnostico exportado')
  await waitForEvent('diagnostics_exported')

  const blockedByLimit = await invokeFunction('operational-insights', { action: 'export_diagnostics', period_days: 1 }, accessToken, 429)
  assert(blockedByLimit.error?.code === 'OPERATION_LIMIT_EXCEEDED', 'Limite operacional nao bloqueou exportacao duplicada.')

  await invokeFunction('product-ocr', { imageBase64: '', mimeType: 'image/png' }, accessToken, 400)
  const ocrEvent = await waitForEvent('product_ocr_blocked')
  assertNoSensitiveLeak(ocrEvent, 'Evento instrumentado')

  const health = await invokeFunction('health-check', {})
  assert(health.release === '6', 'Health-check nao esta na Release 6.')
  assert(health.status === 'ok', `Health-check nao retornou ok: ${JSON.stringify(health.checks)}`)
  assertNoSensitiveLeak(health, 'Health-check')

  assert(await countEvents({ event_type: 'release6_smoke_visible' }) === 1, 'Evento proprio do smoke ficou inconsistente.')

  console.table({
    authenticatedProtection: 'OK',
    identityOverrideBlockedBeforeWrite: 'OK',
    userScopedEvents: 'OK',
    sanitizedMetadata: 'OK',
    featureFlagBlocksModule: 'OK',
    operationLimitBlocksDuplicateExport: 'OK',
    diagnosticsExportSafe: 'OK',
    functionInstrumentation: 'OK',
    healthCheck: 'OK',
    financialResidue: 'NONE',
  })
  console.info('Release 6 smoke remoto: PASS, observabilidade ativa e sem vazamento sensível')
} finally {
  await cleanup()
}
