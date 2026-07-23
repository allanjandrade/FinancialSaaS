import { loadAuthorizedFinanceState } from '../finance-state.ts'
import { calculateMonthlyReport } from '../financial-calculations.ts'
import { normalizeFinanceState } from '../financial-engine/normalize-state.ts'
import {
  calculateBenefitBurnRate,
  calculateCardRisk,
  calculateCategoryAnomalies,
  calculateFinancialSnapshot,
  calculateMonthEndProjection,
  calculatePurchaseSimulation,
  calculateRecurringSuggestions,
} from '../financial-engine/calculations.ts'

type ContextInput = { contextType: string; entityId: string | null; userId?: string }

function compactTransactions(state: Record<string, unknown>, entityId: string | null) {
  const transactions = Array.isArray(state.transactions) ? state.transactions : []
  const selected = entityId ? transactions.find((item: any) => item.id === entityId) : null
  const recent = [...transactions]
    .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 10)
    .map((item: any) => ({
      date: item.date,
      kind: item.kind,
      amount: item.amount,
      category: item.category,
      description: String(item.description || '').slice(0, 80),
      isInternalTransfer: item.isInternalTransfer === true,
      benefitType: item.benefitType || null,
    }))
  return {
    selected: selected ? {
      date: selected.date,
      kind: selected.kind,
      amount: selected.amount,
      category: selected.category,
      description: String(selected.description || '').slice(0, 80),
    } : null,
    recent,
    uncategorizedCount: transactions.filter((item: any) => item.category === 'A Classificar').length,
    internalTransferCount: transactions.filter((item: any) => item.isInternalTransfer).length,
  }
}

function benefitContext(state: Record<string, unknown>) {
  return ['VA', 'VR'].map((type) => {
    try { return calculateBenefitBurnRate(state, type) } catch { return null }
  }).filter(Boolean)
}

export async function buildAiContext(token: string, input: ContextInput) {
  const row = await loadAuthorizedFinanceState(token, input.userId || '')
  const referenceDate = new Date().toISOString().slice(0, 10)
  const state = normalizeFinanceState(row.data, referenceDate)
  const snapshot = calculateFinancialSnapshot(state)
  const basis = ['Estado financeiro autorizado do usuario', `Periodo de referencia: ${state.period.start} a ${state.period.end}`]
  const commonWarnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : []

  if (input.contextType === 'dashboard') {
    return {
      familyId: row.family_id,
      basis: [...basis, 'Snapshot, projecao, cartoes e beneficios calculados pelo motor financeiro'],
      warnings: commonWarnings,
      context: {
        contextType: 'dashboard',
        snapshot,
        monthEndProjection: calculateMonthEndProjection(state),
        cardRisk: calculateCardRisk(state),
        benefitBurnRate: benefitContext(state),
      },
    }
  }

  if (input.contextType === 'entries') {
    return {
      familyId: row.family_id,
      basis: [...basis, 'Ultimos lancamentos normalizados pelo motor financeiro'],
      warnings: commonWarnings,
      context: {
        contextType: 'entries',
        snapshot,
        entries: compactTransactions(state, input.entityId),
        anomalies: calculateCategoryAnomalies(state),
      },
    }
  }

  if (input.contextType === 'purchases') {
    const wishlist = Array.isArray(state.wishlist) ? state.wishlist : []
    const selected = input.entityId ? wishlist.find((item: any) => item.id === input.entityId) : null
    let simulation = null
    if (selected?.currentPrice > 0) {
      simulation = calculatePurchaseSimulation(state, {
        amount: selected.currentPrice,
        paymentMethod: 'credit_card',
        installments: 1,
      })
    }
    return {
      familyId: row.family_id,
      basis: [...basis, 'Wishlist e simulacao calculadas sem executar compra'],
      warnings: commonWarnings,
      context: {
        contextType: 'purchases',
        snapshot,
        cardRisk: calculateCardRisk(state),
        selectedItem: selected || null,
        purchaseSimulation: simulation,
        wishlist: wishlist.slice(0, 10),
      },
    }
  }

  const [year, month] = referenceDate.split('-').map(Number)
  return {
    familyId: row.family_id,
    basis: [...basis, 'Relatorio mensal e analises calculados pelo motor financeiro'],
    warnings: commonWarnings,
    context: {
      contextType: 'reports',
      monthlyReport: calculateMonthlyReport(row.data, year, month),
      monthEndProjection: calculateMonthEndProjection(state),
      anomalies: calculateCategoryAnomalies(state),
      recurringSuggestions: calculateRecurringSuggestions(state),
    },
  }
}
