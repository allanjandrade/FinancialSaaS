import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authErrorDetails, requireAuthenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  chunkText,
  createEmbeddings,
  embeddingConfiguration,
  sha256,
} from '../_shared/embeddings.ts'

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function restRequest(path: string, token: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !apiKey) throw new Error('Supabase REST não configurado')

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `PostgREST ${response.status}`)
    Object.assign(error, { status: response.status, details: data })
    throw error
  }
  return data
}

async function indexDocument(body: Record<string, unknown>, token: string) {
  const familyId = String(body.familyId || '')
  const sourceType = String(body.sourceType || '').trim()
  const sourceId = String(body.sourceId || '').trim()
  const title = String(body.title || '').trim()
  const content = String(body.content || '').trim()
  const mimeType = body.mimeType ? String(body.mimeType) : null
  const metadata = isObject(body.metadata) ? body.metadata : {}

  if (!familyId || !sourceType || !sourceId || content.length < 10) {
    throw Object.assign(new Error('familyId, sourceType, sourceId e content são obrigatórios'), { status: 400 })
  }
  if (content.length > 250000) {
    throw Object.assign(new Error('Documento excede o limite de 250 mil caracteres'), { status: 413 })
  }

  const chunks = chunkText(content)
  if (!chunks.length) throw Object.assign(new Error('Documento sem conteúdo indexável'), { status: 400 })

  const config = embeddingConfiguration()
  const [contentHash, embeddings] = await Promise.all([
    sha256(content),
    createEmbeddings(chunks.map((chunk) => chunk.content), 'RETRIEVAL_DOCUMENT'),
  ])

  const documents = await restRequest(
    'knowledge_documents?on_conflict=family_id,source_type,source_id',
    token,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{
        family_id: familyId,
        source_type: sourceType,
        source_id: sourceId,
        title,
        mime_type: mimeType,
        content_hash: contentHash,
        embedding_status: 'processing',
        embedding_model: config.model,
        embedding_version: config.version,
        metadata,
        updated_at: new Date().toISOString(),
      }]),
    },
  )
  const document = documents?.[0]
  if (!document?.id) throw new Error('Documento vetorial não retornado pelo banco')

  const preparedChunks = await Promise.all(chunks.map(async (chunk, index) => ({
    ...chunk,
    content_hash: await sha256(chunk.content),
    embedding: embeddings[index],
  })))

  const insertedCount = await restRequest('rpc/replace_knowledge_chunks', token, {
    method: 'POST',
    body: JSON.stringify({
      p_document_id: document.id,
      p_family_id: familyId,
      p_chunks: preparedChunks,
      p_embedding_model: config.model,
      p_embedding_version: config.version,
    }),
  })

  return {
    documentId: document.id,
    contentHash,
    chunkCount: Number(insertedCount || preparedChunks.length),
    model: config.model,
    version: config.version,
  }
}

async function searchKnowledge(body: Record<string, unknown>, token: string) {
  const familyId = String(body.familyId || '')
  const query = String(body.query || '').trim()
  const matchCount = Math.max(1, Math.min(20, Number(body.matchCount || 8)))
  const threshold = Math.max(0, Math.min(1, Number(body.threshold ?? 0.72)))
  if (!familyId || !query) {
    throw Object.assign(new Error('familyId e query são obrigatórios'), { status: 400 })
  }

  const [embedding] = await createEmbeddings([query.slice(0, 8000)], 'RETRIEVAL_QUERY')
  const matches = await restRequest('rpc/match_knowledge_chunks', token, {
    method: 'POST',
    body: JSON.stringify({
      p_family_id: familyId,
      p_query_embedding: embedding,
      p_match_threshold: threshold,
      p_match_count: matchCount,
    }),
  })
  return { query, matches: matches || [] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Método não permitido', 405)

  try {
    const { token } = await requireAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'index')
    const config = embeddingConfiguration()
    if (config.testOnly) {
      const isTemporaryDiagnostic = action === 'index'
        ? body.sourceType === 'diagnostic' && isObject(body.metadata) && body.metadata.temporary === true
        : body.testOnly === true
      if (!isTemporaryDiagnostic) {
        return errorResponse('Embeddings limitados a dados sinteticos durante os testes', 403)
      }
    }
    const result = action === 'search'
      ? await searchKnowledge(body, token)
      : await indexDocument(body, token)
    return jsonResponse(result)
  } catch (error) {
    const authError = authErrorDetails(error)
    if (authError) return errorResponse(authError.message, authError.status)
    const status = Number((error as { status?: number })?.status || 500)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return errorResponse('Erro no serviço de embeddings', status, message)
  }
})
