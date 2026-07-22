<template>
  <div class="entries-view operation-shell ledger-page-shell" data-testid="entries-page">
    <header class="entries-header operation-hero" data-testid="operation-hero">
      <div>
        <p class="eyebrow">Movimentações</p>
        <h1>Lançamentos</h1>
        <p>Registre, importe, concilie e revise suas movimentações financeiras em um fluxo único.</p>
      </div>
      <div class="entries-hero-actions" data-testid="entries-page-header">
        <button
          type="button"
          class="primary-button compact-action ocr-hero-action"
          data-testid="entry-ocr-primary-action"
          :disabled="attachmentUploading"
          @click="openPrimaryOcr"
        >
          <Paperclip :size="17" />
          Escanear documento (OCR)
        </button>
        <button type="button" class="secondary-button compact-action" data-testid="statement-import-section" @click="openStatementImport">
          <Upload :size="17" />
          Importar extrato
        </button>
        <button type="button" class="secondary-button compact-action" @click="openManualEntry('expense')">
          Lançar manualmente
        </button>
      </div>
    </header>

    <LedgerSection :divided="false" class="entries-ledger-section">
      <section class="entries-premium-rail operation-metric-rail ledger-stat-strip entries-ledger-strip" data-testid="entries-premium-rail">
        <article v-for="metric in entriesRailMetrics" :key="metric.label" class="entry-rail-card" :class="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      </section>
    </LedgerSection>

    <form @submit.prevent="handleSubmit" class="entries-workspace operation-layout">
      <details
        class="entry-primary manual-entry-disclosure"
        :open="manualEntryOpen"
        @toggle="manualEntryOpen = $event.target.open"
      >
        <summary class="manual-entry-summary">
          <span>
            <strong>Cadastro manual</strong>
            <small>Use quando o OCR não for necessário ou quando quiser revisar tudo campo a campo.</small>
          </span>
          <em>{{ manualEntryOpen ? 'Recolher' : 'Abrir formulário' }}</em>
        </summary>

        <div class="mode-switch" role="tablist" aria-label="Tipo de lançamento">
          <button
            type="button"
            class="segment mode-card expense"
            :class="{ active: entryType === 'expense' }"
            @click="setEntryType('expense')"
          >
            <Receipt :size="18" />
            <strong>Despesa</strong>
            <span>Registrar saída</span>
          </button>
          <button
            type="button"
            class="segment mode-card income"
            :class="{ active: entryType === 'income' }"
            @click="setEntryType('income')"
          >
            <Plus :size="18" />
            <strong>Receita</strong>
            <span>Registrar entrada</span>
          </button>
          <button
            type="button"
            class="segment mode-card transfer"
            :class="{ active: entryType === 'transfer' }"
            data-testid="entries-transfer-action"
            @click="setEntryType('transfer')"
          >
            <Upload :size="18" />
            <strong>Transferência</strong>
            <span>Entre contas</span>
          </button>
        </div>

        <section class="panel entry-panel">
          <div class="entry-form-toolbar">
            <div class="entry-mode-copy" data-testid="entry-mode-copy">
              <p class="eyebrow">Cadastro</p>
              <h2>{{ formTitle }}</h2>
              <span>{{ formDescription }}</span>
            </div>
            <div class="form-actions">
              <button type="button" class="secondary-button" @click="clearForm">
                Limpar
              </button>
              <button type="submit" class="primary-button">
                <Plus :size="18" />
                <span>{{ submitLabel }}</span>
              </button>
            </div>
          </div>

          <div class="entry-form">
            <div class="form-section">
              <p class="form-section-title">Essencial</p>
              <div class="form-row primary-fields">
                <label>
                  Data
                  <input v-model="form.date" type="date" required />
                </label>
                <label>
                  Valor
                  <input v-model.number="form.amount" type="number" step="0.01" min="0" required />
                </label>
                <label class="description-field">
                  {{ entryType === 'transfer' ? 'Notas' : 'Descrição' }}
                  <input v-model="form.description" type="text" maxlength="80" placeholder="Opcional" />
                </label>
              </div>
            </div>

            <div v-if="entryType !== 'transfer'" class="form-section">
              <p class="form-section-title">Classificação</p>
              <div class="form-row">
                <label>
                  {{ entryType === 'income' ? 'Tipo' : 'Categoria' }}
                  <select v-model="form.category" required>
                    <option v-for="item in categories" :key="item" :value="item">
                      {{ item }}
                    </option>
                  </select>
                </label>
                <label>
                  Origem financeira
                  <select ref="transferSourceInput" v-model="form.sourceId" required>
                    <option v-for="opt in sourceOptions" :key="opt.id" :value="opt.id">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label v-if="entryType === 'expense'">
                  Pagamento
                  <select v-model="form.payment" @change="onPaymentChange">
                    <option v-for="method in paymentMethods" :key="method" :value="method">
                      {{ method }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div v-else class="form-section" data-testid="transfer-form-fields">
              <p class="form-section-title">Contas</p>
              <div class="form-row transfer-fields">
                <label>
                  Conta de origem
                  <select ref="transferSourceInput" v-model="form.sourceId" required>
                    <option v-for="opt in accountOptions" :key="opt.id" :value="opt.id">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label>
                  Conta de destino
                  <select v-model="form.destinationId" required>
                    <option v-for="opt in accountOptions" :key="opt.id" :value="opt.id">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div v-if="entryType !== 'transfer'" class="form-section compact-section">
              <p class="form-section-title">Responsável</p>
              <div class="form-row optional-fields">
                <label>
                  {{ entryType === 'income' ? 'Proprietário (receita)' : 'Responsável' }}
                  <select v-model="form.familyMemberId">
                    <option v-for="m in familyMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                </label>
                <label v-if="entryType === 'expense'">
                  Quem pagou
                  <select v-model="form.paidByMemberId">
                    <option v-for="m in familyMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                </label>
                <label class="switch-row status-switch">
                  <input v-model="form.paid" type="checkbox" />
                  <span>{{ entryType === 'income' ? 'Recebido' : 'Pago' }}</span>
                </label>
              </div>
            </div>

            <div v-if="entryType === 'expense' && sourceSuggestion?.best" class="source-suggestion">
              <strong>Sugestão:</strong> {{ sourceSuggestion.best?.reason }}
              <span v-if="sourceSuggestion.best">
                — {{ sourceSuggestion.best.label }}
                ({{ formatCurrency(sourceSuggestion.best.available) }} disponível)
              </span>
              <button type="button" class="link-btn" @click="applySuggestion">Aplicar sugestão</button>
            </div>

            <div v-if="entryType === 'expense' && subscriptionSuggestion?.shouldSuggest" class="subscription-suggestion">
              <strong>Essa cobrança parece uma assinatura.</strong>
              <span>{{ subscriptionSuggestion.message }}</span>
              <button
                v-if="subscriptionSuggestion.action === 'link'"
                type="button"
                class="link-btn"
                @click="linkSubscriptionSuggestion"
              >
                Vincular
              </button>
              <button
                v-else
                type="button"
                class="link-btn"
                @click="createSubscriptionFromSuggestion"
              >
                Criar e vincular
              </button>
            </div>

            <details v-if="entryType === 'expense'" class="advanced-panel shared-block" data-testid="entry-sharing-section">
              <summary>
                <span>Rateio familiar</span>
                <small>Opcional</small>
              </summary>
              <div class="advanced-panel-body">
                <p class="sharing-note">Privado por padrão. Para criar um lançamento familiar real, use Família ou marque o rateio manual desta despesa.</p>
                <label class="switch-row">
                  <input v-model="form.isShared" type="checkbox" />
                  <span>Despesa compartilhada (rateio familiar)</span>
                </label>
                <template v-if="form.isShared">
                  <label>
                    Modo de divisão
                    <select v-model="form.splitMode">
                      <option value="percent">Por percentual</option>
                      <option value="fixed">Por valor fixo</option>
                      <option value="shares">Por cotas</option>
                    </select>
                  </label>
                  <div v-for="(row, idx) in form.splits" :key="row.memberId" class="split-row">
                    <span>{{ memberLabel(row.memberId) }}</span>
                    <input
                      v-if="form.splitMode === 'percent'"
                      v-model.number="row.percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="%"
                    />
                    <input
                      v-else-if="form.splitMode === 'fixed'"
                      v-model.number="row.fixedAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="R$"
                    />
                    <input
                      v-else
                      v-model.number="row.shares"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="cotas"
                    />
                  </div>
                </template>
              </div>
            </details>
          </div>
        </section>
      </details>

      <aside class="side-stack">
        <input
          ref="statementFileInput"
          type="file"
          class="sr-only"
          :accept="STATEMENT_FILE_ACCEPT"
          data-testid="statement-import-input"
          @change="onStatementFilePick"
        />
        <input
          ref="entryFileInput"
          type="file"
          class="sr-only"
          :accept="FINANCIAL_DOCUMENT_ACCEPT"
          data-testid="entry-attachment-input"
          @change="onEntryAttachmentPick"
        />

        <OperationalContextPanel
          title="Contexto operacional"
          subtitle="Resumo rápido para decidir a origem, revisar pendências e evitar lançamentos duplicados."
          :items="entriesContextItems"
          :alerts="entriesContextAlerts"
          empty-message="Cadastre sua primeira movimentação para ativar o contexto operacional."
        />

        <section v-if="reviewPanelOpen" class="panel review-panel" data-testid="entry-review-panel">
          <div class="panel-head compact">
            <div>
              <h2>Revisão pendente</h2>
              <p>Confira o documento ou extrato antes de salvar qualquer lançamento.</p>
            </div>
          </div>

          <p v-if="statementError" class="statement-error">{{ statementError }}</p>

          <div v-if="entryAttachment" class="attachment-file">
            <FileText :size="15" />
            {{ entryAttachment.name }}
            <button type="button" class="link-btn" @click="clearEntryAttachment">Remover</button>
          </div>
          <p v-if="documentReviewState === DOCUMENT_REVIEW_STATES.EXTRACTING" class="document-status">
            Extraindo dados do documento...
          </p>
          <p v-if="documentError" class="statement-error">{{ documentError }}</p>

          <div v-if="statementPreview?.items?.length" class="statement-preview" data-testid="statement-import-preview">
            <div class="statement-preview-head">
              <strong>{{ statementPreview.summary.totalRows }} lançamentos analisados</strong>
              <button type="button" class="link-btn" @click="clearStatementImport">Limpar</button>
            </div>
            <div class="statement-summary" data-testid="statement-import-summary">
              <span>{{ statementPreview.summary.createCount }} para criar</span>
              <span>{{ statementPreview.summary.reconcileCount }} conciliado{{ statementPreview.summary.reconcileCount === 1 ? '' : 's' }}</span>
              <span>{{ statementPreview.summary.duplicateCount }} duplicado{{ statementPreview.summary.duplicateCount === 1 ? '' : 's' }}</span>
            </div>
            <div class="statement-preview-list">
              <div
                v-for="row in statementPreview.items"
                :key="row.id"
                class="statement-preview-row"
                :class="[`is-${row.kind}`, `action-${row.action}`]"
              >
                <span class="statement-date">{{ formatDate(row.date) }}</span>
                <span class="statement-description">
                  <strong>{{ row.description }}</strong>
                  <small v-if="row.action === 'reconcile'">
                    {{ row.subscriptionMatch?.name || 'Assinatura' }} vinculada
                  </small>
                  <small v-else-if="row.suggestedCategory">
                    Categoria: {{ row.suggestedCategory }}
                  </small>
                  <small v-else-if="row.suggestedType">
                    Tipo: {{ row.suggestedType }}
                  </small>
                  <small v-else-if="row.reason">
                    {{ row.reason }}
                  </small>
                </span>
                <span class="statement-action" :class="row.action">
                  {{ statementActionLabel(row.action) }}
                </span>
                <strong>{{ entryValuePrefix(row.kind) }} {{ formatCurrency(row.amount) }}</strong>
              </div>
            </div>
            <button
              type="button"
              class="primary-button statement-confirm"
              data-testid="statement-import-confirm"
              :disabled="!statementPreview.canConfirm"
              @click="importStatementRows"
            >
              <Upload :size="16" />
              <span>Confirmar importação</span>
            </button>
          </div>

          <div
            v-if="documentDraft"
            class="document-review"
            :class="{ ready: documentReviewConfirmed, manual: documentDraft.manualFallback }"
            data-testid="document-review-section"
          >
            <div class="document-review-head">
              <div>
                <strong>Revisão assistida</strong>
                <p>Confira os campos extraídos. Nada será salvo antes da sua confirmação.</p>
              </div>
              <span>{{ documentConfidenceLabel }}</span>
            </div>

            <p v-if="documentDraft.friendlyError" class="document-warning">{{ documentDraft.friendlyError }}</p>
            <p v-if="documentDraft.pendingFields?.length" class="document-warning">
              Campos pendentes: {{ pendingDocumentFields }}
            </p>

            <div class="form-row">
              <label>
                Tipo
                <select v-model="documentDraft.type" data-testid="document-review-type" @change="onDocumentTypeChange">
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="transfer">Transferencia</option>
                  <option value="benefit">Beneficio</option>
                  <option value="card">Cartão</option>
                </select>
              </label>
              <label>
                Valor
                <input v-model.number="documentDraft.amount" data-testid="document-review-amount" type="number" min="0" step="0.01" />
              </label>
              <label>
                Data
                <input v-model="documentDraft.date" data-testid="document-review-date" type="date" />
              </label>
            </div>

            <label>
              Estabelecimento/origem
              <input v-model="documentDraft.origin" data-testid="document-review-origin" maxlength="120" />
            </label>

            <div class="form-row">
              <label>
                Categoria sugerida
                <select v-model="documentDraft.category" data-testid="document-review-category">
                  <option v-for="item in documentCategoryOptions" :key="item" :value="item">{{ item }}</option>
                </select>
              </label>
              <label>
                Metodo de pagamento
                <select v-model="documentDraft.paymentMethod" data-testid="document-review-payment" @change="onDocumentPaymentChange">
                  <option value="">Selecione</option>
                  <option v-for="method in paymentMethods" :key="method" :value="method">{{ method }}</option>
                </select>
              </label>
              <label>
                Conta/cartão/benefício relacionado
                <select v-model="documentDraft.sourceId" data-testid="document-review-source" @change="onDocumentSourceChange">
                  <option value="">Selecione</option>
                  <option v-for="opt in documentSourceOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </label>
            </div>

            <div class="document-review-actions">
              <button type="button" class="secondary-button" @click="clearDocumentReview">Descartar OCR</button>
              <button
                type="button"
                class="primary-button"
                data-testid="document-review-confirm"
                :disabled="!canConfirmDocumentReview"
                @click="confirmDocumentReview"
              >
                Confirmar revisão
              </button>
            </div>
          </div>

          <div v-if="entryType === 'income'" class="income-doc-hint">
            <FileText :size="16" />
            <span>
              Anexe holerite, informe de rendimentos ou comprovante em
              <router-link to="/income-documents">Comprovantes de entrada</router-link>.
            </span>
          </div>
        </section>

        <section class="panel history-panel">
          <div class="panel-head compact">
            <div>
              <h2>Recentes</h2>
              <p>{{ historySummary }}</p>
            </div>
            <button type="button" class="icon-button" @click="confirmClear" title="Limpar dados">
              <Trash2 />
            </button>
          </div>

          <EmptyState
            v-if="!allEntries.length"
            :icon="Receipt"
            title="Nenhum lançamento ainda"
            description="Você pode cadastrar uma despesa manualmente ou registrar sua primeira receita para liberar o painel calculado."
            action-label="Cadastrar despesa"
            secondary-label="Cadastrar receita"
            @action="setEntryType('expense')"
            @secondary="setEntryType('income')"
          />
          <div v-else class="entry-list" data-testid="entries-history-list">
            <article v-for="entry in visibleEntries" :key="entry.id" class="entry-record" :class="`is-${entry.kind}`">
              <div class="entry-record-icon" aria-hidden="true">
                <Receipt :size="16" />
              </div>
              <div class="entry-record-main">
                <div class="entry-record-top">
                  <strong>{{ entry.description || entry.category || entry.type || entryKindLabel(entry.kind) }}</strong>
                  <span class="entry-amount" :class="entry.kind">
                    {{ entryValuePrefix(entry.kind) }} {{ formatCurrency(entry.amount) }}
                  </span>
                </div>
                <div class="entry-record-meta">
                  <span class="badge" :class="entry.kind">
                    {{ entryKindLabel(entry.kind) }}
                  </span>
                  <span>{{ formatDate(entry.date) }}</span>
                  <span>{{ entry.category || entry.type }}</span>
                  <span v-if="entry.payment">{{ entry.payment }}</span>
                  <span v-if="attachmentCount(entry)" class="attachment-badge">
                    <FileText :size="14" />
                    {{ attachmentCount(entry) }}
                  </span>
                </div>
              </div>
              <button
                v-if="entry.kind !== 'transfer'"
                class="icon-button small"
                type="button"
                title="Excluir lançamento"
                @click="deleteEntry(entry.id, entry.kind)"
              >
                <Trash2 />
              </button>
            </article>
            <p v-if="hiddenEntriesCount" class="history-limit">
              Mostrando os {{ visibleEntries.length }} mais recentes de {{ allEntries.length }}.
            </p>
          </div>
        </section>
      </aside>
    </form>
    <ContextualAssistant context-type="entries" />
    <ConfirmModal 
      :show="showConfirmModal" 
      title="Confirmar"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="showConfirmModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import { useEntryAttachmentUpload } from '@/composables/useEntryAttachmentUpload.js'
import ConfirmModal from '@/components/ConfirmModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ContextualAssistant from '@/components/ContextualAssistant.vue'
import LedgerSection from '@/components/layout/LedgerSection.vue'
import OperationalContextPanel from '@/components/layout/OperationalContextPanel.vue'
import { parseStatementFile, STATEMENT_FILE_ACCEPT } from '@/utils/statement-import.js'
import {
  DOCUMENT_REVIEW_STATES,
  FINANCIAL_DOCUMENT_ACCEPT,
  buildEntryPayloadFromDocumentDraft,
  extractFinancialDocumentDraft,
} from '@/utils/financial-document-ocr.js'
import { suggestExpenseSource } from '@/utils/financial-consolidation.js'
import { SOURCE_TYPES } from '@/constants/financial-structure.js'
import { SPLIT_MODES } from '@/constants/family.js'
import { Plus, Trash2, FileText, Receipt, Paperclip, Upload } from 'lucide-vue-next'

const financeStore = useFinanceStore()
const { showToast } = useNotification()
const route = useRoute()
const router = useRouter()
const {
  uploading: attachmentUploading,
  validateFile: validateEntryAttachment,
  uploadEntryAttachment,
} = useEntryAttachmentUpload()

const showConfirmModal = ref(false)
const confirmMessage = ref('')
const confirmAction = ref(null)

const entryType = ref('expense')
const manualEntryOpen = ref(false)
const transferSourceInput = ref(null)
const entryFileInput = ref(null)
const entryAttachment = ref(null)
const documentDraft = ref(null)
const documentReviewState = ref(DOCUMENT_REVIEW_STATES.EMPTY)
const documentReviewConfirmed = ref(false)
const documentError = ref('')
const statementFileInput = ref(null)
const statementRows = ref([])
const statementPreview = ref(null)
const statementImporting = ref(false)
const statementError = ref('')
const form = ref({
  date: new Date().toISOString().split('T')[0],
  amount: '',
  category: '',
  payment: 'Pix',
  description: '',
  paid: true,
  sourceType: SOURCE_TYPES.ACCOUNT,
  sourceId: '',
  destinationId: '',
  familyMemberId: '',
  creditCardId: null,
  paidByMemberId: '',
  isShared: false,
  splitMode: SPLIT_MODES.PERCENT,
  splits: [],
  subscriptionId: '',
})

const categories = computed(() => {
  return entryType.value === 'income' 
    ? financeStore.incomeTypes 
    : financeStore.expenseCategories
})

const paymentMethods = financeStore.paymentMethods
const familyMembers = computed(() => financeStore.state.familyMembers || [])
const accountOptions = computed(() => (financeStore.state.financialAccounts || []).map((a) => ({
  id: a.id,
  label: `${a.name} (${a.type})`,
  sourceType: SOURCE_TYPES.ACCOUNT,
})))
const formTitle = computed(() => ({
  expense: 'Nova despesa',
  income: 'Nova receita',
  transfer: 'Nova transferência',
}[entryType.value] || 'Novo lançamento')
)
const formDescription = computed(() => ({
  expense: 'Registre uma saída que impacta seu orçamento.',
  income: 'Registre uma entrada que compõe sua renda.',
  transfer: 'Registre movimentações entre suas próprias contas sem contar como receita ou despesa.',
}[entryType.value] || 'Registre uma movimentação financeira.')
)
const submitLabel = computed(() => entryType.value === 'transfer' ? 'Salvar transferência' : 'Salvar lançamento')
const attachmentHint = computed(() => {
  if (entryType.value === 'income') return 'PDF ou imagem: o OCR cria uma revisão antes de vincular o documento à receita.'
  if (entryType.value === 'transfer') return 'PDF ou imagem: o OCR cria uma revisão antes de vincular o documento à transferência.'
  return 'PDF ou imagem: o OCR cria uma revisão antes de vincular o documento à despesa.'
})
const attachmentButtonLabel = computed(() => {
  if (documentReviewState.value === DOCUMENT_REVIEW_STATES.EXTRACTING) return 'Extraindo dados'
  if (entryAttachment.value) return 'Trocar documento'
  return 'Ler documento'
})
const documentConfidenceLabel = computed(() => `${Math.round(Number(documentDraft.value?.confidence || 0))}%`)
const pendingDocumentFields = computed(() => (documentDraft.value?.pendingFields || [])
  .map((field) => ({
    type: 'tipo',
    amount: 'valor',
    date: 'data',
    origin: 'origem',
    category: 'categoria',
    paymentMethod: 'metodo',
    sourceId: 'origem financeira',
  }[field] || field))
  .join(', '))
const documentCategoryOptions = computed(() => {
  const type = documentDraft.value?.type
  if (type === 'income' || type === 'benefit') return financeStore.incomeTypes
  return financeStore.expenseCategories
})
const documentSourceOptions = computed(() => {
  const type = documentDraft.value?.type
  if (type === 'income' || type === 'benefit') return incomeSourceOptions.value
  if (type === 'transfer') return accountOptions.value
  return expenseSourceOptions.value
})
const canConfirmDocumentReview = computed(() => {
  const draft = documentDraft.value
  if (!draft) return false
  return Boolean(draft.type && Number(draft.amount || 0) > 0 && draft.date && (draft.origin || draft.description) && draft.category && draft.paymentMethod && draft.sourceId)
})

const sourceOptions = computed(() => {
  if (entryType.value === 'transfer') return accountOptions.value
  if (entryType.value === 'income') return incomeSourceOptions.value
  return expenseSourceOptions.value
})

const incomeSourceOptions = computed(() => {
  const opts = (financeStore.state.financialAccounts || []).map((a) => ({
    id: a.id,
    label: `${a.name} (${a.type})`,
    sourceType: SOURCE_TYPES.ACCOUNT,
    payment: 'Transferência',
  }))
  ;(financeStore.state.benefitWallets || []).forEach((b) => {
    const option = benefitSourceOption(b)
    opts.push(option)
  })
  return opts
})

const expenseSourceOptions = computed(() => {
  const opts = []
  ;(financeStore.state.financialAccounts || []).forEach((a) => {
    opts.push({ id: a.id, label: `${a.name} · conta`, sourceType: SOURCE_TYPES.ACCOUNT, payment: 'Pix' })
  })
  ;(financeStore.state.creditCards || []).forEach((c) => {
    opts.push({ id: c.id, label: `${c.name} · cartão`, sourceType: SOURCE_TYPES.CREDIT_CARD, payment: 'Crédito' })
  })
  ;(financeStore.state.benefitWallets || []).forEach((b) => {
    const option = benefitSourceOption(b)
    opts.push(option)
  })
  return opts
})

const sourceSuggestion = computed(() => {
  if (entryType.value !== 'expense' || !form.value.category) return null
  const amount = Number(form.value.amount || 0)
  if (amount <= 0) return null
  const suggestion = suggestExpenseSource(financeStore.state, {
    category: form.value.category,
    amount,
  })
  return suggestion.best ? suggestion : null
})

const subscriptionSuggestion = computed(() => {
  if (entryType.value !== 'expense' || Number(form.value.amount || 0) <= 0) return null
  return financeStore.suggestSubscriptionForExpense({
    description: form.value.description,
    amount: Number(form.value.amount || 0),
    date: form.value.date,
    payment: form.value.payment,
    sourceType: form.value.sourceType,
    sourceId: form.value.sourceId,
    creditCardId: form.value.creditCardId,
  })
})

watch(
  () => [form.value.category, entryType.value],
  () => {
    if (entryType.value === 'expense' && form.value.category && sourceSuggestion.value?.best?.sufficient) {
      applySuggestion()
    }
  },
)

watch(
  sourceOptions,
  (opts) => {
    if (!form.value.sourceId && opts[0]) {
      form.value.sourceId = opts[0].id
      form.value.sourceType = opts[0].sourceType
    }
    if (entryType.value === 'transfer' && !form.value.destinationId) {
      form.value.destinationId = opts.find((opt) => opt.id !== form.value.sourceId)?.id || opts[1]?.id || opts[0]?.id || ''
    }
  },
  { immediate: true },
)

watch(
  () => route.query.transfer,
  (value) => {
    if (String(value || '') === '1') openTransferModeFromRoute()
  },
  { immediate: true },
)

watch(
  familyMembers,
  (list) => {
    if (!list.length) return
    if (!form.value.familyMemberId) form.value.familyMemberId = list[0].id
    if (!form.value.paidByMemberId) form.value.paidByMemberId = list[0].id
    if (!form.value.splits.length) {
      form.value.splits = list.map((m) => ({
        memberId: m.id,
        percent: 100 / list.length,
        fixedAmount: 0,
        shares: 1,
      }))
    }
  },
  { immediate: true },
)

function memberLabel(id) {
  return familyMembers.value.find((m) => m.id === id)?.name || '—'
}

function normalizeBenefitKind(wallet = {}) {
  const raw = String(wallet.kind || wallet.type || wallet.category || wallet.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (raw.includes('vr') || raw.includes('refeicao') || raw.includes('refeicoes')) return 'vr'
  if (raw.includes('corpor') || raw.includes('auxilio') || raw.includes('mobilidade') || raw.includes('cultura') || raw.includes('educacao')) return 'corporate'
  return 'va'
}

function benefitSourceOption(wallet) {
  const kind = normalizeBenefitKind(wallet)
  const label = kind === 'vr' ? 'VR' : kind === 'corporate' ? 'Corporativo' : 'VA'
  const sourceType = kind === 'vr'
    ? SOURCE_TYPES.BENEFIT_VR
    : kind === 'corporate'
      ? SOURCE_TYPES.BENEFIT_CORPORATE
      : SOURCE_TYPES.BENEFIT_VA
  const payment = kind === 'vr' ? 'VR' : kind === 'va' ? 'VA' : 'Pix'
  return {
    id: wallet.id,
    label: `${wallet.name || 'Beneficio'} · ${label}`,
    sourceType,
    payment,
  }
}

function onPaymentChange() {
  const match = sourceOptions.value.find((o) => o.payment === form.value.payment)
  if (match) {
    form.value.sourceId = match.id
    form.value.sourceType = match.sourceType
  }
}

function applySuggestion() {
  const best = sourceSuggestion.value?.best
  if (!best?.sufficient) return
  form.value.sourceId = best.sourceId
  form.value.sourceType = best.sourceType
  form.value.payment = best.payment
  if (best.sourceType === SOURCE_TYPES.CREDIT_CARD) {
    form.value.creditCardId = best.sourceId
  }
}

function linkSubscriptionSuggestion() {
  const suggestion = subscriptionSuggestion.value
  if (!suggestion?.subscriptionId) return
  form.value.subscriptionId = suggestion.subscriptionId
  showToast('Assinatura vinculada. Salve o lançamento para registrar a cobrança real.', 'info')
}

function createSubscriptionFromSuggestion() {
  const suggestion = subscriptionSuggestion.value
  if (!suggestion?.draft) return
  const selectedSource = sourceOptions.value.find((item) => item.id === form.value.sourceId)
  const payload = {
    ...suggestion.draft,
    amount: Number(form.value.amount || suggestion.draft.amount || 0),
    started_at: form.value.date,
    next_billing_date: suggestion.draft.next_billing_date,
    payment_method_type: selectedSource?.sourceType === SOURCE_TYPES.CREDIT_CARD ? 'card' : 'account',
    card_id: selectedSource?.sourceType === SOURCE_TYPES.CREDIT_CARD ? selectedSource.id : null,
    account_id: selectedSource?.sourceType === SOURCE_TYPES.ACCOUNT ? selectedSource.id : null,
  }
  const created = financeStore.addSubscription(payload)
  form.value.subscriptionId = created.id
  showToast('Assinatura criada e vinculada. Salve o lançamento para registrar a cobrança real.', 'success')
}

function displayPaymentMethod(value) {
  return {
    Credito: 'Crédito',
    Debito: 'Débito',
    Transferencia: 'Transferência',
  }[value] || value || ''
}

function officialPaymentMethod(value) {
  const raw = String(value || '')
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const canonical = normalized.includes('credito') ? 'credito'
    : normalized.includes('debito') ? 'debito'
      : normalized.includes('transfer') ? 'transfer'
        : ''

  if (!canonical) return raw
  return paymentMethods.find((method) => {
    const methodKey = String(method)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    return methodKey.includes(canonical)
  }) || raw
}

function entryTypeFromDocument(type) {
  if (type === 'income' || type === 'benefit') return 'income'
  if (type === 'transfer') return 'transfer'
  return 'expense'
}

function syncDocumentPendingFields() {
  if (!documentDraft.value) return
  documentDraft.value.pendingFields = [
    ['amount', documentDraft.value.amount],
    ['origin', documentDraft.value.origin || documentDraft.value.description],
    ['category', documentDraft.value.category],
    ['paymentMethod', documentDraft.value.paymentMethod],
    ['sourceId', documentDraft.value.sourceId],
  ]
    .filter(([, value]) => value == null || value === '' || value === 0)
    .map(([field]) => field)
}

function applyDefaultDocumentSource() {
  const draft = documentDraft.value
  if (!draft) return
  const normalizedPayment = officialPaymentMethod(draft.paymentMethod)
  draft.paymentMethod = normalizedPayment
  const match = documentSourceOptions.value.find((opt) => {
    if (draft.sourceId && opt.id === draft.sourceId) return true
    if (draft.sourceType && opt.sourceType === draft.sourceType) return true
    if (normalizedPayment && opt.payment === normalizedPayment) return true
    return false
  }) || documentSourceOptions.value[0]
  if (match) {
    draft.sourceId = match.id
    draft.sourceType = match.sourceType
  }
  if ((draft.type === 'benefit' || draft.paymentMethod === 'VA' || draft.paymentMethod === 'VR') && !['VA', 'VR'].includes(draft.category)) {
    draft.category = draft.paymentMethod === 'VR' ? 'VR' : 'VA'
  }
  syncDocumentPendingFields()
}

function onDocumentTypeChange() {
  if (!documentDraft.value) return
  if (documentDraft.value.type === 'card') documentDraft.value.paymentMethod = 'Crédito'
  if (documentDraft.value.type === 'card') documentDraft.value.paymentMethod = officialPaymentMethod(documentDraft.value.paymentMethod)
  if (documentDraft.value.type === 'benefit' && !['VA', 'VR'].includes(documentDraft.value.paymentMethod)) {
    documentDraft.value.paymentMethod = 'VA'
  }
  applyDefaultDocumentSource()
}

function onDocumentPaymentChange() {
  applyDefaultDocumentSource()
}

function onDocumentSourceChange() {
  const match = documentSourceOptions.value.find((opt) => opt.id === documentDraft.value?.sourceId)
  if (match && documentDraft.value) {
    documentDraft.value.sourceType = match.sourceType
    if (match.payment) documentDraft.value.paymentMethod = match.payment
  }
  syncDocumentPendingFields()
}

function hydrateDocumentDraft(draft, file) {
  if (!draft || draft.mode !== 'document') return null
  const next = {
    ...draft,
    file: draft.file || file,
    paymentMethod: officialPaymentMethod(draft.paymentMethod),
    category: draft.category || (draft.type === 'income' || draft.type === 'benefit' ? financeStore.incomeTypes[0] : financeStore.expenseCategories[0]),
  }
  documentDraft.value = next
  entryType.value = entryTypeFromDocument(next.type)
  applyDefaultDocumentSource()
  return documentDraft.value
}

async function onEntryAttachmentPick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  entryAttachment.value = file
  documentDraft.value = null
  documentReviewConfirmed.value = false
  documentError.value = ''
  documentReviewState.value = DOCUMENT_REVIEW_STATES.EXTRACTING

  try {
    const draft = await extractFinancialDocumentDraft(file)
    if (draft?.mode === 'statement') {
      statementRows.value = draft.rows || []
      refreshStatementPreview()
      documentReviewState.value = DOCUMENT_REVIEW_STATES.REVIEW_PENDING
      showToast(`${statementRows.value.length} lancamentos reconhecidos. Revise antes de importar.`, 'success')
      return
    }
    hydrateDocumentDraft(draft, file)
    documentReviewState.value = DOCUMENT_REVIEW_STATES.REVIEW_PENDING
    showToast(draft?.manualFallback ? 'OCR indisponível. Revise manualmente antes de salvar.' : 'Documento lido. Revise antes de salvar.', draft?.manualFallback ? 'warning' : 'success')
  } catch (err) {
    documentError.value = err?.message || 'Não foi possível ler o documento.'
    documentReviewState.value = DOCUMENT_REVIEW_STATES.ERROR
    showToast(documentError.value, 'error')
  }
}

function clearEntryAttachment() {
  entryAttachment.value = null
  clearDocumentReview()
  if (entryFileInput.value) entryFileInput.value.value = ''
}

function clearDocumentReview() {
  documentDraft.value = null
  documentReviewState.value = DOCUMENT_REVIEW_STATES.EMPTY
  documentReviewConfirmed.value = false
  documentError.value = ''
}

function applyDocumentDraftToForm() {
  const draft = documentDraft.value
  if (!draft) return
  entryType.value = entryTypeFromDocument(draft.type)
  const payload = buildEntryPayloadFromDocumentDraft(draft)
  const sourceMatch = documentSourceOptions.value.find((opt) => opt.id === draft.sourceId)
  form.value.date = payload.date
  form.value.amount = payload.amount || ''
  form.value.category = payload.kind === 'income' ? payload.type : payload.category
  form.value.payment = officialPaymentMethod(payload.payment)
  form.value.description = draft.origin || payload.description
  form.value.sourceId = sourceMatch?.id || draft.sourceId || ''
  form.value.sourceType = sourceMatch?.sourceType || draft.sourceType || SOURCE_TYPES.ACCOUNT
  if (form.value.sourceType === SOURCE_TYPES.CREDIT_CARD) form.value.creditCardId = form.value.sourceId
  if (entryType.value === 'transfer') {
    form.value.destinationId = accountOptions.value.find((opt) => opt.id !== form.value.sourceId)?.id || ''
  }
  if (entryType.value !== 'transfer') form.value.paid = payload.paid
}

function confirmDocumentReview() {
  if (!canConfirmDocumentReview.value) {
    showToast('Revise os campos pendentes antes de confirmar.', 'warning')
    return
  }
  syncDocumentPendingFields()
  applyDocumentDraftToForm()
  documentReviewConfirmed.value = true
  documentReviewState.value = DOCUMENT_REVIEW_STATES.READY_TO_SAVE
  showToast('Revisão confirmada. Confira o formulário e salve o lançamento.', 'success')
}

function clearStatementImport() {
  statementRows.value = []
  statementPreview.value = null
  statementError.value = ''
  if (statementFileInput.value) statementFileInput.value.value = ''
}

async function onStatementFilePick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  statementImporting.value = true
  statementError.value = ''
  statementRows.value = []
  statementPreview.value = null

  try {
    statementRows.value = await parseStatementFile(file)
    refreshStatementPreview()
    showToast(`${statementRows.value.length} lancamentos reconhecidos. Revise antes de importar.`, 'success')
  } catch (err) {
    statementError.value = err?.message || 'Não foi possível ler o extrato.'
    showToast(statementError.value, 'error')
  } finally {
    statementImporting.value = false
  }
}

function defaultStatementSource() {
  const account = financeStore.state.financialAccounts?.[0]
  return {
    sourceType: SOURCE_TYPES.ACCOUNT,
    sourceId: account?.id || '',
  }
}

function refreshStatementPreview() {
  if (!statementRows.value.length) {
    statementPreview.value = null
    return
  }
  const source = defaultStatementSource()
  statementPreview.value = financeStore.buildStatementImportPreview(statementRows.value, {
    ...source,
    payment: 'Transferência',
    familyMemberId: form.value.familyMemberId || familyMembers.value[0]?.id || '',
  })
}

function statementActionLabel(action) {
  const labels = {
    create: 'Criar',
    duplicate: 'Duplicado',
    reconcile: 'Conciliar assinatura',
    ignored: 'Ignorado',
  }
  return labels[action] || 'Revisar'
}

function importStatementRows() {
  if (!statementPreview.value?.items?.length) return
  const source = defaultStatementSource()
  if (!source.sourceId) {
    showToast('Cadastre uma conta financeira antes de importar extratos.', 'warning')
    return
  }

  const session = financeStore.confirmStatementImportPreview(statementPreview.value, {
    ...source,
    payment: 'Transferência',
    familyMemberId: form.value.familyMemberId || familyMembers.value[0]?.id || '',
  })
  const imported = session?.createdEntries?.length || 0
  const skipped = session?.skippedRows?.length || 0
  clearStatementImport()
  showToast(`${imported} lançamentos importados. ${skipped} ignorados por duplicidade ou regra.`, 'success')
}

function attachmentCount(entry) {
  return Array.isArray(entry.documentIds) ? entry.documentIds.length : 0
}

const allEntries = computed(() => {
  const expenses = financeStore.state.expenses.map(e => ({ ...e, kind: 'expense' }))
  const incomes = financeStore.state.incomes.map(i => ({ ...i, kind: 'income' }))
  const transfers = (financeStore.state.internalTransfers || []).map((t) => ({
    ...t,
    kind: 'transfer',
    category: 'Transferência interna',
    payment: 'Interna',
  }))
  return [...expenses, ...incomes, ...transfers].sort((a, b) => new Date(b.date) - new Date(a.date))
})

const visibleEntries = computed(() => allEntries.value.slice(0, 8))
const hiddenEntriesCount = computed(() => Math.max(0, allEntries.value.length - visibleEntries.value.length))
const currentMonthEntries = computed(() => allEntries.value.filter((entry) => isCurrentMonth(entry.date)))
const currentMonthIncomeTotal = computed(() => sumEntriesByKind(currentMonthEntries.value, 'income'))
const currentMonthExpenseTotal = computed(() => sumEntriesByKind(currentMonthEntries.value, 'expense'))
const currentMonthNetTotal = computed(() => currentMonthIncomeTotal.value - currentMonthExpenseTotal.value)
const currentMonthTransferCount = computed(() => currentMonthEntries.value.filter((entry) => entry.kind === 'transfer').length)
const entriesRailMetrics = computed(() => [
  {
    label: 'Entradas do mês',
    value: formatCurrency(currentMonthIncomeTotal.value),
    hint: `${currentMonthEntries.value.filter((entry) => entry.kind === 'income').length} receita${currentMonthEntries.value.filter((entry) => entry.kind === 'income').length === 1 ? '' : 's'}`,
    tone: 'income',
  },
  {
    label: 'Saídas do mês',
    value: formatCurrency(currentMonthExpenseTotal.value),
    hint: `${currentMonthEntries.value.filter((entry) => entry.kind === 'expense').length} despesa${currentMonthEntries.value.filter((entry) => entry.kind === 'expense').length === 1 ? '' : 's'}`,
    tone: 'expense',
  },
  {
    label: 'Saldo operacional',
    value: formatCurrency(currentMonthNetTotal.value),
    hint: currentMonthNetTotal.value >= 0 ? 'Mês positivo até agora' : 'Mês pressionado',
    tone: currentMonthNetTotal.value >= 0 ? 'income' : 'expense',
  },
  {
    label: 'Revisões assistidas',
    value: String((statementPreview.value?.summary?.totalRows || 0) + (documentDraft.value ? 1 : 0)),
    hint: `${currentMonthTransferCount.value} transferência${currentMonthTransferCount.value === 1 ? '' : 's'} no mês`,
    tone: 'neutral',
  },
])
const historySummary = computed(() => {
  if (!allEntries.value.length) return 'Nenhum lançamento registrado.'
  if (allEntries.value.length === 1) return '1 lançamento registrado.'
  return `${allEntries.value.length} lançamentos registrados.`
})
const reviewPanelOpen = computed(() => Boolean(
  entryAttachment.value
  || documentDraft.value
  || statementPreview.value?.items?.length
  || statementImporting.value
  || statementError.value
  || documentError.value,
))
const entriesContextItems = computed(() => [
  {
    id: 'month-balance',
    label: 'Saldo do período',
    value: formatCurrency(currentMonthNetTotal.value || 0),
    hint: 'Receitas menos despesas confirmadas',
    tone: currentMonthNetTotal.value >= 0 ? 'success' : 'danger',
  },
  {
    id: 'pending-review',
    label: 'Revisão pendente',
    value: reviewPanelOpen.value ? 'Aberta' : 'Sem pendências',
    hint: reviewPanelOpen.value ? 'Confira antes de salvar' : 'OCR e extratos ficam aqui',
    tone: reviewPanelOpen.value ? 'warning' : 'success',
  },
  {
    id: 'recent-count',
    label: 'Lançamentos recentes',
    value: String(visibleEntries.value.length || 0),
    hint: historySummary.value,
    tone: 'info',
  },
])
const entriesContextAlerts = computed(() => {
  const alerts = []
  if (!sourceOptions.value.length) {
    alerts.push({
      id: 'no-source',
      title: 'Cadastre uma origem financeira',
      message: 'Contas, cartões ou benefícios permitem classificar melhor cada lançamento.',
      tone: 'warning',
    })
  }
  if (entryType.value === 'expense' && subscriptionSuggestion.value?.shouldSuggest) {
    alerts.push({
      id: 'subscription-suggestion',
      title: 'Possível assinatura',
      message: subscriptionSuggestion.value.message,
      tone: 'info',
    })
  }
  return alerts
})

function setEntryType(type) {
  entryType.value = type
  clearEntryAttachment()
  if (type === 'transfer') clearStatementImport()
  form.value.category = type === 'transfer'
    ? ''
    : type === 'income'
      ? financeStore.incomeTypes[0] || ''
      : financeStore.expenseCategories[0] || ''
  form.value.payment = type === 'expense' ? 'Pix' : ''
  const first = sourceOptions.value[0]
  if (first) {
    form.value.sourceId = first.id
    form.value.sourceType = first.sourceType
  }
  if (type === 'transfer') {
    form.value.destinationId = accountOptions.value.find((opt) => opt.id !== form.value.sourceId)?.id || accountOptions.value[1]?.id || ''
  }
}

function openManualEntry(type = entryType.value) {
  manualEntryOpen.value = true
  setEntryType(type)
}

function openPrimaryOcr() {
  if (entryType.value === 'transfer') setEntryType('expense')
  entryFileInput.value?.click()
}

function openStatementImport() {
  if (entryType.value === 'transfer') setEntryType('expense')
  statementFileInput.value?.click()
}

function isCurrentMonth(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function sumEntriesByKind(entries, kind) {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((total, entry) => total + Number(entry.amount || 0), 0)
}

async function handleSubmit() {
  const payload = { ...form.value }
  if (entryAttachment.value && documentDraft.value && !documentReviewConfirmed.value) {
    showToast('Confirme a revisão assistida antes de salvar o lançamento.', 'warning')
    return
  }
  if (entryType.value === 'transfer') {
    if (!payload.sourceId || !payload.destinationId || payload.sourceId === payload.destinationId) {
      showToast('Selecione contas diferentes para a transferência.', 'warning')
      return
    }
    const transfer = financeStore.addInternalTransfer({
      date: payload.date,
      amount: payload.amount,
      fromType: SOURCE_TYPES.ACCOUNT,
      fromId: payload.sourceId,
      toType: SOURCE_TYPES.ACCOUNT,
      toId: payload.destinationId,
      description: payload.description,
    })
    if (entryAttachment.value && transfer?.id) {
      try {
        const result = await uploadEntryAttachment({
          file: entryAttachment.value,
          entryKind: 'transfer',
          entryId: transfer.id,
          date: payload.date,
          category: 'Transferencia interna',
          amount: payload.amount,
          label: payload.description,
        })
        if (result.bucketMissing) {
          showToast('Transferencia salva; anexo guardado neste aparelho.', 'warning')
        }
      } catch (err) {
        showToast(`Transferencia salva, mas o anexo falhou: ${err.message || 'erro inesperado'}`, 'warning')
      }
    }
    showToast('Transferência registrada sem criar receita ou despesa.', 'success')
    clearForm()
    return
  }
  const opt = sourceOptions.value.find((o) => o.id === form.value.sourceId)
  if (opt) {
    payload.sourceType = opt.sourceType
    if (opt.sourceType === SOURCE_TYPES.CREDIT_CARD) payload.creditCardId = opt.id
  }

  if (documentReviewConfirmed.value && documentDraft.value) {
    const reviewedPayload = buildEntryPayloadFromDocumentDraft(documentDraft.value, {
      amount: payload.amount,
      date: payload.date,
      category: payload.category,
      paymentMethod: payload.payment,
      description: payload.description,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
    })
    payload.ocrProvider = reviewedPayload.ocrProvider
    payload.ocrConfidence = reviewedPayload.ocrConfidence
    payload.ocrDate = reviewedPayload.ocrDate
    payload.ocrTipoDocumento = reviewedPayload.ocrTipoDocumento
    payload.ocrObservacoes = reviewedPayload.ocrObservacoes
    payload.paid = reviewedPayload.paid
  }

  if (entryAttachment.value) {
    const validation = validateEntryAttachment(entryAttachment.value)
    if (validation) {
      showToast(validation, 'error')
      return
    }
  }

  let savedEntry = null
  const savedKind = entryType.value

  if (entryType.value === 'expense') {
    savedEntry = financeStore.addExpense({
      ...payload,
      responsibleMemberId: payload.familyMemberId,
      paidByMemberId: payload.paidByMemberId || payload.familyMemberId,
      isShared: payload.isShared,
      splitMode: payload.splitMode,
      splits: payload.splits,
    })
  } else {
    savedEntry = financeStore.addIncome({
      ...payload,
      type: payload.category,
      ownerMemberId: payload.familyMemberId,
    })
  }

  if (entryAttachment.value && savedEntry?.id) {
    try {
      const result = await uploadEntryAttachment({
        file: entryAttachment.value,
        entryKind: savedKind,
        entryId: savedEntry.id,
        date: payload.date,
        category: payload.category,
        amount: payload.amount,
        label: payload.description,
      })
      if (result.bucketMissing) {
        showToast('Lançamento salvo; anexo guardado neste aparelho.', 'warning')
      }
    } catch (err) {
      showToast(`Lançamento salvo, mas o anexo falhou: ${err.message || 'erro inesperado'}`, 'warning')
    }
  }
  clearForm()
}

function clearForm() {
  clearEntryAttachment()
  clearStatementImport()
  const first = sourceOptions.value[0]
  form.value = {
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    payment: 'Pix',
    description: '',
    paid: true,
    sourceType: first?.sourceType || SOURCE_TYPES.ACCOUNT,
    sourceId: first?.id || '',
    destinationId: entryType.value === 'transfer'
      ? accountOptions.value.find((opt) => opt.id !== first?.id)?.id || accountOptions.value[1]?.id || ''
      : '',
    familyMemberId: familyMembers.value[0]?.id || '',
    creditCardId: null,
    paidByMemberId: familyMembers.value[0]?.id || '',
    isShared: false,
    splitMode: SPLIT_MODES.PERCENT,
    subscriptionId: '',
    splits: familyMembers.value.map((m) => ({
      memberId: m.id,
      percent: 100 / Math.max(1, familyMembers.value.length),
      fixedAmount: 0,
      shares: 1,
    })),
  }
}

function openTransferModeFromRoute() {
  setEntryType('transfer')
  nextTick(() => transferSourceInput.value?.focus?.())
  const query = { ...route.query }
  delete query.transfer
  router.replace({ path: '/entries', query }).catch(() => {})
}

function entryKindLabel(kind) {
  return {
    expense: 'Despesa',
    income: 'Receita',
    transfer: 'Transferência',
  }[kind] || kind
}

function entryValuePrefix(kind) {
  if (kind === 'expense') return '-'
  if (kind === 'income') return '+'
  return ''
}

function deleteEntry(id, type) {
  confirmMessage.value = 'Deseja excluir este lançamento?'
  confirmAction.value = () => {
    if (type === 'expense') {
      financeStore.deleteExpense(id)
    } else {
      financeStore.deleteIncome(id)
    }
    showToast('Lançamento excluído com sucesso!', 'success')
  }
  showConfirmModal.value = true
}

function confirmClear() {
  confirmMessage.value = 'Deseja limpar todos os dados? Esta ação não pode ser desfeita.'
  confirmAction.value = () => {
    financeStore.resetData()
    showToast('Dados limpos com sucesso!', 'success')
  }
  showConfirmModal.value = true
}

function handleConfirm() {
  if (confirmAction.value) {
    confirmAction.value()
    confirmAction.value = null
  }
  showConfirmModal.value = false
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

onMounted(() => {
  if (entryType.value !== 'transfer') form.value.category = categories.value[0]
})
</script>

<style scoped>
.entries-view {
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: clamp(1rem, 2.5vw, 2rem);
}

.entries-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.entries-header.operation-hero {
  align-items: center;
  margin-bottom: 1rem;
  padding: clamp(1rem, 2vw, 1.35rem);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-color));
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%),
    var(--gradient-panel);
  box-shadow: none;
}

.entries-hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.compact-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0.62rem 0.9rem;
  white-space: nowrap;
}

.ocr-hero-action {
  min-width: 230px;
  box-shadow: var(--shadow-glow);
}

.entries-premium-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-bottom: 1rem;
}

.entry-rail-card {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.entry-rail-card span,
.entry-rail-card small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-rail-card span {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.entry-rail-card strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.05rem, 1.4vw, 1.35rem);
  font-weight: 800;
  line-height: 1.1;
}

.entry-rail-card small {
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.entry-rail-card.income strong {
  color: var(--income);
}

.entry-rail-card.expense strong {
  color: var(--expense);
}

.entry-rail-card.neutral strong {
  color: var(--accent);
}

.entries-header h1,
.entries-header p {
  margin: 0;
}

.entries-header h1 {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.entries-header > div > p:not(.eyebrow) {
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--page-subtitle-size);
  margin-top: .35rem;
}

.eyebrow {
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

.quick-actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.quick-actions button,
.quick-actions a {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  min-height: 34px;
  padding: .45rem .7rem;
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  font-size: .78rem;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.quick-actions button:hover,
.quick-actions a:hover {
  background: var(--blue-dim);
  border-color: var(--border-strong);
  color: var(--accent);
}

.entry-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  align-items: start;
  gap: clamp(1rem, 2vw, 1.5rem);
}

.panel {
  min-width: 0;
  background: transparent;
  border-radius: var(--radius-lg);
  padding: clamp(1rem, 2vw, 1.5rem);
  box-shadow: none;
  transition: background-color 0.3s ease;
}

.entry-panel {
  display: grid;
  gap: 1rem;
}

.entry-panel-head {
  display: grid;
  gap: 0.85rem;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.panel-head h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-head p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
}

.segmented {
  display: flex;
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 4px;
  transition: background-color 0.3s ease;
}

.entry-mode-copy {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.entry-mode-copy h2,
.entry-mode-copy p {
  margin: 0;
}

.entry-mode-copy h2 {
  color: var(--text-primary);
}

.entry-mode-copy p {
  color: var(--text-secondary);
}

.segment {
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.segment.active {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.entry-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form-section {
  display: grid;
  gap: 0.65rem;
}

.form-section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.85rem;
}

.primary-fields {
  grid-template-columns: minmax(150px, 0.9fr) minmax(170px, 1.1fr);
}

.optional-fields {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.entry-form label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.entry-form input,
.entry-form select {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  background: var(--bg-input);
  color: var(--text-primary);
  transition: border-color 0.2s ease, background-color 0.3s ease;
}

.entry-form input:focus,
.entry-form select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.switch-row {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.switch-row input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.shared-block {
  margin-bottom: 0.25rem;
}
.sharing-note {
  margin: 0 0 .55rem;
  color: var(--text-secondary);
  font-size: .88rem;
  line-height: 1.45;
}
.split-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.4rem;
  font-size: 0.88rem;
}
.split-row input { width: 100px; }

.source-suggestion {
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  background: var(--blue-dim);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border-color));
  font-size: 0.88rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.subscription-suggestion {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  background: var(--savings-dim);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, var(--border-color));
  font-size: 0.88rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.subscription-suggestion strong {
  color: var(--text-primary);
}

.advanced-panel {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
  overflow: hidden;
}

.advanced-panel summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  cursor: pointer;
  color: var(--text-primary);
  font-weight: 800;
  list-style: none;
}

.advanced-panel summary::-webkit-details-marker {
  display: none;
}

.advanced-panel summary::after {
  content: "+";
  width: 24px;
  height: 24px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--bg-panel);
  color: var(--accent);
  font-weight: 900;
}

.advanced-panel[open] summary::after {
  content: "-";
}

.advanced-panel summary small {
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
}

.advanced-panel-body {
  display: grid;
  gap: 0.75rem;
  padding: 0 0.85rem 0.85rem;
}

.documents-grid {
  gap: 0.85rem;
}

.attachment-block {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.attachment-block p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
}

.statement-import-block {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.statement-import-head,
.statement-preview-head,
.statement-preview-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.statement-import-head {
  justify-content: space-between;
  flex-wrap: wrap;
}

.statement-import-head strong,
.statement-preview-head strong {
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 700;
}

.statement-import-head p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
}

.statement-error {
  margin: 0;
  color: #ef4444;
  font-size: 0.82rem;
  line-height: 1.4;
}

.statement-preview {
  display: grid;
  gap: 0.7rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.statement-preview-head {
  justify-content: space-between;
}

.statement-summary {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.statement-summary span,
.statement-action {
  width: fit-content;
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.74rem;
  font-weight: 800;
}

.statement-preview-list {
  display: grid;
  gap: 0.45rem;
  max-height: 220px;
  overflow: auto;
}

.statement-preview-row {
  min-width: 0;
  justify-content: space-between;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.statement-date {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.statement-description {
  flex: 1;
  min-width: 120px;
  display: grid;
  gap: 0.15rem;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.statement-description small {
  color: var(--text-secondary);
  font-size: 0.74rem;
}

.statement-action.create {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
  color: #047857;
}

.statement-action.reconcile {
  background: var(--blue-dim);
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border-color));
  color: var(--accent);
}

.statement-action.duplicate,
.statement-action.ignored {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.22);
  color: var(--text-muted);
}

.statement-preview-row.action-duplicate {
  opacity: 0.72;
}

.statement-preview-row strong {
  flex: 0 0 auto;
  color: var(--text-primary);
  font-size: 0.82rem;
}

.statement-preview-row.is-expense strong {
  color: #ef4444;
}

.statement-preview-row.is-income strong {
  color: #10b981;
}

.statement-confirm {
  width: fit-content;
  min-height: 38px;
  padding: 0.65rem 0.9rem;
}

.statement-confirm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.attachment-row,
.attachment-file,
.attachment-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.attachment-button {
  min-height: 38px;
  padding: 0.55rem 0.75rem;
}

.attachment-file {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.document-status {
  color: var(--accent) !important;
  font-weight: 700;
}

.document-review {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.document-review.ready {
  border-color: color-mix(in srgb, var(--income) 30%, var(--border-color));
}

.document-review-head,
.document-review-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.document-review-head strong {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.document-review-head p {
  margin-top: 0.15rem;
}

.document-review-head span {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-sm);
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 800;
}

.document-warning {
  margin: 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 8px;
  background: rgba(251, 191, 36, 0.08);
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.4;
}

.document-review-actions .primary-button,
.document-review-actions .secondary-button {
  flex: 0 1 auto;
}

.attachment-badge {
  width: fit-content;
  min-height: 26px;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 800;
}

.income-doc-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.income-doc-hint a {
  color: var(--accent);
  font-weight: 500;
}

.link-btn {
  margin-left: 0.5rem;
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.primary-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.primary-button:hover {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.secondary-button {
  padding: 0.875rem 1.5rem;
  background: var(--blue-dim);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-color));
  border-radius: 8px;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.secondary-button:hover {
  background: var(--bg-hover);
}

.icon-button {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.icon-button:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.icon-button.small {
  width: 32px;
  height: 32px;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.expense {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.badge.income {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge.transfer {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.expense {
  color: #ef4444;
}

.income {
  color: #10b981;
}

.transfer,
.muted-action {
  color: var(--text-secondary);
}

.history-panel {
  min-height: 300px;
}

.entry-list {
  display: grid;
  gap: 0.75rem;
}

.entry-record {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.entry-record-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--blue-dim);
  color: var(--accent);
}

.entry-record-main {
  min-width: 0;
  display: grid;
  gap: 0.35rem;
}

.entry-record-top,
.entry-record-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.entry-record-top {
  justify-content: space-between;
}

.entry-record-top strong {
  min-width: 0;
  color: var(--text-primary);
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-amount {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 0.92rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.entry-record-meta {
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.history-limit {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .entries-view {
    padding: 1rem;
  }

  .entries-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .entry-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .panel {
    padding: 1rem;
  }

  .segmented {
    flex-wrap: wrap;
  }

  .segment {
    flex: 1 1 120px;
  }

  .primary-fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .entry-record {
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: start;
  }

  .entry-record-icon {
    width: 34px;
    height: 34px;
  }

  .entry-record-top {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2rem;
  }

  .form-actions {
    flex-direction: column-reverse;
    gap: 0.7rem;
  }

  .primary-button,
  .secondary-button {
    width: 100%;
  }

}

.entries-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(340px, 0.82fr);
  align-items: start;
  gap: clamp(1rem, 2vw, 1.5rem);
}

.entry-primary,
.side-stack {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.manual-entry-disclosure {
  align-content: start;
}

.manual-entry-disclosure[open] {
  gap: 1rem;
}

.manual-entry-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  min-height: 58px;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-panel) 88%, var(--bg-hover));
  color: var(--text-primary);
  box-shadow: none;
  cursor: pointer;
  list-style: none;
}

.manual-entry-summary::-webkit-details-marker {
  display: none;
}

.manual-entry-summary span {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.manual-entry-summary strong {
  font-size: 0.94rem;
}

.manual-entry-summary small {
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.35;
}

.manual-entry-summary em {
  flex: 0 0 auto;
  color: var(--accent);
  font-size: 0.78rem;
  font-style: normal;
  font-weight: 800;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.mode-card.segment {
  min-height: 92px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  align-items: center;
  gap: 0.15rem 0.65rem;
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: none;
  text-align: left;
}

.mode-card.segment svg {
  grid-row: span 2;
  color: var(--accent);
}

.mode-card.segment strong {
  color: var(--text-primary);
  font-size: 0.94rem;
}

.mode-card.segment span {
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}

.mode-card.segment.active {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border-color));
  background: var(--blue-dim);
  box-shadow: var(--shadow-glow);
}

.entry-panel {
  gap: 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--border-color));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 34%),
    var(--bg-panel);
}

.entry-form-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-panel);
}

.entry-mode-copy {
  margin: 0;
}

.entry-mode-copy span {
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.form-actions {
  min-width: 260px;
  margin: 0;
}

.entry-form {
  display: grid;
  gap: 1rem;
}

.primary-fields {
  grid-template-columns: minmax(132px, 0.75fr) minmax(150px, 0.9fr) minmax(220px, 1.35fr);
}

.description-field {
  grid-column: auto;
}

.compact-section {
  padding-top: 0.15rem;
}

.status-switch {
  min-height: var(--touch-target-min);
  justify-content: center;
  padding: 0 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
}

.review-panel {
  display: grid;
  gap: 0.9rem;
}

.panel-head.compact {
  align-items: center;
  margin-bottom: 0;
}

.mini-link {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 800;
  text-decoration: none;
}

.review-panel label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 600;
}

.review-panel input,
.review-panel select {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.review-panel .form-row {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.history-panel {
  min-height: 0;
}

@media (max-width: 1120px) {
  .entries-premium-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .entries-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-stack {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .entries-header.operation-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .entries-hero-actions,
  .entries-hero-actions .primary-button,
  .entries-hero-actions .secondary-button {
    width: 100%;
  }

  .entries-premium-rail {
    grid-template-columns: minmax(0, 1fr);
  }

  .mode-switch {
    grid-template-columns: minmax(0, 1fr);
  }

  .mode-card.segment {
    min-height: 66px;
  }

  .entry-form-toolbar {
    position: static;
    grid-template-columns: minmax(0, 1fr);
  }

  .form-actions {
    min-width: 0;
    align-items: stretch;
    flex-direction: row-reverse;
    gap: 0.6rem;
  }

  .form-actions .primary-button {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }

  .form-actions .secondary-button {
    flex: 0 0 auto;
    width: auto;
    padding-inline: 1rem;
  }

  .primary-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
