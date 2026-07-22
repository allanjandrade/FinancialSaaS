import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const indexFile = path.join(distDir, 'index.html')

const routes = [
  '/login',
  '/signup',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookies',
  '/data-processing',
  '/subscription-policy',
  '/ai-consent',
  '/security',
  '/lgpd-requests',
  '/financial-disclaimer',
  '/pricing',
  '/dashboard',
  '/command-center',
  '/analysis',
  '/reports',
  '/entries',
  '/income-documents',
  '/onboarding',
  '/price-monitor',
  '/card',
  '/cards',
  '/accounts',
  '/benefit',
  '/benefits',
  '/ai',
  '/advisor',
  '/ai-actions',
  '/automations',
  '/intelligence',
  '/plan',
  '/plan/purchase-simulator',
  '/goals',
  '/budget',
  '/subscriptions',
  '/purchase-simulator',
  '/simulations',
  '/simulations/can-i-buy',
  '/simulacoes',
  '/simulacoes/posso-comprar',
  '/compras',
  '/compras/wishlist',
  '/compras/nova',
  '/compras/produto',
  '/compras-ia',
  '/compras-ia/nova',
  '/compras-ia/wishlist',
  '/purchases',
  '/purchases/new',
  '/structure',
  '/financas',
  '/configuracoes',
  '/family',
  '/family-hub',
  '/settings',
  '/settings/family',
  '/support',
  '/billing',
  '/admin',
  '/operational',
]

if (!fs.existsSync(indexFile)) {
  throw new Error('dist/index.html not found. Run vite build before generating route fallbacks.')
}

const indexHtml = fs.readFileSync(indexFile)

for (const route of routes) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, '')
  if (!cleanRoute) continue
  const routeDir = path.join(distDir, ...cleanRoute.split('/'))
  fs.mkdirSync(routeDir, { recursive: true })
  fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml)
}

fs.writeFileSync(path.join(distDir, '404.html'), indexHtml)

console.log(`Generated SPA fallbacks for ${routes.length} routes.`)
