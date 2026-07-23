<template>
  <DemoModeDashboard v-if="demoMode" />
  <div v-else-if="!hasInitialSetup" class="premium-dashboard initial-dashboard ledger-page-shell ledger-flow" data-testid="initial-dashboard">
    <section class="initial-dashboard-hero">
      <div>
        <p class="eyebrow">Mês atual · {{ selectedMonthLabel }}</p>
        <h1>Comece cadastrando sua primeira receita.</h1>
        <span>Com uma renda real, o app calcula saldo seguro, despesas previstas e próximos passos sem mostrar métricas vazias.</span>
      </div>
      <button class="submit-entry" type="button" data-testid="open-first-income-wizard" @click="openFirstIncomeWizard">
        <Plus /> Cadastrar primeira receita
      </button>
    </section>

    <section class="metrics-grid initial-metrics-grid" data-dashboard-section="initial-kpis">
      <article v-for="metric in initialMetricCards" :key="metric.label" class="metric-card">
        <div class="metric-head">
          <span>{{ metric.label }}</span>
          <div class="metric-icon" :class="metric.tone">
            <component :is="metric.icon" />
          </div>
        </div>
        <strong class="money" :class="metric.tone">{{ metric.value }}</strong>
        <small>{{ metric.detail }}</small>
      </article>
    </section>

    <section class="initial-next-step">
      <WalletCards />
      <div>
        <strong>O próximo passo será vincular uma conta ou cartão.</strong>
        <span>Por enquanto, a tela fica focada em Receitas, Despesas e Saldo para evitar ruído.</span>
      </div>
      <button type="button" @click="router.push('/accounts')">Configurar contas <ArrowRight /></button>
    </section>

    <div v-if="firstIncomeModalOpen" class="first-income-layer" data-testid="first-income-modal" role="dialog" aria-modal="true" aria-labelledby="first-income-title" @click.self="closeFirstIncomeWizard">
      <form class="first-income-modal" @submit.prevent="submitFirstIncome">
        <header>
          <div>
            <span>Primeira etapa</span>
            <h2 id="first-income-title">Cadastrar primeira receita</h2>
            <p>Informe o valor recorrente principal para iniciar o cálculo do mês atual.</p>
          </div>
          <button type="button" aria-label="Fechar cadastro de receita" @click="closeFirstIncomeWizard">×</button>
        </header>

        <label>
          <span>Descrição</span>
          <input v-model.trim="firstIncomeForm.description" required placeholder="Ex.: Salário mensal" />
        </label>

        <div class="quick-form-row">
          <label>
            <span>Valor</span>
            <input v-model="firstIncomeForm.amount" required inputmode="decimal" class="money" placeholder="R$ 0,00" />
          </label>
          <label>
            <span>Tipo</span>
            <select v-model="firstIncomeForm.type" required>
              <option v-for="category in suggestedIncomeTypes" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
        </div>

        <footer>
          <button class="secondary-action" type="button" @click="closeFirstIncomeWizard">Cancelar</button>
          <button class="submit-entry" type="submit"><Plus /> Salvar receita</button>
        </footer>
      </form>
    </div>
  </div>
  <div v-else-if="showFirstStepsMode" class="premium-dashboard first-steps-dashboard ledger-page-shell ledger-flow" data-testid="first-steps-mode">
    <section class="first-steps-hero" data-dashboard-section="first-steps-summary">
      <div>
        <p class="eyebrow">Primeiros passos · {{ selectedMonthLabel }}</p>
        <h1>Configure só o que libera clareza financeira.</h1>
        <span>Esta visualização mostra apenas Receita, Despesa, Metas e Resumo até a base estar pronta para o dashboard completo.</span>
      </div>
      <strong>{{ firstStepsStatus.completeCount }} de 2 bases essenciais prontas</strong>
    </section>

    <section class="first-steps-grid" data-testid="first-steps-sections">
      <article class="first-step-card" :class="{ complete: firstStepsStatus.hasIncome }" data-first-step-section="income">
        <div class="first-step-icon income"><ArrowUpCircle /></div>
        <div>
          <span>Receita</span>
          <strong class="money">{{ formatCurrency(periodIncomeTotal, hideBalance) }}</strong>
          <small>{{ firstStepsStatus.hasIncome ? 'Receita cadastrada no histórico.' : 'Complete sua primeira receita para ativar análises.' }}</small>
        </div>
        <button type="button" @click="router.push('/entries')">{{ firstStepsStatus.hasIncome ? 'Revisar receita' : 'Cadastrar receita' }}</button>
      </article>

      <article class="first-step-card" :class="{ complete: firstStepsStatus.hasExpense }" data-first-step-section="expense">
        <div class="first-step-icon expense"><ArrowDownCircle /></div>
        <div>
          <span>Despesa</span>
          <strong class="money">{{ formatCurrency(dashboardExpenseTotal, hideBalance) }}</strong>
          <small>{{ firstStepsStatus.hasExpense ? 'Gastos já aparecem no mês.' : 'Registre a primeira despesa real para evitar projeção vazia.' }}</small>
        </div>
        <button type="button" @click="router.push('/entries')">{{ firstStepsStatus.hasExpense ? 'Ver despesas' : 'Registrar despesa' }}</button>
      </article>

      <article class="first-step-card" :class="{ complete: firstStepsStatus.hasGoal }" data-first-step-section="goals">
        <div class="first-step-icon savings"><TrendingUp /></div>
        <div>
          <span>Metas</span>
          <strong>{{ firstStepsStatus.hasGoal ? `${goalRows[0]?.progress || 0}%` : 'Sem meta' }}</strong>
          <small>{{ firstStepsStatus.hasGoal ? goalRows[0]?.detail : 'Crie uma meta simples, como reserva de emergência.' }}</small>
        </div>
        <button type="button" @click="router.push('/goals')">{{ firstStepsStatus.hasGoal ? 'Ver metas' : 'Criar meta' }}</button>
      </article>

      <article class="first-step-card summary" :class="{ complete: firstStepsStatus.hasSummaryReady }" data-first-step-section="summary">
        <div class="first-step-icon"><WalletCards /></div>
        <div>
          <span>Resumo</span>
          <strong class="money">{{ formatCurrency(availableBalance, hideBalance) }}</strong>
          <small>{{ firstStepsStatus.hasSummaryReady ? 'Resumo pronto para decisões iniciais.' : 'O resumo fica útil após receita e pelo menos uma despesa ou meta.' }}</small>
        </div>
        <button type="button" @click="router.push('/plan')">Ver plano</button>
      </article>
    </section>
  </div>
  <div v-else class="premium-dashboard ledger-page-shell" data-testid="dashboard-page">
    <ExecutiveHero
      :summary="executiveSummary"
      data-dashboard-section="executive-hero"
      @focus-quick-income="focusQuickIncome"
    />
    <section class="dashboard-scope" data-testid="family-dashboard-mode">
      <span>Escopo</span>
      <button type="button" :class="{ active: dashboardScope === 'mine' }" @click="dashboardScope = 'mine'">Minha visão</button>
      <button type="button" :class="{ active: dashboardScope === 'family' }" @click="dashboardScope = 'family'">Família</button>
    </section>

    <nav class="dashboard-tabs" role="tablist" aria-label="Seções do dashboard" data-testid="dashboard-tabs">
      <button
        v-for="tab in dashboardTabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="activeDashboardTab === tab.key"
        :class="{ active: activeDashboardTab === tab.key }"
        @click="activeDashboardTab = tab.key"
      >
        <component :is="tab.icon" />
        <span>{{ tab.label }}</span>
        <small>{{ tab.detail }}</small>
      </button>
    </nav>

    <section class="v3-command-center" :class="`mode-${v3CommandCenter.mode}`" data-testid="v3-command-center">
      <div class="v3-command-main">
        <span>Comando do mês</span>
        <strong>{{ v3CommandCenter.headline }}</strong>
        <p>{{ v3CommandCenter.description }}</p>
        <button type="button" @click="runV3CommandAction(v3CommandPrimaryAction)">
          {{ v3CommandPrimaryAction.label }} <ArrowRight />
        </button>
        <button class="v3-secondary-action" type="button" @click="router.push('/command-center')">
          Abrir central completa
        </button>
      </div>
      <div class="v3-command-kpis">
        <div v-for="kpi in v3CommandCenter.kpis" :key="kpi.key" :class="kpi.tone">
          <span>{{ kpi.label }}</span>
          <strong class="money">{{ formatCurrency(kpi.value, hideBalance) }}</strong>
        </div>
      </div>
      <div class="v3-command-actions">
        <div v-if="v3CommandCenter.risks.length" class="v3-risk-list">
          <strong>Riscos</strong>
          <button
            v-for="risk in v3CommandCenter.risks.slice(0, 2)"
            :key="risk.key"
            type="button"
            :class="risk.severity"
            @click="router.push('/plan')"
          >
            <span>{{ risk.label }}</span>
            <small>{{ risk.detail }}</small>
          </button>
        </div>
        <div class="v3-action-list">
          <strong>Ações rápidas</strong>
          <button
            v-for="action in v3CommandCenter.actions.slice(0, 2)"
            :key="action.key"
            type="button"
            @click="runV3CommandAction(action)"
          >
            <span>{{ action.label }}</span>
            <small>{{ action.detail }}</small>
          </button>
        </div>
      </div>
    </section>

    <section
      v-show="activeDashboardTab === 'summary'"
      id="dashboard-tab-summary"
      class="dashboard-tab-panel"
      role="tabpanel"
      aria-label="Resumo"
      data-dashboard-tab-panel="summary"
    >
    <section class="balance-hero" data-dashboard-section="balance-hero">
      <div class="hero-copy">
        <p>Saldo disponível · {{ selectedMonthLabel }}</p>
        <strong class="hero-value money" :class="{ negative: availableBalance < 0 }">
          {{ formatCurrency(availableBalance, hideBalance) }}
        </strong>
        <div class="hero-comparison" :class="balanceDelta >= 0 ? 'positive' : 'negative'">
          <component :is="balanceDelta >= 0 ? ArrowUp : ArrowDown" />
          <span>{{ formatSignedCurrency(balanceDelta, hideBalance) }} vs mês anterior</span>
          <small>{{ balanceDeltaPercent }}</small>
        </div>
      </div>

      <div class="sparkline-card" aria-label="Evolução do saldo nos últimos seis meses">
        <span>Evolução · últimos 6 meses</span>
        <svg viewBox="0 0 260 82" role="img">
          <defs>
            <linearGradient id="balance-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="sparkAreaPath" fill="url(#balance-area)" />
          <polyline :points="sparkPoints" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          <circle :cx="sparkLastPoint.x" :cy="sparkLastPoint.y" r="7" fill="var(--blue-mid)" />
          <circle :cx="sparkLastPoint.x" :cy="sparkLastPoint.y" r="3.5" fill="var(--accent)" />
          <text
            v-for="item in sparkSeries"
            :key="item.key"
            :x="item.x"
            y="80"
            text-anchor="middle"
          >{{ item.label }}</text>
        </svg>
      </div>
    </section>

    <details class="dashboard-secondary-details dashboard-insight-details">
      <summary>
        <span>Resumo executivo</span>
        <small>Diagnóstico e sinais do mês sem ocupar a primeira leitura.</small>
      </summary>

    <section class="intelligence-brief" :class="financialBrief.tone" data-dashboard-section="financial-brief">
      <div class="brief-icon"><Sparkles /></div>
      <div class="brief-copy">
        <span>Resumo executivo</span>
        <strong>{{ financialBrief.title }}</strong>
        <p>{{ financialBrief.description }}</p>
      </div>
      <div class="brief-signals">
        <div v-for="signal in financialBrief.signals" :key="signal.label">
          <span>{{ signal.label }}</span>
          <strong class="money">{{ signal.value }}</strong>
        </div>
      </div>
      <button class="brief-cta" type="button" @click="router.push('/intelligence')">
        Abrir análise <ArrowRight />
      </button>
    </section>
    </details>

    <section class="dashboard-data-entry-cta" data-testid="dashboard-data-entry-cta">
      <div>
        <span>Entrada de dados</span>
        <strong>Registre uma receita ou despesa sem procurar o formulário.</strong>
        <small>O lançamento rápido abre no topo da aba de cadastro e atualiza estas métricas.</small>
      </div>
      <button type="button" @click="openDataEntryTab('expense')">
        <Plus /> Registrar agora
      </button>
    </section>

    <LedgerSection :divided="false" class="dashboard-ledger-section">
      <section class="metrics-grid ledger-stat-strip dashboard-ledger-strip" data-dashboard-section="dashboard-kpis">
        <article v-for="metric in metricCards" :key="metric.label" class="metric-card">
          <div class="metric-head">
            <span>{{ metric.label }}</span>
            <div class="metric-icon" :class="metric.tone">
              <component :is="metric.icon" />
            </div>
          </div>
          <strong class="money" :class="metric.tone">{{ metric.value }}</strong>
          <small>{{ metric.detail }}</small>
        </article>
      </section>
    </LedgerSection>
    </section>

    <details v-show="activeDashboardTab === 'analysis'" v-if="hasPredictiveData" class="dashboard-secondary-details dashboard-insight-details">
      <summary>
        <span>Previsões do consultor</span>
        <small>Fechamento, capacidade segura e risco principal ficam sob demanda.</small>
      </summary>

    <section class="metrics-grid advisor-summary-grid" data-testid="dashboard-advisor-cards" data-dashboard-section="advisor-summary">
      <article class="metric-card">
        <div class="metric-head">
          <span>Fechamento previsto</span>
          <div class="metric-icon savings"><TrendingUp /></div>
        </div>
        <strong class="money">{{ formatCurrency(predictiveSnapshot.summary.projectedClosing, hideBalance) }}</strong>
        <small>Consultor preditivo</small>
      </article>
      <article class="metric-card">
        <div class="metric-head">
          <span>Capacidade segura</span>
          <div class="metric-icon income"><WalletCards /></div>
        </div>
        <strong class="money">{{ formatCurrency(predictiveSnapshot.summary.safeInvestmentCapacity, hideBalance) }}</strong>
        <small>Antes de investir</small>
      </article>
      <article class="metric-card">
        <div class="metric-head">
          <span>Principal risco</span>
          <div class="metric-icon expense"><Sparkles /></div>
        </div>
        <strong>{{ predictiveSnapshot.summary.mainRisk }}</strong>
        <small><button type="button" class="inline-link" @click="router.push('/advisor')">Abrir Consultor</button></small>
      </article>
    </section>
    </details>

    <section
      v-show="activeDashboardTab === 'data-entry'"
      id="dashboard-tab-data-entry"
      class="dashboard-tab-panel dashboard-data-entry-panel"
      role="tabpanel"
      aria-label="Entrada de dados"
      data-dashboard-tab-panel="data-entry"
    >
      <article class="premium-panel quick-entry-panel" :class="{ 'focus-pulse': quickEntryFocused }" data-dashboard-section="quick-entry">
        <header class="panel-header compact">
          <div>
            <h2>Lançamento rápido</h2>
            <p>Registre sem sair do dashboard</p>
          </div>
        </header>

        <form class="quick-form" @submit.prevent="submitQuickEntry">
          <div class="entry-type-toggle">
            <button type="button" data-testid="quick-entry-type-expense" :class="{ active: quickEntry.type === 'expense' }" @click="setQuickType('expense')">Despesa</button>
            <button type="button" data-testid="quick-entry-type-income" :class="{ active: quickEntry.type === 'income' }" @click="setQuickType('income')">Receita</button>
          </div>

          <label>
            <span>Descrição</span>
            <input v-model.trim="quickEntry.description" required placeholder="Ex.: Supermercado" />
          </label>

          <div class="quick-form-row">
            <label>
              <span>Valor</span>
              <input v-model="quickEntry.amount" required inputmode="decimal" class="money" placeholder="R$ 0,00" />
            </label>
            <label>
              <span>{{ quickEntry.type === 'expense' ? 'Categoria' : 'Tipo' }}</span>
              <select v-model="quickEntry.category" required data-testid="quick-entry-category">
                <option v-for="category in quickCategories" :key="category" :value="category">{{ category }}</option>
              </select>
            </label>
          </div>

          <button class="submit-entry" type="submit">
            <Plus /> Registrar lançamento
          </button>
        </form>
      </article>
    </section>

    <DashboardGrid v-show="activeDashboardTab !== 'data-entry'" :class="`dashboard-grid-tab-${activeDashboardTab}`">
      <template #main>
      <article v-show="activeDashboardTab === 'expenses'" class="premium-panel transactions-panel" data-dashboard-tab-panel="expenses" data-dashboard-section="recent-entries">
        <header class="panel-header">
          <div>
            <h2>Lançamentos recentes</h2>
            <p>{{ periodLabel }}</p>
          </div>
          <button type="button" @click="router.push('/entries')">Ver todos <ArrowRight /></button>
        </header>

        <div v-if="recentEntries.length" class="transaction-list">
          <button
            v-for="entry in recentEntries"
            :key="`${entry.type}-${entry.id}`"
            type="button"
            class="transaction-row"
            @click="router.push('/entries')"
          >
            <span class="transaction-icon" :class="entry.type">
              <component :is="entry.icon" />
            </span>
            <span class="transaction-copy">
              <strong>{{ entry.description }}</strong>
              <small>{{ formatDate(entry.date) }} · <em>{{ entry.category }}</em></small>
            </span>
            <b class="money" :class="entry.type">
              {{ entry.type === 'income' ? '+' : '-' }} {{ formatCurrency(entry.amount, hideBalance) }}
            </b>
          </button>
        </div>

        <div v-else class="empty-state">
          <Receipt />
          <strong>Nenhum lançamento neste período</strong>
          <span>Use o formulário ao lado para registrar a primeira movimentação.</span>
        </div>
      </article>

        <article v-show="activeDashboardTab === 'expenses'" class="premium-panel category-panel" data-dashboard-section="category-summary">
          <header class="panel-header compact">
            <h2>Despesas por categoria</h2>
            <button type="button" @click="router.push('/reports')">Detalhes <ArrowRight /></button>
          </header>

          <div v-if="categoryBreakdown.length" class="donut-layout">
            <div class="donut" :style="{ background: donutGradient }">
              <div>
                <strong>{{ selectedMonthShort }}</strong>
                <span>{{ financeStore.state.settings.year }}</span>
              </div>
            </div>
            <div class="donut-legend">
              <div v-for="category in categoryBreakdown" :key="category.name">
                <span><i :style="{ background: category.color }" />{{ category.name }}</span>
                <b class="money">{{ category.percent }}%</b>
              </div>
            </div>
          </div>
          <div v-else class="mini-empty actionable-empty">
            <strong>Categorias</strong>
            <span>Registre uma despesa para ativar categorias e análises do período.</span>
            <div class="empty-actions">
              <button type="button" data-testid="simulate-expenses-action" @click="router.push('/simulations')">Simular gastos</button>
              <button type="button" @click="router.push('/budget')">Criar categoria</button>
            </div>
          </div>
        </article>

        <details v-show="activeDashboardTab === 'summary'" class="dashboard-secondary-details dashboard-grid-details">
          <summary>
            <span>Plano e alertas</span>
            <small>Ações recomendadas, riscos e próximas atenções.</small>
          </summary>

        <article class="premium-panel month-plan-panel" data-dashboard-section="month-plan">
          <header class="panel-header compact">
            <div>
              <h2>Plano do mês</h2>
              <p>Resumo operacional para agir agora</p>
            </div>
            <button type="button" @click="router.push('/plan')">Abrir plano <ArrowRight /></button>
          </header>
          <div class="action-stack">
            <div v-for="item in monthPlanRows" :key="item.label" class="action-row">
              <span class="action-dot" :class="item.tone" />
              <div>
                <strong>{{ item.label }}</strong>
                <small>{{ item.detail }}</small>
              </div>
            </div>
          </div>
        </article>

        <article class="premium-panel alerts-panel" data-dashboard-section="dashboard-alerts">
          <header class="panel-header compact">
            <div>
              <h2>Próximas atenções</h2>
              <p>Contas, alertas e prioridades do cockpit</p>
            </div>
          </header>
          <div class="attention-list">
            <div v-for="alert in attentionRows" :key="alert.label" class="attention-row" :class="alert.tone">
              <strong>{{ alert.label }}</strong>
              <span>{{ alert.detail }}</span>
            </div>
          </div>
        </article>
        </details>
      </template>

      <template #aside>
        <details v-show="activeDashboardTab === 'expenses'" class="dashboard-secondary-details">
          <summary>
            <span>Compromissos do mês</span>
            <small>Orçamento e assinaturas ficam acessíveis sem lotar a lateral.</small>
          </summary>

        <article class="premium-panel budget-panel" data-dashboard-section="budget-summary">
          <header class="panel-header compact">
            <div>
              <h2>Orçamento mensal</h2>
              <p>Metas sugeridas pela renda</p>
            </div>
            <button type="button" @click="router.push('/budget')">Ajustar <ArrowRight /></button>
          </header>

          <div v-if="budgetRows.length" class="budget-list">
            <div v-for="budget in budgetRows" :key="budget.name" class="budget-row">
              <div class="budget-copy">
                <span><i :style="{ background: budget.color }" />{{ budget.name }}</span>
                <b class="money">{{ compactCurrency(budget.spent) }} / {{ compactCurrency(budget.target) }} · {{ budget.percent }}%</b>
              </div>
              <div class="budget-track">
                <span :class="{ exceeded: budget.percent > 90 }" :style="{ width: `${Math.min(100, budget.percent)}%`, background: budget.color }" />
              </div>
            </div>
          </div>
          <div v-else class="mini-empty">Sem orçamento executado no período.</div>
        </article>

        <article class="premium-panel subscriptions-panel" data-dashboard-section="subscriptions-summary">
          <header class="panel-header compact">
            <div>
              <h2>Assinaturas do mês</h2>
              <p>Previsão recorrente sem duplicar cobranças pagas</p>
            </div>
            <button type="button" @click="router.push('/subscriptions')">Gerenciar <ArrowRight /></button>
          </header>
          <div class="subscription-summary-card">
            <strong>{{ formatCurrency(subscriptionSummary.totalMonthly, hideBalance) }} em assinaturas este mês</strong>
            <span>{{ subscriptionNextChargeText }}</span>
            <small>{{ subscriptionAlertText }}</small>
          </div>
        </article>
        </details>

        <section
          v-show="activeDashboardTab === 'goals'"
          id="dashboard-tab-goals"
          class="dashboard-tab-panel dashboard-goals-panel"
          role="tabpanel"
          aria-label="Metas"
          data-dashboard-tab-panel="goals"
        >
        <article class="premium-panel goals-panel" data-dashboard-section="goals-summary">
          <header class="panel-header compact">
            <div>
              <h2>Metas do mês</h2>
              <p>Progresso resumido</p>
            </div>
            <button type="button" @click="router.push('/goals')">Ver metas <ArrowRight /></button>
          </header>
          <div class="compact-list">
            <div v-for="goal in goalRows" :key="goal.name" class="compact-row">
              <div>
                <strong>{{ goal.name }}</strong>
                <small>{{ goal.detail }}</small>
              </div>
              <b>{{ goal.progress }}%</b>
            </div>
          </div>
          <button
            v-if="!hasActiveGoals"
            class="inline-empty-action"
            type="button"
            data-testid="create-first-goal-action"
            @click="router.push('/goals')"
          >
            + Criar minha primeira meta
          </button>
        </article>
        </section>

        <details v-show="activeDashboardTab === 'analysis'" class="dashboard-secondary-details" data-testid="dashboard-secondary-toggle">
          <summary>
            <span>Mais análises</span>
            <small>Automações e assistente contextual sob demanda.</small>
          </summary>

        <article class="premium-panel automations-panel" data-dashboard-section="automation-summary">
          <header class="panel-header compact">
            <div>
              <h2>Automações ativas</h2>
              <p>Alertas controlados, sem ação financeira automática</p>
            </div>
            <button type="button" @click="router.push('/automations')">Gerenciar <ArrowRight /></button>
          </header>
          <div class="compact-list">
            <div v-for="automation in automationRows" :key="automation.name" class="compact-row">
              <div>
                <strong>{{ automation.name }}</strong>
                <small>{{ automation.detail }}</small>
              </div>
              <b>{{ automation.status }}</b>
            </div>
          </div>
        </article>

        <ContextualAssistant context-type="dashboard" class="dashboard-assistant" compact data-dashboard-section="dashboard-assistant" />
        </details>
      </template>
    </DashboardGrid>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { useNotification } from '@/composables/useNotification'
import DemoModeDashboard from '@/components/DemoModeDashboard.vue'
import ExecutiveHero from '@/components/ExecutiveHero.vue'
import ContextualAssistant from '@/components/ContextualAssistant.vue'
import DashboardGrid from '@/components/layout/DashboardGrid.vue'
import LedgerSection from '@/components/layout/LedgerSection.vue'
import { buildExecutiveSummary, getFirstStepsStatus, getInitialSetupStatus, isDemoMode } from '@/utils/release7-ux'
import { buildMonthlyPlan } from '@/utils/planning-engine.js'
import { buildPredictiveSnapshot } from '@/domain/predictive/index.js'
import { buildV3CommandCenter } from '@/domain/v3/commandCenter.js'
import { quantityLabel } from '@/utils/pt-br-copy.js'
import { buildSubscriptionSummary } from '@/utils/subscriptions.js'
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowRight,
  ArrowUp,
  ArrowUpCircle,
  Car,
  Clapperboard,
  HeartPulse,
  Home as HomeIcon,
  Plus,
  Receipt,
  Sparkles,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const financeStore = useFinanceStore()
const { showToast } = useNotification()
const dashboardScope = ref('mine')
const activeDashboardTab = ref('summary')
const quickEntryFocused = ref(false)
const firstIncomeModalOpen = ref(false)
let quickEntryFocusTimer = null

const categoryColors = ['#0369a1', '#059669', '#b45309', '#0e7490', '#0f766e', '#be123c']
const dashboardTabs = [
  { key: 'summary', label: 'Resumo', detail: 'Saldo e KPIs', icon: WalletCards },
  { key: 'expenses', label: 'Despesas', detail: 'Gastos e categorias', icon: ArrowDownCircle },
  { key: 'goals', label: 'Metas', detail: 'Progresso mensal', icon: TrendingUp },
  { key: 'analysis', label: 'Análises', detail: 'Riscos e automações', icon: Sparkles },
  { key: 'data-entry', label: 'Entrada de dados', detail: 'Lançamento rápido', icon: Plus },
]
const PRIMARY_EXPENSE_CATEGORIES = ['Mercado', 'Moradia', 'Transporte', 'Assinaturas', 'Lazer', 'Outros']
const PRIMARY_INCOME_TYPES = ['Salário', 'Freelancer', 'Pix recebido', 'Reembolso', 'Venda de Produtos', 'Outros']
const quickEntry = reactive({
  type: 'expense',
  description: '',
  amount: '',
  category: PRIMARY_EXPENSE_CATEGORIES[0],
})
const firstIncomeForm = reactive({
  description: 'Receita mensal',
  amount: '',
  type: PRIMARY_INCOME_TYPES[0],
})

const activePeriod = computed(() => {
  const period = String(route.query.period || 'month')
  return ['today', 'week', 'month', 'year'].includes(period) ? period : 'month'
})

const demoMode = computed(() => isDemoMode(route))
const initialSetupStatus = computed(() => getInitialSetupStatus(financeStore.state, financeStore.calcMonth))
const hasInitialSetup = computed(() => initialSetupStatus.value.complete)
const firstStepsStatus = computed(() => getFirstStepsStatus(financeStore.state))
const showFirstStepsMode = computed(() => hasInitialSetup.value && !firstStepsStatus.value.complete)
const hasPredictiveData = computed(() =>
  Boolean(
    financeStore.state.incomes.length
      || financeStore.state.expenses.length
      || financeStore.state.planningGoals.length
      || financeStore.state.wishlist.length,
  ),
)
const hideBalance = computed(() => financeStore.state.settings.hideBalance)
const selectedMonth = computed(() => normalizeMonth(financeStore.state.settings.selectedMonth))
const selectedYear = computed(() => normalizeYear(financeStore.state.settings.year))
const monthData = computed(() => financeStore.calcMonth(selectedMonth.value))
const availableBalance = computed(() => monthData.value.cashBalance - monthData.value.cardBill)
const executiveSummary = computed(() => buildExecutiveSummary(financeStore.state, financeStore.calcMonth))

const selectedMonthLabel = computed(() => `${financeStore.monthNames[selectedMonth.value - 1]}/${selectedYear.value}`)
const selectedMonthShort = computed(() => financeStore.monthNames[selectedMonth.value - 1]?.slice(0, 3) || 'Mês')
const periodLabel = computed(() => ({
  today: 'Movimentacoes de hoje',
  week: 'Ultimos sete dias',
  month: selectedMonthLabel.value,
  year: `Ano de ${selectedYear.value}`,
})[activePeriod.value])

const quickCategories = computed(() => categoriesForQuickType(quickEntry.type))
const suggestedIncomeTypes = computed(() => suggestedOptions(financeStore.incomeTypes, PRIMARY_INCOME_TYPES))

const allEntries = computed(() => [
  ...financeStore.state.expenses.map((entry) => ({
    ...entry,
    type: 'expense',
    category: entry.category || 'Despesa',
  })),
  ...financeStore.state.incomes.map((entry) => ({
    ...entry,
    type: 'income',
    category: entry.type || 'Receita',
  })),
])

const periodEntries = computed(() => allEntries.value.filter((entry) => isInActivePeriod(entry.date)))
const periodIncomes = computed(() => periodEntries.value.filter((entry) => entry.type === 'income'))
const periodExpenses = computed(() => periodEntries.value.filter((entry) => entry.type === 'expense'))
const periodIncomeTotal = computed(() => sumAmounts(periodIncomes.value))
const periodExpenseTotal = computed(() => sumAmounts(periodExpenses.value))
const subscriptionForecastTotal = computed(() => (
  activePeriod.value === 'month'
    ? Number(subscriptionSummary.value.monthImpact?.forecastTotal || 0)
    : 0
))
const dashboardExpenseTotal = computed(() => periodExpenseTotal.value + subscriptionForecastTotal.value)
const periodSavings = computed(() => periodIncomeTotal.value - dashboardExpenseTotal.value)
const savingsRate = computed(() => periodIncomeTotal.value > 0 ? Math.round((periodSavings.value / periodIncomeTotal.value) * 100) : 0)
const expenseCommitment = computed(() => periodIncomeTotal.value > 0
  ? Math.round((dashboardExpenseTotal.value / periodIncomeTotal.value) * 100)
  : 0)
const balanceCoverage = computed(() => dashboardExpenseTotal.value > 0
  ? Math.max(0, availableBalance.value / dashboardExpenseTotal.value)
  : 0)
const balanceCoverageText = computed(() => (
  dashboardExpenseTotal.value > 0
    ? `${balanceCoverage.value.toFixed(1).replace('.', ',')}x dos gastos`
    : 'Sem gastos no período'
))

const financialBrief = computed(() => {
  const rate = savingsRate.value
  const commitment = expenseCommitment.value
  const isHealthy = availableBalance.value >= 0 && rate >= 15
  const needsAttention = availableBalance.value < 0 || commitment > 90

  return {
    tone: needsAttention ? 'attention' : isHealthy ? 'healthy' : 'stable',
    title: needsAttention
      ? 'A margem financeira pede atenção'
      : isHealthy
        ? 'Seu ritmo financeiro está saudável'
        : 'Cenário estável, com espaço para otimização',
    description: needsAttention
      ? 'Priorize despesas essenciais e revise compromissos antes de assumir novas parcelas.'
      : isHealthy
        ? 'A economia do período está acima da faixa de segurança e o saldo mantém cobertura positiva.'
        : 'Pequenos ajustes no orçamento podem elevar sua reserva sem comprometer a rotina.',
    signals: [
      { label: 'Economia', value: `${rate}%` },
      { label: 'Comprometimento', value: `${commitment}%` },
      { label: 'Cobertura do saldo', value: balanceCoverageText.value },
    ],
  }
})

const previousMonthData = computed(() => {
  const date = new Date(selectedYear.value, selectedMonth.value - 2, 1)
  return aggregateMonth(date.getFullYear(), date.getMonth() + 1)
})
const balanceDelta = computed(() => availableBalance.value - previousMonthData.value.balance)
const balanceDeltaPercent = computed(() => {
  const previous = Math.abs(previousMonthData.value.balance)
  if (!previous) return 'sem comparativo'
  const percent = (balanceDelta.value / previous) * 100
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1).replace('.', ',')}%`
})

const initialMetricCards = computed(() => [
  {
    label: 'Receitas',
    value: formatCurrency(periodIncomeTotal.value, hideBalance.value),
    detail: periodIncomeTotal.value > 0 ? selectedMonthLabel.value : 'Cadastre sua renda principal',
    tone: 'income',
    icon: ArrowUpCircle,
  },
  {
    label: 'Despesas',
    value: formatCurrency(dashboardExpenseTotal.value, hideBalance.value),
    detail: dashboardExpenseTotal.value > 0 ? periodLabel.value : 'Ainda sem gastos no mês',
    tone: 'expense',
    icon: ArrowDownCircle,
  },
  {
    label: 'Saldo',
    value: formatCurrency(availableBalance.value, hideBalance.value),
    detail: 'resultado previsto do mês atual',
    tone: availableBalance.value >= 0 ? 'income' : 'expense',
    icon: WalletCards,
  },
])

const hasDashboardMetricData = computed(() => (
  periodIncomeTotal.value > 0
  || dashboardExpenseTotal.value > 0
  || availableBalance.value !== 0
))

const metricCards = computed(() => {
  const cards = []
  if (periodIncomeTotal.value > 0) {
    cards.push({
      label: 'Receitas',
      value: formatCurrency(periodIncomeTotal.value, hideBalance.value),
      detail: periodLabel.value,
      tone: 'income',
      icon: ArrowUpCircle,
    })
  }
  if (dashboardExpenseTotal.value > 0) {
    cards.push({
      label: 'Despesas',
      value: formatCurrency(dashboardExpenseTotal.value, hideBalance.value),
      detail: subscriptionForecastTotal.value > 0
        ? `${quantityLabel(periodExpenses.value.length, 'lançamento', 'lançamentos')} + ${formatCurrency(subscriptionForecastTotal.value, hideBalance.value)} previstos`
        : quantityLabel(periodExpenses.value.length, 'lançamento', 'lançamentos'),
      tone: 'expense',
      icon: ArrowDownCircle,
    })
  }
  if (hasDashboardMetricData.value) {
    cards.push({
      label: 'Saldo',
      value: formatCurrency(availableBalance.value, hideBalance.value),
      detail: selectedMonthLabel.value,
      tone: availableBalance.value >= 0 ? 'income' : 'expense',
      icon: WalletCards,
    })
  }
  if (periodIncomeTotal.value > 0 && dashboardExpenseTotal.value > 0) {
    cards.push({
      label: 'Economia',
      value: formatCurrency(periodSavings.value, hideBalance.value),
      detail: `${savingsRate.value}% da renda do período`,
      tone: 'savings',
      icon: TrendingUp,
    })
  }
  if (dashboardExpenseTotal.value > 0 && availableBalance.value > 0) {
    cards.push({
      label: 'Cobertura do saldo',
      value: `${balanceCoverage.value.toFixed(1).replace('.', ',')}x`,
      detail: 'saldo disponível dividido pelos gastos do período',
      tone: balanceCoverage.value >= 1 ? 'income' : 'expense',
      icon: WalletCards,
    })
  }
  return cards
})

const recentEntries = computed(() => periodEntries.value
  .map((entry) => ({ ...entry, icon: iconForEntry(entry) }))
  .sort((a, b) => entryTimestamp(b) - entryTimestamp(a))
  .slice(0, 7))

const categoryBreakdown = computed(() => {
  const totals = new Map()
  for (const expense of periodExpenses.value) {
    const name = expense.category || 'Outros'
    totals.set(name, (totals.get(name) || 0) + Number(expense.amount || 0))
  }
  if (subscriptionForecastTotal.value > 0) {
    totals.set('Assinaturas', (totals.get('Assinaturas') || 0) + subscriptionForecastTotal.value)
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index],
      percent: total ? Math.round((value / total) * 100) : 0,
    }))
})

const donutGradient = computed(() => {
  if (!categoryBreakdown.value.length) return 'var(--bg-elevated)'
  let cursor = 0
  const stops = categoryBreakdown.value.map((category) => {
    const start = cursor
    cursor += category.percent
    return `${category.color} ${start}% ${cursor}%`
  })
  if (cursor < 100) stops.push(`var(--bg-elevated) ${cursor}% 100%`)
  return `conic-gradient(${stops.join(', ')})`
})

const budgetRows = computed(() => {
  const baseIncome = Math.max(monthData.value.incomeCash + monthData.value.vaIncome, periodIncomeTotal.value)
  const shares = [0.22, 0.16, 0.12, 0.09]
  const rows = categoryBreakdown.value.map((category, index) => {
    const target = Math.max(category.value, baseIncome * shares[index])
    return {
      ...category,
      spent: category.value,
      target,
      percent: target ? Math.round((category.value / target) * 100) : 0,
    }
  })
  return rows
})

const monthlyPlan = computed(() => buildMonthlyPlan(financeStore.state))
const predictiveSnapshot = computed(() => buildPredictiveSnapshot(financeStore.state, dashboardReferenceDate.value))
const subscriptionSummary = computed(() => buildSubscriptionSummary(financeStore.state, dashboardReferenceDate.value))
const v3CommandCenter = computed(() => buildV3CommandCenter({
  state: financeStore.state,
  executiveSummary: executiveSummary.value,
  subscriptionSummary: subscriptionSummary.value,
  monthData: monthData.value,
  availableBalance: availableBalance.value,
}))
const v3CommandPrimaryAction = computed(() => v3CommandCenter.value.primaryAction)

const dashboardReferenceDate = computed(() => {
  const day = Math.min(new Date().getDate(), new Date(selectedYear.value, selectedMonth.value, 0).getDate())
  return `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
})

const subscriptionNextChargeText = computed(() => {
  const next = subscriptionSummary.value.nextCharge
  if (!next) return 'Nenhuma cobrança prevista nos próximos 30 dias.'
  return `Próxima: ${next.name} — ${formatCurrency(next.amount, hideBalance.value)} em ${next.daysUntil} dia${next.daysUntil === 1 ? '' : 's'}`
})

const subscriptionAlertText = computed(() => {
  const alert = subscriptionSummary.value.alerts[0]
  if (!alert) return 'Sem alertas críticos de assinatura.'
  return alert.description
})

const monthPlanRows = computed(() => {
  const plan = monthlyPlan.value
  const riskyBudgetCount = plan.budgets.filter((budget) => ['attention', 'overrun'].includes(budget.risk)).length
  return [
    {
      label: plan.month_risk === 'critical' ? 'Reduzir compromissos antes de comprar' : plan.month_risk === 'attention' ? 'Revisar categorias em atenção' : 'Mês sob controle',
      detail: plan.month_risk === 'stable'
        ? `Margem livre estimada: ${formatCurrency(plan.free_amount_for_purchases, hideBalance.value)}`
        : `${quantityLabel(riskyBudgetCount, 'categoria', 'categorias')} ${riskyBudgetCount === 1 ? 'pede' : 'pedem'} revisão`,
      tone: plan.month_risk === 'critical' ? 'danger' : plan.month_risk === 'attention' ? 'warning' : 'ok',
    },
    {
      label: 'Capacidade de investimento',
      detail: plan.answers.can_invest
        ? `Contribuição segura sugerida: ${formatCurrency(plan.recommended_contribution, hideBalance.value)}`
        : 'Aguarde uma sobra segura antes de investir.',
      tone: plan.answers.can_invest ? 'ok' : 'warning',
    },
    {
      label: 'Compras pequenas',
      detail: plan.answers.can_buy_small_items
        ? 'Permitidas dentro da margem livre.'
        : 'Melhor aguardar nova entrada ou cortar gasto variável.',
      tone: plan.answers.can_buy_small_items ? 'ok' : 'warning',
    },
  ]
})

const attentionRows = computed(() => {
  const rows = []
  const openPriceAlerts = (financeStore.state.priceMonitorAlerts || []).filter((alert) => alert.status === 'open')
  if (availableBalance.value < 0) {
    rows.push({
      label: 'Saldo disponível negativo',
      detail: 'Priorize despesas essenciais e evite novas parcelas.',
      tone: 'danger',
    })
  }
  if (expenseCommitment.value >= 85) {
    rows.push({
      label: 'Comprometimento alto',
      detail: `${expenseCommitment.value}% da renda do período já está comprometida.`,
      tone: 'warning',
    })
  }
  if (openPriceAlerts.length) {
    rows.push({
      label: `${quantityLabel(openPriceAlerts.length, 'alerta', 'alertas')} de preço`,
      detail: openPriceAlerts[0]?.message || 'Revise oportunidades antes de comprar.',
      tone: 'ok',
    })
  }
  const riskyBudget = monthlyPlan.value.budgets.find((budget) => ['attention', 'overrun'].includes(budget.risk))
  if (riskyBudget) {
    rows.push({
      label: `${riskyBudget.category} perto do limite`,
      detail: `Uso atual: ${Math.round(riskyBudget.percent_used * 100)}% do planejado.`,
      tone: riskyBudget.risk === 'overrun' ? 'danger' : 'warning',
    })
  }
  if (!rows.length) {
    rows.push({
      label: 'Nenhuma conta crítica agora',
      detail: 'Tudo certo para os próximos dias.',
      tone: 'ok',
    })
  }
  return rows.slice(0, 4)
})

const hasActiveGoals = computed(() => (financeStore.state.planningGoals || [])
  .some((goal) => goal.status !== 'cancelled'))

const goalRows = computed(() => {
  const goals = (financeStore.state.planningGoals || [])
    .filter((goal) => goal.status !== 'cancelled')
    .slice(0, 3)
    .map((goal) => {
      const target = Number(goal.target_amount || goal.targetAmount || 0)
      const current = Number(goal.current_amount || goal.currentAmount || 0)
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      return {
        name: goal.name || 'Meta sem nome',
        progress,
        detail: target > 0
          ? `${compactCurrency(current)} de ${compactCurrency(target)}`
          : 'Defina valor alvo para acompanhar.',
      }
    })

  return goals.length ? goals : [{
    name: 'Nenhuma meta ativa',
    progress: 0,
    detail: 'Crie uma meta para acompanhar o progresso mensal.',
  }]
})

const automationRows = computed(() => {
  const openAlerts = (financeStore.state.priceMonitorAlerts || []).filter((alert) => alert.status === 'open')
  const rows = []
  if (openAlerts.length) {
    rows.push({
      name: 'Alertas de preço',
      detail: `${quantityLabel(openAlerts.length, 'notificação in-app', 'notificações in-app')} aguardando revisão.`,
      status: 'ativo',
    })
  }
  if ((financeStore.state.wishlist || []).some((item) => item.monitorPrice)) {
    rows.push({
      name: 'Monitoramento de wishlist',
      detail: 'Busca controlada com log e sem compra automática.',
      status: 'ativo',
    })
  }
  return rows.length ? rows.slice(0, 3) : [{
    name: 'Nenhuma automação ativa',
    detail: 'Use modelos aprovados para criar alertas com trava e intervalo entre avisos.',
    status: 'ok',
  }]
})

const sparkSeries = computed(() => {
  const raw = []
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(selectedYear.value, selectedMonth.value - 1 - offset, 1)
    const aggregate = aggregateMonth(date.getFullYear(), date.getMonth() + 1)
    raw.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: financeStore.monthNames[date.getMonth()]?.slice(0, 3) || '',
      value: aggregate.balance,
    })
  }
  const values = raw.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  return raw.map((item, index) => ({
    ...item,
    x: 8 + index * 48.8,
    y: 62 - ((item.value - min) / spread) * 48,
  }))
})

const sparkPoints = computed(() => sparkSeries.value.map((item) => `${item.x},${item.y}`).join(' '))
const sparkAreaPath = computed(() => `M ${sparkSeries.value[0].x} 68 L ${sparkPoints.value.replaceAll(' ', ' L ')} L ${sparkLastPoint.value.x} 68 Z`)
const sparkLastPoint = computed(() => sparkSeries.value[sparkSeries.value.length - 1] || { x: 252, y: 40 })

function aggregateMonth(year, month) {
  const income = financeStore.state.incomes
    .filter((entry) => entryYearMonth(entry.date, year, month))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const expense = financeStore.state.expenses
    .filter((entry) => entryYearMonth(entry.date, year, month))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  return { income, expense, balance: income - expense }
}

function entryYearMonth(value, year, month) {
  const date = parseLocalDate(value)
  return date.getFullYear() === year && date.getMonth() + 1 === month
}

function normalizeMonth(value) {
  const month = Number(value)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1
}

function normalizeYear(value) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear()
}

function isInActivePeriod(value) {
  const date = parseLocalDate(value)
  const now = new Date()
  if (activePeriod.value === 'today') return date.toDateString() === now.toDateString()
  if (activePeriod.value === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    return date >= start && date <= now
  }
  if (activePeriod.value === 'year') return date.getFullYear() === selectedYear.value
  return date.getFullYear() === selectedYear.value && date.getMonth() + 1 === selectedMonth.value
}

function parseLocalDate(value) {
  const text = String(value || '')
  return new Date(text.length === 10 ? `${text}T12:00:00` : text)
}

function entryTimestamp(entry) {
  return new Date(entry.created_at || entry.date || 0).getTime()
}

function sumAmounts(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
}

function iconForEntry(entry) {
  if (entry.type === 'income') return WalletCards
  const text = `${entry.category || ''} ${entry.description || ''}`.toLowerCase()
  if (/mercado|alimenta|restaurante|delivery|acougue/.test(text)) return ShoppingCart
  if (/moradia|aluguel|condominio|energia|agua|internet/.test(text)) return HomeIcon
  if (/transporte|combustivel|uber|carro/.test(text)) return Car
  if (/saude|farmacia|medico/.test(text)) return HeartPulse
  if (/lazer|cinema|streaming/.test(text)) return Clapperboard
  return Receipt
}

function suggestedOptions(options, preferred) {
  const byKey = new Map((options || []).map((item) => [optionKey(item), item]))
  return preferred.map((item) => byKey.get(optionKey(item)) || item).slice(0, 6)
}

function optionKey(value) {
  return String(value || '').normalize('NFC').toLocaleLowerCase('pt-BR')
}

function categoriesForQuickType(type) {
  return type === 'expense'
    ? suggestedOptions(financeStore.expenseCategories, PRIMARY_EXPENSE_CATEGORIES)
    : suggestedIncomeTypes.value
}

async function setQuickType(type) {
  quickEntry.type = type
  await nextTick()
  quickEntry.category = categoriesForQuickType(type)[0] || ''
}

function pulseQuickEntry() {
  if (quickEntryFocusTimer) window.clearTimeout(quickEntryFocusTimer)
  quickEntryFocused.value = true
  quickEntryFocusTimer = window.setTimeout(() => {
    quickEntryFocused.value = false
    quickEntryFocusTimer = null
  }, 1800)
}

async function openDataEntryTab(type = quickEntry.type) {
  activeDashboardTab.value = 'data-entry'
  await setQuickType(type)
  await nextTick()
  pulseQuickEntry()
}

async function focusQuickIncome() {
  await openDataEntryTab('income')
}

async function runV3CommandAction(action) {
  if (!action) return
  if (action.intent && action.route === '/entries') {
    await openDataEntryTab(action.intent)
    return
  }
  router.push(action.route || '/plan')
}

function openFirstIncomeWizard() {
  firstIncomeModalOpen.value = true
}

function closeFirstIncomeWizard() {
  firstIncomeModalOpen.value = false
}

function parseAmount(value) {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=.*[.,])/g, '')
    .replace(',', '.')
  return Number(normalized)
}

function todayIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function submitFirstIncome() {
  const amount = parseAmount(firstIncomeForm.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('Informe um valor válido.', 'warning')
    return
  }

  financeStore.addIncome({
    date: todayIsoDate(),
    amount,
    type: firstIncomeForm.type,
    description: firstIncomeForm.description,
  })

  showToast('Primeira receita registrada com sucesso.', 'success')
  firstIncomeForm.description = 'Receita mensal'
  firstIncomeForm.amount = ''
  firstIncomeForm.type = suggestedIncomeTypes.value[0] || PRIMARY_INCOME_TYPES[0]
  firstIncomeModalOpen.value = false
}

function submitQuickEntry() {
  const amount = parseAmount(quickEntry.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('Informe um valor válido.', 'warning')
    return
  }

  const date = todayIsoDate()
  if (quickEntry.type === 'expense') {
    financeStore.addExpense({
      date,
      amount,
      category: quickEntry.category,
      description: quickEntry.description,
      payment: 'Pix',
      paid: true,
    })
  } else {
    financeStore.addIncome({
      date,
      amount,
      type: quickEntry.category,
      description: quickEntry.description,
    })
  }

  showToast('Lançamento registrado com sucesso.', 'success')
  quickEntry.description = ''
  quickEntry.amount = ''
  quickEntry.category = categoriesForQuickType(quickEntry.type)[0] || ''
}

function formatCurrency(value, hidden = false) {
  if (hidden) return 'R$ •••••'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function compactCurrency(value) {
  if (hideBalance.value) return 'R$ •••'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatSignedCurrency(value, hidden = false) {
  if (hidden) return 'R$ •••••'
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}${formatCurrency(Math.abs(value))}`
}

function formatDate(value) {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}
</script>

<style scoped>
.premium-dashboard {
  width: min(var(--content-max), 100%);
  margin: 0 auto;
  padding: var(--content-pad);
  display: grid;
  gap: 1rem;
}

.initial-dashboard {
  min-height: calc(100vh - 80px);
  align-content: start;
}

.initial-dashboard-hero,
.initial-next-step {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  background: transparent;
  box-shadow: none;
}

.initial-dashboard-hero {
  padding: 1.25rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
}

.initial-dashboard-hero h1 {
  max-width: 780px;
  margin: 0.3rem 0;
  color: var(--text-primary);
  font-size: clamp(1.55rem, 3vw, 2.45rem);
  line-height: 1.08;
  letter-spacing: 0;
}

.initial-dashboard-hero span,
.initial-next-step span {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.initial-metrics-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.initial-next-step {
  padding: 1rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
}

.initial-next-step > svg {
  width: 34px;
  height: 34px;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--accent);
  background: var(--blue-dim);
}

.initial-next-step strong {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--text-primary);
}

.initial-next-step button,
.secondary-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0 0.85rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 800;
}

.initial-next-step button svg {
  width: 14px;
}

.first-steps-dashboard {
  align-content: start;
}

.first-steps-hero,
.first-step-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  background: transparent;
  box-shadow: none;
}

.first-steps-hero {
  min-height: 150px;
  padding: 1.25rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
}

.first-steps-hero h1 {
  max-width: 760px;
  margin: 0.3rem 0;
  color: var(--text-primary);
  font-size: clamp(1.55rem, 3vw, 2.35rem);
  line-height: 1.08;
  letter-spacing: 0;
}

.first-steps-hero span {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.first-steps-hero > strong {
  min-width: 156px;
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-color));
  border-radius: var(--radius-md);
  color: var(--accent);
  background: var(--blue-dim);
  text-align: center;
}

.first-steps-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.first-step-card {
  min-height: 250px;
  padding: 1rem;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
}

.first-step-card.complete {
  border-color: color-mix(in srgb, var(--income) 28%, var(--border-color));
}

.first-step-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  color: var(--accent);
  background: var(--blue-dim);
}

.first-step-icon svg {
  width: 19px;
}

.first-step-icon.income {
  color: var(--income);
  background: var(--income-dim);
}

.first-step-icon.expense {
  color: var(--expense);
  background: var(--expense-dim);
}

.first-step-icon.savings {
  color: var(--savings);
  background: var(--savings-dim);
}

.first-step-card span {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.first-step-card strong {
  display: block;
  margin-top: 0.4rem;
  color: var(--text-primary);
  font-size: 1.35rem;
  font-weight: 700;
}

.first-step-card small {
  display: block;
  margin-top: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
}

.first-step-card button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 800;
}

.first-step-card:not(.complete) button {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-strong));
  background: var(--accent);
  color: #fff;
}

.first-income-layer {
  position: fixed;
  inset: 0;
  z-index: 1200;
  padding: 1rem;
  display: grid;
  place-items: center;
  background: rgba(5, 8, 18, 0.58);
  backdrop-filter: blur(8px);
}

.first-income-modal {
  width: min(520px, 100%);
  max-height: min(680px, calc(100vh - 2rem));
  overflow: auto;
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28);
}

.first-income-modal header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.first-income-modal header span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.first-income-modal h2 {
  margin: 0.15rem 0;
  color: var(--text-primary);
  font-size: 1.2rem;
}

.first-income-modal p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.first-income-modal header button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.2rem;
}

.first-income-modal label {
  display: grid;
  gap: 0.35rem;
}

.first-income-modal label > span {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
}

.first-income-modal input,
.first-income-modal select {
  min-height: 40px;
}

.first-income-modal footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.dashboard-scope {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .25rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
}

.dashboard-scope span {
  padding: 0 .55rem;
  color: var(--text-muted);
  font-size: .82rem;
  font-weight: 800;
}

.dashboard-scope button {
  border: 0;
  border-radius: 6px;
  padding: .55rem .8rem;
  background: transparent;
  color: var(--text-muted);
  font-weight: 900;
}

.dashboard-scope button.active {
  background: var(--accent);
  color: #fff;
}

.dashboard-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.35rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-glass);
  box-shadow: none;
  backdrop-filter: blur(14px);
}

.dashboard-tabs button {
  min-width: 0;
  min-height: 64px;
  padding: 0.65rem 0.75rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  align-items: center;
  column-gap: 0.5rem;
  row-gap: 0.12rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.dashboard-tabs button svg {
  grid-row: 1 / span 2;
  width: 17px;
  height: 17px;
}

.dashboard-tabs button span,
.dashboard-tabs button small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-tabs button span {
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 800;
}

.dashboard-tabs button small {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.dashboard-tabs button.active {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border-color));
  background: linear-gradient(135deg, var(--blue-dim), color-mix(in srgb, var(--accent-cyan) 9%, transparent));
  color: var(--accent-hover);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent);
}

.dashboard-tabs button:hover {
  border-color: var(--divider-strong);
  background: color-mix(in srgb, var(--bg-hover) 76%, var(--bg-panel));
}

.v3-command-center {
  display: grid;
  grid-template-columns: minmax(260px, 1.2fr) minmax(260px, 1fr) minmax(240px, 0.9fr);
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-color));
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 34%),
    linear-gradient(135deg, var(--bg-panel), color-mix(in srgb, var(--bg-panel) 86%, var(--blue-dim)));
  box-shadow: none;
}

.v3-command-main,
.v3-command-kpis,
.v3-command-actions,
.v3-risk-list,
.v3-action-list {
  min-width: 0;
}

.v3-command-main {
  display: grid;
  align-content: center;
  gap: 0.42rem;
}

.v3-command-main > span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.v3-command-main strong {
  color: var(--text-primary);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.15;
}

.v3-command-main p {
  max-width: 58ch;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.v3-command-main button {
  width: fit-content;
  min-height: 38px;
  margin-top: 0.25rem;
  padding: 0 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 900;
}

.v3-command-main .v3-secondary-action {
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--accent);
}

.v3-command-main button svg {
  width: 14px;
}

.v3-command-kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.v3-command-kpis > div,
.v3-risk-list button,
.v3-action-list button {
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
}

.v3-command-kpis > div {
  padding: 0.72rem;
  display: grid;
  align-content: center;
  gap: 0.25rem;
}

.v3-command-kpis span {
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 800;
}

.v3-command-kpis strong {
  color: var(--text-primary);
  font-size: 0.92rem;
}

.v3-command-kpis .income strong,
.v3-command-kpis .savings strong {
  color: var(--income);
}

.v3-command-kpis .expense strong,
.v3-command-kpis .warning strong {
  color: var(--expense);
}

.v3-command-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.v3-risk-list,
.v3-action-list {
  display: grid;
  align-content: start;
  gap: 0.45rem;
}

.v3-risk-list > strong,
.v3-action-list > strong {
  color: var(--text-secondary);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
}

.v3-risk-list button,
.v3-action-list button {
  padding: 0.62rem 0.68rem;
  display: grid;
  gap: 0.18rem;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.v3-risk-list button:hover,
.v3-action-list button:hover {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color));
  background: var(--bg-hover);
}

.v3-risk-list span,
.v3-action-list span {
  color: var(--text-primary);
  font-size: 0.72rem;
  font-weight: 900;
}

.v3-risk-list small,
.v3-action-list small {
  color: var(--text-secondary);
  font-size: 0.66rem;
  line-height: 1.3;
}

.v3-risk-list .critical {
  border-color: color-mix(in srgb, var(--expense) 36%, var(--border-color));
}

.v3-risk-list .warning {
  border-color: color-mix(in srgb, #fbbf24 38%, var(--border-color));
}

.dashboard-tab-panel {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.dashboard-data-entry-cta {
  position: sticky;
  top: 0.75rem;
  z-index: 4;
  min-width: 0;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--border-color));
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, color-mix(in srgb, var(--bg-panel) 84%, var(--blue-dim)), color-mix(in srgb, var(--bg-panel) 92%, var(--accent-cyan)));
  box-shadow: none;
}

.dashboard-data-entry-cta div {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.dashboard-data-entry-cta span {
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 900;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.dashboard-data-entry-cta strong {
  color: var(--text-primary);
  font-size: var(--text-sm);
  line-height: 1.25;
}

.dashboard-data-entry-cta small {
  color: var(--text-secondary);
  font-size: 0.72rem;
  line-height: 1.35;
}

.dashboard-data-entry-cta button {
  min-height: 42px;
  flex: 0 0 auto;
  padding: 0 0.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--gradient-accent);
  color: #fff;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 900;
  box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 22%, transparent);
}

.dashboard-data-entry-cta button svg {
  width: 15px;
}

.dashboard-grid-tab-summary,
.dashboard-grid-tab-goals,
.dashboard-grid-tab-analysis,
.dashboard-grid-tab-data-entry {
  grid-template-columns: minmax(0, 1fr);
}

.dashboard-grid-tab-summary .dashboard-grid__aside,
.dashboard-grid-tab-goals .dashboard-grid__main,
.dashboard-grid-tab-analysis .dashboard-grid__main,
.dashboard-grid-tab-data-entry .dashboard-grid__main {
  display: none;
}

.dashboard-grid-tab-goals .dashboard-grid__aside,
.dashboard-grid-tab-analysis .dashboard-grid__aside,
.dashboard-grid-tab-data-entry .dashboard-grid__aside {
  width: min(100%, 760px);
}

.dashboard-secondary-details {
  display: grid;
  gap: 0.85rem;
}

.dashboard-secondary-details summary {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: none;
  color: var(--text-primary);
  cursor: pointer;
}

.dashboard-secondary-details summary::-webkit-details-marker {
  display: none;
}

.dashboard-secondary-details summary::after {
  content: '+';
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--accent);
  background: var(--blue-dim);
  font-weight: 900;
}

.dashboard-secondary-details[open] summary::after {
  content: '-';
}

.dashboard-secondary-details summary span,
.dashboard-secondary-details summary small {
  display: block;
}

.dashboard-secondary-details summary span {
  font-size: var(--text-sm);
  font-weight: 800;
}

.dashboard-secondary-details summary small {
  margin-top: 0.12rem;
  color: var(--text-secondary);
  font-size: 0.72rem;
  line-height: 1.35;
}

.dashboard-secondary-details > .premium-panel,
.dashboard-secondary-details > .intelligence-brief,
.dashboard-secondary-details > .metrics-grid,
.dashboard-secondary-details > .dashboard-assistant {
  margin-top: 0.85rem;
}

.dashboard-secondary-details > .premium-panel + .premium-panel {
  margin-top: 0.85rem;
}

.balance-hero,
.metric-card,
.premium-panel {
  border: 1px solid var(--border-color);
  background: transparent;
}

.balance-hero {
  position: relative;
  min-height: 170px;
  padding: 1.25rem;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
  align-items: center;
  gap: 1.5rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: transparent;
  box-shadow: none;
}

.balance-hero::before {
  display: none;
}

.hero-copy {
  position: relative;
  z-index: 1;
}

.hero-copy > p {
  margin-bottom: 10px;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

.hero-value {
  display: block;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-display);
  font-weight: var(--page-title-weight);
  letter-spacing: 0;
  line-height: 1.05;
}

.hero-value.negative { color: var(--expense); }

.hero-comparison {
  width: fit-content;
  margin-top: 16px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
}

.hero-comparison svg { width: 12px; height: 12px; }
.hero-comparison small { margin-left: 4px; opacity: 0.72; }
.hero-comparison.positive { color: var(--income); background: var(--income-dim); }
.hero-comparison.negative { color: var(--expense); background: var(--expense-dim); }

.sparkline-card {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: end;
  gap: 8px;
}

.sparkline-card > span { color: var(--text-muted); font-size: var(--text-xs); font-weight: 600; }
.sparkline-card svg { width: 280px; max-width: 100%; overflow: visible; }
.sparkline-card text { fill: var(--text-muted); font-family: var(--font-sans); font-size: 9px; }

.intelligence-brief {
  container-type: inline-size;
  min-height: 112px;
  padding: 1rem 1.15rem;
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: none;
}

.brief-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  color: var(--accent);
  background: var(--blue-dim);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}
.brief-icon svg { width: 21px; }
.brief-copy { min-width: 0; display: grid; gap: 0.2rem; }
.brief-copy > span { color: var(--accent); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; letter-spacing: var(--eyebrow-letter-spacing); text-transform: uppercase; }
.brief-copy strong { font-size: var(--text-lg); font-weight: 700; letter-spacing: 0; }
.brief-copy p { color: var(--text-secondary); font-size: var(--text-sm); }
.brief-signals { display: grid; grid-template-columns: repeat(3, minmax(92px, 1fr)); gap: 0.5rem; }
.brief-signals > div { min-height: 62px; padding: 0.65rem 0.75rem; display: grid; align-content: center; gap: 0.2rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-elevated); }
.brief-signals span { color: var(--text-muted); font-size: 0.65rem; font-weight: 600; }
.brief-signals strong { font-size: var(--text-sm); }
.brief-cta { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.55rem 0.7rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--accent); font-size: 0.76rem; font-weight: 700; white-space: nowrap; cursor: pointer; }
.brief-cta svg { width: 14px; }
.intelligence-brief.healthy .brief-icon { color: var(--income); background: var(--income-dim); }
.intelligence-brief.attention .brief-icon { color: var(--expense); background: var(--expense-dim); }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.advisor-summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  min-height: 126px;
  padding: 1rem;
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-radius: var(--radius-lg);
  box-shadow: none;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.metric-card:hover { border-color: var(--divider-strong); box-shadow: none; }
.metric-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.metric-head > span { color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; letter-spacing: var(--eyebrow-letter-spacing); text-transform: uppercase; }
.metric-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: var(--radius-md); }
.metric-icon svg { width: 17px; }
.inline-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.metric-icon.income { color: var(--income); background: var(--income-dim); }
.metric-icon.expense { color: var(--expense); background: var(--expense-dim); }
.metric-icon.savings { color: var(--savings); background: var(--savings-dim); }
.metric-card > strong { align-self: center; display: block; margin: 0.65rem 0; font-size: 1.45rem; font-weight: 600; letter-spacing: 0; }
.metric-card > strong.income { color: var(--income); }
.metric-card > strong.expense { color: var(--expense); }
.metric-card > strong.savings { color: var(--savings); }
.metric-card > small { color: var(--text-muted); font-size: var(--text-xs); }

.premium-panel { overflow: hidden; border-radius: var(--radius-lg); box-shadow: none; }
.panel-header { min-height: 61px; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border-color); }
.panel-header.compact { min-height: 54px; padding: 13px 17px; }
.panel-header h2 { color: var(--text-primary); font-size: var(--text-base); font-weight: 700; letter-spacing: 0; }
.panel-header p { margin-top: 2px; color: var(--text-muted); font-size: var(--text-xs); }
.panel-header button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--accent); cursor: pointer; font-size: var(--text-xs); font-weight: 700; }
.panel-header button svg { width: 12px; }

.transaction-list { display: grid; }
.transaction-row { width: 100%; min-height: 69px; padding: 13px 20px; display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 13px; border: 0; border-bottom: 1px solid var(--border-color); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.transaction-row:last-child { border-bottom: 0; }
.transaction-row:hover { background: var(--bg-elevated); }
.transaction-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: var(--radius-md); color: var(--expense); background: var(--expense-dim); }
.transaction-icon.income { color: var(--income); background: var(--income-dim); }
.transaction-icon svg { width: 17px; }
.transaction-copy { min-width: 0; display: grid; gap: 3px; }
.transaction-copy strong { overflow: hidden; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.transaction-copy small { color: var(--text-muted); font-size: var(--text-xs); }
.transaction-copy em { padding: 2px 6px; border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text-secondary); font-style: normal; }
.transaction-row > b { color: var(--text-secondary); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
.transaction-row > b.income { color: var(--income); }

.empty-state { min-height: 180px; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); text-align: center; }
.empty-state svg { width: 32px; }
.empty-state strong { color: var(--text-secondary); font-size: 0.82rem; }
.empty-state span { font-size: 0.72rem; }

.donut-layout { padding: 20px 18px; display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: 18px; }
.donut { width: 92px; height: 92px; padding: 12px; border-radius: 50%; }
.donut > div { width: 100%; height: 100%; display: grid; place-content: center; border-radius: 50%; background: var(--bg-card); text-align: center; }
.donut strong { color: var(--text-primary); font-size: 0.78rem; }
.donut span { color: var(--text-muted); font-size: 0.6rem; }
.donut-legend { display: grid; gap: 9px; }
.donut-legend > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-secondary); font-size: 0.68rem; }
.donut-legend span { min-width: 0; display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.donut-legend i, .budget-copy i { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; }
.donut-legend b { color: var(--text-primary); font-size: 0.66rem; font-weight: 500; }
.mini-empty { padding: 26px; color: var(--text-muted); font-size: 0.72rem; text-align: center; }

.actionable-empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.empty-actions button,
.inline-empty-action {
  min-height: 34px;
  padding: 0 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 800;
}

.empty-actions button:first-child {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-strong));
  background: var(--blue-dim);
}

.budget-list { padding: 14px 17px 17px; display: grid; gap: 15px; }
.budget-row { display: grid; gap: 7px; }
.budget-copy { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--text-secondary); font-size: 0.67rem; }
.budget-copy span { display: flex; align-items: center; gap: 7px; }
.budget-copy b { color: var(--text-muted); font-size: 0.59rem; font-weight: 400; white-space: nowrap; }
.budget-track { height: 4px; overflow: hidden; border-radius: 999px; background: var(--bg-elevated); }
.budget-track span { display: block; height: 100%; border-radius: inherit; transition: width 0.3s ease; }
.budget-track span.exceeded { background: var(--expense) !important; }

.quick-entry-panel {
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.quick-entry-panel.focus-pulse {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border-color));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent), var(--shadow-card-hover);
  animation: quick-entry-focus 0.9s ease-in-out 2;
}

.quick-form { padding: 15px 17px 18px; display: grid; gap: 12px; }
.entry-type-toggle { padding: 3px; display: grid; grid-template-columns: 1fr 1fr; border-radius: var(--radius-sm); background: var(--bg-input); }
.entry-type-toggle button { min-height: 30px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 0.7rem; font-weight: 500; }
.entry-type-toggle button.active { color: var(--text-primary); background: var(--bg-elevated); box-shadow: none; }
.quick-form label { display: grid; gap: 5px; }
.quick-form label > span { color: var(--text-muted); font-size: 0.62rem; font-weight: 500; }
.quick-form input, .quick-form select { width: 100%; min-height: 38px; padding: 0 10px; border-color: var(--border-color); font-size: 0.72rem; }
.quick-form-row { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 9px; }
.submit-entry { min-height: 39px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: var(--radius-sm); background: var(--accent); color: #fff; cursor: pointer; font-size: 0.72rem; font-weight: 600; }
.submit-entry:hover { background: var(--accent-hover); }
.submit-entry svg { width: 14px; }

.action-stack,
.attention-list,
.compact-list {
  padding: 14px 17px 17px;
  display: grid;
  gap: 0.75rem;
}

.action-row,
.attention-row,
.compact-row {
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.action-row {
  padding: 0.75rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  align-items: start;
}

.action-row strong,
.attention-row strong,
.compact-row strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.78rem;
}

.action-row small,
.attention-row span,
.compact-row small {
  display: block;
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
  line-height: 1.35;
}

.action-dot {
  width: 10px;
  height: 10px;
  margin-top: 0.25rem;
  border-radius: 999px;
  background: var(--accent);
}

.action-dot.ok { background: var(--income); }
.action-dot.warning { background: #fbbf24; }
.action-dot.danger { background: var(--expense); }

.attention-row,
.compact-row {
  padding: 0.72rem 0.8rem;
}

.attention-row.ok { border-color: color-mix(in srgb, var(--income) 28%, var(--border-color)); }
.attention-row.warning { border-color: color-mix(in srgb, #fbbf24 35%, var(--border-color)); }
.attention-row.danger { border-color: color-mix(in srgb, var(--expense) 35%, var(--border-color)); }

.compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.compact-row b {
  flex: 0 0 auto;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 800;
}

.inline-empty-action {
  margin: 0 17px 17px;
  justify-self: start;
}

@keyframes quick-entry-focus {
  0%, 100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent), var(--shadow-card-hover);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 26%, transparent), var(--shadow-card-hover);
  }
}

.subscription-summary-card {
  padding: 0.95rem 1rem 1rem;
  display: grid;
  gap: 0.35rem;
}

.subscription-summary-card strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.subscription-summary-card span,
.subscription-summary-card small {
  color: var(--text-secondary);
  font-size: 0.76rem;
  line-height: 1.35;
}

.dashboard-assistant {
  min-width: 0;
}

@media (max-width: 1000px) {
  .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .first-steps-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .v3-command-center {
    grid-template-columns: 1fr;
  }
  .dashboard-tabs {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(154px, 1fr);
    overflow-x: auto;
    scrollbar-width: thin;
    scroll-snap-type: x proximity;
  }
  .dashboard-tabs button {
    min-width: 154px;
    min-height: 58px;
    scroll-snap-align: start;
  }
}

@container (max-width: 780px) {
  .intelligence-brief { grid-template-columns: auto 1fr; }
  .brief-signals { grid-column: 1 / -1; }
  .brief-cta { grid-column: 1 / -1; justify-self: end; }
}

@media (max-width: 760px) {
  .premium-dashboard { padding: 16px; gap: 16px; }
  .initial-dashboard-hero,
  .initial-next-step,
  .first-steps-hero {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .initial-metrics-grid {
    grid-template-columns: 1fr;
  }
  .balance-hero { grid-template-columns: 1fr; align-items: flex-start; padding: 24px; }
  .sparkline-card { width: 100%; justify-items: start; }
  .sparkline-card svg { width: 100%; }
  .brief-signals { grid-template-columns: repeat(3, 1fr); }
  .dashboard-data-entry-cta {
    position: static;
    align-items: stretch;
    flex-direction: column;
  }
  .dashboard-data-entry-cta button {
    width: 100%;
  }
  .v3-command-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .premium-dashboard { padding: 10px; }
  .dashboard-tabs { grid-auto-columns: minmax(145px, 78vw); }
  .v3-command-kpis {
    grid-template-columns: 1fr;
  }
  .v3-command-main button {
    width: 100%;
    justify-content: center;
  }
  .first-steps-grid { grid-template-columns: 1fr; }
  .balance-hero { padding: 20px; }
  .hero-comparison { align-items: flex-start; flex-wrap: wrap; }
  .metrics-grid { grid-template-columns: 1fr; }
  .transaction-row { grid-template-columns: 36px minmax(0, 1fr); }
  .transaction-row > b { grid-column: 2; }
  .donut-layout { grid-template-columns: 82px minmax(0, 1fr); }
  .donut { width: 80px; height: 80px; }
  .quick-form-row { grid-template-columns: 1fr; }
  .intelligence-brief { grid-template-columns: 1fr; }
  .brief-signals { grid-template-columns: 1fr; }
  .brief-cta { justify-self: stretch; justify-content: center; }
}
</style>
