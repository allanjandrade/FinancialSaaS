import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (file) => {
  expect(fs.existsSync(file), `${file} should exist`).toBe(true)
  return fs.readFileSync(file, 'utf8')
}

describe('V3.4 assisted action drawer contract', () => {
  it('declares the drawer shell, confirmation flow, and route/confirm emissions', () => {
    const drawer = read('src/components/v3/AssistedActionDrawer.vue')

    expect(drawer).toContain('data-testid="v34-assisted-drawer"')
    expect(drawer).toContain('role="dialog"')
    expect(drawer).toContain('aria-modal="true"')
    expect(drawer).toContain('buildExecutionConfirmation')
    expect(drawer).toContain('activeStep')
    expect(drawer).toContain('confirmation')
    expect(drawer).toContain("emit('confirm'")
    expect(drawer).toContain("emit('route'")
    expect(drawer).toContain('@keydown.esc')
  })

  it('imports every assisted action panel through stable aliases', () => {
    const drawer = read('src/components/v3/AssistedActionDrawer.vue')

    expect(drawer).toContain("import IncomeActionForm from '@/components/v3/actions/IncomeActionForm.vue'")
    expect(drawer).toContain("import OcrReviewAction from '@/components/v3/actions/OcrReviewAction.vue'")
    expect(drawer).toContain("import SubscriptionActionPanel from '@/components/v3/actions/SubscriptionActionPanel.vue'")
    expect(drawer).toContain("import SubscriptionCutReview from '@/components/v3/actions/SubscriptionCutReview.vue'")
    expect(drawer).toContain("import GoalActionForm from '@/components/v3/actions/GoalActionForm.vue'")
  })

  it.each([
    ['src/components/v3/actions/IncomeActionForm.vue', 'v34-income-action-form'],
    ['src/components/v3/actions/OcrReviewAction.vue', 'v34-ocr-review-action'],
    ['src/components/v3/actions/SubscriptionActionPanel.vue', 'v34-subscription-action-panel'],
    ['src/components/v3/actions/SubscriptionCutReview.vue', 'v34-subscription-cut-review'],
    ['src/components/v3/actions/GoalActionForm.vue', 'v34-goal-action-form'],
  ])('%s exposes %s', (file, testId) => {
    expect(read(file)).toContain(`data-testid="${testId}"`)
  })
})
