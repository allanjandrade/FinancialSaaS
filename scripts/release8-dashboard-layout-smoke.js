import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  CYPRESS_SPEC: 'cypress/e2e/release8-dashboard-layout.cy.js',
}

const child = spawn('node', ['scripts/run-e2e.js'], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code) => {
  if (code === 0) console.log('Release 8.2 smoke local: PASS, Dashboard sem espacos vazios estruturais')
  process.exit(code ?? 1)
})
