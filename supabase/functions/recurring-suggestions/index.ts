import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { calculateRecurringSuggestions } from '../_shared/financial-engine/calculations.ts'
import { handleFinancialEngineRequest } from '../_shared/financial-engine/http.ts'

serve((req) => req.method === 'OPTIONS'
  ? new Response('ok', { headers: corsHeaders })
  : handleFinancialEngineRequest(req, (state, body) => calculateRecurringSuggestions(state, Number(body.lookbackMonths || 6)), {
    requireDate: false,
    errorMessage: 'Erro ao detectar recorrencias',
  }))
