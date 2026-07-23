import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildPredictiveSnapshot } from '../_shared/predictive-engine/index.ts'
import { handlePredictiveRequest } from '../_shared/predictive-engine/http.ts'

serve((req) => handlePredictiveRequest(
  req,
  'predictive-snapshot',
  'predictive_snapshot_requested',
  'predictive_snapshot_generated',
  (state, body) => buildPredictiveSnapshot(state, String(body.referenceDate || new Date().toISOString().slice(0, 10))),
))
