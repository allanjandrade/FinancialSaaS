<template>
  <PageShell
    eyebrow="Assinatura"
    title="Planos e assinatura"
    description="Veja seu plano atual, limites de uso e opções disponíveis."
    testid="billing-page"
  >
    <section class="billing-grid">
      <article class="billing-panel">
        <SubscriptionBadge :label="subscriptionLabel" />
        <h2>Plano atual</h2>
        <p data-testid="billing-current-plan">{{ subscriptionLabel }}</p>
        <p class="plan-copy">{{ planCopy }}</p>
        <div v-if="lockedFeatureMessage" class="locked-feature-message" data-testid="locked-feature-message">
          {{ lockedFeatureMessage }}
        </div>
        <UsageLimitBanner title="Busca de preço" :detail="usageDetail" />
        <PaywallCard v-if="showPaywall && !checkoutAllowed" @notify="checkoutMessage = checkoutGuardMessage" />
        <div v-if="checkoutMessage" class="checkout-message" data-testid="checkout-message">{{ checkoutMessage }}</div>
      </article>

      <article class="billing-panel">
        <h2>Comparação de planos</h2>
        <PlanComparison />
        <button v-if="checkoutAllowed && !access.isPremium" class="primary-button" type="button" data-testid="billing-checkout-button" @click="createCheckout">
          Assinar Premium
        </button>
        <button v-else-if="!access.isPremium" class="secondary-button" type="button" data-testid="billing-checkout-button" disabled>
          Fazer upgrade
        </button>
        <p v-if="!checkoutAllowed && !access.isPremium" class="guard-message" data-testid="billing-guard-message">{{ checkoutGuardMessage }}</p>
        <BillingPortalButton v-if="access.isPremium" @open="portalMessage = 'Portal de assinatura solicitado.'" />
        <p v-if="portalMessage">{{ portalMessage }}</p>
      </article>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageShell from '@/components/layout/PageShell.vue'
import PaywallCard from '@/components/billing/PaywallCard.vue'
import PlanComparison from '@/components/billing/PlanComparison.vue'
import SubscriptionBadge from '@/components/billing/SubscriptionBadge.vue'
import UsageLimitBanner from '@/components/billing/UsageLimitBanner.vue'
import BillingPortalButton from '@/components/billing/BillingPortalButton.vue'
import { resolveEntitlements } from '@/domain/billing/entitlements.js'
import { currentPlanLabel } from '@/domain/billing/plans.js'
import { canAccessCheckout, checkoutBlockedMessage, resolveFrontendAccess } from '@/domain/access-control.js'
import { premiumFeatureLabel } from '@/domain/entitlements/featureAccess.js'
import { loadAuthenticatedContext } from '@/lib/authenticated-context.js'
import { friendlySupabaseError, invokeAuthenticatedFunction } from '@/lib/supabase-auth.js'

const route = useRoute()
const checkoutMessage = ref('')
const portalMessage = ref('')
const usage = ref(Number(localStorage.getItem('release10-price-search-usage') || 3))
const subscription = ref(JSON.parse(localStorage.getItem('release10-subscription') || '{"status":"free","plan_code":"free"}'))
const remoteEntitlements = ref(null)
const billingCheckoutMode = 'testers_only'

const entitlements = computed(() => remoteEntitlements.value || resolveEntitlements({ subscription: subscription.value }))
const access = computed(() => resolveFrontendAccess({ entitlements: entitlements.value }))
const subscriptionLabel = computed(() => currentPlanLabel(entitlements.value.plan_code))
const planCopy = computed(() => {
  if (access.value.isPremium) return 'Sua assinatura Premium está ativa com análises, simulações e limites ampliados.'
  return 'Ideal para controlar receitas, despesas, contas e cartões de forma simples.'
})
const showPaywall = computed(() => entitlements.value.plan_code === 'free' && usage.value >= entitlements.value.limits.price_search_monthly)
const usageDetail = computed(() => `${usage.value}/${entitlements.value.limits.price_search_monthly ?? 'ilimitado'} buscas usadas`)
const checkoutAllowed = computed(() => canAccessCheckout(access.value, billingCheckoutMode))
const checkoutGuardMessage = computed(() => checkoutBlockedMessage(billingCheckoutMode))
const lockedFeatureMessage = computed(() => {
  if (route.query.locked !== '1') return ''
  return `${premiumFeatureLabel(String(route.query.feature || ''))} é um recurso Premium. Faça upgrade para acessar.`
})

onMounted(async () => {
  try {
    const [statusResult, contextResult] = await Promise.all([
      invokeAuthenticatedFunction('billing-subscription-status'),
      loadAuthenticatedContext(),
    ])
    const status = statusResult?.data
    const resolved = contextResult?.entitlements
    if (status?.subscription) subscription.value = status.subscription
    if (resolved) remoteEntitlements.value = resolved
  } catch {
    remoteEntitlements.value = null
  }
})

async function createCheckout() {
  if (!checkoutAllowed.value) {
    checkoutMessage.value = checkoutGuardMessage.value
    return
  }
  const { error, skipped } = await invokeAuthenticatedFunction('billing-create-checkout', { body: { plan_code: 'premium_monthly' } })
  if (error || skipped) {
    checkoutMessage.value = friendlySupabaseError(error, 'Entre novamente para continuar.')
    return
  }
  checkoutMessage.value = 'Checkout Premium solicitado com segurança.'
}
</script>

<style scoped>
.billing-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(320px, 1.2fr);
  gap: 1rem;
}

.billing-panel {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
}

.billing-panel h2,
.billing-panel p {
  margin: 0;
}

.primary-button {
  width: fit-content;
  border: 0;
  border-radius: 8px;
  padding: 0.7rem 1rem;
  background: var(--accent);
  color: white;
  font-weight: 800;
}

.secondary-button {
  width: fit-content;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.7rem 1rem;
  background: var(--bg-input);
  color: var(--text-secondary);
  font-weight: 800;
}

.checkout-message {
  color: var(--income);
}

.guard-message {
  color: var(--warning);
  font-weight: 800;
}

.locked-feature-message {
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(240, 180, 93, 0.32);
  border-radius: 8px;
  background: rgba(240, 180, 93, 0.08);
  color: var(--warning);
  font-weight: 800;
}

.plan-copy {
  color: var(--text-secondary);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 760px) {
  .billing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
