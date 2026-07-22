import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { summarizeCypressResult } from './cypress-result.js'

const root = process.cwd()
const localAppData = path.join(root, '.appdata-r4-clean')
const localLocalAppData = path.join(root, '.localappdata-r4-clean')
const localUserData = path.join(root, '.cypress-user-data-r4-clean')
const localNpmCache = path.join(root, '.npm-cache-r4')
const localCypressCache = path.join(root, '.cypress-cache-15-8-2-manual')
for (const dir of [localAppData, localLocalAppData, localUserData, localNpmCache, localCypressCache]) {
  fs.mkdirSync(dir, { recursive: true })
}

const cypressSpawnFile = path.join(root, 'node_modules', 'cypress', 'dist', 'exec', 'spawn.js')
if (fs.existsSync(cypressSpawnFile)) {
  const source = fs.readFileSync(cypressSpawnFile, 'utf8')
  if (!source.includes('CYPRESS_ELECTRON_ARGS')) {
    fs.writeFileSync(
      cypressSpawnFile,
      source.replace(
        'stdioOptions.env = lodash_1.default.extend({}, stdioOptions.env, envOverrides);\n',
        "stdioOptions.env = lodash_1.default.extend({}, stdioOptions.env, envOverrides);\n            if (stdioOptions.env.CYPRESS_ELECTRON_ARGS) {\n                electronArgs.push(...String(stdioOptions.env.CYPRESS_ELECTRON_ARGS).split(/\\s+/).filter(Boolean));\n            }\n",
      ),
    )
  }
}

delete process.env.CYPRESS_CONFIG_ENV
delete process.env.CYPRESS_APP_DATA_FOLDER
delete process.env.CYPRESS_INTERNAL_ENV
process.env.APPDATA = localAppData
process.env.LOCALAPPDATA = localLocalAppData
process.env.npm_config_cache ||= localNpmCache
process.env.CYPRESS_CACHE_FOLDER ||= localCypressCache
process.env.CYPRESS_ELECTRON_ARGS ||= [
  `--user-data-dir=${localUserData}`,
  '--disable-gpu',
  '--in-process-gpu',
  '--disable-gpu-compositing',
  '--disable-accelerated-2d-canvas',
  '--disable-accelerated-video-decode',
].join(' ')

const server = spawn('npm run preview -- --host 127.0.0.1 --port 4173', {
  stdio: 'inherit',
  shell: true,
})

async function waitForServer() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173')
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Preview server did not start within 30 seconds')
}

async function stopServer() {
  if (server.exitCode != null) return
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', resolve)
    })
  } else {
    server.kill('SIGTERM')
  }
}

try {
  await waitForServer()
  const { default: cypress } = await import('cypress')
  const runOptions = { browser: process.env.CYPRESS_BROWSER || 'chrome' }
  if (process.env.CYPRESS_SPEC) runOptions.spec = process.env.CYPRESS_SPEC
  const result = await cypress.run(runOptions)
  const summary = summarizeCypressResult(result)
  if (summary.failed) {
    console.error(`Cypress: ${summary.failed} falha(s); ${summary.passed}/${summary.total} testes passaram`)
    summary.messages.forEach((message) => console.error(message))
  } else {
    console.log(`Cypress: ${summary.passed}/${summary.total} tests passed`)
  }
  const exitCode = summary.failed ? 1 : 0
  await stopServer()
  process.exit(exitCode)
} catch (error) {
  console.error(error.message)
  await stopServer()
  process.exit(1)
}
