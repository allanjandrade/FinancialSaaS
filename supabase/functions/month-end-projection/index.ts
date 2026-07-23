import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { calculateMonthEndProjection } from '../_shared/financial-engine/calculations.ts'
import { handleFinancialEngineRequest } from '../_shared/financial-engine/http.ts'

serve((req) => req.method === 'OPTIONS'
  ? new Response('ok', { headers: corsHeaders })
  : handleFinancialEngineRequest(req, (state) => calculateMonthEndProjection(state), {
    errorMessage: 'Erro ao projetar fechamento do mes',
  }))
