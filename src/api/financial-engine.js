import { getSupabaseClient } from '@/lib/supabase-client.js'
import { friendlySupabaseError, invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'

async function invokeFinancialEngine(functionName, payload = {}) {
  const supabase = getSupabaseClient()
  const { data, error, skipped } = await invokeAuthenticatedFunction(functionName, { body: payload }, { supabase, timeoutMs: 7000, attempts: 2 })
  if (skipped) throw new Error('Faca login para consultar o motor financeiro.')
  if (error) throw new Error(friendlySupabaseError(error, `Falha ao executar ${functionName}`))
  if (!data?.result) throw new Error(`Resposta invalida de ${functionName}`)
  return data.result
}

export const getFinancialSnapshot = (referenceDate, familyId) =>
  invokeFinancialEngine('financial-snapshot', { referenceDate, familyId })

export const getBenefitBurnRate = (benefitType, referenceDate, familyId) =>
  invokeFinancialEngine('benefit-burn-rate', { benefitType, referenceDate, familyId })

export const getCardRisk = (referenceDate, { cardId, familyId } = {}) =>
  invokeFinancialEngine('card-risk', { referenceDate, cardId, familyId })

export const getMonthEndProjection = (referenceDate, familyId) =>
  invokeFinancialEngine('month-end-projection', { referenceDate, familyId })

export const getCategoryAnomalies = (referenceDate, { lookbackMonths = 3, familyId } = {}) =>
  invokeFinancialEngine('category-anomalies', { referenceDate, lookbackMonths, familyId })

export const simulatePurchase = (purchase, familyId) =>
  invokeFinancialEngine('purchase-simulation', { ...purchase, familyId })

export const getRecurringSuggestions = ({ lookbackMonths = 6, referenceDate, familyId } = {}) =>
  invokeFinancialEngine('recurring-suggestions', { lookbackMonths, referenceDate, familyId })
