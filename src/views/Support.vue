<template>
  <PageShell
    eyebrow="Ajuda"
    title="Suporte"
    description="Encontre respostas rápidas sobre acesso, planos, segurança, compras e alertas."
    testid="support-page"
  >
    <section class="support-layout">
      <article class="support-panel">
        <h2>Perguntas frequentes</h2>
        <div class="faq-list" data-testid="support-faq-list">
          <details v-for="item in faq" :key="item.id">
            <summary>{{ item.question }}</summary>
            <p>{{ item.answer }}</p>
          </details>
        </div>
      </article>

      <aside class="support-panel assistant-panel" data-testid="support-fixed-agent">
        <h2>Buscar ajuda</h2>
        <p>Digite uma dúvida. A resposta vem apenas da base de ajuda cadastrada.</p>
        <form class="support-search" @submit.prevent="ask">
          <label>
            <span>Sua dúvida</span>
            <input v-model.trim="question" placeholder="Ex: como redefinir minha senha?" />
          </label>
          <button class="primary-button" type="submit">Perguntar</button>
        </form>
        <div v-if="answer" class="answer-box" role="status">
          <strong>{{ matchedQuestion || 'Resposta da base de ajuda' }}</strong>
          <p>{{ answer }}</p>
        </div>
      </aside>
    </section>

    <section class="support-links" aria-label="Links importantes">
      <router-link to="/privacy">Privacidade</router-link>
      <router-link to="/terms">Termos de Uso</router-link>
      <router-link to="/subscription-policy">Assinatura e Cancelamento</router-link>
      <router-link to="/security">Segurança</router-link>
    </section>
  </PageShell>
</template>

<script setup>
import { ref } from 'vue'
import PageShell from '@/components/layout/PageShell.vue'
import { SUPPORT_FAQ } from '@/domain/support/staticFaq.js'
import { answerSupportQuestion } from '@/domain/support/supportAgent.js'

const faq = SUPPORT_FAQ
const question = ref('')
const answer = ref('')
const matchedQuestion = ref('')

function ask() {
  const result = answerSupportQuestion(question.value)
  answer.value = result.answer
  matchedQuestion.value = result.matched?.question || ''
}
</script>

<style scoped>
.support-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  gap: 1rem;
  align-items: start;
}

.support-panel,
.support-links {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.support-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.support-panel h2,
.support-panel p {
  margin: 0;
}

.support-panel > p,
.faq-list p,
.answer-box p {
  color: var(--text-secondary);
  line-height: 1.55;
}

.faq-list {
  display: grid;
  gap: 0.55rem;
}

details {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0.75rem 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 800;
}

details p {
  padding: 0 0.85rem 0.85rem;
}

.support-search,
.support-search label {
  display: grid;
  gap: 0.55rem;
}

.support-search label {
  color: var(--text-secondary);
  font-weight: 800;
}

.answer-box {
  display: grid;
  gap: 0.45rem;
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.support-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding: 0.85rem;
}

.support-links a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 0.85rem;
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 800;
}

@media (max-width: 820px) {
  .support-layout {
    grid-template-columns: 1fr;
  }
}
</style>
