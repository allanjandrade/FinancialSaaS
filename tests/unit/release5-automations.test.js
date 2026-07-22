import { describe, expect, it } from 'vitest'
import {
  validateAutomationActionPayload,
  validateTemplateParameters,
} from '../../supabase/functions/_shared/automations/schemas.js'
import {
  evaluateAutomationTemplate,
  evaluateBenefitDepletionRisk,
  evaluateCardBillRatioAbove,
  evaluateCategoryAnomalyDetected,
  evaluateCashBalanceBelow,
  evaluateWishlistTargetPriceReached,
} from '../../supabase/functions/_shared/automations/evaluators.js'
import {
  buildAutomationDedupeKey,
  buildNotificationPayload,
  isInCooldown,
  nextRunAt,
  normalizeRunResult,
} from '../../supabase/functions/_shared/automations/runner.js'
import { normalizeFinanceState } from '../../supabase/functions/_shared/financial-engine/normalize-state.js'
import { release2FinancialState } from '../fixtures/release2-financial-state.js'

const referenceDate = '2026-06-18'

describe('Release 5 automation safety', () => {
  it('accepts only approved templates and parameters', () => {
    expect(validateTemplateParameters('card_bill_ratio_above', { ratio: 0.35 })).toEqual({ ratio: 0.35 })
    expect(validateAutomationActionPayload({
      action: 'create_automation',
      template_id: 'card_bill_ratio_above',
      name: 'Fatura segura',
      parameters: { ratio: 0.35 },
      cadence: 'daily',
      cooldown_hours: 24,
      timezone: 'America/Sao_Paulo',
    })).toMatchObject({
      action: 'create_automation',
      templateId: 'card_bill_ratio_above',
      parameters: { ratio: 0.35 },
      cadence: 'daily',
    })
  })

  it('blocks identity override, free-form code and external channels', () => {
    expect(() => validateAutomationActionPayload({
      action: 'create_automation',
      template_id: 'cash_balance_below',
      name: 'Saldo',
      parameters: { threshold: 100 },
      user_id: 'forged',
    })).toThrow(/Campo perigoso/)
    expect(() => validateAutomationActionPayload({
      action: 'create_automation',
      template_id: 'cash_balance_below',
      name: 'Saldo',
      parameters: { threshold: 100, script: 'return true' },
    })).toThrow(/Campo perigoso/)
    expect(() => validateAutomationActionPayload({
      action: 'create_automation',
      template_id: 'cash_balance_below',
      name: 'Saldo',
      parameters: { threshold: 100, action: 'create_transaction' },
    })).toThrow(/Campo perigoso|Campo nao permitido/)
    expect(() => validateAutomationActionPayload({
      action: 'create_automation',
      template_id: 'cash_balance_below',
      name: 'Saldo',
      parameters: { threshold: 100, whatsapp: '+5511999999999' },
    })).toThrow(/Campo perigoso/)
  })

  it('validates management actions without accepting extra fields', () => {
    expect(validateAutomationActionPayload({ action: 'pause_automation', automation_id: 'auto-1' })).toEqual({
      action: 'pause_automation',
      automationId: 'auto-1',
    })
    expect(() => validateAutomationActionPayload({
      action: 'resume_automation',
      automation_id: 'auto-1',
      prompt: 'rode agora',
    })).toThrow(/Campo perigoso/)
  })

  it('evaluates templates without mutating financial state', () => {
    const financeData = release2FinancialState()
    const before = JSON.stringify(financeData)
    const normalized = normalizeFinanceState(financeData, referenceDate)

    expect(evaluateCashBalanceBelow(normalized, { threshold: 999999 }).triggered).toBe(true)
    expect(evaluateCardBillRatioAbove(normalized, { ratio: 0.2 }).triggered).toBe(true)

    const benefitState = release2FinancialState()
    benefitState.benefitWallets[0].balance = 100
    const benefitNormalized = normalizeFinanceState(benefitState, referenceDate)
    expect(evaluateBenefitDepletionRisk(benefitNormalized, { benefit_type: 'VA' }).triggered).toBe(true)

    expect(evaluateCategoryAnomalyDetected(normalized, { severity: 'attention' }).triggered).toBe(true)
    expect(evaluateAutomationTemplate('bill_due_soon', { days_before: 3 }, financeData, { referenceDate })).toMatchObject({
      status: 'skipped',
      code: 'BILLS_SOURCE_NOT_READY',
    })

    expect(JSON.stringify(financeData)).toBe(before)
  })

  it('handles wishlist price alerts only when the quoted item reaches target', () => {
    const financeData = {
      ...release2FinancialState(),
      wishlist: [
        { id: 'wish-1', name: 'Cadeira', currentPrice: 690, targetPrice: 700, status: 'quoted' },
        { id: 'wish-2', name: 'Mesa', targetPrice: 500, status: 'quote_pending' },
      ],
    }
    expect(evaluateWishlistTargetPriceReached(financeData, { purchase_item_id: 'wish-1' })).toMatchObject({
      status: 'success',
      triggered: true,
    })
    expect(evaluateWishlistTargetPriceReached(financeData, { purchase_item_id: 'wish-2' })).toMatchObject({
      status: 'skipped',
      code: 'QUOTE_PENDING',
    })
  })

  it('deduplicates by automation, template, window and signal', () => {
    const automation = { id: 'auto-1', template_id: 'card_bill_ratio_above', cadence: 'daily' }
    const evaluation = { signal: 'ratio:0.35:limit:0.2', details: { ratio: 0.35 } }
    const first = buildAutomationDedupeKey(automation, evaluation, new Date('2026-06-18T10:00:00Z'))
    const sameWindow = buildAutomationDedupeKey(automation, evaluation, new Date('2026-06-18T20:00:00Z'))
    const nextWindow = buildAutomationDedupeKey(automation, evaluation, new Date('2026-06-19T10:00:00Z'))
    expect(first).toBe(sameWindow)
    expect(first).not.toBe(nextWindow)
  })

  it('applies cooldown and creates only in-app notification payloads', () => {
    expect(isInCooldown('2026-06-18T10:00:00.000Z', 24, new Date('2026-06-18T12:00:00.000Z'))).toBe(true)
    expect(nextRunAt('hourly', new Date('2026-06-18T10:00:00.000Z'))).toBe('2026-06-18T11:00:00.000Z')

    const cooldownResult = normalizeRunResult({ status: 'success', triggered: true }, true)
    expect(cooldownResult).toMatchObject({
      status: 'skipped',
      triggered: false,
      resultPayload: { code: 'COOLDOWN_ACTIVE' },
    })

    const notification = buildNotificationPayload(
      { id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', template_id: 'cash_balance_below', name: 'Saldo baixo' },
      { severity: 'attention', title: 'Saldo baixo', message: 'Saldo em atencao.', details: { value: 10 } },
      '33333333-3333-4333-8333-333333333333',
    )
    expect(notification).toMatchObject({
      source: 'automation',
      source_id: '33333333-3333-4333-8333-333333333333',
      user_id: '22222222-2222-4222-8222-222222222222',
    })
    expect(Object.keys(notification)).not.toEqual(expect.arrayContaining(['email_to', 'phone_number', 'webhook_url']))
  })
})
