import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scannedRoots = ['src', 'public', 'dist'].filter((dir) => fs.existsSync(path.join(root, dir)))
const forbiddenPatterns = [
  /VALUE_SERP_API_KEY/i,
  /DATAFORSEO/i,
  /GEMINI_API_KEY/i,
  /SUPABASE_SERVICE_ROLE/i,
  /service_role/i,
  /valueserp\.com/i,
  /serpapi\.com/i,
  /generativelanguage\.googleapis\.com/i,
]

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return [full]
  })
}

function isTextFile(file) {
  return /\.(js|mjs|cjs|ts|vue|json|html|css|txt|map)$/i.test(file)
}

const findings = []
for (const dir of scannedRoots) {
  for (const file of walk(path.join(root, dir)).filter(isTextFile)) {
    const content = fs.readFileSync(file, 'utf8')
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        findings.push(`${path.relative(root, file)} contem ${pattern}`)
      }
    }
  }
}

const viteEnvFiles = fs.readdirSync(root)
  .filter((name) => /^\.env/.test(name))
  .map((name) => path.join(root, name))
for (const file of viteEnvFiles) {
  const content = fs.readFileSync(file, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*VITE_.*(SECRET|SERVICE_ROLE|VALUE_SERP|DATAFORSEO|GEMINI_API_KEY|API_KEY)\s*=/i.test(line)) {
      findings.push(`${path.relative(root, file)} contem env VITE sensivel`)
    }
  }
}

assert.deepEqual(findings, [], `Secrets ou providers sensiveis expostos no frontend:\n${findings.join('\n')}`)
console.log('Secrets exposure validation: PASS')
