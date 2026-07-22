import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROUTE_META } from '@/router/navigation.js'
import { resolveRouteFeatureAccess } from '@/router/guards/requireFeature.js'

const authMeta = (path, extra = {}) => ({ requiresAuth: true, ...(ROUTE_META[path] || {}), ...extra })

const routes = [
  ...(import.meta.env.DEV ? [
    {
      path: '/design-preview',
      name: 'design-preview',
      component: () => import('@/views/Home.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/design-preview/reports',
      name: 'design-preview-reports',
      component: () => import('@/views/Reports.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/design-preview/intelligence',
      name: 'design-preview-intelligence',
      component: () => import('@/views/IntelligenceCenter.vue'),
      meta: { requiresAuth: false },
    },
  ] : []),
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/views/Signup.vue'),
    meta: { requiresAuth: false, publicPage: true }
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/AuthCallback.vue'),
    meta: { requiresAuth: false, publicPage: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { requiresAuth: false, publicPage: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPassword.vue'),
    meta: { requiresAuth: false, publicPage: true }
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/legal/PrivacyPolicy.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Privacidade' }
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/views/legal/TermsOfUse.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Termos' }
  },
  {
    path: '/cookies',
    name: 'cookies',
    component: () => import('@/views/legal/CookiePolicy.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Cookies' }
  },
  {
    path: '/data-processing',
    name: 'data-processing',
    component: () => import('@/views/legal/DataProcessingNotice.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Tratamento de Dados' }
  },
  {
    path: '/subscription-policy',
    name: 'subscription-policy',
    component: () => import('@/views/legal/SubscriptionPolicy.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Assinatura e Cancelamento' }
  },
  {
    path: '/ai-consent',
    name: 'ai-consent',
    component: () => import('@/views/legal/AiConsentNotice.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Consentimento do Copiloto' }
  },
  {
    path: '/security',
    name: 'security',
    component: () => import('@/views/legal/SecurityPolicyPublic.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Segurança' }
  },
  {
    path: '/lgpd-requests',
    name: 'lgpd-requests',
    component: () => import('@/views/legal/LgpdRequests.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Direitos LGPD' }
  },
  {
    path: '/financial-disclaimer',
    name: 'financial-disclaimer',
    component: () => import('@/views/legal/FinancialDisclaimer.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Aviso Financeiro' }
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: () => import('@/views/public/Pricing.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Planos' }
  },
  {
    path: '/index.html',
    redirect: '/'
  },
  {
    path: '/financas',
    redirect: '/entries'
  },
  {
    path: '/compras',
    redirect: '/purchases'
  },
  {
    path: '/compras/wishlist',
    redirect: '/purchases'
  },
  {
    path: '/compras/nova',
    redirect: '/purchases/new'
  },
  {
    path: '/compras/produto/:id',
    redirect: (to) => `/purchases/${to.params.id}`
  },
  {
    path: '/compras/:id',
    redirect: (to) => `/purchases/${to.params.id}`
  },
  {
    path: '/cards',
    redirect: '/card'
  },
  {
    path: '/accounts',
    redirect: '/structure?tab=accounts'
  },
  {
    path: '/benefits',
    redirect: '/benefit'
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/Reports.vue'),
    meta: authMeta('/reports')
  },
  {
    path: '/configuracoes',
    redirect: '/settings'
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/public/Landing.vue'),
    meta: { requiresAuth: false, publicPage: true, title: 'Controle Financeiro' }
  },
  {
    path: '/entries',
    name: 'entries',
    component: () => import('@/views/Entries.vue'),
    meta: authMeta('/entries')
  },
  {
    path: '/income-documents',
    name: 'income-documents',
    component: () => import('@/views/IncomeDocuments.vue'),
    meta: authMeta('/income-documents')
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/Onboarding.vue'),
    meta: authMeta('/onboarding')
  },
  {
    path: '/price-monitor',
    name: 'price-monitor',
    component: () => import('@/views/PriceMonitor.vue'),
    meta: authMeta('/price-monitor')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/CommandCenter.vue'),
    meta: authMeta('/dashboard')
  },
  {
    path: '/command-center',
    name: 'command-center',
    component: () => import('@/views/CommandCenter.vue'),
    meta: authMeta('/command-center')
  },
  {
    path: '/analysis',
    name: 'analysis',
    component: () => import('@/views/Home.vue'),
    meta: authMeta('/analysis')
  },
  {
    path: '/card',
    name: 'card',
    component: () => import('@/views/Card.vue'),
    meta: authMeta('/card')
  },
  {
    path: '/benefit',
    name: 'benefit',
    component: () => import('@/views/Benefit.vue'),
    meta: authMeta('/benefit')
  },
  {
    path: '/ai',
    name: 'ai',
    component: () => import('@/views/AI.vue'),
    meta: authMeta('/ai')
  },
  {
    path: '/advisor',
    name: 'advisor',
    component: () => import('@/views/Advisor.vue'),
    meta: authMeta('/advisor')
  },
  {
    path: '/ai-actions',
    name: 'ai-actions',
    component: () => import('@/views/AIActionHub.vue'),
    meta: authMeta('/ai-actions')
  },
  {
    path: '/automations',
    name: 'automations',
    component: () => import('@/views/Automations.vue'),
    meta: authMeta('/automations')
  },
  {
    path: '/intelligence',
    name: 'intelligence',
    component: () => import('@/views/IntelligenceCenter.vue'),
    meta: authMeta('/intelligence')
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('@/views/Plan.vue'),
    meta: authMeta('/plan')
  },
  {
    path: '/plan/purchase-simulator',
    redirect: '/simulations/can-i-buy'
  },
  {
    path: '/goals',
    name: 'goals',
    component: () => import('@/views/Goals.vue'),
    meta: authMeta('/goals')
  },
  {
    path: '/budget',
    name: 'budget',
    component: () => import('@/views/Budget.vue'),
    meta: authMeta('/budget')
  },
  {
    path: '/subscriptions',
    name: 'subscriptions',
    component: () => import('@/views/Subscriptions.vue'),
    meta: authMeta('/subscriptions')
  },
  {
    path: '/purchase-simulator',
    redirect: '/simulations/can-i-buy'
  },
  {
    path: '/simulacoes',
    redirect: '/simulations'
  },
  {
    path: '/simulacoes/posso-comprar',
    redirect: '/simulations/can-i-buy'
  },
  {
    path: '/simulations',
    name: 'simulations',
    component: () => import('@/views/Simulations.vue'),
    meta: authMeta('/simulations', { premiumFeature: 'scenario_simulation' })
  },
  {
    path: '/simulations/can-i-buy',
    name: 'simulations-can-i-buy',
    component: () => import('@/views/PurchaseSimulator.vue'),
    meta: authMeta('/simulations/can-i-buy', { premiumFeature: 'scenario_simulation' })
  },
  {
    path: '/compras-ia',
    redirect: '/purchases/new'
  },
  {
    path: '/compras-ia/nova',
    redirect: '/purchases/new'
  },
  {
    path: '/compras-ia/wishlist',
    redirect: '/purchases'
  },
  {
    path: '/compras-ia/produto/:id',
    redirect: (to) => `/purchases/${to.params.id}`
  },
  {
    path: '/purchases/new',
    name: 'purchase-new',
    component: () => import('@/views/PurchaseNew.vue'),
    meta: authMeta('/purchases/new')
  },
  {
    path: '/purchases',
    name: 'purchase-wishlist',
    component: () => import('@/views/PurchaseWishlist.vue'),
    meta: authMeta('/purchases')
  },
  {
    path: '/purchases/:id',
    name: 'purchase-detail',
    component: () => import('@/views/PurchaseDetail.vue'),
    meta: { requiresAuth: true, title: 'Produto', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist', 'Produto'], icon: 'purchases', subtitle: 'Detalhes, preço compatível e decisão' }
  },
  {
    path: '/structure',
    name: 'structure',
    component: () => import('@/views/FinancialStructure.vue'),
    meta: authMeta('/structure')
  },
  {
    path: '/family/invite/:token',
    name: 'family-invite',
    component: () => import('@/views/FamilyInvite.vue'),
    meta: authMeta('/family/invite/:token')
  },
  {
    path: '/family',
    name: 'family',
    component: () => import('@/views/Family.vue'),
    meta: authMeta('/family')
  },
  {
    path: '/settings/family',
    redirect: '/family'
  },
  {
    path: '/family-hub',
    name: 'family-hub',
    component: () => import('@/views/FamilyHub.vue'),
    meta: authMeta('/family')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: authMeta('/settings')
  },
  {
    path: '/support',
    name: 'support',
    component: () => import('@/views/Support.vue'),
    meta: authMeta('/support')
  },
  {
    path: '/billing',
    name: 'billing',
    component: () => import('@/views/Billing.vue'),
    meta: authMeta('/billing')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/Admin.vue'),
    meta: authMeta('/admin')
  },
  {
    path: '/operational',
    name: 'operational',
    component: () => import('@/views/Operational.vue'),
    meta: authMeta('/operational')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && authStore.initialized && !authStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta.requiresAuth && authStore.initialized && authStore.isAuthenticated) {
    const gate = await resolveRouteFeatureAccess(to)
    if (!gate.allowed) {
      next({
        path: '/billing',
        query: {
          locked: '1',
          feature: gate.feature,
          from: to.fullPath,
        },
      })
      return
    }
  }
  next()
})

export default router
