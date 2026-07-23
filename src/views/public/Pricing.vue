<template>
  <main class="pricing-page" data-testid="pricing-page">
    <AuthBackground />
    <PublicHeader />

    <section class="pricing-shell">
      <p class="eyebrow">Planos</p>
      <h1>Escolha o nível de controle financeiro para sua operação.</h1>
      <p class="lead">
        Compare limites, inteligência e governança antes de liberar recursos para o time.
        Todos os planos mantêm experiência operacional clara e rotas públicas de conformidade.
      </p>

      <section class="plans ledger-pricing-table" aria-label="Comparação de planos">
        <article class="ledger-pricing-row">
          <div>
            <h2>Grátis</h2>
            <p>Controle inicial para validar o fluxo financeiro sem compromisso.</p>
          </div>
          <strong>R$ 0</strong>
          <ul>
            <li>Lançamentos manuais</li>
            <li>Relatório mensal básico</li>
            <li>Wishlist e buscas com limites reduzidos</li>
          </ul>
          <router-link to="/signup" class="secondary">Criar conta</router-link>
        </article>
        <article class="ledger-pricing-row featured">
          <div>
            <span class="plan-badge">Recomendado</span>
            <h2>Premium mensal</h2>
            <p>Operação recorrente com análises, simulações, alertas e recomendações.</p>
          </div>
          <strong>R$ 19,90/mês</strong>
          <ul>
            <li>Consultor financeiro completo</li>
            <li>Simulações e relatórios avançados</li>
            <li>Busca e wishlist ampliadas</li>
          </ul>
          <router-link to="/signup" class="primary">Assinar Premium</router-link>
        </article>
        <article class="ledger-pricing-row">
          <div>
            <h2>Premium anual</h2>
            <p>Mesmo controle Premium com previsibilidade de custo anual.</p>
          </div>
          <div class="price-stack">
            <strong>R$ 16,58/mês</strong>
            <small>R$ 199,00 cobrados ao ano</small>
          </div>
          <ul>
            <li>Melhor custo-benefício</li>
            <li>Mesmos recursos do Premium mensal</li>
            <li>Cobrança anual simplificada</li>
          </ul>
          <router-link to="/signup" class="primary">Assinar Premium</router-link>
        </article>
      </section>

      <footer>
        <router-link to="/terms">Termos de Uso</router-link>
        <router-link to="/privacy">Privacidade</router-link>
        <router-link to="/subscription-policy">Assinatura e Cancelamento</router-link>
      </footer>
    </section>
  </main>
</template>

<script setup>
import AuthBackground from '@/components/brand/AuthBackground.vue'
import PublicHeader from '@/components/public/PublicHeader.vue'
</script>

<style scoped>
.pricing-page {
  --public-page-bg: #f8fafc;
  --public-surface: #ffffff;
  --public-text-primary: #0f172a;
  --public-text-secondary: #475569;
  --public-border: #e2e8f0;
  --public-border-strong: #cbd5e1;
  --auth-background: var(--public-page-bg);
  --auth-grid-line: rgba(15, 23, 42, .04);
  position: relative;
  min-height: 100vh;
  padding: 1.25rem;
  background: var(--public-page-bg);
  color: var(--public-text-primary);
}

.pricing-shell {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

a {
  color: var(--public-text-secondary);
  text-decoration: none;
  font-weight: 800;
}

.eyebrow {
  margin: 2rem 0 0;
  color: var(--accent);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h1,
h2,
p {
  margin: 0;
}

h1,
h2,
strong {
  color: var(--public-text-primary);
}

h1 {
  max-width: 820px;
  font-size: 2.75rem;
  line-height: 1.08;
}

.lead {
  max-width: 760px;
  color: var(--public-text-secondary);
  line-height: 1.7;
}

.plans {
  display: grid;
  margin-top: 1rem;
  border-top: 1px solid var(--public-border);
}

.ledger-pricing-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.32fr) minmax(220px, 0.5fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--public-border);
  background: transparent;
  box-shadow: none;
}

.ledger-pricing-row.featured {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--public-border));
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  box-shadow: none;
}

article p,
small {
  color: var(--public-text-secondary);
  line-height: 1.55;
}

strong {
  font-size: 1.65rem;
}

.price-stack {
  display: grid;
  gap: 0.2rem;
}

.plan-badge {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 0.6rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 900;
}

.primary,
.secondary {
  width: fit-content;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--public-border-strong);
  border-radius: var(--radius-sm);
  padding: 0.78rem 1rem;
  background: var(--public-surface);
  color: var(--public-text-primary);
  font-weight: 900;
}

.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

ul {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding-left: 1.1rem;
  color: var(--public-text-secondary);
  line-height: 1.5;
}

footer {
  padding-top: 1rem;
  border-top: 1px solid var(--public-border);
}

@media (max-width: 720px) {
  h1 {
    font-size: 2.2rem;
  }
}

@media (max-width: 820px) {
  .ledger-pricing-row {
    grid-template-columns: 1fr;
  }
}
</style>
