export const NAV_GROUPS = [
  {
    id: 'inicio',
    label: 'Início',
    items: [
      { path: '/dashboard', label: 'Comando', icon: 'commandCenter' },
    ],
  },
  {
    id: 'inteligencia',
    label: 'Inteligência',
    items: [
      { path: '/analysis', label: 'Análises', icon: 'dashboard' },
      { path: '/reports', label: 'Relatórios', icon: 'reports' },
      { path: '/plan', label: 'Planejamento', icon: 'plan' },
      { path: '/purchases', label: 'Wishlist', icon: 'purchases' },
      { path: '/advisor', label: 'Consultor', icon: 'advisor', premiumFeature: 'predictive_advisor' },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      { path: '/entries', label: 'Lançamentos', icon: 'entries' },
      { path: '/structure?tab=accounts', label: 'Contas', icon: 'accounts' },
      { path: '/card', label: 'Cartões', icon: 'accounts' },
      { path: '/benefit', label: 'Benefícios', icon: 'benefits' },
      { path: '/subscriptions', label: 'Assinaturas', icon: 'subscriptions' },
      { path: '/family', label: 'Família', icon: 'family' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    items: [
      { path: '/settings', label: 'Perfil', icon: 'settings' },
      { path: '/settings?tab=security', label: 'Segurança', icon: 'security' },
      { path: '/settings?tab=integrations', label: 'Integrações', icon: 'integrations' },
      { path: '/admin', label: 'Admin', icon: 'admin', adminOnly: true },
      { path: '/operational', label: 'Operacional', icon: 'operational', operationalOnly: true },
    ],
  },
]

export const ROUTE_META = {
  '/': { title: 'Visão Geral', group: 'Início', breadcrumb: ['Início', 'Visão Geral'], icon: 'dashboard', subtitle: 'Saldo disponível, obrigações e alertas do período' },
  '/dashboard': { title: 'Comando', group: 'Início', breadcrumb: ['Início', 'Comando'], icon: 'commandCenter', subtitle: 'Score, plano de ação e execução financeira do mês' },
  '/command-center': { title: 'Central de Comando', group: 'Início', breadcrumb: ['Início', 'Central de Comando'], icon: 'commandCenter', subtitle: 'Score, plano de ação e execução financeira do mês' },
  '/analysis': { title: 'Análises', group: 'Inteligência', breadcrumb: ['Inteligência', 'Análises'], icon: 'dashboard', subtitle: 'Visão analítica, indicadores e histórico operacional' },
  '/reports': { title: 'Relatórios', group: 'Inteligência', breadcrumb: ['Inteligência', 'Relatórios'], icon: 'reports', subtitle: 'Histórico, comparativos e tendências' },
  '/entries': { title: 'Lançamentos', group: 'Operação', breadcrumb: ['Operação', 'Lançamentos'], icon: 'entries', subtitle: 'Cadastro manual, OCR e IA no mesmo fluxo' },
  '/accounts': { title: 'Contas', group: 'Operação', breadcrumb: ['Operação', 'Contas'], icon: 'accounts', subtitle: 'Contas financeiras e saldos operacionais' },
  '/cards': { title: 'Cartões', group: 'Operação', breadcrumb: ['Operação', 'Cartões'], icon: 'accounts', subtitle: 'Cartões e competência de faturas' },
  '/benefits': { title: 'Benefícios', group: 'Operação', breadcrumb: ['Operação', 'Benefícios'], icon: 'benefits', subtitle: 'Carteiras VA, VR e saldos' },
  '/structure': { title: 'Contas', group: 'Operação', breadcrumb: ['Operação', 'Contas'], icon: 'accounts', subtitle: 'Contas, cartões e benefícios' },
  '/structure?tab=accounts': { title: 'Contas', group: 'Operação', breadcrumb: ['Operação', 'Contas'], icon: 'accounts', subtitle: 'Contas financeiras e saldos operacionais' },
  '/card': { title: 'Cartões', group: 'Operação', breadcrumb: ['Operação', 'Cartões'], icon: 'accounts', subtitle: 'Cartões e competência de faturas' },
  '/benefit': { title: 'Benefícios', group: 'Operação', breadcrumb: ['Operação', 'Benefícios'], icon: 'benefits', subtitle: 'Carteiras VA e VR' },
  '/income-documents': { title: 'Comprovantes', group: 'Operação', breadcrumb: ['Operação', 'Comprovantes'], icon: 'entries', subtitle: 'Documentos de entrada' },
  '/plan': { title: 'Planejamento', group: 'Inteligência', breadcrumb: ['Inteligência', 'Planejamento'], icon: 'plan', subtitle: 'Prioridades, simulações e decisões do mês' },
  '/goals': { title: 'Metas', group: 'Planejamento', breadcrumb: ['Planejamento', 'Metas'], icon: 'goals', subtitle: 'Reservas, compras planejadas e objetivos de economia' },
  '/budget': { title: 'Orçamento', group: 'Planejamento', breadcrumb: ['Planejamento', 'Orçamento'], icon: 'budget', subtitle: 'Planejado, realizado e risco por categoria' },
  '/subscriptions': { title: 'Assinaturas', group: 'Operação', breadcrumb: ['Operação', 'Assinaturas'], icon: 'subscriptions', subtitle: 'Cobranças recorrentes, alertas e impacto no mês' },
  '/purchases': { title: 'Wishlist', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist'], icon: 'purchases', subtitle: 'Itens desejados, cotação e decisão financeira' },
  '/purchases/new': { title: 'Nova compra', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist', 'Nova compra'], icon: 'purchases', subtitle: 'Cadastre um item para cotar e avaliar antes de comprar' },
  '/simulations': { title: 'Simulações', group: 'Planejamento', breadcrumb: ['Planejamento', 'Simulações'], icon: 'simulator', subtitle: 'Cenários para decidir antes de se comprometer' },
  '/simulations/can-i-buy': { title: 'Posso comprar?', group: 'Planejamento', breadcrumb: ['Planejamento', 'Simulações', 'Posso comprar?'], icon: 'simulator', subtitle: 'Simule uma compra antes de comprometer seu mês' },
  '/purchase-simulator': { title: 'Posso comprar?', group: 'Planejamento', breadcrumb: ['Planejamento', 'Simulações', 'Posso comprar?'], icon: 'simulator', subtitle: 'Simule uma compra antes de comprometer seu mês' },
  '/ai': { title: 'Copiloto', group: 'Inteligência', breadcrumb: ['Inteligência', 'Copiloto'], icon: 'copilot', subtitle: 'Análise financeira assistida' },
  '/advisor': { title: 'Consultor financeiro', group: 'Inteligência', breadcrumb: ['Inteligência', 'Consultor financeiro'], icon: 'advisor', subtitle: 'Previsões e cenários para decidir melhor' },
  '/ai-actions': { title: 'Ações inteligentes', group: 'Inteligência', breadcrumb: ['Inteligência', 'Ações inteligentes'], icon: 'aiActions', subtitle: 'Sugestões revisadas antes de executar' },
  '/automations': { title: 'Alertas', group: 'Inteligência', breadcrumb: ['Inteligência', 'Alertas'], icon: 'automations', subtitle: 'Avisos com trava, deduplicação e pausa entre alertas' },
  '/settings': { title: 'Perfil', group: 'Configurações', breadcrumb: ['Configurações', 'Perfil'], icon: 'settings', subtitle: 'Conta, preferências e segurança' },
  '/settings?tab=security': { title: 'Segurança', group: 'Configurações', breadcrumb: ['Configurações', 'Segurança'], icon: 'security', subtitle: 'Acesso, privacidade e proteção da conta' },
  '/settings?tab=integrations': { title: 'Integrações', group: 'Configurações', breadcrumb: ['Configurações', 'Integrações'], icon: 'integrations', subtitle: 'Conexões e serviços externos' },
  '/support': { title: 'Suporte', group: 'Configurações', breadcrumb: ['Configurações', 'Suporte'], icon: 'support', subtitle: 'Ajuda, perguntas frequentes e canais oficiais' },
  '/billing': { title: 'Planos', group: 'Configurações', breadcrumb: ['Configurações', 'Planos'], icon: 'billing', subtitle: 'Assinatura, limites e acesso Premium' },
  '/admin': { title: 'Admin', group: 'Configurações', breadcrumb: ['Configurações', 'Admin'], icon: 'admin', subtitle: 'Testers, flags, planos e auditoria' },
  '/operational': { title: 'Operacional', group: 'Configurações', breadcrumb: ['Configurações', 'Operacional'], icon: 'operational', subtitle: 'Eventos, auditoria e diagnóstico' },
  '/family': { title: 'Família', group: 'Operação', breadcrumb: ['Operação', 'Família'], icon: 'family', subtitle: 'Compartilhamento familiar' },
  '/family/invite/:token': { title: 'Convite familiar', group: 'Operação', breadcrumb: ['Operação', 'Família', 'Convite'], icon: 'family', subtitle: 'Aceite de convite familiar' },
  '/settings/family': { title: 'Família', group: 'Operação', breadcrumb: ['Operação', 'Família'], icon: 'family', subtitle: 'Compartilhamento familiar' },
  '/onboarding': { title: 'Perfil financeiro', group: 'Configurações', breadcrumb: ['Configurações', 'Perfil financeiro'], icon: 'settings', subtitle: 'Configuração inicial' },
  '/price-monitor': { title: 'Wishlist', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist'], icon: 'purchases', subtitle: 'Alertas e histórico de preço' },
  '/intelligence': { title: 'Copiloto', group: 'Inteligência', breadcrumb: ['Inteligência', 'Copiloto'], icon: 'copilot', subtitle: 'Centro de inteligência financeira' },
}

function splitPath(value = '') {
  const [pathname, query = ''] = String(value || '').split('?')
  return { pathname: pathname || '/', query }
}

export function metaForPath(path) {
  if (ROUTE_META[path]) return ROUTE_META[path]
  const { pathname } = splitPath(path)
  if (path?.startsWith('/purchases/')) {
    return { title: 'Produto', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist', 'Produto'], icon: 'purchases', subtitle: 'Detalhes, preço compatível e decisão' }
  }
  if (path?.startsWith('/compras-ia/produto/')) {
    return { title: 'Produto', group: 'Inteligência', breadcrumb: ['Inteligência', 'Wishlist', 'Produto'], icon: 'purchases', subtitle: 'Detalhes, preço compatível e decisão' }
  }
  if (path?.startsWith('/family/invite/')) {
    return ROUTE_META['/family/invite/:token']
  }
  return ROUTE_META[pathname] || { title: 'Controle Financeiro', group: '', breadcrumb: [], icon: '', subtitle: 'Organização financeira' }
}

export function isItemActive(path, itemPath) {
  const current = splitPath(path)
  const item = splitPath(itemPath)
  const currentFull = current.query ? `${current.pathname}?${current.query}` : current.pathname
  const itemFull = item.query ? `${item.pathname}?${item.query}` : item.pathname

  if (item.query) return currentFull === itemFull
  if (item.pathname === '/settings' && current.pathname === '/settings' && current.query) return false
  if (item.pathname === '/dashboard') return current.pathname === '/' || current.pathname === '/dashboard' || current.pathname === '/command-center'
  if (item.pathname === '/command-center') return current.pathname === '/dashboard' || current.pathname === '/command-center'
  if (item.pathname === '/purchases') return current.pathname === '/purchases' || current.pathname.startsWith('/purchases/') || current.pathname.startsWith('/compras-ia/')
  if (item.pathname === '/plan') return current.pathname === '/plan' || current.pathname === '/goals' || current.pathname === '/budget' || current.pathname === '/simulations' || current.pathname.startsWith('/simulations/') || current.pathname === '/purchase-simulator'
  if (item.pathname === '/ai') return current.pathname === '/ai' || current.pathname === '/intelligence'
  if (item.pathname === '/structure') return ['/accounts', '/structure'].some((prefix) => current.pathname === prefix || current.pathname.startsWith(`${prefix}/`))
  if (item.pathname === '/card') return current.pathname === '/card' || current.pathname === '/cards'
  if (item.pathname === '/benefit') return current.pathname === '/benefits' || current.pathname === '/benefit'
  return current.pathname === item.pathname || current.pathname.startsWith(`${item.pathname}/`)
}

export function groupForPath(path) {
  const active = NAV_GROUPS.find((group) => group.items.some((item) => isItemActive(path, item.path)))
  return active?.label || metaForPath(path).group
}
