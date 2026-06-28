<template>
  <main class="marketing-page" data-testid="landing-page">
    <AuthBackground />
    <PublicHeader />

    <section class="hero">
      <p class="eyebrow">Plataforma financeira B2B</p>
      <h1>Organize sua vida financeira com mais clareza</h1>
      <p>
        Centralize lancamentos, previsoes, compras planejadas, alertas e auditoria em uma experiencia
        desenhada para rotina operacional, seguranca e acompanhamento de times.
      </p>
      <div class="actions">
        <router-link to="/login" class="primary">Entrar</router-link>
        <router-link to="/pricing" class="secondary">Ver planos</router-link>
      </div>
    </section>

    <section class="product-preview" aria-label="Previa do produto">
      <div class="preview-top">
        <span>Resumo executivo</span>
        <strong>Junho/2026</strong>
      </div>
      <div class="preview-grid">
        <article>
          <span>Saldo operacional</span>
          <strong>R$ 84,2 mil</strong>
          <small>+12% vs periodo anterior</small>
        </article>
        <article>
          <span>Risco de caixa</span>
          <strong>Baixo</strong>
          <small>3 alertas revisados</small>
        </article>
        <article>
          <span>Compras monitoradas</span>
          <strong>28</strong>
          <small>6 com preco compativel</small>
        </article>
      </div>
      <div class="preview-table">
        <div><span>Categoria</span><span>Realizado</span><span>Status</span></div>
        <div><span>Fornecedores</span><strong>R$ 31,4 mil</strong><small>Dentro</small></div>
        <div><span>Beneficios</span><strong>R$ 18,7 mil</strong><small>Acompanhar</small></div>
        <div><span>Operacoes</span><strong>R$ 22,1 mil</strong><small>Dentro</small></div>
      </div>
    </section>

    <section class="features" aria-label="Recursos principais">
      <article>
        <h2>Visao executiva</h2>
        <p>Acompanhe saldo, compromissos, risco e proximas acoes com hierarquia clara para tomada de decisao.</p>
      </article>
      <article>
        <h2>Governanca operacional</h2>
        <p>Use trilhas de auditoria, controles de acesso, suporte LGPD e confirmacoes antes de acoes sensiveis.</p>
      </article>
      <article>
        <h2>Compras e precos</h2>
        <p>Monitore produtos, compare oportunidades compativeis e reduza decisoes de compra sem contexto.</p>
      </article>
      <article>
        <h2>Automacoes assistidas</h2>
        <p>Receba alertas e sugestoes com limites, revisao humana e historico para manter controle do processo.</p>
      </article>
    </section>

    <section class="privacy-section">
      <div>
        <p class="eyebrow">LGPD e confianca</p>
        <h2>Privacidade e segurança para dados financeiros</h2>
        <p>
          Informacoes financeiras exigem controle. A plataforma trabalha com escopos de acesso, politicas de
          privacidade, rotas legais e avisos claros para apoiar operacoes com responsabilidade.
        </p>
      </div>
      <div class="trust-grid">
        <article><h3>Seguranca</h3><p>Protecao de acesso, isolamento de usuario e verificacoes operacionais.</p></article>
        <article><h3>Privacidade</h3><p>Tratamento de dados com finalidade definida e documentos publicos de conformidade.</p></article>
        <article><h3>Direitos LGPD</h3><p>Fluxos para consulta, correcao e solicitacoes relacionadas aos dados.</p></article>
        <article><h3>Controle humano</h3><p>Acoes sensiveis passam por revisao, confirmacao e historico.</p></article>
      </div>
    </section>

    <footer class="public-footer">
      <span>Controle Financeiro</span>
      <router-link to="/terms">Termos de Uso</router-link>
      <router-link to="/privacy">Privacidade</router-link>
      <router-link to="/cookies">Cookies</router-link>
      <router-link to="/data-processing">Tratamento de Dados</router-link>
      <router-link to="/subscription-policy">Assinatura e Cancelamento</router-link>
      <router-link to="/security">Seguranca</router-link>
      <router-link to="/lgpd-requests">Direitos LGPD</router-link>
    </footer>
  </main>
</template>

<script setup>
import AuthBackground from '@/components/brand/AuthBackground.vue'
import PublicHeader from '@/components/public/PublicHeader.vue'
</script>

<style scoped>
.marketing-page {
  position: relative;
  min-height: 100vh;
  padding: 1.25rem;
  color: var(--text-primary);
  overflow: hidden auto;
}

.hero,
.product-preview,
.features,
.privacy-section,
.public-footer {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin-inline: auto;
}

.actions,
.public-footer {
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

.primary,
.secondary {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  padding: 0.78rem 1rem;
}

.primary {
  background: var(--accent);
  color: #fff;
}

.secondary {
  border: 1px solid var(--border-strong);
  background: var(--bg-panel);
  color: var(--text-primary);
}

.hero {
  display: grid;
  gap: 1rem;
  padding: 4rem 0 2rem;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  max-width: 820px;
  font-size: 3rem;
  line-height: 1.05;
}

.hero p,
.privacy-section > div > p {
  max-width: 760px;
  color: var(--text-secondary);
  font-size: 1.08rem;
  line-height: 1.7;
}

.product-preview {
  padding: 1rem;
  display: grid;
  gap: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-card);
}

.preview-top,
.preview-grid,
.preview-table > div {
  display: grid;
  gap: 0.75rem;
}

.preview-top {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.preview-top span,
.preview-grid span,
.preview-table span,
.preview-table small {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.preview-grid,
.features,
.trust-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.preview-grid article {
  min-height: 110px;
}

.preview-table {
  display: grid;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-table > div {
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.preview-table > div:first-child {
  background: var(--bg-elevated);
}

.preview-table > div:last-child {
  border-bottom: 0;
}

article,
.privacy-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-card);
}

article {
  padding: 1.1rem;
}

article p {
  color: var(--text-secondary);
  line-height: 1.55;
}

.privacy-section {
  display: grid;
  gap: 1.2rem;
  margin-top: 1rem;
  padding: 1.2rem;
}

.public-footer {
  margin-top: 2rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--border-color);
  color: var(--text-muted);
}

.public-footer a {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

@media (max-width: 720px) {
  h1 {
    font-size: 2.25rem;
  }

  .preview-table > div {
    grid-template-columns: 1fr;
  }
}
</style>
