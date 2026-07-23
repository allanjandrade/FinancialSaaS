import { describe, expect, it } from 'vitest'
import {
  chunkText,
  embeddingProvider,
  embeddingsEnabled,
} from '../../supabase/functions/_shared/embeddings.ts'
import {
  normalizeConnectorRecord,
  stableJson,
} from '../../supabase/functions/_shared/connectors.ts'

describe('data intelligence foundation', () => {
  it('keeps paid embeddings disabled unless explicitly enabled', () => {
    expect(embeddingsEnabled()).toBe(false)
    expect(embeddingsEnabled('false')).toBe(false)
    expect(embeddingsEnabled('true')).toBe(true)
  })

  it('selects Gemini only when explicitly configured', () => {
    expect(embeddingProvider()).toBe('openai')
    expect(embeddingProvider('openai')).toBe('openai')
    expect(embeddingProvider('gemini')).toBe('gemini')
  })

  it('chunks long content with stable indexes and bounded size', () => {
    const content = Array.from({ length: 80 }, (_, index) =>
      `Parágrafo ${index}: informação financeira relevante para busca semântica.`
    ).join('\n')
    const chunks = chunkText(content, 500, 60)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk, index) => chunk.chunk_index === index)).toBe(true)
    expect(chunks.every((chunk) => chunk.content.length <= 500)).toBe(true)
  })

  it('normalizes connector records with deterministic hashes', async () => {
    const first = await normalizeConnectorRecord('open_finance', {
      transactionId: 'txn-1',
      amount: 120.5,
      description: 'Mercado',
      date: '2026-06-10T12:00:00Z',
    }, 0)
    const second = await normalizeConnectorRecord('open_finance', {
      description: 'Mercado',
      amount: 120.5,
      date: '2026-06-10T12:00:00Z',
      transactionId: 'txn-1',
    }, 0)

    expect(first.dedupe_key).toBe('txn-1')
    expect(first.payload_hash).toBe(second.payload_hash)
    expect(stableJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })
})
