import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { simulateScenario } from '../_shared/predictive-engine/index.ts'
import { handlePredictiveRequest } from '../_shared/predictive-engine/http.ts'

serve((req) => handlePredictiveRequest(
  req,
  'scenario-simulation',
  'scenario_simulation_requested',
  'scenario_simulation_generated',
  (state, body) => simulateScenario(state, String(body.scenario || 'probable'), String(body.referenceDate || new Date().toISOString().slice(0, 10))),
  { featureKey: 'scenario_simulation' },
))
