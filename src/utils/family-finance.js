import { SPLIT_MODES } from '@/constants/family.js'
import { computeConsolidatedPatrimony } from '@/utils/financial-consolidation.js'

function monthKeyFromDate(dateString) {
  const [y, m] = dateString.split('-').map(Number)
  return y * 100 + m
}

export function memberById(state, id) {
  return (state.familyMembers || []).find((m) => m.id === id)
}

export function memberName(state, id) {
  return memberById(state, id)?.name || '—'
}

/** Calcula valor por membro conforme modo de divisão */
export function allocateSplitAmounts(total, splits, mode = SPLIT_MODES.PERCENT) {
  const amount = Number(total || 0)
  if (!splits?.length || amount <= 0) return []

  if (mode === SPLIT_MODES.FIXED) {
    return splits.map((s) => ({
      memberId: s.memberId,
      amount: Number(s.fixedAmount || 0),
      percent: amount > 0 ? (Number(s.fixedAmount || 0) / amount) * 100 : 0,
    }))
  }

  if (mode === SPLIT_MODES.SHARES) {
    const totalShares = splits.reduce((sum, s) => sum + Number(s.shares || 1), 0) || 1
    return splits.map((s) => {
      const share = Number(s.shares || 1) / totalShares
      return { memberId: s.memberId, amount: amount * share, percent: share * 100 }
    })
  }

  return splits.map((s) => {
    const pct = Number(s.percent || 0) / 100
    return { memberId: s.memberId, amount: amount * pct, percent: Number(s.percent || 0) }
  })
}

/** Saldos internos: quem deve para quem */
export function computeInternalBalances(state) {
  const balances = {}

  function addDebt(fromId, toId, value) {
    if (!fromId || !toId || fromId === toId || value <= 0) return
    if (!balances[fromId]) balances[fromId] = {}
    balances[fromId][toId] = (balances[fromId][toId] || 0) + value
  }

  ;(state.expenses || []).forEach((exp) => {
    if (!exp.isShared || !exp.paidByMemberId) return
    const allocated = allocateSplitAmounts(exp.amount, exp.splits, exp.splitMode)
    allocated.forEach((row) => {
      if (row.memberId !== exp.paidByMemberId && row.amount > 0) {
        addDebt(row.memberId, exp.paidByMemberId, row.amount)
      }
    })
  })

  ;(state.settlements || []).forEach((s) => {
    addDebt(s.fromMemberId, s.toMemberId, -Number(s.amount || 0))
  })

  const pairs = []
  Object.keys(balances).forEach((fromId) => {
    Object.keys(balances[fromId]).forEach((toId) => {
      const net = balances[fromId][toId]
      if (Math.abs(net) >= 0.01) {
        pairs.push({
          fromMemberId: fromId,
          toMemberId: toId,
          fromName: memberName(state, fromId),
          toName: memberName(state, toId),
          amount: Math.round(net * 100) / 100,
        })
      }
    })
  })

  return pairs
}

export function computeFairnessSplit(state, month) {
  const year = state.settings?.year || new Date().getFullYear()
  const key = year * 100 + month
  const members = state.familyMembers || []

  const incomes = members.map((m) => {
    const total = (state.incomes || [])
      .filter((i) => i.familyMemberId === m.id && monthKeyFromDate(i.date) === key)
      .reduce((s, i) => s + Number(i.amount || 0), 0)
    return { memberId: m.id, name: m.name, income: total }
  })

  const grand = incomes.reduce((s, r) => s + r.income, 0)
  if (grand <= 0) {
    const even = 100 / Math.max(1, members.length)
    return incomes.map((r) => ({ ...r, suggestedPercent: even }))
  }

  return incomes.map((r) => ({
    ...r,
    suggestedPercent: Math.round((r.income / grand) * 1000) / 10,
  }))
}

export function computeFamilyPatrimony(state, monthCalc) {
  const consolidated = computeConsolidatedPatrimony(state, monthCalc)
  const members = state.familyMembers || []

  const individual = members.map((m) => {
    const accounts = (state.financialAccounts || []).filter((a) => a.memberId === m.id)
    const benefits = (state.benefitWallets || []).filter((b) => b.memberId === m.id)
    const personal =
      accounts.reduce((s, a) => s + Number(a.balance || 0), 0) +
      benefits.reduce((s, b) => s + Number(b.balance || 0), 0)
    return { memberId: m.id, name: m.name, value: personal }
  })

  const individualTotal = individual.reduce((s, r) => s + r.value, 0)
  const shared = Math.max(0, consolidated.netPatrimony - individualTotal)

  return {
    individual,
    individualTotal,
    shared,
    total: consolidated.netPatrimony,
  }
}

export function computeFamilyCashFlow(state, month, calcMonth) {
  const year = state.settings?.year || new Date().getFullYear()
  const key = year * 100 + month
  const monthData = calcMonth(month)

  const expenses = (state.expenses || []).filter((e) => monthKeyFromDate(e.date) === key)
  const sharedExpenses = expenses.filter((e) => e.isShared)
  const individualExpenses = expenses.filter((e) => !e.isShared)

  const debtCommitments = (state.sharedDebts || []).reduce((s, d) => s + Number(d.monthlyPayment || 0), 0)
  const goalCommitments = (state.sharedGoals || []).reduce((s, g) => {
    const remaining = Math.max(0, Number(g.targetAmount || 0) - Number(g.currentAmount || 0))
    return s + remaining / Math.max(1, Number(g.monthsRemaining || 12))
  }, 0)

  const totalIncome = monthData.incomeCash + monthData.vaIncome
  const totalExpense = monthData.cashExpenses + monthData.cardBill

  return {
    totalIncome,
    totalExpense,
    individualExpenseTotal: individualExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    sharedExpenseTotal: sharedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    commitments: debtCommitments + goalCommitments,
    projectedBalance: totalIncome - totalExpense - debtCommitments,
  }
}

export function computeFamilyDashboard(state, month, calcMonth) {
  const year = state.settings?.year || new Date().getFullYear()
  const key = year * 100 + month
  const members = state.familyMembers || []

  const individualIncomes = members.map((m) => ({
    memberId: m.id,
    name: m.name,
    total: (state.incomes || [])
      .filter((i) => i.familyMemberId === m.id && monthKeyFromDate(i.date) === key)
      .reduce((s, i) => s + Number(i.amount || 0), 0),
  }))

  const individualExpenses = members.map((m) => ({
    memberId: m.id,
    name: m.name,
    total: (state.expenses || [])
      .filter((e) => !e.isShared && (e.responsibleMemberId || e.familyMemberId) === m.id)
      .filter((e) => monthKeyFromDate(e.date) === key)
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  }))

  const cashFlow = computeFamilyCashFlow(state, month, calcMonth)
  const patrimony = computeFamilyPatrimony(state, calcMonth(month))
  const balances = computeInternalBalances(state)
  const fairness = computeFairnessSplit(state, month)

  return {
    individualIncomes,
    familyIncomeTotal: individualIncomes.reduce((s, r) => s + r.total, 0),
    individualExpenses,
    sharedExpenseTotal: cashFlow.sharedExpenseTotal,
    sharedDebts: state.sharedDebts || [],
    sharedGoals: state.sharedGoals || [],
    patrimony,
    cashFlow,
    internalBalances: balances,
    fairness,
  }
}

export function answerFamilyQuestion(question, state, month, calcMonth) {
  const q = String(question || '').toLowerCase()
  const dash = computeFamilyDashboard(state, month, calcMonth)

  if (q.includes('contribui') || q.includes('renda')) {
    return dash.fairness
      .map((r) => `${r.name}: ${formatBrl(r.income)} (sugestão ${r.suggestedPercent}% nas despesas compartilhadas)`)
      .join('\n')
  }
  if (q.includes('pagando mais') || q.includes('despesa')) {
    const sorted = [...dash.individualExpenses].sort((a, b) => b.total - a.total)
    const top = sorted[0]
    return top
      ? `${top.name} registrou mais despesas individuais este mês (${formatBrl(top.total)}).`
      : 'Sem despesas individuais no período.'
  }
  if (q.includes('justa') || q.includes('divisão')) {
    return `Divisão proporcional à renda:\n${dash.fairness.map((r) => `${r.name}: ${r.suggestedPercent}%`).join('\n')}`
  }
  if (q.includes('meta') || q.includes('falta')) {
    const goal = (state.sharedGoals || [])[0]
    if (!goal) return 'Nenhuma meta compartilhada cadastrada.'
    const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount || 0))
    return `Meta "${goal.name}": faltam ${formatBrl(remaining)} de ${formatBrl(goal.targetAmount)}.`
  }
  if (q.includes('dívida') || q.includes('dividir')) {
    const debt = (state.sharedDebts || [])[0]
    if (!debt) return 'Cadastre uma dívida familiar na aba Dívidas.'
    const rows = allocateSplitAmounts(debt.balance, debt.splits, debt.splitMode)
    return `Dívida "${debt.name}" (${formatBrl(debt.balance)}):\n${rows.map((r) => `${memberName(state, r.memberId)}: ${formatBrl(r.amount)}`).join('\n')}`
  }
  if (q.includes('deve')) {
    if (!dash.internalBalances.length) return 'Não há saldos internos pendentes entre membros.'
    return dash.internalBalances
      .map((b) => `${b.fromName} deve ${b.toName}: ${formatBrl(b.amount)}`)
      .join('\n')
  }

  return `Receita familiar: ${formatBrl(dash.familyIncomeTotal)}. Despesas compartilhadas: ${formatBrl(dash.sharedExpenseTotal)}. Patrimônio total: ${formatBrl(dash.patrimony.total)}.`
}

function formatBrl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export function canPerform(role, action) {
  if (role === 'administrator') return true
  if (role === 'viewer') {
    return ['view', 'consult'].includes(action)
  }
  if (role === 'member') {
    return !['manage_permissions', 'remove_member', 'invite'].includes(action)
  }
  return false
}

export function buildInviteLink(token) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/family?invite=${token}`
}
