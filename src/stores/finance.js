import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  OFFICIAL_EXPENSE_CATEGORIES,
  OFFICIAL_INCOME_TYPES,
  OFFICIAL_PAYMENT_METHODS,
  normalizeExpenseCategory,
  normalizeIncomeType,
  normalizePaymentMethod,
} from '@/constants/finance'
import { buildMaturitySnapshot, syncMaturityHistory } from '@/utils/financial-maturity.js'
import { syncFinancialEventProjection } from '@/api/normalized-finance.js'
import {
  deleteBenefitAccountProjection,
  deletePurchaseProjection,
  syncAuditLogProjection,
  syncBenefitAccountProjection,
  syncBenefitTransactionProjection,
  syncPurchasePriceProjection,
  syncPurchaseProjection,
} from '@/api/release1-projections.js'
import { ensureFinancialStructure } from '@/utils/financial-structure-migrate.js'
import { SOURCE_TYPES, createOpenFinanceFields, newId } from '@/constants/financial-structure.js'
import { ensureFamilyMode } from '@/utils/family-migrate.js'
import { FAMILY_ROLES, SPLIT_MODES } from '@/constants/family.js'
import {
  buildPriceStats,
  normalizePriceRecord,
  toNumber,
} from '@/utils/price-monitoring.js'
import {
  findMatchingProduct,
  normalizeReceiptDraft,
  receiptDuplicateKey,
} from '@/utils/market-receipt-import.js'
import { useFamilySyncStore } from '@/stores/family-sync.js'
import {
  sanitizeCategoryBudget,
  sanitizePlanningGoal,
} from '@/utils/planning-engine.js'
import {
  advanceBillingDate,
  buildSubscriptionMonthImpact,
  cancelSubscription as cancelSubscriptionRecord,
  pauseSubscription as pauseSubscriptionRecord,
  reconcileSubscriptionCharge,
  sanitizeSubscription,
  sanitizeSubscriptionCharge,
  softDeleteSubscription as softDeleteSubscriptionRecord,
  suggestSubscriptionFromExpense,
} from '@/utils/subscriptions.js'
import {
  buildStatementImportPreview as buildStatementImportPreviewDomain,
} from '@/domain/reconciliation/reconciliationEngine.js'
import { hasCompatiblePrice, isAcceptedCompatibleOffer, requiresCompatiblePrice } from '@/utils/productIdentity.js'
import {
  firstSafeExternalUrl,
  normalizeExternalUrl,
  normalizeImageUrl,
} from '@/utils/safe-url.js'
import {
  FINANCE_STORAGE_KEY,
  getUserScopedItem,
  getUserScopedKey,
  migrateLegacyStorageToUserScope,
  setActiveStorageUser,
  setUserScopedItem,
} from '@/lib/userScopedStorage.js'

const EMPTY_STATE = {
  settings: {
    year: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    cardLimit: 0,
    cardClosingDay: 1,
    cardDueDay: 10,
    vaInitialBalance: 0,
    hideBalance: false,
    emergencyReserveCurrent: 0,
    emergencyReserveMinimum: 0,
    monthlyRecurringExpenses: 0,
    monthlyDebtPayments: 0,
    activeGoalsValue: 0,
    familyModeEnabled: false,
    familySharedGoalsLabel: 'Metas familiares',
    maturityHistory: [],
    familyName: 'Minha Família',
    currentMemberId: '',
  },
  family: null,
  familyInvites: [],
  sharedDebts: [],
  sharedGoals: [],
  settlements: [],
  planningGoals: [],
  categoryBudgets: [],
  auditLog: [],
  incomes: [],
  expenses: [],
  wishlist: [],
  priorityQueue: [],
  financialAccounts: [],
  creditCards: [],
  benefitWallets: [],
  familyMembers: [],
  recurringIncomes: [],
  recurringRules: [],
  subscriptions: [],
  subscriptionCharges: [],
  internalTransfers: [],
  aiAlerts: [],
  archivedTransactions: [],
  incomeDocuments: [],
  entryDocuments: [],
  products: [],
  stores: [],
  priceRecords: [],
  userTrackedProducts: [],
  priceAlerts: [],
  priceMonitorAlerts: [],
  importedMarketReceipts: [],
  importSessions: [],
}

function cloneEmptyState() {
  const cloned = JSON.parse(JSON.stringify(EMPTY_STATE))
  applyCurrentPeriodDefault(cloned)
  return cloned
}

function currentPeriod() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    selectedMonth: now.getMonth() + 1,
  }
}

function applyCurrentPeriodDefault(target) {
  const period = currentPeriod()
  target.settings = {
    ...(target.settings || {}),
    year: period.year,
    selectedMonth: period.selectedMonth,
  }
  return target
}

export const useFinanceStore = defineStore('finance', () => {
  const state = ref(cloneEmptyState())
  const loading = ref(false)
  const activeUserId = ref(null)

  // Getters
  const selectedKey = computed(() => {
    return state.value.settings.year * 100 + state.value.settings.selectedMonth
  })

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]

  const expenseCategories = OFFICIAL_EXPENSE_CATEGORIES
  const incomeTypes = OFFICIAL_INCOME_TYPES
  const paymentMethods = OFFICIAL_PAYMENT_METHODS

  // Actions
  function getCurrentMember() {
    const id = state.value.settings.currentMemberId
    return state.value.familyMembers.find((m) => m.id === id) || state.value.familyMembers[0]
  }

  function memberName(id) {
    return state.value.familyMembers.find((m) => m.id === id)?.name || '—'
  }

  function appendAudit(entry) {
    const member = getCurrentMember()
    const row = {
      id: newId(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || '',
      memberId: member?.id || '',
      memberName: member?.name || 'Sistema',
      at: new Date().toISOString(),
      details: entry.details || '',
    }
    state.value.auditLog = [...(state.value.auditLog || []), row].slice(-500)
    syncAuditLogProjection(state.value.family?.id, row).catch((error) => {
      console.warn('[audit-logs] Projeção remota não sincronizada:', error.message)
    })
  }

  function migrateExpense(rawExpense) {
    const expense = { ...rawExpense }
    expense.category = normalizeExpenseCategory(expense.category)
    expense.payment = normalizePaymentMethod(expense.payment)
    if (!expense.date) expense.date = new Date().toISOString().split('T')[0]
    if (!expense.description) expense.description = 'Sem descrição'
    expense.amount = Number(expense.amount || 0)
    expense.paid = Boolean(expense.paid)
    expense.isShared = Boolean(expense.isShared)
    expense.splitMode = expense.splitMode || SPLIT_MODES.PERCENT
    expense.splits = Array.isArray(expense.splits) ? expense.splits : []
    expense.responsibleMemberId = expense.responsibleMemberId || expense.familyMemberId || null
    expense.paidByMemberId = expense.paidByMemberId || expense.responsibleMemberId || null
    expense.documentIds = Array.isArray(expense.documentIds) ? expense.documentIds : []
    return expense
  }

  function migrateIncome(rawIncome) {
    const income = { ...rawIncome }
    income.type = normalizeIncomeType(income.type)
    if (!income.date) income.date = new Date().toISOString().split('T')[0]
    if (!income.description) income.description = 'Sem descrição'
    income.amount = Number(income.amount || 0)
    income.ownerMemberId = income.ownerMemberId || income.familyMemberId || null
    income.documentIds = Array.isArray(income.documentIds) ? income.documentIds : []
    return income
  }

  function resetInMemoryState() {
    state.value = cloneEmptyState()
    ensureFinancialStructure(state.value)
    ensureFamilyMode(state.value)
  }

  function loadState() {
    if (!activeUserId.value) {
      resetInMemoryState()
      return
    }

    migrateLegacyStorageToUserScope(FINANCE_STORAGE_KEY, activeUserId.value)
    const saved = getUserScopedItem(FINANCE_STORAGE_KEY, activeUserId.value)
    if (!saved) {
      resetInMemoryState()
      return
    }
    try {
      const parsed = JSON.parse(saved)
      state.value = {
        ...EMPTY_STATE,
        settings: { ...EMPTY_STATE.settings, ...parsed.settings },
        incomes: Array.isArray(parsed.incomes) ? parsed.incomes.map(migrateIncome) : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(migrateExpense) : [],
        wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist.map(migrateWishlistItem) : [],
        priorityQueue: Array.isArray(parsed.priorityQueue) ? parsed.priorityQueue : [],
        financialAccounts: parsed.financialAccounts || [],
        creditCards: parsed.creditCards || [],
        benefitWallets: parsed.benefitWallets || [],
        familyMembers: parsed.familyMembers || [],
        recurringIncomes: parsed.recurringIncomes || [],
        recurringRules: parsed.recurringRules || [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions.map(sanitizeSubscription) : [],
        subscriptionCharges: Array.isArray(parsed.subscriptionCharges) ? parsed.subscriptionCharges.map(sanitizeSubscriptionCharge) : [],
        internalTransfers: parsed.internalTransfers || [],
        aiAlerts: parsed.aiAlerts || [],
        archivedTransactions: parsed.archivedTransactions || [],
        family: parsed.family || null,
        familyInvites: parsed.familyInvites || [],
        sharedDebts: parsed.sharedDebts || [],
        sharedGoals: parsed.sharedGoals || [],
        settlements: parsed.settlements || [],
        planningGoals: Array.isArray(parsed.planningGoals) ? parsed.planningGoals.map(sanitizePlanningGoal) : [],
        categoryBudgets: Array.isArray(parsed.categoryBudgets) ? parsed.categoryBudgets.map((item) => sanitizeCategoryBudget(item, parsed)) : [],
        auditLog: parsed.auditLog || [],
        incomeDocuments: Array.isArray(parsed.incomeDocuments) ? parsed.incomeDocuments : [],
        entryDocuments: Array.isArray(parsed.entryDocuments) ? parsed.entryDocuments : [],
        products: Array.isArray(parsed.products) ? parsed.products.map(migrateProduct) : [],
        stores: Array.isArray(parsed.stores) ? parsed.stores.map(migrateStore) : [],
        priceRecords: Array.isArray(parsed.priceRecords) ? parsed.priceRecords.map(migratePriceRecord) : [],
        userTrackedProducts: Array.isArray(parsed.userTrackedProducts) ? parsed.userTrackedProducts.map(migrateTrackedProduct) : [],
        priceAlerts: Array.isArray(parsed.priceAlerts) ? parsed.priceAlerts.map(migratePriceAlert) : [],
        priceMonitorAlerts: Array.isArray(parsed.priceMonitorAlerts) ? parsed.priceMonitorAlerts.map(migratePriceMonitorAlert) : [],
        importedMarketReceipts: Array.isArray(parsed.importedMarketReceipts) ? parsed.importedMarketReceipts.map(migrateImportedReceipt) : [],
        importSessions: Array.isArray(parsed.importSessions) ? parsed.importSessions : [],
      }
      applyCurrentPeriodDefault(state.value)
      ensureFinancialStructure(state.value)
      ensureFamilyMode(state.value)
      syncLegacySettingsFromStructure()
      saveState({ skipCloudPush: true, markLocalChange: false })
    } catch {
      resetInMemoryState()
    }
  }

  function setActiveUser(userId) {
    const nextUserId = userId || null
    if (activeUserId.value === nextUserId) return
    activeUserId.value = nextUserId
    setActiveStorageUser(nextUserId)
    loadState()
  }

  function requireActiveUser() {
    if (!activeUserId.value) throw new Error('Usuario autenticado obrigatorio para dados financeiros')
    return activeUserId.value
  }

  function recordMaturitySnapshot() {
    const snapshot = buildMaturitySnapshot(state.value, calcMonth)
    state.value.settings.maturityHistory = syncMaturityHistory(
      state.value.settings.maturityHistory,
      snapshot,
    )
  }

  function syncLegacySettingsFromStructure() {
    const card = state.value.creditCards[0]
    if (card) {
      state.value.settings.cardLimit = card.limit
      state.value.settings.cardClosingDay = card.closingDay
      state.value.settings.cardDueDay = card.dueDay
    }
    const va = state.value.benefitWallets.find((b) => b.kind === 'va')
    if (va) state.value.settings.vaInitialBalance = va.balance
  }

  function syncCreditCardAvailableLimits() {
    state.value.creditCards.forEach((card) => {
      const bill = state.value.expenses
        .filter((e) => e.payment === 'Crédito' && (e.creditCardId === card.id || e.sourceId === card.id))
        .reduce((s, e) => s + Number(e.amount || 0), 0)
      card.availableLimit = Math.max(0, Number(card.limit || 0) - bill)
    })
  }

  function findSourceEntity(sourceType, sourceId) {
    if (sourceType === SOURCE_TYPES.CREDIT_CARD) {
      return state.value.creditCards.find((c) => c.id === sourceId)
    }
    if ([SOURCE_TYPES.BENEFIT_VA, SOURCE_TYPES.BENEFIT_VR, SOURCE_TYPES.BENEFIT_CORPORATE].includes(sourceType)) {
      return state.value.benefitWallets.find((b) => b.id === sourceId)
    }
    return state.value.financialAccounts.find((a) => a.id === sourceId)
  }

  function applySourceDelta(sourceType, sourceId, delta) {
    const entity = findSourceEntity(sourceType, sourceId)
    if (!entity) return
    if (sourceType === SOURCE_TYPES.CREDIT_CARD) {
      syncCreditCardAvailableLimits()
      return
    }
    entity.balance = Number(entity.balance || 0) + delta
  }

  function processRecurringIncomes() {
    const now = new Date()
    const monthKey = state.value.settings.year * 100 + (now.getMonth() + 1)
    const monthStr = `${state.value.settings.year}-${String(now.getMonth() + 1).padStart(2, '0')}`

    state.value.recurringIncomes
      .filter((r) => r.active !== false)
      .forEach((rec) => {
        const exists = state.value.incomes.some(
          (i) => i.recurringIncomeId === rec.id && monthKeyFromDate(i.date) === monthKey,
        )
        if (exists) return
        if (rec.frequency === 'Mensal' && Number(rec.dayOfMonth) > now.getDate()) return

        addIncome({
          date: monthStr,
          type: rec.type,
          amount: rec.amount,
          description: rec.description || `Recorrente: ${rec.type}`,
          sourceType: rec.sourceType || SOURCE_TYPES.ACCOUNT,
          sourceId: rec.sourceAccountId,
          familyMemberId: rec.memberId,
          recurringIncomeId: rec.id,
          paid: true,
        }, { skipRecurring: true })
        rec.lastGeneratedAt = new Date().toISOString()
      })
  }

  function saveState(options = {}) {
    syncCreditCardAvailableLimits()
    recordMaturitySnapshot()
    if (options.markLocalChange !== false && !options.skipCloudPush) {
      state.value.settings.lastLocalChangeAt = new Date().toISOString()
    }
    if (!activeUserId.value) return
    setUserScopedItem(FINANCE_STORAGE_KEY, JSON.stringify(state.value), activeUserId.value)
    if (options.skipCloudPush) return
    queueMicrotask(() => {
      const sync = useFamilySyncStore()
      if (!sync.applyingRemote) sync.schedulePush()
    })
  }

  function monthKeyFromDate(dateString, shift = 0) {
    const [year, month] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1 + shift, 1)
    return date.getFullYear() * 100 + (date.getMonth() + 1)
  }

  function calculateCardCompetency(dateString, expense = null) {
    const [year, month, day] = dateString.split('-').map(Number)
    let closingDay = state.value.settings.cardClosingDay || 1
    if (expense?.creditCardId || expense?.sourceId) {
      const cardId = expense.creditCardId || expense.sourceId
      const card = state.value.creditCards.find((c) => c.id === cardId)
      if (card?.closingDay) closingDay = card.closingDay
    }

    let competencyMonth, competencyYear

    if (day <= closingDay) {
      const nextMonth = new Date(year, month, 1)
      competencyMonth = nextMonth.getMonth() + 1
      competencyYear = nextMonth.getFullYear()
    } else {
      const nextNextMonth = new Date(year, month + 1, 1)
      competencyMonth = nextNextMonth.getMonth() + 1
      competencyYear = nextNextMonth.getFullYear()
    }

    return { competencyMonth, competencyYear }
  }

  function expenseImpactKey(expense) {
    if (expense.payment === 'Crédito') {
      if (expense.cardCompetencyMonth && expense.cardCompetencyYear) {
        return expense.cardCompetencyYear * 100 + expense.cardCompetencyMonth
      }
      return monthKeyFromDate(expense.date, 1)
    }
    return monthKeyFromDate(expense.date, 0)
  }

  function calcMonth(month) {
    const key = state.value.settings.year * 100 + month
    const incomeCash = state.value.incomes
      .filter((item) => monthKeyFromDate(item.date) === key && item.type !== 'VA' && item.type !== 'VR')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const vaIncome = state.value.incomes
      .filter((item) => monthKeyFromDate(item.date) === key && (item.type === 'VA' || item.type === 'VR'))
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const cashExpenses = state.value.expenses
      .filter((item) => {
        const isCashPayment = item.payment !== 'Crédito' && item.payment !== 'VA' && item.payment !== 'VR'
        const impactsThisMonth = expenseImpactKey(item) === key
        return isCashPayment && impactsThisMonth
      })
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const cardBill = state.value.expenses
      .filter((item) => item.payment === 'Crédito' && expenseImpactKey(item) === key)
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const subscriptionImpact = buildSubscriptionMonthImpact(state.value, {
      year: state.value.settings.year,
      month,
    })

    const vaUse = state.value.expenses
      .filter((item) => expenseImpactKey(item) === key && isVaExpense(item))
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const adjustedCashExpenses = cashExpenses + Number(subscriptionImpact.accountForecast || 0)
    const adjustedCardBill = cardBill + Number(subscriptionImpact.cardForecast || 0)

    return {
      key,
      incomeCash,
      vaIncome,
      cashExpenses: adjustedCashExpenses,
      cardBill: adjustedCardBill,
      vaUse,
      subscriptionForecast: Number(subscriptionImpact.forecastTotal || 0),
      subscriptionAccountForecast: Number(subscriptionImpact.accountForecast || 0),
      subscriptionCardForecast: Number(subscriptionImpact.cardForecast || 0),
      cashBalance: incomeCash - adjustedCashExpenses,
    }
  }

  function isVaExpense(expense) {
    const vaCategories = new Set(['Mercado', 'Açougue', 'Restaurante', 'Delivery'])
    return (expense.payment === 'VA' || expense.payment === 'VR') && vaCategories.has(expense.category)
  }

  function resolveExpenseSource(expense) {
    if (expense.sourceType && expense.sourceId) {
      return { sourceType: expense.sourceType, sourceId: expense.sourceId }
    }
    const payment = normalizePaymentMethod(expense.payment)
    if (payment === 'Crédito' && state.value.creditCards[0]) {
      const id = expense.creditCardId || state.value.creditCards[0].id
      return { sourceType: SOURCE_TYPES.CREDIT_CARD, sourceId: id }
    }
    if (payment === 'VA') {
      const w = state.value.benefitWallets.find((b) => b.kind === 'va')
      if (w) return { sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: w.id }
    }
    if (payment === 'VR') {
      const w = state.value.benefitWallets.find((b) => b.kind === 'vr')
      if (w) return { sourceType: SOURCE_TYPES.BENEFIT_VR, sourceId: w.id }
    }
    const acc = state.value.financialAccounts[0]
    return { sourceType: SOURCE_TYPES.ACCOUNT, sourceId: acc?.id }
  }

  function addExpense(expense, options = {}) {
    const { competencyMonth, competencyYear } = calculateCardCompetency(expense.date, expense)
    const payment = normalizePaymentMethod(expense.payment)
    const { sourceType, sourceId } = resolveExpenseSource(expense)
    const amount = Number(expense.amount)

    const current = getCurrentMember()
    const responsibleId = expense.responsibleMemberId || expense.familyMemberId || current?.id
    let splits = expense.splits || []
    if (expense.isShared && splits.length === 0 && state.value.familyMembers.length >= 2) {
      const pct = 100 / state.value.familyMembers.length
      splits = state.value.familyMembers.map((m) => ({ memberId: m.id, percent: pct }))
    }

    const newExpense = {
      id: newId(),
      date: expense.date,
      category: normalizeExpenseCategory(expense.category),
      description: expense.description || 'Sem descrição',
      payment,
      amount,
      paid: expense.paid == null ? payment !== 'Crédito' : Boolean(expense.paid),
      sourceType,
      sourceId,
      creditCardId: sourceType === SOURCE_TYPES.CREDIT_CARD ? sourceId : null,
      familyMemberId: responsibleId,
      responsibleMemberId: responsibleId,
      paidByMemberId: expense.paidByMemberId || responsibleId,
      isShared: Boolean(expense.isShared),
      splitMode: expense.splitMode || SPLIT_MODES.PERCENT,
      splits,
      createdByMemberId: current?.id,
      cardCompetencyMonth: competencyMonth,
      cardCompetencyYear: competencyYear,
      documentIds: expense.documentIds || [],
      ocrProvider: expense.ocrProvider || null,
      ocrConfidence: expense.ocrConfidence ?? null,
      ocrDate: expense.ocrDate || null,
      ocrTipoDocumento: expense.ocrTipoDocumento || null,
      ocrObservacoes: expense.ocrObservacoes || null,
      subscriptionId: expense.subscriptionId || null,
      subscriptionChargeId: null,
      importSessionId: expense.importSessionId || null,
      created_at: new Date().toISOString(),
    }
    const subscriptionMatch = newExpense.subscriptionId
      ? linkExpenseToSubscription(newExpense, newExpense.subscriptionId)
      : reconcileExpenseWithSubscription(newExpense)
    if (subscriptionMatch?.reconciled) {
      newExpense.subscriptionId = subscriptionMatch.subscriptionId
      newExpense.subscriptionChargeId = subscriptionMatch.charge.id
    }
    state.value.expenses.push(newExpense)
    if (newExpense.paid && sourceType !== SOURCE_TYPES.CREDIT_CARD) {
      applySourceDelta(sourceType, sourceId, -amount)
    }
    appendAudit({
      action: 'created',
      entityType: 'expense',
      entityId: newExpense.id,
      details: `${newExpense.description} — ${amount}${newExpense.isShared ? ' (compartilhada)' : ''}`,
    })
    if (newExpense.paid) {
      appendAudit({ action: 'paid', entityType: 'expense', entityId: newExpense.id, details: `Pago por ${current?.name}` })
    }
    if (newExpense.paid && [SOURCE_TYPES.BENEFIT_VA, SOURCE_TYPES.BENEFIT_VR, SOURCE_TYPES.BENEFIT_CORPORATE].includes(sourceType)) {
      const wallet = state.value.benefitWallets.find((item) => item.id === sourceId)
      syncBenefitTransactionProjection(state.value.family?.id, wallet, {
        id: `expense:${newExpense.id}`,
        type: 'debit',
        amount,
        description: newExpense.description,
        occurredAt: new Date(`${newExpense.date}T12:00:00`).toISOString(),
      }).catch((error) => console.warn('[benefits] Débito remoto não sincronizado:', error.message))
    }
    if (!options.skipSave) saveState()
    return newExpense
  }

  function addIncome(income, options = {}) {
    const sourceType = income.sourceType || SOURCE_TYPES.ACCOUNT
    const sourceId = income.sourceId || state.value.financialAccounts[0]?.id
    const amount = Number(income.amount)

    const ownerId = income.ownerMemberId || income.familyMemberId || state.value.familyMembers[0]?.id
    const newIncome = {
      id: newId(),
      date: income.date,
      type: normalizeIncomeType(income.type),
      description: income.description || 'Sem descrição',
      amount,
      sourceType,
      sourceId,
      familyMemberId: ownerId,
      ownerMemberId: ownerId,
      recurringIncomeId: income.recurringIncomeId || null,
      createdByMemberId: getCurrentMember()?.id,
      documentIds: income.documentIds || [],
      ocrProvider: income.ocrProvider || null,
      ocrConfidence: income.ocrConfidence ?? null,
      ocrDate: income.ocrDate || null,
      ocrTipoDocumento: income.ocrTipoDocumento || null,
      ocrObservacoes: income.ocrObservacoes || null,
      importSessionId: income.importSessionId || null,
      created_at: new Date().toISOString(),
    }
    state.value.incomes.push(newIncome)
    applySourceDelta(sourceType, sourceId, amount)
    appendAudit({
      action: 'received',
      entityType: 'income',
      entityId: newIncome.id,
      details: `${newIncome.type} — ${amount} (${memberName(ownerId)})`,
    })
    if ([SOURCE_TYPES.BENEFIT_VA, SOURCE_TYPES.BENEFIT_VR, SOURCE_TYPES.BENEFIT_CORPORATE].includes(sourceType)) {
      const wallet = state.value.benefitWallets.find((item) => item.id === sourceId)
      syncBenefitTransactionProjection(state.value.family?.id, wallet, {
        id: `income:${newIncome.id}`,
        type: 'credit',
        amount,
        description: newIncome.description,
        occurredAt: new Date(`${newIncome.date}T12:00:00`).toISOString(),
      }).catch((error) => console.warn('[benefits] Crédito remoto não sincronizado:', error.message))
    }
    if (!options.skipRecurring) processRecurringIncomes()
    saveState()
    return newIncome
  }

  function addIncomeDocument(meta) {
    const doc = {
      id: meta.id || newId(),
      type: meta.type || 'outro',
      label: meta.label || '',
      referenceYear: meta.referenceYear || new Date().getFullYear(),
      referenceMonth: meta.referenceMonth || null,
      incomeId: meta.incomeId || null,
      fileName: meta.fileName || 'documento',
      mimeType: meta.mimeType || 'application/octet-stream',
      size: meta.size || 0,
      storage: meta.storage || 'local',
      storagePath: meta.storagePath || null,
      amount: meta.amount != null ? Number(meta.amount) : null,
      notes: meta.notes || '',
      uploadedAt: meta.uploadedAt || new Date().toISOString(),
    }
    state.value.incomeDocuments.push(doc)
    appendAudit({
      action: 'created',
      entityType: 'income_document',
      entityId: doc.id,
      details: doc.label || doc.fileName,
    })
    saveState()
    return doc
  }

  function updateIncomeDocument(id, patch) {
    const doc = state.value.incomeDocuments.find((d) => d.id === id)
    if (!doc) return null
    Object.assign(doc, patch)
    saveState()
    return doc
  }

  function deleteIncomeDocument(id) {
    state.value.incomeDocuments = state.value.incomeDocuments.filter((d) => d.id !== id)
    const income = state.value.incomes.find((i) => i.documentIds?.includes(id))
    if (income?.documentIds) {
      income.documentIds = income.documentIds.filter((docId) => docId !== id)
    }
    const transfer = (state.value.internalTransfers || []).find((item) => item.documentIds?.includes(id))
    if (transfer?.documentIds) {
      transfer.documentIds = transfer.documentIds.filter((docId) => docId !== id)
    }
    saveState()
  }

  function linkDocumentToIncome(documentId, incomeId) {
    const doc = state.value.incomeDocuments.find((d) => d.id === documentId)
    const income = state.value.incomes.find((i) => i.id === incomeId)
    if (!doc || !income) return false
    doc.incomeId = incomeId
    if (!income.documentIds) income.documentIds = []
    if (!income.documentIds.includes(documentId)) income.documentIds.push(documentId)
    saveState()
    return true
  }

  function getIncomeDocuments(filters = {}) {
    let list = [...(state.value.incomeDocuments || [])]
    if (filters.type) list = list.filter((d) => d.type === filters.type)
    if (filters.year) list = list.filter((d) => Number(d.referenceYear) === Number(filters.year))
    if (filters.month) list = list.filter((d) => Number(d.referenceMonth) === Number(filters.month))
    return list.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  }

  function addEntryDocument(meta) {
    const doc = {
      id: meta.id || newId(),
      sourceType: 'entry_document',
      entryKind: meta.entryKind || 'expense',
      entryId: meta.entryId || null,
      label: meta.label || '',
      date: meta.date || new Date().toISOString().split('T')[0],
      category: meta.category || '',
      amount: meta.amount != null ? Number(meta.amount) : null,
      fileName: meta.fileName || 'documento',
      mimeType: meta.mimeType || 'application/octet-stream',
      size: meta.size || 0,
      storage: meta.storage || 'local',
      storagePath: meta.storagePath || null,
      notes: meta.notes || '',
      uploadedAt: meta.uploadedAt || new Date().toISOString(),
    }
    state.value.entryDocuments = [...(state.value.entryDocuments || []), doc]
    appendAudit({
      action: 'attached',
      entityType: doc.entryKind,
      entityId: doc.entryId || '',
      details: doc.label || doc.fileName,
    })
    saveState()
    return doc
  }

  function linkEntryDocumentToEntry(documentId, entryKind, entryId) {
    const doc = (state.value.entryDocuments || []).find((item) => item.id === documentId)
    const list = entryKind === 'income'
      ? state.value.incomes
      : entryKind === 'transfer'
        ? state.value.internalTransfers
        : state.value.expenses
    const entry = list.find((item) => item.id === entryId)
    if (!doc || !entry) return false

    doc.entryKind = entryKind
    doc.entryId = entryId
    if (!entry.documentIds) entry.documentIds = []
    if (!entry.documentIds.includes(documentId)) entry.documentIds.push(documentId)
    saveState()
    return true
  }

  function getEntryDocuments(entryKind, entryId) {
    return (state.value.entryDocuments || [])
      .filter((doc) => doc.entryKind === entryKind && doc.entryId === entryId)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
  }

  function deleteExpense(id) {
    state.value.expenses = state.value.expenses.filter(e => e.id !== id)
    saveState()
  }

  function deleteIncome(id) {
    state.value.incomes = state.value.incomes.filter(i => i.id !== id)
    saveState()
  }

  function updateSettings(newSettings) {
    state.value.settings = { ...state.value.settings, ...newSettings }
    saveState()
  }

  function resetData() {
    resetInMemoryState()
    saveState()
  }

  function migrateProduct(raw) {
    return {
      id: raw.id || newId(),
      name: raw.name || '',
      brand: raw.brand || '',
      category: raw.category || 'Mercado',
      barcode: raw.barcode || '',
      default_unit: raw.default_unit || 'un',
      created_at: raw.created_at || new Date().toISOString(),
    }
  }

  function migrateStore(raw) {
    return {
      id: raw.id || newId(),
      name: raw.name || '',
      type: raw.type || 'manual',
      website_url: normalizeExternalUrl(raw.website_url),
      created_at: raw.created_at || new Date().toISOString(),
    }
  }

  function migratePriceRecord(raw) {
    return normalizePriceRecord({
      id: raw.id || newId(),
      product_id: raw.product_id,
      store_id: raw.store_id || '',
      price: raw.price,
      unit_price: raw.unit_price,
      currency: raw.currency || 'BRL',
      source: raw.source || 'manual',
      collected_at: raw.collected_at || raw.created_at || new Date().toISOString(),
      product_url: normalizeExternalUrl(raw.product_url),
      availability: raw.availability || 'available',
      quantity: raw.quantity || 1,
      notes: raw.notes || '',
    })
  }

  function migrateTrackedProduct(raw) {
    return {
      id: raw.id || newId(),
      user_id: raw.user_id || 'local',
      product_id: raw.product_id,
      target_price: raw.target_price == null || raw.target_price === '' ? null : toNumber(raw.target_price),
      usual_quantity: Math.max(1, toNumber(raw.usual_quantity, 1)),
      purchase_frequency_days: Math.max(1, toNumber(raw.purchase_frequency_days, 30)),
      alert_enabled: raw.alert_enabled !== false,
      created_at: raw.created_at || new Date().toISOString(),
    }
  }

  function migratePriceAlert(raw) {
    return {
      id: raw.id || newId(),
      user_id: raw.user_id || 'local',
      product_id: raw.product_id,
      condition_type: raw.condition_type || 'below_target',
      target_price: toNumber(raw.target_price),
      triggered_at: raw.triggered_at || new Date().toISOString(),
      status: raw.status || 'open',
      price_record_id: raw.price_record_id || '',
    }
  }

  function migratePriceMonitorAlert(raw) {
    return {
      ...raw,
      url: normalizeExternalUrl(raw?.url),
    }
  }

  function migrateImportedReceipt(raw) {
    return {
      id: raw.id || newId(),
      duplicateKey: raw.duplicateKey || '',
      receiptKey: raw.receiptKey || '',
      establishmentName: raw.establishmentName || '',
      cnpj: raw.cnpj || '',
      purchaseDate: raw.purchaseDate || new Date().toISOString().split('T')[0],
      total: toNumber(raw.total),
      paymentMethod: normalizePaymentMethod(raw.paymentMethod || 'Transferencia'),
      expenseId: raw.expenseId || '',
      itemCount: toNumber(raw.itemCount),
      importedAt: raw.importedAt || new Date().toISOString(),
      source: raw.source || 'receipt_import',
    }
  }

  function addProduct(product, options = {}) {
    const normalized = migrateProduct(product)
    const existing = state.value.products.find((item) => {
      if (normalized.barcode && item.barcode === normalized.barcode) return true
      return item.name.trim().toLowerCase() === normalized.name.trim().toLowerCase()
        && item.brand.trim().toLowerCase() === normalized.brand.trim().toLowerCase()
    })
    if (existing) return existing
    state.value.products.push(normalized)
    if (!options.skipSave) saveState()
    return normalized
  }

  function updateProduct(id, patch) {
    const index = state.value.products.findIndex((item) => item.id === id)
    if (index < 0) return null
    state.value.products[index] = migrateProduct({ ...state.value.products[index], ...patch, id })
    saveState()
    return state.value.products[index]
  }

  function deleteProduct(id) {
    state.value.products = state.value.products.filter((item) => item.id !== id)
    state.value.userTrackedProducts = state.value.userTrackedProducts.filter((item) => item.product_id !== id)
    saveState()
  }

  function addStore(store, options = {}) {
    const normalized = migrateStore(store)
    const existing = state.value.stores.find((item) => item.name.trim().toLowerCase() === normalized.name.trim().toLowerCase())
    if (existing) return existing
    state.value.stores.push(normalized)
    if (!options.skipSave) saveState()
    return normalized
  }

  function findOrCreateStore(name, type = 'manual', options = {}) {
    const storeName = (name || 'Loja informada').trim()
    return addStore({ name: storeName, type }, options)
  }

  function trackProduct(data, options = {}) {
    const existing = state.value.userTrackedProducts.find((item) => item.product_id === data.product_id)
    if (existing) {
      Object.assign(existing, migrateTrackedProduct({ ...existing, ...data, id: existing.id }))
      if (!options.skipSave) saveState()
      return existing
    }
    const tracked = migrateTrackedProduct(data)
    state.value.userTrackedProducts.push(tracked)
    if (!options.skipSave) saveState()
    return tracked
  }

  function addPriceRecord(record, options = {}) {
    const normalized = migratePriceRecord({ ...record, id: newId() })
    if (!normalized.product_id || normalized.price <= 0) return null
    state.value.priceRecords.push(normalized)
    evaluatePriceAlert(normalized)
    if (!options.skipSave) saveState()
    return normalized
  }

  function recordManualPrice(payload) {
    const product = payload.product_id
      ? state.value.products.find((item) => item.id === payload.product_id)
      : addProduct(payload.product || payload)
    if (!product) return null

    const store = payload.store_id
      ? state.value.stores.find((item) => item.id === payload.store_id)
      : findOrCreateStore(payload.storeName || payload.store?.name || 'Compra manual')

    trackProduct({
      product_id: product.id,
      target_price: payload.target_price,
      usual_quantity: payload.usual_quantity || 1,
      purchase_frequency_days: payload.purchase_frequency_days || 30,
      alert_enabled: payload.alert_enabled !== false,
    })

    return addPriceRecord({
      product_id: product.id,
      store_id: store?.id || '',
      price: payload.price,
      unit_price: payload.unit_price,
      quantity: payload.quantity || 1,
      currency: payload.currency || 'BRL',
      source: payload.source || 'manual',
      collected_at: payload.collected_at || new Date().toISOString(),
      product_url: normalizeExternalUrl(payload.product_url),
      availability: payload.availability || 'available',
      notes: payload.notes || '',
    })
  }

  function hasImportedMarketReceipt(draft) {
    const normalized = normalizeReceiptDraft(draft)
    const key = receiptDuplicateKey(normalized)
    return state.value.importedMarketReceipts.some((receipt) => receipt.duplicateKey === key)
  }

  function importMarketReceipt(draft) {
    const normalized = normalizeReceiptDraft(draft)
    const duplicateKey = receiptDuplicateKey(normalized)
    if (state.value.importedMarketReceipts.some((receipt) => receipt.duplicateKey === duplicateKey)) {
      return { ok: false, reason: 'duplicate', duplicateKey }
    }
    const validItems = normalized.items.filter((item) => item.name && Number(item.totalPrice || 0) > 0)
    if (!validItems.length || !normalized.total || normalized.total <= 0) {
      return { ok: false, reason: 'invalid' }
    }

    const store = findOrCreateStore(
      normalized.establishmentName || 'Mercado importado',
      'receipt_import',
      { skipSave: true },
    )
    const expense = addExpense({
      date: normalized.purchaseDate,
      category: 'Mercado',
      description: normalized.establishmentName || 'Compra de mercado importada',
      payment: normalized.paymentMethod,
      amount: normalized.total,
      paid: normalized.paymentMethod !== 'Crédito' && normalized.paymentMethod !== 'Boleto',
      ocrProvider: normalized.sourceDocument || 'receipt_import',
      ocrConfidence: normalized.confidence,
      ocrDate: new Date().toISOString().split('T')[0],
      ocrTipoDocumento: 'Cupom fiscal/NFC-e',
      ocrObservacoes: `Importação com ${validItems.length} itens`,
    }, { skipSave: true })

    const records = validItems.map((item) => {
      const existing = findMatchingProduct(state.value.products, item)
      const product = existing || addProduct({
        name: item.name,
        brand: '',
        category: item.category || 'Mercado',
        barcode: item.barcode,
        default_unit: item.unit || 'un',
      }, { skipSave: true })

      trackProduct({
        product_id: product.id,
        usual_quantity: item.quantity || 1,
        purchase_frequency_days: 30,
        alert_enabled: true,
      }, { skipSave: true })

      return addPriceRecord({
        product_id: product.id,
        store_id: store?.id || '',
        price: item.totalPrice,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        currency: 'BRL',
        source: 'receipt_import',
        collected_at: new Date(`${normalized.purchaseDate}T12:00:00`).toISOString(),
        availability: 'purchased',
        notes: normalized.receiptKey ? `NFC-e ${normalized.receiptKey}` : 'Cupom importado',
      }, { skipSave: true })
    }).filter(Boolean)

    if (records.length !== validItems.length) {
      return { ok: false, reason: 'invalid_records' }
    }

    const imported = migrateImportedReceipt({
      duplicateKey,
      receiptKey: normalized.receiptKey,
      establishmentName: normalized.establishmentName,
      cnpj: normalized.cnpj,
      purchaseDate: normalized.purchaseDate,
      total: normalized.total,
      paymentMethod: normalized.paymentMethod,
      expenseId: expense.id,
      itemCount: records.length,
      source: 'receipt_import',
    })
    state.value.importedMarketReceipts.push(imported)
    saveState()
    syncFinancialEventProjection(state.value.family?.id, {
      eventType: 'market_receipt_imported',
      sourceType: 'receipt_import',
      sourceId: imported.id,
      dedupeKey: duplicateKey,
      occurredAt: new Date(`${normalized.purchaseDate}T12:00:00`).toISOString(),
      amount: normalized.total,
      currency: 'BRL',
      description: normalized.establishmentName || 'Compra de mercado importada',
      category: 'Mercado',
      counterparty: normalized.establishmentName || null,
      payload: {
        receiptKey: normalized.receiptKey,
        cnpj: normalized.cnpj,
        paymentMethod: normalized.paymentMethod,
        itemCount: records.length,
        expenseId: expense.id,
      },
    }).catch((error) => {
      console.warn('[financial-events] Projeção normalizada não sincronizada:', error.message)
    })
    return { ok: true, expense, records, receipt: imported }
  }

  function evaluatePriceAlert(record) {
    const tracked = state.value.userTrackedProducts.find((item) => item.product_id === record.product_id)
    if (!tracked?.alert_enabled || !tracked.target_price) return null
    if (record.price > Number(tracked.target_price)) return null
    const alert = migratePriceAlert({
      product_id: record.product_id,
      target_price: tracked.target_price,
      price_record_id: record.id,
      condition_type: 'below_target',
      status: 'open',
    })
    state.value.priceAlerts.push(alert)
    return alert
  }

  function updateTrackedProduct(productId, patch) {
    const item = state.value.userTrackedProducts.find((tracked) => tracked.product_id === productId)
    if (!item) return trackProduct({ ...patch, product_id: productId })
    Object.assign(item, migrateTrackedProduct({ ...item, ...patch, id: item.id }))
    saveState()
    return item
  }

  function resolveProductPriceStats(productId) {
    const product = state.value.products.find((item) => item.id === productId)
    if (!product) return null
    const tracked = state.value.userTrackedProducts.find((item) => item.product_id === productId)
    return buildPriceStats(product, state.value.priceRecords, tracked)
  }

  function monitoredProducts() {
    return state.value.products.map((product) => {
      const tracked = state.value.userTrackedProducts.find((item) => item.product_id === product.id)
      return {
        product,
        tracked,
        stats: buildPriceStats(product, state.value.priceRecords, tracked),
      }
    })
  }

  function sanitizeWishlistOffer(offer) {
    if (!offer || typeof offer !== 'object') return offer || null
    return {
      ...offer,
      url: firstSafeExternalUrl(offer.url, offer.link, offer.productUrl, offer.product_url),
      link: normalizeExternalUrl(offer.link),
      productUrl: normalizeExternalUrl(offer.productUrl),
      product_url: normalizeExternalUrl(offer.product_url),
      imageUrl: normalizeImageUrl(offer.imageUrl || offer.image_url),
      image_url: normalizeImageUrl(offer.image_url || offer.imageUrl),
      image: normalizeImageUrl(offer.image),
      offers: Array.isArray(offer.offers) ? offer.offers.map(sanitizeWishlistOffer).filter(Boolean) : [],
    }
  }

  function sanitizeWishlistSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot || null
    return {
      ...snapshot,
      url: firstSafeExternalUrl(snapshot.url, snapshot.link, snapshot.productUrl, snapshot.product_url),
      link: normalizeExternalUrl(snapshot.link),
      productUrl: normalizeExternalUrl(snapshot.productUrl),
      product_url: normalizeExternalUrl(snapshot.product_url),
      imageUrl: normalizeImageUrl(snapshot.imageUrl || snapshot.image_url),
      image_url: normalizeImageUrl(snapshot.image_url || snapshot.imageUrl),
      image: normalizeImageUrl(snapshot.image),
      offers: Array.isArray(snapshot.offers) ? snapshot.offers.map(sanitizeWishlistOffer).filter(Boolean) : [],
    }
  }

  function migrateWishlistItem(raw) {
    const rawIdentity = raw.product_identity || raw.productIdentity || null
    const requiresCompatibility = requiresCompatiblePrice(raw)
    const compatibleReady = !requiresCompatibility || hasCompatiblePrice(raw)
    const originalLink = firstSafeExternalUrl(raw.originalLink, raw.originalUrl, raw.original_url)
    const originalUrl = firstSafeExternalUrl(raw.originalUrl, raw.original_url, raw.originalLink)
    const canonicalUrl = firstSafeExternalUrl(raw.canonicalUrl, raw.canonical_url, raw.originalLink, raw.originalUrl, raw.original_url)
    const validPriceHistory = (Array.isArray(raw.priceHistory) ? raw.priceHistory : [])
      .filter((entry) => !requiresCompatibility || isAcceptedCompatibleOffer(entry))
      .map(sanitizeWishlistSnapshot)
    const validMarketplaceOffers = (Array.isArray(raw.marketplaceOffers) ? raw.marketplaceOffers : [])
      .filter((offer) => !requiresCompatibility || isAcceptedCompatibleOffer(offer))
      .map(sanitizeWishlistOffer)
    return {
      id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
      name: raw.name || '',
      value: compatibleReady && raw.value != null && raw.value !== '' ? Number(raw.value || 0) : null,
      description: raw.description || '',
      category: normalizeExpenseCategory(raw.category),
      priority: raw.priority || 'Média',
      desiredDate: raw.desiredDate || '',
      notes: raw.notes || '',
      imageUrl: normalizeImageUrl(raw.imageUrl || raw.image_url),
      originalLink,
      originalUrl,
      canonicalUrl,
      original_url: originalUrl,
      canonical_url: canonicalUrl,
      brand: raw.brand || '',
      model: raw.model || '',
      attributes: raw.attributes && typeof raw.attributes === 'object' ? { ...raw.attributes } : {},
      marketplace: raw.marketplace || '',
      marketplaceItemId: raw.marketplaceItemId || raw.marketplace_item_id || '',
      marketplace_item_id: raw.marketplaceItemId || raw.marketplace_item_id || '',
      product_identity_id: raw.product_identity_id || raw.productIdentityId || '',
      source: raw.source || '',
      source_product_id: raw.source_product_id || raw.sourceProductId || '',
      id_type: raw.id_type || raw.idType || '',
      identity_locked: Boolean(raw.identity_locked || raw.identityLocked),
      identity_status: raw.identity_status || raw.identityStatus || (raw.identity_locked ? 'confirmed' : 'pending'),
      identity_source: raw.identity_source || raw.identitySource || '',
      origin_label: raw.origin_label || raw.originLabel || '',
      removedUrlParams: Array.isArray(raw.removedUrlParams) ? raw.removedUrlParams : [],
      hasVariation: Boolean(raw.hasVariation),
      manualPrice: Boolean(raw.manualPrice),
      manualPriceUpdatedAt: raw.manualPriceUpdatedAt || '',
      monitorPrice: raw.monitorPrice !== false,
      targetPrice: raw.targetPrice == null || raw.targetPrice === '' ? null : Number(raw.targetPrice),
      priceMonitorCheckedAt: raw.priceMonitorCheckedAt || '',
      priceMonitorDiagnostics: Array.isArray(raw.priceMonitorDiagnostics) ? raw.priceMonitorDiagnostics : [],
      lastQuotedPrice: compatibleReady ? Number(raw.lastQuotedPrice || 0) : 0,
      priceHistory: validPriceHistory,
      marketplaceOffers: validMarketplaceOffers,
      alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [],
      priceMode: raw.priceMode || '',
      priceStatus: compatibleReady ? raw.priceStatus || 'pending_quote' : 'pending_quote',
      priceDiagnostics: Array.isArray(raw.priceDiagnostics) ? raw.priceDiagnostics : [],
      priceSummary: raw.priceSummary || null,
      sourcesUsed: Array.isArray(raw.sourcesUsed) ? raw.sourcesUsed : [],
      priceFetchedAt: raw.priceFetchedAt || '',
      purchaseMotivation: raw.purchaseMotivation || '',
      product_identity: rawIdentity && typeof rawIdentity === 'object' ? { ...rawIdentity } : null,
      price_search_status: raw.price_search_status || raw.priceSearchStatus || 'quote_pending',
      last_match_score: Number(raw.last_match_score || raw.lastMatchScore || 0),
      last_match_reason: raw.last_match_reason || raw.lastMatchReason || '',
      best_compatible_offer: compatibleReady ? sanitizeWishlistOffer(raw.best_compatible_offer || raw.bestCompatibleOffer) : null,
      accepted_candidates: Array.isArray(raw.accepted_candidates)
        ? raw.accepted_candidates.filter((offer) => !requiresCompatibility || isAcceptedCompatibleOffer(offer)).map(sanitizeWishlistOffer)
        : Array.isArray(raw.acceptedCandidates)
          ? raw.acceptedCandidates.filter((offer) => !requiresCompatibility || isAcceptedCompatibleOffer(offer)).map(sanitizeWishlistOffer)
          : [],
      ambiguous_candidates: Array.isArray(raw.ambiguous_candidates)
        ? raw.ambiguous_candidates.map(sanitizeWishlistOffer)
        : Array.isArray(raw.ambiguousCandidates)
          ? raw.ambiguousCandidates.map(sanitizeWishlistOffer)
          : [],
      last_rejected_candidates: Array.isArray(raw.last_rejected_candidates)
        ? raw.last_rejected_candidates.map(sanitizeWishlistOffer)
        : Array.isArray(raw.lastRejectedCandidates)
          ? raw.lastRejectedCandidates.map(sanitizeWishlistOffer)
          : [],
      created_at: raw.created_at || new Date().toISOString(),
    }
  }

  function addWishlistItem(item) {
    requireActiveUser()
    const newItem = migrateWishlistItem({
      ...item,
      id: item.id || crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
    })
    state.value.wishlist.push(newItem)
    saveState()
    syncPurchaseProjection(state.value.family?.id, newItem).catch((error) => {
      console.warn('[purchases] Item remoto não sincronizado:', error.message)
    })
    return newItem
  }

  function updateWishlistItem(id, patch) {
    requireActiveUser()
    const index = state.value.wishlist.findIndex((w) => w.id === id)
    if (index < 0) return null
    state.value.wishlist[index] = migrateWishlistItem({
      ...state.value.wishlist[index],
      ...patch,
    })
    saveState()
    syncPurchaseProjection(state.value.family?.id, state.value.wishlist[index]).catch((error) => {
      console.warn('[purchases] Item remoto não atualizado:', error.message)
    })
    return state.value.wishlist[index]
  }

  function addPriceSnapshot(wishId, snapshot) {
    requireActiveUser()
    const item = state.value.wishlist.find((w) => w.id === wishId)
    if (!item) return
    const requiresCompatibility = requiresCompatiblePrice(item)
    if (requiresCompatibility && snapshot.compatibility_status !== 'accepted') return
    const matchScore = Number(snapshot.match_score || snapshot.matchScore || 0)
    if (requiresCompatibility && matchScore < 0.85) return
    const total = Number(snapshot.total || snapshot.price || 0)
    if (!Number.isFinite(total) || total <= 0) return
    const validOffers = (Array.isArray(snapshot.offers) ? snapshot.offers : [])
      .filter((offer) => Number(offer.total || offer.totalPrice || offer.price || 0) > 0)
      .filter((offer) => !requiresCompatibility || isAcceptedCompatibleOffer(offer))
      .sort((a, b) => Number(a.total || a.totalPrice || a.price) - Number(b.total || b.totalPrice || b.price))
      .slice(0, 3)
    const entry = {
      at: new Date().toISOString(),
      price: Number(snapshot.price || 0),
      total,
      marketplace: snapshot.marketplace || '',
      source: snapshot.source || (item.priceMode === 'live' ? 'live' : 'estimated'),
      title: snapshot.title || '',
      url: firstSafeExternalUrl(snapshot.url, snapshot.link, snapshot.productUrl, snapshot.product_url),
      match_score: requiresCompatibility ? matchScore : Number(snapshot.match_score || snapshot.matchScore || 0),
      match_reason: snapshot.match_reason || snapshot.matchReason || '',
      compatibility_status: requiresCompatibility ? 'accepted' : snapshot.compatibility_status || '',
      offers: validOffers
        .map((offer) => ({
          marketplace: offer.marketplace || offer.source || '',
          title: offer.title || '',
          price: Number(offer.price || 0),
          shipping: Number(offer.shipping || 0),
          total: Number(offer.total || offer.totalPrice || offer.price || 0),
          url: firstSafeExternalUrl(offer.url, offer.link, offer.productUrl, offer.product_url),
          match_score: Number(offer.match_score || offer.match?.score || 0),
          match_reason: offer.match_reason || offer.match?.reason || '',
          compatibility_status: offer.compatibility_status || (requiresCompatibility ? 'accepted' : ''),
        })),
    }
    item.priceHistory = [...(item.priceHistory || []), entry].slice(-30)
    item.lastQuotedPrice = entry.total
    saveState()
    syncPurchasePriceProjection(state.value.family?.id, item, entry).catch((error) => {
      console.warn('[purchases] Histórico remoto não sincronizado:', error.message)
    })
  }

  function togglePriceMonitor(wishId, enabled) {
    return updateWishlistItem(wishId, { monitorPrice: enabled })
  }

  function setWishlistPriceMonitor(wishId, enabled, targetPrice = null) {
    const normalizedTarget = Number(targetPrice || 0)
    return updateWishlistItem(wishId, {
      monitorPrice: enabled,
      targetPrice: normalizedTarget > 0 ? normalizedTarget : null,
    })
  }

  function dismissPriceMonitorAlert(alertId) {
    const alert = state.value.priceMonitorAlerts.find((item) => item.id === alertId)
    if (!alert) return null
    alert.status = 'dismissed'
    alert.dismissedAt = new Date().toISOString()
    saveState()
    return alert
  }

  function deleteWishlistItem(id) {
    requireActiveUser()
    state.value.wishlist = state.value.wishlist.filter((item) => item.id !== id)
    saveState()
    deletePurchaseProjection(state.value.family?.id, id).catch((error) => {
      console.warn('[purchases] Exclusão remota não sincronizada:', error.message)
    })
  }

  function addPriorityItem(item) {
    const newItem = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
      name: item.name,
      targetAmount: Number(item.targetAmount),
      priorityOrder: Number(item.priorityOrder),
      created_at: new Date().toISOString(),
    }
    state.value.priorityQueue.push(newItem)
    state.value.priorityQueue.sort((a, b) => a.priorityOrder - b.priorityOrder)
    saveState()
  }

  function deletePriorityItem(id) {
    state.value.priorityQueue = state.value.priorityQueue.filter((item) => item.id !== id)
    saveState()
  }

  function addFinancialAccount(data) {
    const account = {
      id: newId(),
      name: data.name,
      type: data.type,
      bank: data.bank || '',
      balance: Number(data.balance || 0),
      currency: 'BRL',
      openFinance: createOpenFinanceFields(data.openFinance),
      created_at: new Date().toISOString(),
    }
    state.value.financialAccounts.push(account)
    saveState()
    return account
  }

  function updateFinancialAccount(id, patch) {
    const i = state.value.financialAccounts.findIndex((a) => a.id === id)
    if (i < 0) return null
    state.value.financialAccounts[i] = { ...state.value.financialAccounts[i], ...patch }
    saveState()
    return state.value.financialAccounts[i]
  }

  function deleteFinancialAccount(id) {
    state.value.financialAccounts = state.value.financialAccounts.filter((a) => a.id !== id)
    saveState()
  }

  function addCreditCard(data) {
    const holder = state.value.familyMembers.find((m) => m.id === data.holderMemberId)
    const card = {
      id: newId(),
      name: data.name,
      bank: data.bank || '',
      brand: data.brand || 'Visa',
      limit: Number(data.limit || 0),
      availableLimit: Number(data.limit || 0),
      closingDay: Number(data.closingDay || 1),
      dueDay: Number(data.dueDay || 10),
      holderMemberId: data.holderMemberId || state.value.familyMembers[0]?.id,
      color: data.color || '#6366f1',
      active: data.active !== false,
      linkedAccountId: data.linkedAccountId || '',
      notes: data.notes || '',
      additionalHolders: data.additionalHolders || (holder
        ? [{ memberId: holder.id, name: holder.name, role: 'Titular' }]
        : []),
      isFamilyCard: Boolean(data.isFamilyCard),
      openFinance: createOpenFinanceFields(data.openFinance),
      created_at: new Date().toISOString(),
    }
    state.value.creditCards.push(card)
    syncLegacySettingsFromStructure()
    saveState()
    return card
  }

  function updateCreditCard(id, patch) {
    const i = state.value.creditCards.findIndex((c) => c.id === id)
    if (i < 0) return null
    state.value.creditCards[i] = { ...state.value.creditCards[i], ...patch }
    syncLegacySettingsFromStructure()
    saveState()
    return state.value.creditCards[i]
  }

  function deleteCreditCard(id) {
    state.value.creditCards = state.value.creditCards.filter((c) => c.id !== id)
    saveState()
  }

  function addBenefitWallet(data) {
    const wallet = {
      id: newId(),
      name: data.name,
      provider: data.provider || 'Outro',
      kind: data.kind,
      corporateType: data.corporateType || '',
      balance: Number(data.balance || 0),
      openingBalance: Number(data.balance || 0),
      monthlyRecharge: Number(data.monthlyRecharge || 0),
      rechargeDay: Number(data.rechargeDay || 1),
      memberId: data.memberId || state.value.familyMembers[0]?.id,
      openFinance: createOpenFinanceFields(data.openFinance),
      created_at: new Date().toISOString(),
    }
    state.value.benefitWallets.push(wallet)
    syncLegacySettingsFromStructure()
    saveState()
    syncBenefitAccountProjection(state.value.family?.id, wallet).then(() => {
      if (wallet.openingBalance <= 0) return null
      return syncBenefitTransactionProjection(state.value.family?.id, wallet, {
        id: `opening:${wallet.id}`,
        type: 'credit',
        amount: wallet.openingBalance,
        description: 'Saldo inicial',
        occurredAt: wallet.created_at,
      })
    }).catch((error) => console.warn('[benefits] Conta remota não sincronizada:', error.message))
    return wallet
  }

  function updateBenefitWallet(id, patch) {
    const i = state.value.benefitWallets.findIndex((b) => b.id === id)
    if (i < 0) return null
    state.value.benefitWallets[i] = {
      ...state.value.benefitWallets[i],
      ...patch,
      openingBalance: state.value.benefitWallets[i].openingBalance ?? state.value.benefitWallets[i].balance ?? 0,
    }
    syncLegacySettingsFromStructure()
    saveState()
    syncBenefitAccountProjection(state.value.family?.id, state.value.benefitWallets[i]).catch((error) => {
      console.warn('[benefits] Conta remota não atualizada:', error.message)
    })
    return state.value.benefitWallets[i]
  }

  function deleteBenefitWallet(id) {
    state.value.benefitWallets = state.value.benefitWallets.filter((b) => b.id !== id)
    saveState()
    deleteBenefitAccountProjection(state.value.family?.id, id).catch((error) => {
      console.warn('[benefits] Exclusão remota não sincronizada:', error.message)
    })
  }

  function updateFamily(patch) {
    state.value.family = { ...state.value.family, ...patch }
    if (patch.name) state.value.settings.familyName = patch.name
    saveState()
  }

  function setCurrentMember(memberId) {
    state.value.settings.currentMemberId = memberId
    saveState()
  }

  function addFamilyMember(data) {
    const member = {
      id: newId(),
      name: data.name,
      role: data.role || FAMILY_ROLES.MEMBER,
      email: data.email || '',
    }
    state.value.familyMembers.push(member)
    appendAudit({ action: 'created', entityType: 'member', entityId: member.id, details: member.name })
    saveState()
    return member
  }

  function updateFamilyMember(id, patch) {
    const i = state.value.familyMembers.findIndex((m) => m.id === id)
    if (i < 0) return null
    state.value.familyMembers[i] = { ...state.value.familyMembers[i], ...patch }
    appendAudit({ action: 'updated', entityType: 'member', entityId: id, details: JSON.stringify(patch) })
    saveState()
    return state.value.familyMembers[i]
  }

  function deleteFamilyMember(id) {
    if (state.value.familyMembers.length <= 1) return
    if (state.value.family?.adminMemberId === id) return
    state.value.familyMembers = state.value.familyMembers.filter((m) => m.id !== id)
    appendAudit({ action: 'deleted', entityType: 'member', entityId: id, details: 'Membro removido' })
    saveState()
  }

  function createFamilyInvite(data) {
    const token = newId()
    const invite = {
      id: newId(),
      email: data.email || '',
      token,
      status: 'Pendente',
      method: data.method || 'link',
      invitedByMemberId: getCurrentMember()?.id,
      createdAt: new Date().toISOString(),
    }
    state.value.familyInvites.push(invite)
    appendAudit({ action: 'invited', entityType: 'invite', entityId: invite.id, details: invite.email || 'link' })
    saveState()
    return invite
  }

  function respondInvite(token, status) {
    const invite = state.value.familyInvites.find((i) => i.token === token)
    if (!invite) return null
    invite.status = status
    if (status === 'Aceito' && invite.email) {
      addFamilyMember({ name: invite.email.split('@')[0], email: invite.email, role: FAMILY_ROLES.MEMBER })
    }
    saveState()
    return invite
  }

  function addSharedDebt(data) {
    const debt = {
      id: newId(),
      name: data.name,
      type: data.type || 'Outro',
      balance: Number(data.balance || 0),
      monthlyPayment: Number(data.monthlyPayment || 0),
      splitMode: data.splitMode || SPLIT_MODES.PERCENT,
      splits: data.splits || [],
      createdAt: new Date().toISOString(),
    }
    if (debt.splits.length === 0) {
      const pct = 100 / Math.max(1, state.value.familyMembers.length)
      debt.splits = state.value.familyMembers.map((m) => ({ memberId: m.id, percent: pct }))
    }
    state.value.sharedDebts.push(debt)
    appendAudit({ action: 'created', entityType: 'shared_debt', entityId: debt.id, details: debt.name })
    saveState()
    return debt
  }

  function deleteSharedDebt(id) {
    state.value.sharedDebts = state.value.sharedDebts.filter((d) => d.id !== id)
    saveState()
  }

  function addSharedGoal(data) {
    const goal = {
      id: newId(),
      name: data.name,
      targetAmount: Number(data.targetAmount || 0),
      currentAmount: Number(data.currentAmount || 0),
      monthsRemaining: Number(data.monthsRemaining || 12),
      contributions: data.contributions || [],
      splitMode: data.splitMode || SPLIT_MODES.PERCENT,
      splits: data.splits || [],
      createdAt: new Date().toISOString(),
    }
    state.value.sharedGoals.push(goal)
    appendAudit({ action: 'created', entityType: 'shared_goal', entityId: goal.id, details: goal.name })
    saveState()
    return goal
  }

  function contributeToGoal(goalId, memberId, amount) {
    const goal = state.value.sharedGoals.find((g) => g.id === goalId)
    if (!goal) return null
    goal.currentAmount = Number(goal.currentAmount || 0) + Number(amount)
    goal.contributions = [...(goal.contributions || []), { memberId, amount: Number(amount), at: new Date().toISOString() }]
    appendAudit({ action: 'paid', entityType: 'shared_goal', entityId: goalId, details: `Contribuição ${amount}` })
    saveState()
    return goal
  }

  function deleteSharedGoal(id) {
    state.value.sharedGoals = state.value.sharedGoals.filter((g) => g.id !== id)
    saveState()
  }

  function addPlanningGoal(data) {
    const goal = sanitizePlanningGoal(data)
    state.value.planningGoals.push(goal)
    appendAudit({ action: 'created', entityType: 'planning_goal', entityId: goal.id, details: goal.name })
    saveState()
    return goal
  }

  function updatePlanningGoal(id, patch) {
    const index = state.value.planningGoals.findIndex((goal) => goal.id === id)
    if (index < 0) return null
    state.value.planningGoals[index] = sanitizePlanningGoal({ ...state.value.planningGoals[index], ...patch, id })
    saveState()
    return state.value.planningGoals[index]
  }

  function deletePlanningGoal(id) {
    state.value.planningGoals = state.value.planningGoals.filter((goal) => goal.id !== id)
    saveState()
  }

  function upsertCategoryBudget(data) {
    const budget = sanitizeCategoryBudget(data, state.value)
    const index = state.value.categoryBudgets.findIndex((item) => (
      item.month_key === budget.month_key && item.category === budget.category
    ))
    if (index >= 0) state.value.categoryBudgets[index] = { ...state.value.categoryBudgets[index], ...budget }
    else state.value.categoryBudgets.push(budget)
    saveState()
    return index >= 0 ? state.value.categoryBudgets[index] : budget
  }

  function deleteCategoryBudget(id) {
    state.value.categoryBudgets = state.value.categoryBudgets.filter((budget) => budget.id !== id)
    saveState()
  }

  function addSettlement(data) {
    const settlement = {
      id: newId(),
      fromMemberId: data.fromMemberId,
      toMemberId: data.toMemberId,
      amount: Number(data.amount),
      method: data.method || 'Pix',
      date: data.date || new Date().toISOString().split('T')[0],
      note: data.note || '',
      createdByMemberId: getCurrentMember()?.id,
      createdAt: new Date().toISOString(),
    }
    state.value.settlements.push(settlement)
    appendAudit({
      action: 'settled',
      entityType: 'settlement',
      entityId: settlement.id,
      details: `${memberName(settlement.fromMemberId)} → ${memberName(settlement.toMemberId)}: ${settlement.amount}`,
    })
    saveState()
    return settlement
  }

  function updateCreditCardFamily(id, patch) {
    return updateCreditCard(id, patch)
  }

  function addRecurringIncome(data) {
    const item = {
      id: newId(),
      type: data.type,
      amount: Number(data.amount),
      frequency: data.frequency || 'Mensal',
      dayOfMonth: Number(data.dayOfMonth || 1),
      memberId: data.memberId || state.value.familyMembers[0]?.id,
      sourceAccountId: data.sourceAccountId || state.value.financialAccounts[0]?.id,
      sourceType: data.sourceType || SOURCE_TYPES.ACCOUNT,
      description: data.description || '',
      active: data.active !== false,
      lastGeneratedAt: null,
      created_at: new Date().toISOString(),
    }
    state.value.recurringIncomes.push(item)
    saveState()
    return item
  }

  function deleteRecurringIncome(id) {
    state.value.recurringIncomes = state.value.recurringIncomes.filter((r) => r.id !== id)
    saveState()
  }

  function addSubscription(data) {
    const item = sanitizeSubscription({
      ...data,
      user_id: data.user_id || activeUserId.value,
    })
    state.value.subscriptions = [...(state.value.subscriptions || []), item]
    appendAudit({
      action: 'created',
      entityType: 'subscription',
      entityId: item.id,
      details: `${item.name} - ${item.amount}`,
    })
    saveState()
    return item
  }

  function updateSubscription(id, patch) {
    const index = (state.value.subscriptions || []).findIndex((item) => item.id === id)
    if (index < 0) return null
    const next = sanitizeSubscription({
      ...state.value.subscriptions[index],
      ...patch,
      id,
      updated_at: new Date().toISOString(),
    })
    state.value.subscriptions[index] = next
    appendAudit({
      action: 'updated',
      entityType: 'subscription',
      entityId: id,
      details: next.name,
    })
    saveState()
    return next
  }

  function pauseSubscription(id) {
    const current = (state.value.subscriptions || []).find((item) => item.id === id)
    if (!current) return null
    const paused = pauseSubscriptionRecord(current)
    return updateSubscription(id, paused)
  }

  function cancelSubscription(id, endedAt = new Date().toISOString().split('T')[0]) {
    const current = (state.value.subscriptions || []).find((item) => item.id === id)
    if (!current) return null
    const cancelled = cancelSubscriptionRecord(current, endedAt)
    return updateSubscription(id, cancelled)
  }

  function softDeleteSubscription(id) {
    const current = (state.value.subscriptions || []).find((item) => item.id === id)
    if (!current) return null
    const deleted = softDeleteSubscriptionRecord(current)
    return updateSubscription(id, deleted)
  }

  function addSubscriptionCharge(data) {
    const charge = sanitizeSubscriptionCharge(data)
    state.value.subscriptionCharges = [...(state.value.subscriptionCharges || []), charge]
    saveState()
    return charge
  }

  function reconcileExpenseWithSubscription(expense) {
    const result = reconcileSubscriptionCharge(
      state.value.subscriptions || [],
      expense,
      expense.date || new Date().toISOString().split('T')[0],
      state.value.subscriptionCharges || [],
    )
    if (!result.reconciled) return result

    const index = state.value.subscriptions.findIndex((item) => item.id === result.subscriptionId)
    if (index >= 0) state.value.subscriptions[index] = result.subscription

    const exists = state.value.subscriptionCharges.some((charge) => (
      charge.subscription_id === result.charge.subscription_id
      && charge.transaction_id === result.charge.transaction_id
    ))
    if (!exists) {
      state.value.subscriptionCharges = [...(state.value.subscriptionCharges || []), result.charge]
    }
    return result
  }

  function linkExpenseToSubscription(expense, subscriptionId) {
    const subscription = (state.value.subscriptions || []).find((item) => item.id === subscriptionId)
    if (!subscription) return { reconciled: false, subscriptionId: null, charge: null }

    const charge = sanitizeSubscriptionCharge({
      subscription_id: subscription.id,
      transaction_id: expense.id,
      charged_at: expense.date,
      amount: expense.amount,
      status: 'paid',
    })
    let nextDate = subscription.next_billing_date
    let guard = 0
    while (new Date(`${nextDate}T12:00:00`) <= new Date(`${expense.date}T12:00:00`) && guard < 36) {
      nextDate = advanceBillingDate(nextDate, subscription)
      guard += 1
    }
    const index = state.value.subscriptions.findIndex((item) => item.id === subscription.id)
    if (index >= 0) {
      state.value.subscriptions[index] = {
        ...subscription,
        next_billing_date: nextDate,
        updated_at: new Date().toISOString(),
      }
    }
    const exists = state.value.subscriptionCharges.some((item) => (
      item.subscription_id === charge.subscription_id && item.transaction_id === charge.transaction_id
    ))
    if (!exists) state.value.subscriptionCharges = [...(state.value.subscriptionCharges || []), charge]
    return { reconciled: true, subscriptionId: subscription.id, charge }
  }

  function suggestSubscriptionForExpense(expense) {
    return suggestSubscriptionFromExpense(state.value, expense)
  }

  function statementImportSource(options = {}) {
    const sourceType = options.sourceType || SOURCE_TYPES.ACCOUNT
    const fallbackSourceId = sourceType === SOURCE_TYPES.CREDIT_CARD
      ? state.value.creditCards[0]?.id
      : state.value.financialAccounts[0]?.id
    return {
      sourceType,
      sourceId: options.sourceId || fallbackSourceId || '',
      payment: normalizePaymentMethod(options.payment || (sourceType === SOURCE_TYPES.CREDIT_CARD ? 'Crédito' : 'Transferência')),
    }
  }

  function buildStatementImportPreview(rows = [], options = {}) {
    const source = statementImportSource(options)
    const memberId = options.familyMemberId || getCurrentMember()?.id || state.value.familyMembers[0]?.id || ''
    return buildStatementImportPreviewDomain(state.value, rows, {
      ...options,
      ...source,
      familyMemberId: memberId,
    })
  }

  function captureSubscriptionSnapshot(session, subscriptionId) {
    if (!subscriptionId) return
    if (session.subscriptionSnapshots.some((item) => item.id === subscriptionId)) return
    const subscription = (state.value.subscriptions || []).find((item) => item.id === subscriptionId)
    if (!subscription) return
    session.subscriptionSnapshots.push({
      id: subscription.id,
      next_billing_date: subscription.next_billing_date,
      updated_at: subscription.updated_at,
    })
  }

  function confirmStatementImportPreview(preview, options = {}) {
    if (!preview?.items?.length) return null

    const source = statementImportSource({
      sourceType: options.sourceType || preview.sourceType,
      sourceId: options.sourceId || preview.sourceId,
      payment: options.payment || preview.payment,
    })
    const memberId = options.familyMemberId || preview.familyMemberId || getCurrentMember()?.id || state.value.familyMembers[0]?.id || ''
    const session = {
      id: newId(),
      type: 'statement_import',
      status: 'confirmed',
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      payment: source.payment,
      summary: preview.summary || {},
      createdEntries: [],
      skippedRows: [],
      reconciledCharges: [],
      subscriptionSnapshots: [],
      created_at: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      rolledBackAt: null,
    }

    preview.items.forEach((item) => {
      if (!['create', 'reconcile'].includes(item.action)) {
        session.skippedRows.push({
          id: item.id,
          action: item.action,
          reason: item.reason,
          duplicateOf: item.duplicateOf || null,
        })
        return
      }

      if (item.kind === 'income') {
        const income = addIncome({
          date: item.date,
          type: item.suggestedType || 'Outros',
          description: item.description,
          amount: item.amount,
          sourceType: item.sourceType || source.sourceType,
          sourceId: item.sourceId || source.sourceId,
          familyMemberId: memberId,
          ownerMemberId: memberId,
          importSessionId: session.id,
        }, { skipSave: true })
        session.createdEntries.push({ kind: 'income', id: income.id, amount: income.amount })
        return
      }

      if (item.action === 'reconcile') captureSubscriptionSnapshot(session, item.subscriptionId)
      const expenseSourceType = item.sourceType || source.sourceType
      const expenseSourceId = item.sourceId || source.sourceId
      const expense = addExpense({
        date: item.date,
        category: item.suggestedCategory || 'Outros',
        description: item.description,
        payment: item.payment || source.payment,
        amount: item.amount,
        paid: expenseSourceType !== SOURCE_TYPES.CREDIT_CARD,
        sourceType: expenseSourceType,
        sourceId: expenseSourceId,
        creditCardId: expenseSourceType === SOURCE_TYPES.CREDIT_CARD ? expenseSourceId : null,
        familyMemberId: memberId,
        responsibleMemberId: memberId,
        paidByMemberId: memberId,
        subscriptionId: item.action === 'reconcile' ? item.subscriptionId : null,
        importSessionId: session.id,
      }, { skipSave: true })

      session.createdEntries.push({
        kind: 'expense',
        id: expense.id,
        amount: expense.amount,
        subscriptionId: expense.subscriptionId || null,
        subscriptionChargeId: expense.subscriptionChargeId || null,
      })
      if (expense.subscriptionChargeId) {
        session.reconciledCharges.push({
          id: expense.subscriptionChargeId,
          subscriptionId: expense.subscriptionId,
          transactionId: expense.id,
        })
      }
    })

    state.value.importSessions = [session, ...(state.value.importSessions || [])]
    appendAudit({
      action: 'imported',
      entityType: 'statement_import',
      entityId: session.id,
      details: `${session.createdEntries.length} lançamentos criados; ${session.skippedRows.length} ignorados`,
    })
    saveState()
    return session
  }

  function restoreEntrySource(entry, kind) {
    if (!entry) return
    if (kind === 'income') {
      applySourceDelta(entry.sourceType || SOURCE_TYPES.ACCOUNT, entry.sourceId, -Number(entry.amount || 0))
      return
    }
    if (entry.paid && entry.sourceType !== SOURCE_TYPES.CREDIT_CARD) {
      applySourceDelta(entry.sourceType || SOURCE_TYPES.ACCOUNT, entry.sourceId, Number(entry.amount || 0))
    }
  }

  function rollbackImportSession(sessionId) {
    const index = (state.value.importSessions || []).findIndex((item) => item.id === sessionId)
    if (index < 0) return false
    const session = state.value.importSessions[index]
    if (session.status === 'rolled_back') return false

    const chargeIds = new Set((session.reconciledCharges || []).map((item) => item.id).filter(Boolean))
    const transactionIds = new Set((session.createdEntries || []).map((item) => item.id).filter(Boolean))

    ;[...(session.createdEntries || [])].reverse().forEach((entryRef) => {
      if (entryRef.kind === 'income') {
        const income = state.value.incomes.find((item) => item.id === entryRef.id)
        restoreEntrySource(income, 'income')
        state.value.incomes = state.value.incomes.filter((item) => item.id !== entryRef.id)
        return
      }

      const expense = state.value.expenses.find((item) => item.id === entryRef.id)
      restoreEntrySource(expense, 'expense')
      if (expense?.subscriptionChargeId) chargeIds.add(expense.subscriptionChargeId)
      state.value.expenses = state.value.expenses.filter((item) => item.id !== entryRef.id)
    })

    state.value.subscriptionCharges = (state.value.subscriptionCharges || []).filter((charge) => (
      !chargeIds.has(charge.id) && !transactionIds.has(charge.transaction_id)
    ))

    ;(session.subscriptionSnapshots || []).forEach((snapshot) => {
      const subscriptionIndex = (state.value.subscriptions || []).findIndex((item) => item.id === snapshot.id)
      if (subscriptionIndex < 0) return
      state.value.subscriptions[subscriptionIndex] = {
        ...state.value.subscriptions[subscriptionIndex],
        next_billing_date: snapshot.next_billing_date,
        updated_at: snapshot.updated_at || new Date().toISOString(),
      }
    })

    state.value.importSessions[index] = {
      ...session,
      status: 'rolled_back',
      rolledBackAt: new Date().toISOString(),
    }
    appendAudit({
      action: 'rolled_back',
      entityType: 'statement_import',
      entityId: session.id,
      details: 'Importação de extrato desfeita',
    })
    saveState()
    return true
  }

  function addInternalTransfer(data) {
    const amount = Number(data.amount)
    const confirmedAt = new Date().toISOString()
    const transfer = {
      id: newId(),
      date: data.date,
      fromType: data.fromType,
      fromId: data.fromId,
      toType: data.toType,
      toId: data.toId,
      amount,
      description: data.description || 'Transferência interna',
      isInternalTransfer: true,
      transferGroupId: newId(),
      transferConfidence: 100,
      confirmed: true,
      confirmedAt,
      documentIds: data.documentIds || [],
      created_at: confirmedAt,
    }
    applySourceDelta(data.fromType, data.fromId, -amount)
    applySourceDelta(data.toType, data.toId, amount)
    state.value.internalTransfers.push(transfer)
    saveState()
    syncInternalTransferProjection(transfer)
    return transfer
  }

  function syncInternalTransferProjection(transfer) {
    return syncFinancialEventProjection(state.value.family?.id, {
      eventType: 'internal_transfer',
      sourceType: 'manual_transfer',
      sourceId: transfer.id,
      dedupeKey: `internal-transfer:${transfer.id}`,
      occurredAt: new Date(`${transfer.date}T12:00:00`).toISOString(),
      amount: transfer.amount,
      currency: 'BRL',
      description: transfer.description,
      isInternalTransfer: true,
      transferGroupId: transfer.transferGroupId || transfer.id,
      transferConfidence: transfer.transferConfidence ?? 100,
      transferConfirmedAt: transfer.confirmedAt || null,
      payload: {
        fromType: transfer.fromType,
        fromId: transfer.fromId,
        toType: transfer.toType,
        toId: transfer.toId,
      },
    }).catch((error) => console.warn('[transfers] Projeção remota não sincronizada:', error.message))
  }

  function setInternalTransferConfirmation(id, confirmed) {
    const transfer = state.value.internalTransfers.find((item) => item.id === id)
    if (!transfer) return null
    transfer.confirmed = Boolean(confirmed)
    transfer.confirmedAt = confirmed ? new Date().toISOString() : null
    transfer.transferConfidence = confirmed ? 100 : 0
    saveState()
    syncInternalTransferProjection(transfer)
    return transfer
  }

  // Initialize
  loadState()
  if (activeUserId.value && !getUserScopedItem(FINANCE_STORAGE_KEY, activeUserId.value)) {
    ensureFinancialStructure(state.value)
    ensureFamilyMode(state.value)
    saveState()
  }
  if (activeUserId.value) processRecurringIncomes()

  return {
    state,
    loading,
    activeUserId,
    selectedKey,
    monthNames,
    expenseCategories,
    incomeTypes,
    paymentMethods,
    loadState,
    saveState,
    setActiveUser,
    resetInMemoryState,
    requireActiveUser,
    getStorageKey: () => getUserScopedKey(FINANCE_STORAGE_KEY, activeUserId.value),
    addExpense,
    addIncome,
    addIncomeDocument,
    updateIncomeDocument,
    deleteIncomeDocument,
    linkDocumentToIncome,
    getIncomeDocuments,
    addEntryDocument,
    linkEntryDocumentToEntry,
    getEntryDocuments,
    deleteExpense,
    deleteIncome,
    updateSettings,
    resetData,
    addProduct,
    updateProduct,
    deleteProduct,
    addStore,
    findOrCreateStore,
    trackProduct,
    updateTrackedProduct,
    addPriceRecord,
    recordManualPrice,
    hasImportedMarketReceipt,
    importMarketReceipt,
    resolveProductPriceStats,
    monitoredProducts,
    addWishlistItem,
    updateWishlistItem,
    addPriceSnapshot,
    togglePriceMonitor,
    setWishlistPriceMonitor,
    dismissPriceMonitorAlert,
    deleteWishlistItem,
    addPriorityItem,
    deletePriorityItem,
    calcMonth,
    expenseImpactKey,
    isVaExpense,
    addFinancialAccount,
    updateFinancialAccount,
    deleteFinancialAccount,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    addBenefitWallet,
    updateBenefitWallet,
    deleteBenefitWallet,
    addFamilyMember,
    deleteFamilyMember,
    addRecurringIncome,
    deleteRecurringIncome,
    addSubscription,
    updateSubscription,
    pauseSubscription,
    cancelSubscription,
    softDeleteSubscription,
    deleteSubscription: softDeleteSubscription,
    addSubscriptionCharge,
    reconcileExpenseWithSubscription,
    suggestSubscriptionForExpense,
    buildStatementImportPreview,
    confirmStatementImportPreview,
    rollbackImportSession,
    addInternalTransfer,
    setInternalTransferConfirmation,
    processRecurringIncomes,
    getCurrentMember,
    appendAudit,
    updateFamily,
    setCurrentMember,
    updateFamilyMember,
    createFamilyInvite,
    respondInvite,
    addSharedDebt,
    deleteSharedDebt,
    addSharedGoal,
    contributeToGoal,
    deleteSharedGoal,
    addPlanningGoal,
    updatePlanningGoal,
    deletePlanningGoal,
    upsertCategoryBudget,
    deleteCategoryBudget,
    addSettlement,
    updateCreditCardFamily,
  }
})
