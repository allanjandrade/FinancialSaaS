<template>
  <main class="marketing-page" data-testid="landing-page">
    <AuthBackground />
    <PublicHeader />

    <section class="landing-shell" aria-labelledby="landing-title">
      <div class="hero-copy">
        <p class="eyebrow">Plataforma financeira B2B</p>
        <h1 id="landing-title">Controle Financeiro para operações com clareza</h1>
        <p>
          Centralize lançamentos, previsões, compras planejadas, alertas e auditoria em uma experiência
          desenhada para rotina operacional, segurança e acompanhamento de times.
        </p>
        <div class="actions">
          <router-link to="/login" class="primary">Entrar</router-link>
          <router-link to="/pricing" class="secondary">Ver planos</router-link>
        </div>
        <div class="hero-proof" aria-label="Indicadores de operação">
          <span><strong>28</strong> compras monitoradas</span>
          <span><strong>6</strong> ofertas compatíveis</span>
          <span><strong>3</strong> alertas revisados</span>
        </div>
      </div>

      <section class="product-preview hero-panel" aria-label="Prévia do produto">
        <div class="preview-top">
          <span>Resumo executivo</span>
          <strong>Junho/2026</strong>
        </div>
        <div class="preview-grid">
          <article class="metric-card">
            <span>Saldo operacional</span>
            <strong>R$ 84,2 mil</strong>
            <small>+12% vs período anterior</small>
          </article>
          <article class="metric-card">
            <span>Risco de caixa</span>
            <strong>Baixo</strong>
            <small>3 alertas revisados</small>
          </article>
          <article class="metric-card">
            <span>Compras monitoradas</span>
            <strong>28</strong>
            <small>6 com preço compatível</small>
          </article>
        </div>
        <div class="preview-table">
          <div><span>Categoria</span><span>Realizado</span><span>Status</span></div>
          <div><span>Fornecedores</span><strong>R$ 31,4 mil</strong><small class="status good">Dentro</small></div>
          <div><span>Benefícios</span><strong>R$ 18,7 mil</strong><small class="status warn">Acompanhar</small></div>
          <div><span>Operações</span><strong>R$ 22,1 mil</strong><small class="status good">Dentro</small></div>
        </div>
      </section>
    </section>

    <section class="features ledger-public-section ledger-row-list" aria-label="Recursos principais">
      <article class="feature-card ledger-row">
        <h2>Visão executiva</h2>
        <p>Acompanhe saldo, compromissos, risco e próximas ações com hierarquia clara para tomada de decisão.</p>
      </article>
      <article class="feature-card ledger-row">
        <h2>Governança operacional</h2>
        <p>Use trilhas de auditoria, controles de acesso, suporte LGPD e confirmações antes de ações sensíveis.</p>
      </article>
      <article class="feature-card ledger-row">
        <h2>Compras e preços</h2>
        <p>Monitore produtos, compare oportunidades compatíveis e reduza decisões de compra sem contexto.</p>
      </article>
      <article class="feature-card ledger-row">
        <h2>Automações assistidas</h2>
        <p>Receba alertas e sugestões com limites, revisão humana e histórico para manter controle do processo.</p>
      </article>
    </section>

    <section class="privacy-section">
      <div>
        <p class="eyebrow">LGPD e confiança</p>
        <h2>Privacidade e segurança para dados financeiros</h2>
        <p>
          Informações financeiras exigem controle. A plataforma trabalha com escopos de acesso, políticas de
          privacidade, rotas legais e avisos claros para apoiar operações com responsabilidade.
        </p>
      </div>
      <div class="trust-grid">
        <article class="trust-card ledger-row"><h3>Segurança</h3><p>Proteção de acesso, isolamento de usuário e verificações operacionais.</p></article>
        <article class="trust-card ledger-row"><h3>Privacidade</h3><p>Tratamento de dados com finalidade definida e documentos públicos de conformidade.</p></article>
        <article class="trust-card ledger-row"><h3>Direitos LGPD</h3><p>Fluxos para consulta, correção e solicitações relacionadas aos dados.</p></article>
        <article class="trust-card ledger-row"><h3>Controle humano</h3><p>Ações sensíveis passam por revisão, confirmação e histórico.</p></article>
      </div>
    </section>

    <footer class="public-footer">
      <span>Controle Financeiro</span>
      <nav class="footer-links" aria-label="Links legais">
        <router-link to="/terms">Termos de Uso</router-link>
        <router-link to="/privacy">Privacidade</router-link>
        <router-link to="/cookies">Cookies</router-link>
        <router-link to="/data-processing">Tratamento de Dados</router-link>
        <router-link to="/subscription-policy">Assinatura e Cancelamento</router-link>
        <router-link to="/security">Segurança</router-link>
        <router-link to="/lgpd-requests">Direitos LGPD</router-link>
      </nav>
    </footer>
  </main>
</template>

<script setup>
import AuthBackground from '@/components/brand/AuthBackground.vue'
import PublicHeader from '@/components/public/PublicHeader.vue'
</script>

<style scoped>
.marketing-page {
  --public-page-bg: #f8fafc;
  --public-surface: #ffffff;
  --public-elevated: #f0fdfa;
  --public-accent-soft: #dbeafe;
  --public-text-primary: #0f172a;
  --public-text-secondary: #475569;
  --public-text-muted: #64748b;
  --public-border: #e2e8f0;
  --public-border-strong: #cbd5e1;
  --auth-background: var(--public-page-bg);
  --auth-grid-line: rgba(15, 23, 42, .04);
  position: relative;
  min-height: 100vh;
  padding: 1.25rem 1.25rem 2rem;
  background: var(--public-page-bg);
  color: var(--public-text-primary);
  overflow: hidden auto;
}

.landing-shell,
.features,
.privacy-section,
.public-footer {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin-inline: auto;
}

.landing-shell {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 4rem);
  min-height: calc(100vh - 96px);
  padding: 3rem 0 2.5rem;
}

.hero-copy {
  display: grid;
  align-content: center;
  gap: 1rem;
}

.actions,
.hero-proof,
.public-footer,
.footer-links {
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
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}

.secondary {
  border: 1px solid var(--public-border-strong);
  background: var(--public-surface);
  color: var(--public-text-primary);
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1,
h2,
h3,
strong {
  color: var(--public-text-primary);
}

h1 {
  max-width: 820px;
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
}

.hero-copy > p:not(.eyebrow),
.privacy-section > div > p {
  max-width: 760px;
  color: var(--public-text-secondary);
  font-size: var(--page-subtitle-size);
  line-height: 1.7;
}

.hero-proof {
  margin-top: 0.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--public-border);
}

.hero-proof span {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--public-text-secondary);
  font-weight: 700;
}

.hero-proof strong {
  font-size: 1.05rem;
}

.product-preview {
  padding: 1rem;
  display: grid;
  gap: 1rem;
  border: 1px solid var(--public-border);
  border-radius: var(--radius-lg);
  background: var(--public-surface);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.hero-panel {
  align-self: center;
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
  border-bottom: 1px solid var(--public-border);
}

.preview-top span,
.preview-grid span,
.preview-table span,
.preview-table small {
  color: var(--public-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr;
}

.metric-card,
.feature-card,
.trust-card {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.privacy-section {
  border: 1px solid var(--public-border);
  border-radius: var(--radius-lg);
  background: var(--public-surface);
  box-shadow: none;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--public-border);
  border-bottom: 1px solid var(--public-border);
  background: rgba(255, 255, 255, 0.56);
}

.preview-grid .metric-card {
  padding: 0.85rem 1rem;
  border-right: 1px solid var(--public-border);
}

.preview-grid .metric-card:last-child {
  border-right: 0;
}

.feature-card,
.trust-card {
  padding: 1rem 0;
  border-bottom: 1px solid var(--public-border);
}

.metric-card {
  min-height: 112px;
  display: grid;
  align-content: space-between;
  gap: 0.55rem;
}

.metric-card strong {
  font-size: 1.15rem;
}

.metric-card small {
  color: #047857;
  font-weight: 800;
}

.preview-table {
  display: grid;
  border: 1px solid var(--public-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-table > div {
  grid-template-columns: minmax(140px, 1fr) minmax(120px, auto) minmax(88px, auto);
  align-items: center;
  padding: 0.82rem 1rem;
  border-bottom: 1px solid var(--public-border);
}

.preview-table > div:first-child {
  background: var(--public-elevated);
}

.preview-table > div:last-child {
  border-bottom: 0;
}

.status {
  justify-self: end;
  min-width: 86px;
  padding: 0.28rem 0.5rem;
  border-radius: 999px;
  text-align: center;
}

.status.good {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.status.warn {
  color: #92400e;
  background: rgba(245, 158, 11, 0.14);
}

.features,
.trust-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.features {
  align-items: stretch;
  margin-top: 0.5rem;
}

.feature-card,
.trust-card {
  display: grid;
  align-content: start;
  gap: 0.65rem;
}

.feature-card p,
.trust-card p {
  color: var(--public-text-secondary);
  line-height: 1.55;
}

.privacy-section {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: start;
  gap: 1.2rem;
  margin-top: 1rem;
  padding: 1.2rem;
}

.privacy-section > div:first-child {
  display: grid;
  gap: 0.65rem;
}

.public-footer {
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--public-border);
  color: var(--public-text-muted);
}

.public-footer > span {
  font-weight: 900;
  color: var(--public-text-primary);
}

.footer-links {
  justify-content: flex-end;
}

.footer-links a {
  color: var(--public-text-secondary);
  font-size: 0.92rem;
}

@media (max-width: 920px) {
  .landing-shell { grid-template-columns: 1fr; padding-top: 2rem; }
  .hero-copy,
  .hero-panel {
    max-width: 760px;
    width: 100%;
  }

  .privacy-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .marketing-page {
    padding: 1rem;
  }

  .actions,
  .hero-proof,
  .public-footer,
  .footer-links {
    align-items: stretch;
  }

  .primary,
  .secondary {
    width: 100%;
  }

  .preview-grid,
  .features,
  .trust-grid {
    grid-template-columns: 1fr;
  }

  .preview-table > div {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .status {
    justify-self: start;
  }
}
</style>
