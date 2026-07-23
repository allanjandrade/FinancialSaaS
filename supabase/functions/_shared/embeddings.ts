const EMBEDDING_DIMENSIONS = 1536

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
export type EmbeddingProvider = 'openai' | 'gemini'

export type TextChunk = {
  chunk_index: number
  content: string
  token_count: number
  metadata: Record<string, unknown>
}

export function chunkText(content: string, maxChars = 2400, overlapChars = 240): TextChunk[] {
  const normalized = content.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []

  const chunks: TextChunk[] = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars)
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf(' ', end),
      )
      if (boundary > start + Math.floor(maxChars * 0.6)) end = boundary + 1
    }

    const text = normalized.slice(start, end).trim()
    if (text) {
      chunks.push({
        chunk_index: chunks.length,
        content: text,
        token_count: Math.ceil(text.length / 4),
        metadata: { start, end },
      })
    }

    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlapChars)
  }
  return chunks
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function embeddingsEnabled(configuredValue?: string): boolean {
  const value = configuredValue ?? (
    typeof Deno !== 'undefined' ? Deno.env.get('EMBEDDINGS_ENABLED') : undefined
  )
  return value?.trim().toLowerCase() === 'true'
}

export function embeddingProvider(configuredValue?: string): EmbeddingProvider {
  const value = configuredValue ?? (
    typeof Deno !== 'undefined' ? Deno.env.get('EMBEDDING_PROVIDER') : undefined
  )
  return value?.trim().toLowerCase() === 'gemini' ? 'gemini' : 'openai'
}

export function embeddingConfiguration() {
  const provider = embeddingProvider()
  return {
    enabled: embeddingsEnabled(),
    testOnly: Deno.env.get('EMBEDDINGS_TEST_ONLY')?.trim().toLowerCase() === 'true',
    provider,
    model: provider === 'gemini'
      ? Deno.env.get('GEMINI_EMBEDDING_MODEL') || 'gemini-embedding-001'
      : Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small',
    version: Deno.env.get('EMBEDDING_VERSION') || 'v1',
    dimensions: EMBEDDING_DIMENSIONS,
  }
}

function normalizeEmbedding(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
  return magnitude > 0 ? values.map((value) => value / magnitude) : values
}

async function createGeminiEmbeddings(
  inputs: string[],
  taskType: EmbeddingTaskType,
  config: ReturnType<typeof embeddingConfiguration>,
): Promise<number[][]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw Object.assign(
      new Error('EMBEDDING_UNAVAILABLE: GEMINI_API_KEY nao configurada'),
      { status: 503 },
    )
  }

  const model = config.model.replace(/^models\//, '')
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        requests: inputs.map((input) => ({
          model: `models/${model}`,
          content: { parts: [{ text: input }] },
          embedContentConfig: {
            taskType,
            outputDimensionality: config.dimensions,
          },
        })),
      }),
      signal: AbortSignal.timeout(60000),
    },
  )

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(
      new Error(`EMBEDDING_UNAVAILABLE: ${JSON.stringify(data).slice(0, 240)}`),
      { status: 503 },
    )
  }

  return (data?.embeddings || []).map((embedding: { values?: number[] }) =>
    normalizeEmbedding(embedding.values || [])
  )
}

async function createOpenAiEmbeddings(
  inputs: string[],
  config: ReturnType<typeof embeddingConfiguration>,
): Promise<number[][]> {
  const apiKey = Deno.env.get('EMBEDDING_API_KEY') || Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw Object.assign(
      new Error('EMBEDDING_UNAVAILABLE: chave de embeddings nao configurada'),
      { status: 503 },
    )
  }

  const endpoint = Deno.env.get('EMBEDDING_API_URL') || 'https://api.openai.com/v1/embeddings'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      input: inputs,
      dimensions: config.dimensions,
      encoding_format: 'float',
    }),
    signal: AbortSignal.timeout(60000),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(
      new Error(`EMBEDDING_UNAVAILABLE: ${JSON.stringify(data).slice(0, 240)}`),
      { status: 503 },
    )
  }

  return [...(data?.data || [])]
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((item) => item.embedding)
}

export async function createEmbeddings(
  inputs: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  if (!inputs.length) return []
  const config = embeddingConfiguration()
  if (!config.enabled) {
    throw Object.assign(
      new Error('EMBEDDING_DISABLED: recurso reservado para a etapa comercial'),
      { status: 503 },
    )
  }

  const embeddings = config.provider === 'gemini'
    ? await createGeminiEmbeddings(inputs, taskType, config)
    : await createOpenAiEmbeddings(inputs, config)

  if (embeddings.length !== inputs.length) {
    throw new Error('EMBEDDING_INVALID: quantidade de vetores diferente da entrada')
  }
  if (embeddings.some((embedding) => !Array.isArray(embedding) || embedding.length !== config.dimensions)) {
    throw new Error(`EMBEDDING_INVALID: esperado vetor com ${config.dimensions} dimensoes`)
  }

  return embeddings
}
