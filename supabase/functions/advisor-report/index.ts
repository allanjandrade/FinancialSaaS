import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildAdvisorReport } from '../_shared/predictive-engine/index.ts'
import { handlePredictiveRequest } from '../_shared/predictive-engine/http.ts'

serve((req) => handlePredictiveRequest(
  req,
  'advisor-report',
  'advisor_report_requested',
  'advisor_report_generated',
  (state, body) => buildAdvisorReport(state, String(body.referenceDate || new Date().toISOString().slice(0, 10))),
  { featureKey: 'predictive_advisor' },
))
