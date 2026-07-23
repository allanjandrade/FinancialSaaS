import { spawn } from 'node:child_process'

const baseUrl = process.env.RELEASE8_REMOTE_APP_URL || process.env.CYPRESS_BASE_URL || process.env.VITE_APP_URL

if (!baseUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl)) {
  throw new Error('Defina RELEASE8_REMOTE_APP_URL ou CYPRESS_BASE_URL com a URL publicada para rodar o smoke remoto da Release 8.2.')
}

const args = [
  'cypress',
  'run',
  '--browser',
  process.env.CYPRESS_BROWSER || 'chrome',
  '--config',
  `baseUrl=${baseUrl}`,
  '--spec',
  'cypress/e2e/release8-dashboard-layout.cy.js',
]

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  if (code === 0) console.log('Release 8.2 smoke remoto: PASS, Dashboard sem espacos vazios estruturais')
  process.exit(code ?? 1)
})
