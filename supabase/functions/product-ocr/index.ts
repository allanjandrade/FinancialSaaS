import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { extractProductFromImage } from '../_shared/product.ts'
import {
  assertBase64Size,
  authErrorDetails,
  requireAuthenticatedUser,
} from '../_shared/auth.ts'
import { assertFeatureEnabled } from '../_shared/observability/flags.ts'
import { logSystemEvent, requestIds } from '../_shared/observability/logger.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo nao permitido', 405)
  }

  const ids = requestIds(req)
  let userId: string | null = null

  try {
    const { user } = await requireAuthenticatedUser(req)
    userId = user.id
    await assertFeatureEnabled(user.id, 'product_ocr_enabled')
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
      await logSystemEvent({
        ...ids,
        userId,
        source: 'edge_function',
        eventType: 'product_ocr_blocked',
        severity: 'warning',
        status: 'blocked',
        functionName: 'product-ocr',
        errorCode: 'IMAGE_REQUIRED',
      })
      return errorResponse('Imagem obrigatoria (image.data ou imagemBase64)', 400)
    }

    assertBase64Size(cleanBase64)
    const extracted = await extractProductFromImage(
      cleanBase64,
      targetMimeType,
      typeof extractedText === 'string' ? extractedText : '',
    )
    await logSystemEvent({
      ...ids,
      userId,
      source: 'edge_function',
      eventType: 'product_ocr_completed',
      functionName: 'product-ocr',
      metadata: { mime_type: targetMimeType },
    })
    return jsonResponse(extracted)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) {
      await logSystemEvent({
        ...ids,
        userId,
        source: 'edge_function',
        eventType: 'product_ocr_blocked',
        severity: 'warning',
        status: 'blocked',
        functionName: 'product-ocr',
        errorCode: authError.code,
        errorMessage: authError.message,
      })
      return errorResponse(authError.message, authError.status)
    }
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    const status = msg.startsWith('OCR_UNAVAILABLE') ? 503 : 500
    await logSystemEvent({
      ...ids,
      userId,
      source: 'edge_function',
      eventType: 'product_ocr_failed',
      severity: status >= 500 ? 'error' : 'warning',
      status: status >= 500 ? 'failed' : 'blocked',
      functionName: 'product-ocr',
      errorCode: (error as any)?.code,
      errorMessage: msg,
    })
    return errorResponse('Erro ao processar anuncio', status, msg)
  }
})
