import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { searchLiveMarketplaces } from '../_shared/marketplace-search.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'

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
    const { query, nome, marca, modelo, marketplace, marketplaceItemId, originalLink } = body
    const result = await searchLiveMarketplaces({
      query,
      nome,
      marca,
      modelo,
      marketplace,
      marketplaceItemId,
      originalLink,
    })

    if (!result.offers.length) {
      return jsonResponse({
        ...result,
        warning: 'Nenhuma oferta ao vivo encontrada. Verifique o nome do produto ou tente novamente.',
      })
    }

    return jsonResponse(result)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    return errorResponse('Erro ao buscar preços', 500, msg)
  }
})
