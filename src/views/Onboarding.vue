<template>
  <main class="onboarding-view" data-testid="onboarding-page">
    <div class="onboarding-shell">
      <aside class="onboarding-side">
        <p class="eyebrow">Primeiros minutos</p>
        <h2>Uma decisão por vez.</h2>
        <p class="side-copy">O fluxo abre só o essencial. O restante fica disponível como opcional para evitar tela vazia demais ou campos demais logo no início.</p>
        <ol class="focus-path" data-testid="onboarding-focus-path">
          <li
            v-for="item in focusPath"
            :key="item.step"
            :class="{ active: step === item.step, complete: step > item.step }"
          >
            <span>{{ item.step }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.detail }}</small>
            </div>
          </li>
        </ol>
      </aside>

      <form class="onboarding-card" @submit.prevent="nextStep">
        <OnboardingStep
          v-if="step === 1"
          :index="1"
          :total="4"
          title="Primeira receita"
          description="Comece pelo dado que destrava o cálculo de capacidade segura. Renda extra e benefícios podem ficar para depois."
        >
          <label>
            Salário mensal
            <input v-model.number="form.salary" data-testid="onboarding-salary" type="number" min="0" step="0.01" />
          </label>

          <details class="optional-section">
            <summary>Tenho renda extra ou benefícios</summary>
            <div class="form-row">
              <label>
                Renda extra
                <input v-model.number="form.extraIncome" type="number" min="0" step="0.01" />
              </label>
              <label>
                Benefício VA
                <input v-model.number="form.vaAmount" type="number" min="0" step="0.01" />
              </label>
              <label>
                Benefício VR
                <input v-model.number="form.vrAmount" type="number" min="0" step="0.01" />
              </label>
            </div>
          </details>
        </OnboardingStep>

        <OnboardingStep
          v-else-if="step === 2"
          :index="2"
          :total="4"
          title="Conta principal"
          description="Informe onde o dinheiro fica. Isso já permite calcular saldo disponível e margem segura."
        >
          <div class="form-row">
            <label>
              Conta principal
              <input v-model.trim="form.accountName" data-testid="onboarding-account-name" maxlength="80" required />
            </label>
            <label>
              Saldo inicial
              <input v-model.number="form.accountBalance" data-testid="onboarding-account-balance" type="number" step="0.01" />
            </label>
          </div>

          <details class="optional-section">
            <summary>Personalizar perfil familiar</summary>
            <label>
              Nome de exibição opcional
              <input v-model.trim="form.displayName" autocomplete="name" maxlength="80" placeholder="Ex.: Ana" />
            </label>
            <label>
              Pessoas na casa
              <input v-model.number="form.householdSize" type="number" min="1" max="20" required />
            </label>
            <label>
              Objetivo principal
              <select v-model="form.objective" required>
                <option v-for="objective in objectives" :key="objective" :value="objective">{{ objective }}</option>
              </select>
            </label>
          </details>
        </OnboardingStep>

        <OnboardingStep
          v-else-if="step === 3"
          :index="3"
          :total="4"
          title="Cartão e primeiro gasto"
          description="Estas informações melhoram projeções, mas não bloqueiam o início. Preencha só se já souber agora."
        >
          <div class="optional-note">
            Você pode concluir sem cartão e sem despesa exemplo. O dashboard ficará pronto com receita e conta principal.
          </div>

          <details class="optional-section">
            <summary>Adicionar cartão de crédito</summary>
            <label>
              Cartão de crédito
              <input v-model.trim="form.cardName" data-testid="onboarding-card-name" maxlength="80" placeholder="Ex.: Cartão principal" />
            </label>
            <div class="form-row">
              <label>
                Limite do cartão
                <input v-model.number="form.cardLimit" data-testid="onboarding-card-limit" type="number" min="0" step="0.01" />
              </label>
              <label>
                Melhor dia de compra
                <input v-model.number="form.closingDay" type="number" min="1" max="31" />
              </label>
              <label>
                Vencimento
                <input v-model.number="form.dueDay" type="number" min="1" max="31" />
              </label>
            </div>
          </details>

          <details class="optional-section">
            <summary>Informar categorias e uma despesa exemplo</summary>
            <div class="category-grid">
              <label v-for="category in recurringCategories" :key="category" class="choice">
                <input v-model="form.recurringCategories" type="checkbox" :value="category" />
                <span>{{ category }}</span>
              </label>
            </div>
            <label>
              Despesa exemplo opcional
              <input v-model.number="form.sampleExpense" data-testid="onboarding-sample-expense" type="number" min="0" step="0.01" placeholder="Ex.: 120" />
            </label>
          </details>
        </OnboardingStep>

        <OnboardingStep
          v-else
          :index="4"
          :total="4"
          title="Finalização"
          description="Confira o que será criado. Nenhum gasto fictício será adicionado sem valor informado."
        >
          <div class="summary-grid">
            <div><span>Receita real</span><strong>{{ formatCurrency(realIncome) }}</strong></div>
            <div><span>Benefícios</span><strong>{{ formatCurrency(benefitIncome) }}</strong></div>
            <div><span>Conta/cartão</span><strong>{{ form.accountName }} / {{ form.cardName || 'sem cartão' }}</strong></div>
            <div><span>Progresso previsto</span><strong>100%</strong></div>
          </div>
          <OnboardingCompletion v-if="completed" />
        </OnboardingStep>

        <div class="step-actions">
          <button v-if="step > 1 && !completed" class="secondary-button" type="button" @click="step -= 1">Voltar</button>
          <button v-if="step < totalSteps" class="primary-button" type="submit">Continuar</button>
          <button v-else-if="!completed" class="primary-button" type="submit" data-testid="onboarding-finish">Concluir configuração</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import OnboardingCompletion from '@/components/onboarding/OnboardingCompletion.vue'
import OnboardingStep from '@/components/onboarding/OnboardingStep.vue'
import { useFinanceStore } from '@/stores/finance'
import { SOURCE_TYPES } from '@/constants/financial-structure'
import { ONBOARDING_OBJECTIVES } from '@/utils/release7-ux'

const financeStore = useFinanceStore()
const router = useRouter()
const step = ref(1)
const completed = ref(false)
const objectives = ONBOARDING_OBJECTIVES
const totalSteps = 4
const focusPath = [
  { step: 1, title: 'Receita', detail: 'Quanto entra por mês' },
  { step: 2, title: 'Conta', detail: 'Onde o saldo fica' },
  { step: 3, title: 'Opcionais', detail: 'Cartão e primeiro gasto' },
  { step: 4, title: 'Revisão', detail: 'Confirmar e entrar' },
]
const recurringCategories = ['Moradia', 'Mercado', 'Transporte', 'Saúde', 'Educação', 'Assinaturas', 'Cartão']

const form = reactive({
  displayName: '',
  householdSize: 1,
  objective: objectives[0],
  salary: 0,
  extraIncome: 0,
  vaAmount: 0,
  vrAmount: 0,
  accountName: 'Conta principal',
  accountBalance: 0,
  cardName: '',
  cardLimit: 0,
  closingDay: 20,
  dueDay: 8,
  recurringCategories: [],
  sampleExpense: 0,
})

const realIncome = computed(() => Number(form.salary || 0) + Number(form.extraIncome || 0))
const benefitIncome = computed(() => Number(form.vaAmount || 0) + Number(form.vrAmount || 0))

function nextStep() {
  if (step.value < totalSteps) {
    step.value += 1
    return
  }
  finishOnboarding()
}

function finishOnboarding() {
  const today = new Date().toISOString().split('T')[0]
  if (!(financeStore.state.familyMembers || []).length) {
    financeStore.addFamilyMember({ name: form.displayName || 'Usuário principal', role: 'administrator' })
  }
  const memberId = financeStore.state.familyMembers[0]?.id
  const account = financeStore.addFinancialAccount({
    name: form.accountName || 'Conta principal',
    type: 'Conta Corrente',
    balance: Number(form.accountBalance || 0),
  })
  let vaWallet = null
  let vrWallet = null
  if (Number(form.vaAmount || 0) > 0) {
    vaWallet = financeStore.addBenefitWallet({ name: 'VA principal', kind: 'va', balance: 0, monthlyRecharge: Number(form.vaAmount || 0), memberId })
  }
  if (Number(form.vrAmount || 0) > 0) {
    vrWallet = financeStore.addBenefitWallet({ name: 'VR principal', kind: 'vr', balance: 0, monthlyRecharge: Number(form.vrAmount || 0), memberId })
  }
  if (Number(form.cardLimit || 0) > 0) {
    financeStore.addCreditCard({
      name: form.cardName || 'Cartão principal',
      limit: Number(form.cardLimit || 0),
      closingDay: Number(form.closingDay || 20),
      dueDay: Number(form.dueDay || 8),
      holderMemberId: memberId,
    })
  }
  if (Number(form.salary || 0) > 0) {
    financeStore.addIncome({ date: today, type: 'Salário', amount: form.salary, sourceType: SOURCE_TYPES.ACCOUNT, sourceId: account.id, familyMemberId: memberId })
  }
  if (Number(form.extraIncome || 0) > 0) {
    financeStore.addIncome({ date: today, type: 'Outros', amount: form.extraIncome, sourceType: SOURCE_TYPES.ACCOUNT, sourceId: account.id, familyMemberId: memberId })
  }
  if (vaWallet) {
    financeStore.addIncome({ date: today, type: 'VA', amount: form.vaAmount, sourceType: SOURCE_TYPES.BENEFIT_VA, sourceId: vaWallet.id, familyMemberId: memberId })
  }
  if (vrWallet) {
    financeStore.addIncome({ date: today, type: 'VR', amount: form.vrAmount, sourceType: SOURCE_TYPES.BENEFIT_VR, sourceId: vrWallet.id, familyMemberId: memberId })
  }
  if (Number(form.sampleExpense || 0) > 0) {
    financeStore.addExpense({
      date: today,
      category: form.recurringCategories[0] || 'Mercado',
      description: 'Despesa exemplo',
      payment: vaWallet ? 'VA' : 'Pix',
      amount: Number(form.sampleExpense || 0),
      paid: false,
      sourceType: vaWallet ? SOURCE_TYPES.BENEFIT_VA : SOURCE_TYPES.ACCOUNT,
      sourceId: vaWallet?.id || account.id,
      familyMemberId: memberId,
    })
  }
  financeStore.updateSettings({
    onboardingCompletedAt: new Date().toISOString(),
    onboardingProfile: {
      displayName: form.displayName,
      householdSize: form.householdSize,
      objective: form.objective,
      recurringCategories: form.recurringCategories,
    },
  })
  completed.value = true
  setTimeout(() => router.push('/dashboard'), 650)
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
</script>

<style scoped>
.onboarding-view {
  min-height: calc(100vh - 64px);
  padding: var(--content-pad);
}
.onboarding-shell {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(240px, 0.75fr) minmax(0, 1.4fr);
  gap: 1rem;
  align-items: start;
}
.onboarding-side,
.onboarding-card {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}
.onboarding-side {
  position: sticky;
  top: 84px;
  display: grid;
  gap: 1rem;
  padding: 1rem;
}
.onboarding-side h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.2rem;
}
.side-copy {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}
.focus-path {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.focus-path li {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 0.7rem;
  align-items: start;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}
.focus-path li > span {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--text-muted);
  background: var(--bg-hover);
  font-weight: 800;
}
.focus-path li.active {
  border-color: rgba(124, 58, 237, 0.45);
  background: rgba(124, 58, 237, 0.08);
}
.focus-path li.active > span {
  color: #fff;
  background: var(--accent);
}
.focus-path li.complete > span {
  color: #fff;
  background: var(--success);
}
.focus-path strong,
.focus-path small {
  display: block;
}
.focus-path strong {
  color: var(--text-primary);
  font-size: 0.88rem;
}
.focus-path small {
  margin-top: 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}
.eyebrow {
  margin: 0;
  color: var(--accent-hover);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}
.onboarding-card {
  display: grid;
  gap: 1.2rem;
  padding: clamp(1rem, 3vw, 1.6rem);
}
.form-row,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
label {
  display: grid;
  gap: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 800;
}
input,
select {
  width: 100%;
  min-height: 42px;
  padding: 0.65rem 0.75rem;
}
.optional-section {
  display: grid;
  gap: 0.85rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}
.optional-section + .optional-section {
  margin-top: 0.85rem;
}
.optional-section summary {
  cursor: pointer;
  color: var(--text-primary);
  font-weight: 800;
}
.optional-section[open] summary {
  margin-bottom: 0.85rem;
}
.optional-note {
  padding: 0.85rem;
  border: 1px solid rgba(124, 58, 237, 0.24);
  border-radius: 8px;
  color: var(--text-secondary);
  background: rgba(124, 58, 237, 0.07);
  line-height: 1.45;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
}
.choice {
  min-height: 44px;
  grid-template-columns: auto 1fr;
  align-items: center;
  padding: 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-hover);
}
.choice input { width: auto; min-height: auto; }
.summary-grid div {
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}
.summary-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 0.74rem;
}
.summary-grid strong {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-primary);
}
.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}
@media (max-width: 860px) {
  .onboarding-shell,
  .form-row,
  .summary-grid { grid-template-columns: 1fr; }
  .onboarding-side { position: static; }
}
@media (max-width: 480px) {
  .onboarding-view { padding: 0.75rem; }
  .step-actions { display: grid; }
}
</style>
