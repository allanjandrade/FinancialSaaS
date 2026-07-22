<template>
  <section v-if="!accounts.length" class="accounts-table-card accounts-table-card--empty" aria-label="Contas financeiras vazias">
    <slot name="empty">
      <div class="empty-row">Nenhuma conta cadastrada.</div>
    </slot>
  </section>

  <section v-else class="accounts-table-card" aria-label="Tabela de contas financeiras">
    <div class="table-scroll">
      <table class="accounts-table">
        <thead>
          <tr>
            <th class="select-col">
              <input
                type="checkbox"
                :checked="allSelected"
                :disabled="!accounts.length"
                aria-label="Selecionar todas as contas"
                @change="emit('toggleAll')"
              />
            </th>
            <th>Nome</th>
            <th>Banco / Agência / Conta</th>
            <th>CNPJ / Pix</th>
            <th>Status</th>
            <th>Saldo</th>
            <th>Atualização</th>
            <th class="actions-col">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.id">
            <td class="select-col">
              <input
                type="checkbox"
                :checked="isSelected(account.id)"
                :aria-label="`Selecionar ${account.name}`"
                @change="emit('toggle', account.id)"
              />
            </td>
            <td data-label="Conta">
              <strong class="account-name">{{ account.name }}</strong>
              <span class="account-type">{{ account.type || 'Conta' }}</span>
            </td>
            <td data-label="Banco">
              <span class="bank-name">{{ account.bank || 'Banco não informado' }}</span>
              <code class="account-mono">{{ bankingLine(account) }}</code>
            </td>
            <td data-label="CNPJ / Pix">
              <span class="account-document">{{ documentLine(account) }}</span>
              <span class="account-pix">Pix: {{ pixLine(account) }}</span>
            </td>
            <td data-label="Status">
              <span class="account-status" :class="`status-${statusTone(account)}`">
                {{ statusLabel(account) }}
              </span>
            </td>
            <td data-label="Saldo">
              <strong class="account-balance">{{ formatCurrency(account.balance) }}</strong>
            </td>
            <td data-label="Atualização">
              <div class="sync-cell">
                <span class="sync-badge" :class="`sync-${syncTone(account)}`">
                  <CheckCircle2 v-if="syncTone(account) === 'synced'" aria-hidden="true" :size="14" />
                  <AlertTriangle v-else-if="syncTone(account) === 'error'" aria-hidden="true" :size="14" />
                  <Clock3 v-else aria-hidden="true" :size="14" />
                  {{ syncLabel(account) }}
                </span>
                <time class="sync-time" :datetime="lastSyncedRaw(account) || undefined">
                  {{ lastSyncedAt(account) }}
                </time>
                <button
                  v-if="syncTone(account) === 'error'"
                  type="button"
                  class="retry-button"
                  :aria-label="`Tentar sincronizar ${account.name} novamente`"
                  @click="emit('retrySync', account)"
                >
                  <RotateCcw aria-hidden="true" :size="14" />
                  Tentar novamente
                </button>
              </div>
            </td>
            <td class="actions-col">
              <AppActionMenu
                :items="[{ id: 'delete', label: 'Excluir conta', destructive: true }]"
                :menu-label="`Ações para ${account.name}`"
                @select="() => emit('delete', account)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw } from 'lucide-vue-next'
import AppActionMenu from '@/components/ui/AppActionMenu.vue'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  selectedIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle', 'toggleAll', 'delete', 'retrySync'])

const selectedSet = computed(() => new Set(props.selectedIds))
const allSelected = computed(() =>
  props.accounts.length > 0 && props.accounts.every((account) => selectedSet.value.has(account.id)),
)

function isSelected(id) {
  return selectedSet.value.has(id)
}

function bankingLine(account) {
  const agency = account.agency || account.branch || account.agencia || account.openFinance?.agency || '--'
  const number = account.accountNumber || account.account_number || account.number || account.conta || '--'
  return `Ag. ${agency} / Conta ${number}`
}

function documentLine(account) {
  const document = account.cnpj || account.cpf || account.document || account.taxId || account.tax_id || ''
  if (!document) return 'Documento pendente'
  return formatDocument(document)
}

function pixLine(account) {
  return account.pixKey || account.pix_key || account.pix || account.openFinance?.pixKey || 'Pendente'
}

function syncTone(account) {
  const status = String(account.openFinance?.syncStatus || account.syncStatus || 'manual').toLowerCase()
  if (['error', 'failed', 'failure', 'sync_error'].includes(status)) return 'error'
  if (['pending', 'syncing', 'processing'].includes(status)) return 'pending'
  if (['synced', 'success', 'ok', 'connected', 'active'].includes(status)) return 'synced'
  return 'manual'
}

function statusTone(account) {
  const status = String(account.status || '').toLowerCase()
  if (account.active === false || ['inactive', 'inativa'].includes(status)) return 'inactive'
  if (['blocked', 'bloqueada', 'suspended', 'suspensa'].includes(status)) return 'warning'
  if (syncTone(account) === 'error') return 'warning'
  return 'active'
}

function statusLabel(account) {
  const tone = statusTone(account)
  if (tone === 'inactive') return 'Inativa'
  if (tone === 'warning') return 'Atenção'
  return 'Ativa'
}

function syncLabel(account) {
  const tone = syncTone(account)
  if (tone === 'synced') return 'Sincronizado'
  if (tone === 'error') return 'Erro'
  if (tone === 'pending') return 'Processando'
  return 'Manual'
}

function lastSyncedRaw(account) {
  return account.openFinance?.lastSyncedAt
    || account.lastSyncedAt
    || account.last_synced_at
    || account.updated_at
    || account.created_at
    || ''
}

function lastSyncedAt(account) {
  const value = lastSyncedRaw(account)
  if (!value) return 'Sem sincronização'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDocument(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return String(value)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value))
}
</script>

<style scoped>
.accounts-table-card {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-family: var(--font-sans);
}

.accounts-table-card--empty {
  min-height: 300px;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--bg-hover) 55%, transparent);
}

.table-scroll {
  overflow-x: auto;
}

.accounts-table {
  min-width: 860px;
  border-collapse: collapse;
}

.accounts-table th,
.accounts-table td {
  border-bottom: 1px solid var(--border-color);
  padding: 0.62rem 0.72rem;
  vertical-align: middle;
}

.accounts-table th {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.accounts-table tbody tr:hover {
  background: var(--bg-hover);
}

.select-col {
  width: 48px;
}

.actions-col {
  width: 128px;
  text-align: right;
}

.account-name,
.bank-name,
.account-document,
.account-balance {
  display: block;
}

.account-name {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 800;
}

.account-type,
.account-pix,
.sync-time {
  display: block;
  margin-top: 0.2rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.account-document {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.account-mono {
  display: block;
  margin-top: 0.25rem;
  color: var(--accent-hover);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  white-space: nowrap;
}

.account-balance {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: var(--page-title-weight);
}

.sync-cell {
  display: grid;
  gap: 0.35rem;
  justify-items: start;
}

.sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 26px;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 0.73rem;
  font-weight: 800;
}

.account-status {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0.22rem 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 0.73rem;
  font-weight: 800;
}

.status-active {
  border-color: rgba(52, 211, 153, 0.28);
  background: rgba(52, 211, 153, 0.12);
  color: #a7f3d0;
}

.status-warning {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.12);
  color: #fde68a;
}

.status-inactive {
  border-color: var(--border-color);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.sync-synced {
  border-color: rgba(52, 211, 153, 0.28);
  background: rgba(52, 211, 153, 0.12);
  color: #a7f3d0;
}

.sync-error {
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
}

.sync-pending {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.12);
  color: #fde68a;
}

.retry-button,
.delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
}

.retry-button {
  border: 1px solid var(--border-color);
  background: var(--blue-dim);
  color: var(--accent-hover);
}

.delete-button {
  border: 1px solid rgba(248, 113, 113, 0.24);
  background: rgba(248, 113, 113, 0.1);
  color: #fecaca;
}

.empty-row {
  display: grid;
  min-height: 128px;
  place-items: center;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .accounts-table-card {
    margin-inline: -0.25rem;
    border: 0;
    background: transparent;
  }

  .accounts-table-card--empty {
    margin-inline: 0;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-hover) 55%, transparent);
  }

  .table-scroll {
    overflow: visible;
  }

  .accounts-table,
  .accounts-table tbody,
  .accounts-table tr,
  .accounts-table td {
    display: block;
    min-width: 0;
    width: 100%;
  }

  .accounts-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .accounts-table tbody {
    display: grid;
    gap: 0.6rem;
  }

  .accounts-table tbody tr {
    position: relative;
    display: grid;
    gap: 0.55rem;
    padding: 0.78rem 0.82rem 0.78rem 2.65rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-panel);
  }

  .accounts-table tbody tr.empty-state-row {
    padding: 0;
  }

  .accounts-table td {
    border: 0;
    padding: 0;
  }

  .accounts-table td:not(.select-col):not(.actions-col)::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 0.14rem;
    color: var(--text-muted);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: var(--eyebrow-letter-spacing);
    text-transform: uppercase;
  }

  .select-col {
    position: absolute;
    left: 0.78rem;
    top: 0.86rem;
    width: auto;
  }

  .actions-col {
    width: 100%;
    text-align: left;
  }

  .delete-button {
    width: 100%;
  }
}
</style>
