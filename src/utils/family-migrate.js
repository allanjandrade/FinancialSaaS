import { FAMILY_ROLES } from '@/constants/family.js'
import { newId } from '@/constants/financial-structure.js'

export function ensureFamilyMode(state) {
  let changed = false

  if (!state.family) {
    const adminId = state.familyMembers?.[0]?.id || newId()
    if (!state.familyMembers?.length) {
      state.familyMembers = [{ id: adminId, name: 'Titular', role: FAMILY_ROLES.ADMINISTRATOR, email: '' }]
      changed = true
    }
    state.family = {
      id: newId(),
      name: state.settings?.familyName || 'Minha Família',
      adminMemberId: state.familyMembers[0].id,
      createdAt: new Date().toISOString(),
    }
    changed = true
  }

  state.familyMembers = (state.familyMembers || []).map((m) => ({
    ...m,
    role: m.role || (m.id === state.family.adminMemberId ? FAMILY_ROLES.ADMINISTRATOR : FAMILY_ROLES.MEMBER),
    email: m.email || '',
  }))

  if (!state.familyInvites) state.familyInvites = []
  if (!state.sharedDebts) state.sharedDebts = []
  if (!state.sharedGoals) state.sharedGoals = []
  if (!state.settlements) state.settlements = []
  if (!state.auditLog) state.auditLog = []

  if (!state.settings.currentMemberId && state.familyMembers[0]) {
    state.settings.currentMemberId = state.familyMembers[0].id
    changed = true
  }

  state.settings.familyModeEnabled = true

  state.expenses = (state.expenses || []).map((e) => ({
    ...e,
    responsibleMemberId: e.responsibleMemberId || e.familyMemberId || null,
    paidByMemberId: e.paidByMemberId || e.responsibleMemberId || e.familyMemberId || null,
    isShared: Boolean(e.isShared),
    splitMode: e.splitMode || 'percent',
    splits: Array.isArray(e.splits) ? e.splits : [],
    createdByMemberId: e.createdByMemberId || state.settings.currentMemberId,
  }))

  state.incomes = (state.incomes || []).map((i) => ({
    ...i,
    ownerMemberId: i.ownerMemberId || i.familyMemberId || state.familyMembers[0]?.id,
    familyMemberId: i.familyMemberId || i.ownerMemberId,
    createdByMemberId: i.createdByMemberId || state.settings.currentMemberId,
  }))

  return changed
}
