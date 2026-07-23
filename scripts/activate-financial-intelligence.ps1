param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
  throw 'Informe -ProjectRef ou defina SUPABASE_PROJECT_REF.'
}

Write-Host 'Ativando Gemini Embeddings para memoria financeira agregada...'
supabase secrets set `
  EMBEDDINGS_ENABLED=true `
  EMBEDDING_PROVIDER=gemini `
  EMBEDDINGS_TEST_ONLY=false `
  GEMINI_EMBEDDING_MODEL=gemini-embedding-001 `
  --project-ref $ProjectRef

Write-Host 'Publicando o modo de analista financeiro na funcao de chat...'
supabase functions deploy chat --project-ref $ProjectRef

Write-Host 'Validando funcoes remotas...'
supabase functions list --project-ref $ProjectRef
