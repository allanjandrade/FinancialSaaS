export const STORAGE_KEY = 'controle-financeiro-app-v2'
export const scopedStorageKey = (userId = '10101010-1010-4010-9010-101010101010') => `${STORAGE_KEY}:${userId}`

export function queryResult(data = null) {
  const result = { data, error: null }
  let chain
  chain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return (resolve) => Promise.resolve(result).then(resolve)
      if (property === 'single' || property === 'maybeSingle') return () => Promise.resolve(result)
      return () => chain
    },
  })
  return chain
}

export function financeState() {
  return {
    settings: { year: 2026, selectedMonth: 6, currentMemberId: 'member-1' },
    familyMembers: [{ id: 'member-1', name: 'Release 10', role: 'administrator' }],
    financialAccounts: [{ id: 'account-1', name: 'Conta', balance: 5000 }],
    creditCards: [],
    benefitWallets: [],
    incomes: [{ id: 'i1', date: '2026-06-05', type: 'Salario', amount: 5000 }],
    expenses: [],
    wishlist: [],
  }
}

export function installSupabaseStub(win, options = {}) {
  const user = { id: options.userId || '10101010-1010-4010-9010-101010101010', email: options.email || 'release10@example.com' }
  const session = { access_token: 'e2e-token', user }
  const calls = []
  const adminAccess = options.admin
    ? { is_admin: true, role: options.admin, permissions: [] }
    : options.adminAccess || { is_admin: false, role: 'user', permissions: [] }
  const subscription = options.subscription || { status: 'free', plan_code: 'free' }
  const entitlements = options.entitlements || {
    plan_code: subscription.status === 'active' ? subscription.plan_code : 'free',
    is_tester: Boolean(options.tester),
    tester_group: options.tester ? 'release11-production-beta' : null,
    features: options.tester || subscription.status === 'active'
      ? { predictive_advisor: true, scenario_simulation: true, price_search: true, automations: true, smart_actions: true, billing_checkout: true }
      : { predictive_advisor: false, scenario_simulation: false, price_search: true, automations: true, smart_actions: false, billing_checkout: false },
    limits: subscription.status === 'active'
      ? { price_search_monthly: 50, automations_active: 10, wishlist_items: null }
      : { price_search_monthly: 3, automations_active: 1, wishlist_items: 5 },
  }
  win.__release10FunctionCalls = calls
  win.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'e2e-anon' }
  win.supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => queryResult(null),
    rpc: () => Promise.resolve({ data: null, error: null }),
    storage: {
      from: () => ({
        upload: async (path) => ({ data: { path }, error: null }),
        download: async () => ({ data: new Blob(['documento'], { type: 'application/octet-stream' }), error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    functions: {
      invoke: async (name, payload = {}) => {
        calls.push({ name, payload })
        if (name === 'admin-current-user') return { data: adminAccess, error: null }
        if (name === 'entitlements-resolve') return { data: entitlements, error: null }
        if (name === 'billing-subscription-status') return { data: { subscription }, error: null }
        if (name === 'admin-list-users') return {
          data: {
            users: [{ id: user.id, email: user.email }],
            admins: adminAccess.is_admin ? [{ user_id: user.id, role: adminAccess.role, active: true }] : [],
            testers: options.tester ? [{ user_id: user.id, status: 'active', tester_group: 'release11-production-beta' }] : [],
            billing: [subscription].filter(Boolean).map((item) => ({ ...item, user_id: user.id })),
          },
          error: null,
        }
        return { data: { ok: true, name, checkout_url: 'https://checkout.example.invalid/session' }, error: null }
      },
    },
  }
}

export function visitRelease10(path, options = {}) {
  cy.visit(path, {
    onBeforeLoad(win) {
      installSupabaseStub(win, options)
      win.localStorage.setItem(scopedStorageKey(options.userId || '10101010-1010-4010-9010-101010101010'), JSON.stringify(options.state || financeState()))
      if (options.staleAdminCache) win.localStorage.setItem('release10-admin-access', JSON.stringify({ is_admin: true, role: 'owner', permissions: [] }))
      if (options.subscription) win.localStorage.setItem('release10-subscription', JSON.stringify(options.subscription))
      if (options.usage != null) win.localStorage.setItem('release10-price-search-usage', String(options.usage))
    },
  })
}
