import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const required = [
  'supabase/migrations/20260613100000_release4_ai_actions.sql',
  'supabase/functions/propose-action/index.ts',
  'supabase/functions/confirm-action/index.ts',
  'supabase/functions/revert-action/index.ts',
  'supabase/functions/_shared/ai-actions/schemas.js',
  'supabase/functions/_shared/ai-actions/executors.js',
  'src/api/ai-actions.js',
  'src/components/AIActionConfirmationModal.vue',
]
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Arquivo obrigatorio ausente: ${file}`)
const migration = read(required[0])
for (const token of ['ai_action_drafts', 'idempotency_keys', 'ai_action_logs', 'commit_ai_action', 'revert_ai_action', 'enable row level security']) {
  if (!migration.includes(token)) throw new Error(`Contrato SQL ausente: ${token}`)
}
const confirm = read(required[2])
for (const token of ['requireAuthenticatedUser', 'requireAiConsent', 'assertAuthorizedFinanceEditor', 'validateActionPayload', 'commit_ai_action']) {
  if (!confirm.includes(token)) throw new Error(`Protecao de confirmacao ausente: ${token}`)
}
if (/ai-assist[\\/]index\.ts/.test(confirm)) throw new Error('confirm-action nao pode delegar escrita ao ai-assist')
console.log('AI actions validation: PASS')
