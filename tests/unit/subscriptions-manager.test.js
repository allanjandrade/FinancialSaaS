import fs from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from '@/router/index.js'
import { NAV_GROUPS, metaForPath } from '@/router/navigation.js'
import { useFinanceStore } from '@/stores/finance.js'
import {
  answerSubscriptionQuestion,
  buildSubscriptionMonthImpact,
  buildSubscriptionSummary,
  cancelSubscription,
  pauseSubscription,
  reconcileSubscriptionCharge,
  sanitizeSubscription,
  suggestSubscriptionFromExpense,
} from '@/utils/subscriptions.js'

vi.mock('@/stores/family-sync.js', () => ({
  useFamilySyncStore: () => ({ applyingRemote: false, schedulePush: vi.fn() }),
}))

const referenceDate = '2026-07-09'

function monthly(overrides = {}) {
  return sanitizeSubscription({
    id: 'sub-netflix',
    user_id: 'user-1',
    name: 'Netflix',
    provider: 'Netflix',
    category: 'Streaming',
    amount: 39.9,
    billing_cycle: 'monthly',
    next_billing_date: '2026-07-11',
    started_at: '2026-01-01',
    status: 'active',
    payment_method_type: 'card',
    card_id: 'card-1',
    reminder_days: 3,
    is_essential: false,
    ...overrides,
  })
}

function annual(overrides = {}) {
  return sanitizeSubscription({
    id: 'sub-prime',
    user_id: 'user-1',
    name: 'Amazon Prime',
    provider: 'Amazon',
    category: 'Streaming',
    amount: 99.9,
    billing_cycle: 'annual',
    next_billing_date: '2026-08-01',
    started_at: '2026-02-01',
    status: 'active',
    payment_method_type: 'account',
    account_id: 'acc-1',
    is_essential: true,
    ...overrides,
  })
}

describe('subscription manager domain', () => {
  it('normalizes monthly and annual subscription registrations', () => {
    expect(monthly()).toMatchObject({
      id: 'sub-netflix',
      name: 'Netflix',
      provider: 'Netflix',
      category: 'Streaming',
      amount: 39.9,
      billing_cycle: 'monthly',
      billing_interval: 1,
      next_billing_date: '2026-07-11',
      payment_method_type: 'card',
      card_id: 'card-1',
      status: 'active',
      deleted_at: null,
    })

    expect(annual()).toMatchObject({
      billing_cycle: 'annual',
      amount: 99.9,
      account_id: 'acc-1',
      is_essential: true,
    })
  })

  it('drops unsafe subscription URLs before they can be rendered as links', () => {
    expect(monthly({ url: 'javascript:alert(1)' }).url).toBe('')
    expect(monthly({ url: 'data:text/html,<script>alert(1)</script>' }).url).toBe('')
    expect(monthly({ url: 'www.netflix.com/cancelplan' }).url).toBe('https://www.netflix.com/cancelplan')
  })

  it('calculates monthly equivalent, annualized total and upcoming charges', () => {
    const summary = buildSubscriptionSummary({
      subscriptions: [
        monthly(),
        annual(),
        monthly({
          id: 'sub-spotify',
          name: 'Spotify',
          provider: 'Spotify',
          amount: 21.9,
          next_billing_date: '2026-07-20',
          is_essential: true,
        }),
      ],
      subscriptionCharges: [],
      expenses: [],
    }, referenceDate)

    expect(summary.totalMonthly).toBe(70.13)
    expect(summary.totalAnnualized).toBe(841.5)
    expect(summary.dispensableMonthly).toBe(39.9)
    expect(summary.essentialMonthly).toBe(30.23)
    expect(summary.next7Days.map((item) => item.name)).toEqual(['Netflix'])
    expect(summary.next15Days.map((item) => item.name)).toEqual(['Netflix', 'Spotify'])
    expect(summary.next30Days.map((item) => item.name)).toEqual(['Netflix', 'Spotify', 'Amazon Prime'])
    expect(summary.nextCharge).toMatchObject({ name: 'Netflix', amount: 39.9, daysUntil: 2 })
  })

  it('excludes paused and canceled subscriptions from future forecasts', () => {
    const paused = pauseSubscription(monthly(), referenceDate)
    const cancelled = cancelSubscription(annual(), referenceDate)
    const summary = buildSubscriptionSummary({
      subscriptions: [paused, cancelled],
      subscriptionCharges: [],
      expenses: [],
    }, referenceDate)

    expect(paused.status).toBe('paused')
    expect(cancelled).toMatchObject({ status: 'cancelled', ended_at: referenceDate })
    expect(summary.totalMonthly).toBe(0)
    expect(summary.next30Days).toEqual([])
  })

  it('reconciles a real card charge with the expected subscription charge', () => {
    const result = reconcileSubscriptionCharge([monthly()], {
      id: 'exp-1',
      date: '2026-07-10',
      description: 'NETFLIX.COM SAO PAULO',
      amount: 39.9,
      payment: 'Crédito',
      creditCardId: 'card-1',
      sourceType: 'credit_card',
      sourceId: 'card-1',
    }, referenceDate)

    expect(result.reconciled).toBe(true)
    expect(result.subscriptionId).toBe('sub-netflix')
    expect(result.charge).toMatchObject({
      subscription_id: 'sub-netflix',
      transaction_id: 'exp-1',
      amount: 39.9,
      status: 'paid',
    })
    expect(result.subscription.next_billing_date).toBe('2026-08-11')
  })

  it('does not count forecast and linked real charge twice in reports', () => {
    const state = {
      subscriptions: [monthly()],
      subscriptionCharges: [{
        id: 'charge-1',
        subscription_id: 'sub-netflix',
        transaction_id: 'exp-1',
        charged_at: '2026-07-10',
        amount: 39.9,
        status: 'paid',
      }],
      expenses: [{
        id: 'exp-1',
        date: '2026-07-10',
        description: 'NETFLIX.COM',
        amount: 39.9,
        payment: 'Crédito',
        creditCardId: 'card-1',
        sourceType: 'credit_card',
        sourceId: 'card-1',
        subscriptionId: 'sub-netflix',
      }],
    }

    const impact = buildSubscriptionMonthImpact(state, { year: 2026, month: 7 })
    expect(impact.forecastTotal).toBe(0)
    expect(impact.actualLinkedTotal).toBe(39.9)
    expect(impact.reportExpenseTotal).toBe(39.9)
    expect(impact.cardImpact).toBe(39.9)
  })

  it('projects card and account impacts for unpaid expected charges', () => {
    const impact = buildSubscriptionMonthImpact({
      subscriptions: [
        monthly(),
        annual(),
      ],
      subscriptionCharges: [],
      expenses: [],
    }, { year: 2026, month: 7 })

    expect(impact.forecastTotal).toBe(39.9)
    expect(impact.cardImpact).toBe(39.9)
    expect(impact.accountImpact).toBe(0)

    const august = buildSubscriptionMonthImpact({
      subscriptions: [annual()],
      subscriptionCharges: [],
      expenses: [],
    }, { year: 2026, month: 8 })
    expect(august.accountImpact).toBe(99.9)
  })

  it('suggests creating or linking a subscription without creating it silently', () => {
    const state = { subscriptions: [], expenses: [] }
    const suggestion = suggestSubscriptionFromExpense(state, {
      id: 'exp-spotify',
      description: 'SPOTIFY PREMIUM',
      amount: 21.9,
      date: '2026-07-09',
      payment: 'Crédito',
      creditCardId: 'card-1',
    })

    expect(suggestion.shouldSuggest).toBe(true)
    expect(suggestion.action).toBe('create')
    expect(suggestion.provider).toBe('Spotify')
    expect(state.subscriptions).toHaveLength(0)
  })

  it('answers subscription questions using real user data', () => {
    const answer = answerSubscriptionQuestion('Quanto gasto por mês com assinaturas e quais posso cortar?', {
      subscriptions: [
        monthly(),
        annual(),
        monthly({
          id: 'sub-chatgpt',
          name: 'ChatGPT',
          provider: 'OpenAI',
          category: 'IA',
          amount: 89.9,
          next_billing_date: '2026-07-18',
          is_essential: false,
        }),
      ],
      subscriptionCharges: [],
      expenses: [],
    }, referenceDate)

    expect(answer.handled).toBe(true)
    expect(answer.content).toContain('R$ 138,13/mês')
    expect(answer.content).toContain('R$ 1.657,50/ano')
    expect(answer.content).toContain('Netflix')
    expect(answer.content).toContain('ChatGPT')
    expect(answer.content).toContain('dispensáveis')
  })
})

describe('subscription manager integration contracts', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('creates, pauses, cancels and reconciles subscriptions through the finance store', () => {
    const store = useFinanceStore()
    store.setActiveUser('user-1')
    store.state.creditCards = [{ id: 'card-1', name: 'Visa', limit: 1000, availableLimit: 1000, closingDay: 20 }]

    const subscription = store.addSubscription(monthly({ id: undefined }))
    expect(store.state.subscriptions).toHaveLength(1)
    expect(subscription.name).toBe('Netflix')

    store.pauseSubscription(subscription.id)
    expect(store.state.subscriptions[0].status).toBe('paused')

    store.updateSubscription(subscription.id, { status: 'active', next_billing_date: '2026-07-11' })
    const expense = store.addExpense({
      date: '2026-07-10',
      category: 'Assinaturas',
      description: 'NETFLIX.COM',
      payment: 'Crédito',
      amount: 39.9,
      paid: true,
      sourceType: 'credit_card',
      sourceId: 'card-1',
      creditCardId: 'card-1',
    })
    expect(expense.subscriptionId).toBe(subscription.id)
    expect(store.state.subscriptionCharges).toHaveLength(1)

    store.cancelSubscription(subscription.id)
    expect(store.state.subscriptions[0].status).toBe('cancelled')
  })

  it('exposes /subscriptions in router, menu, dashboard and route fallbacks', () => {
    expect(router.resolve('/subscriptions').name).toBe('subscriptions')
    expect(metaForPath('/subscriptions')).toMatchObject({
      title: 'Assinaturas',
      group: 'Operação',
    })

    const operation = NAV_GROUPS.find((group) => group.id === 'operacao')
    expect(operation.items.map((item) => item.path)).toContain('/subscriptions')

    const dashboard = fs.readFileSync('src/views/Home.vue', 'utf8')
    expect(dashboard).toContain('Assinaturas do mês')
    expect(dashboard).toContain("router.push('/subscriptions')")

    const fallback = fs.readFileSync('scripts/generate-spa-route-fallbacks.js', 'utf8')
    expect(fallback).toContain("'/subscriptions'")
  })

  it('validates the subscriptions migration RLS contract', () => {
    const migration = fs.readFileSync('supabase/migrations/20260709100000_subscriptions_manager.sql', 'utf8')

    expect(migration).toContain('create table if not exists public.subscriptions')
    expect(migration).toContain('create table if not exists public.subscription_charges')
    expect(migration).toContain('alter table public.subscriptions enable row level security')
    expect(migration).toContain('alter table public.subscription_charges enable row level security')
    expect(migration).toContain('auth.uid() = user_id')
    expect(migration).toContain('deleted_at is null')
    expect(migration).toContain('grant select, insert, update on public.subscriptions to authenticated')
    expect(migration).not.toContain('grant select, insert, update, delete on public.subscriptions to authenticated')
    expect(migration).not.toContain('create policy "subscriptions_delete_own"')
  })
})
