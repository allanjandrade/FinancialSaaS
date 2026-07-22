import { getSupabaseClient } from '@/lib/supabase-client.js'

export class AutomationApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'AutomationApiError'
    this.code = code
    this.status = status
  }
}

async function invokeAutomationConfig(body) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  const session = data?.session
  const config = window.SUPABASE_CONFIG
  if (error || !session?.access_token) {
    throw new AutomationApiError('UNAUTHORIZED', 'Entre novamente para continuar.', 401)
  }

  const response = await fetch(`${config.url}/functions/v1/automation-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AutomationApiError(
      payload?.error?.code || 'AUTOMATION_UNAVAILABLE',
      payload?.error?.message || 'Não foi possível concluir a automação.',
      response.status,
    )
  }
  return payload
}

export const listAutomationTemplates = () => invokeAutomationConfig({ action: 'list_templates' })

export const listUserAutomations = (limit = 30) => invokeAutomationConfig({
  action: 'list_user_automations',
  limit,
})

export const createAutomation = ({ templateId, name, parameters, cadence, cooldownHours, timezone }) => invokeAutomationConfig({
  action: 'create_automation',
  template_id: templateId,
  name,
  parameters,
  cadence,
  cooldown_hours: cooldownHours,
  timezone,
})

export const pauseAutomation = (automationId) => invokeAutomationConfig({
  action: 'pause_automation',
  automation_id: automationId,
})

export const resumeAutomation = (automationId) => invokeAutomationConfig({
  action: 'resume_automation',
  automation_id: automationId,
})

export const deleteAutomation = (automationId) => invokeAutomationConfig({
  action: 'delete_automation',
  automation_id: automationId,
})

export const listAutomationNotifications = (limit = 30) => invokeAutomationConfig({
  action: 'list_notifications',
  limit,
})

export const markAutomationNotificationRead = (notificationId) => invokeAutomationConfig({
  action: 'mark_notification_read',
  notification_id: notificationId,
})
