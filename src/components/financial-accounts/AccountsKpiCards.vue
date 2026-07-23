<template>
  <section class="accounts-kpi-grid" aria-label="Indicadores das contas financeiras">
    <article class="kpi-card">
      <div class="kpi-icon"><Landmark aria-hidden="true" :size="20" /></div>
      <span>Saldo Consolidado</span>
      <strong :class="{ zero: !accounts.length }">{{ formatCurrency(consolidatedBalance) }}</strong>
    </article>

    <article class="kpi-card">
      <div class="kpi-icon"><Wallet aria-hidden="true" :size="20" /></div>
      <span>Disponível</span>
      <strong :class="{ zero: !activeAccounts.length }">{{ formatCurrency(availableBalance) }}</strong>
    </article>

    <article class="kpi-card">
      <div class="kpi-icon"><Hourglass aria-hidden="true" :size="20" /></div>
      <span>A Compensar</span>
      <strong :class="{ zero: !clearingBalance }">{{ formatCurrency(clearingBalance) }}</strong>
    </article>

    <article class="kpi-card">
      <div class="kpi-icon"><RefreshCw aria-hidden="true" :size="20" /></div>
      <span>Sincronização %</span>
      <strong :class="{ zero: !accounts.length }">{{ syncPercentage }}%</strong>
    </article>

    <article class="kpi-card">
      <div class="kpi-icon"><AlertTriangle aria-hidden="true" :size="20" /></div>
      <span>Alertas</span>
      <strong :class="{ zero: alertCount === 0 }">{{ alertCount }}</strong>
    </article>

    <article class="kpi-card">
      <div class="kpi-icon"><ShieldCheck aria-hidden="true" :size="20" /></div>
      <span>Data Quality</span>
      <strong :class="{ zero: !accounts.length }">{{ dataQualityScore }}%</strong>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { AlertTriangle, Hourglass, Landmark, RefreshCw, ShieldCheck, Wallet } from 'lucide-vue-next'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
})

const consolidatedBalance = computed(() =>
  props.accounts.reduce((sum, account) => sum + toNumber(account.balance), 0),
)

const activeAccounts = computed(() =>
  props.accounts.filter((account) => !isInactiveAccount(account)),
)

const availableBalance = computed(() =>
  activeAccounts.value.reduce((sum, account) => {
    const available = account.availableBalance ?? account.available_balance ?? account.balance
    return sum + toNumber(available)
  }, 0),
)

const clearingBalance = computed(() =>
  props.accounts.reduce((sum, account) => {
    const pending = account.clearingBalance
      ?? account.pendingBalance
      ?? account.pending_balance
      ?? account.toClearBalance
      ?? account.aCompensar
      ?? 0
    return sum + toNumber(pending)
  }, 0),
)

const syncPercentage = computed(() => {
  if (!props.accounts.length) return 0
  const synced = props.accounts.filter((account) => syncTone(account) === 'synced').length
  return Math.round((synced / props.accounts.length) * 100)
})

const alertCount = computed(() =>
  props.accounts.filter((account) => {
    return isInactiveAccount(account)
      || toNumber(account.balance) < 0
      || syncTone(account) === 'error'
  }).length,
)

const dataQualityScore = computed(() => {
  if (!props.accounts.length) return 0
  const total = props.accounts.reduce((sum, account) => sum + accountQualityScore(account), 0)
  return Math.round(total / props.accounts.length)
})

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function syncTone(account) {
  const status = String(account.openFinance?.syncStatus || account.syncStatus || 'manual').toLowerCase()
  if (['synced', 'success', 'ok', 'connected', 'active'].includes(status)) return 'synced'
  if (['error', 'failed', 'failure', 'sync_error'].includes(status)) return 'error'
  return 'manual'
}

function isInactiveAccount(account) {
  const status = String(account.status || '').toLowerCase()
  return account.active === false
    || ['blocked', 'bloqueada', 'suspended', 'suspensa', 'inactive', 'inativa'].includes(status)
}

function accountQualityScore(account) {
  const checks = [
    account.name,
    account.type,
    account.balance !== undefined && account.balance !== null,
    account.bank,
    account.cnpj || account.cpf || account.document || account.taxId || account.pixKey || account.pix_key,
  ]

  const present = checks.filter(Boolean).length
  return Math.round((present / checks.length) * 100)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value))
}
</script>

<style scoped>
.accounts-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  font-family: var(--font-sans);
}

.kpi-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.25rem 0.6rem;
  align-items: center;
  min-width: 0;
  padding: 0.62rem 0.72rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
}

.kpi-icon {
  display: inline-grid;
  place-items: center;
  grid-row: span 2;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--accent);
  background: var(--blue-dim);
}

.kpi-card span {
  color: var(--text-muted);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.kpi-card strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--page-title-weight);
  line-height: 1;
  overflow-wrap: anywhere;
}

.kpi-card strong.zero {
  color: var(--text-muted);
}

@media (max-width: 980px) {
  .accounts-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .accounts-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .kpi-card {
    grid-template-columns: 1fr;
    gap: 0.24rem;
    padding: 0.5rem;
  }

  .kpi-icon {
    display: none;
  }

  .kpi-card span {
    font-size: 0.58rem;
  }

  .kpi-card strong {
    font-size: 1rem;
  }
}
</style>
