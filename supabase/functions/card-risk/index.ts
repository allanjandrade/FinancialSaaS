import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { calculateCardRisk } from '../_shared/financial-engine/calculations.ts'
import { handleFinancialEngineRequest } from '../_shared/financial-engine/http.ts'

serve((req) => req.method === 'OPTIONS'
  ? new Response('ok', { headers: corsHeaders })
  : handleFinancialEngineRequest(req, (state, body) => calculateCardRisk(state, body.cardId), {
    errorMessage: 'Erro ao avaliar risco do cartao',
  }))
