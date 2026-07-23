import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { runChatAssistant, runFinancialAnalyst } from '../_shared/chat.ts'
import {
  assertBase64Size,
  authErrorDetails,
  requireAuthenticatedUser,
} from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Método não permitido', 405)
  }

  try {
    await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const { message, image, imagemBase64, mimeType: bodyMimeType, mode, facts, memory } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return errorResponse('Campo "message" é obrigatório', 400)
    }

    let cleanBase64: string | null = null
    let targetMimeType = bodyMimeType || 'image/jpeg'

    if (image?.data) {
      cleanBase64 = image.data.includes(',') ? image.data.split(',')[1] : image.data
      targetMimeType = image.mimeType || targetMimeType
    } else if (imagemBase64) {
      cleanBase64 = imagemBase64.includes(',') ? imagemBase64.split(',')[1] : imagemBase64
    }

    if (cleanBase64) assertBase64Size(cleanBase64)
    const responseText = mode === 'financial-analysis'
      ? await runFinancialAnalyst(
        message,
        facts && typeof facts === 'object' && !Array.isArray(facts) ? facts : {},
        Array.isArray(memory) ? memory : [],
      )
      : await runChatAssistant(message, cleanBase64, targetMimeType)
    return jsonResponse({ response: responseText })
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    const status = msg.startsWith('CHAT_UNAVAILABLE') ? 503 : 500
    return errorResponse('Erro no assistente de chat', status, msg)
  }
})
