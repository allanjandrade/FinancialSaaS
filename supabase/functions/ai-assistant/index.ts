import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { runChatAssistant } from '../_shared/chat.ts'
import { extractReceiptFromImage } from '../_shared/receipt.ts'
import {
  assertBase64Size,
  authErrorDetails,
  requireAuthenticatedUser,
} from '../_shared/auth.ts'

/**
 * @deprecated Use /functions/v1/chat ou /functions/v1/receipt-ocr
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const {
      message,
      image,
      imagemBase64,
      mimeType: bodyMimeType,
      acao,
    } = body

    let cleanBase64: string | null = null
    let targetMimeType = bodyMimeType || 'image/jpeg'

    if (image?.data) {
      cleanBase64 = image.data.includes(',') ? image.data.split(',')[1] : image.data
      targetMimeType = image.mimeType || targetMimeType
    } else if (imagemBase64) {
      cleanBase64 = imagemBase64.includes(',') ? imagemBase64.split(',')[1] : imagemBase64
    }

    if (cleanBase64) assertBase64Size(cleanBase64)

    const isReceiptFlow = acao === 'processar-comprovante'

    if (isReceiptFlow) {
      if (!cleanBase64) {
        return errorResponse('Imagem obrigatória para OCR', 400)
      }
      const extracted = await extractReceiptFromImage(cleanBase64, targetMimeType)
      return jsonResponse(extracted)
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return errorResponse('Campo "message" é obrigatório para chat', 400)
    }

    const responseText = await runChatAssistant(message, cleanBase64, targetMimeType)
    return jsonResponse({ response: responseText })
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    if (msg.startsWith('INVALID_JSON') || msg.startsWith('INVALID_SCHEMA')) {
      return errorResponse('Schema inválido na resposta da IA', 422, msg)
    }
    return errorResponse('Erro crítico', 500, msg)
  }
})
