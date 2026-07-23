import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { extractReceiptFromImage } from '../_shared/receipt.ts'
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
    const { image, imagemBase64, mimeType: bodyMimeType, extractedText } = body

    let cleanBase64: string | null = null
    let targetMimeType = bodyMimeType || 'image/jpeg'

    if (image?.data) {
      cleanBase64 = image.data.includes(',') ? image.data.split(',')[1] : image.data
      targetMimeType = image.mimeType || targetMimeType
    } else if (imagemBase64) {
      cleanBase64 = imagemBase64.includes(',') ? imagemBase64.split(',')[1] : imagemBase64
    }

    if (!cleanBase64) {
      return errorResponse('Imagem obrigatória (image.data ou imagemBase64)', 400)
    }

    assertBase64Size(cleanBase64)
    const extracted = await extractReceiptFromImage(
      cleanBase64,
      targetMimeType,
      typeof extractedText === 'string' ? extractedText : '',
    )
    return jsonResponse(extracted)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    if (msg.startsWith('INVALID_JSON') || msg.startsWith('INVALID_SCHEMA')) {
      return errorResponse('Schema inválido na resposta da IA', 422, msg)
    }
    const status = msg.startsWith('OCR_UNAVAILABLE') ? 503 : 500
    return errorResponse('Erro ao processar comprovante', status, msg)
  }
})
