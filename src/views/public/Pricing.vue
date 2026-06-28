<template>
  <main class="pricing-page" data-testid="pricing-page">
    <AuthBackground />
    <PublicHeader />

    <section class="pricing-shell">
      <p class="eyebrow">Planos</p>
      <h1>Escolha o nivel de controle financeiro para sua operacao.</h1>
      <p class="lead">
        Compare limites, inteligencia e governanca antes de liberar recursos para o time.
        Todos os planos mantem experiencia operacional clara e rotas publicas de conformidade.
      </p>

      <section class="plans" aria-label="Comparacao de planos">
        <article>
          <div>
            <h2>Gratis</h2>
            <p>Controle inicial para validar o fluxo financeiro sem compromisso.</p>
          </div>
          <strong>R$ 0</strong>
          <ul>
            <li>Lancamentos manuais</li>
            <li>Relatorio mensal basico</li>
            <li>Wishlist e buscas com limites reduzidos</li>
          </ul>
          <router-link to="/signup" class="secondary">Criar conta</router-link>
        </article>
        <article class="featured">
          <div>
            <span class="plan-badge">Recomendado</span>
            <h2>Premium mensal</h2>
            <p>Operacao recorrente com analises, simulacoes, alertas e recomendacoes.</p>
          </div>
          <strong>R$ 19,90/mês</strong>
          <ul>
            <li>Consultor financeiro completo</li>
            <li>Simulacoes e relatorios avancados</li>
            <li>Busca e wishlist ampliadas</li>
          </ul>
          <router-link to="/signup" class="primary">Assinar Premium</router-link>
        </article>
        <article>
          <div>
            <h2>Premium anual</h2>
            <p>Mesmo controle Premium com previsibilidade de custo anual.</p>
          </div>
          <strong>R$ 16,58/mês</strong>
          <small>R$ 199,00 cobrados ao ano</small>
          <ul>
            <li>Melhor custo-beneficio</li>
            <li>Mesmos recursos do Premium mensal</li>
            <li>Cobranca anual simplificada</li>
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
  position: relative;
  min-height: 100vh;
  padding: 1.25rem;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 800;
}

.eyebrow {
  margin: 2rem 0 0;
  color: var(--accent);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  max-width: 820px;
  font-size: 2.75rem;
  line-height: 1.08;
}

.lead {
  max-width: 760px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

article {
  display: grid;
  gap: 0.85rem;
  align-content: start;
  padding: 1.2rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-card);
}

article.featured {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-color));
  box-shadow: var(--shadow-card-hover);
}

article p,
small {
  color: var(--text-secondary);
  line-height: 1.55;
}

strong {
  font-size: 1.65rem;
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
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0.78rem 1rem;
  background: var(--bg-panel);
  color: var(--text-primary);
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
  color: var(--text-secondary);
  line-height: 1.5;
}

footer {
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 720px) {
  h1 {
    font-size: 2.2rem;
  }
}
</style>
