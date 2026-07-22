import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStatementOcr } from '@/utils/statement-ocr-api.js'

describe('statement OCR API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.supabase
    delete window.SUPABASE_CONFIG
  })

  it('surfaces structured edge auth errors instead of object placeholders', async () => {
    window.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'anon-key' }
    window.supabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: 'token' } },
        })),
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sessao invalida ou expirada. Faca login novamente.',
        },
      }),
    })))

    const file = new File(['img'], 'extrato.png', { type: 'image/png' })
    await expect(fetchStatementOcr(file)).rejects.toThrow(
      'HTTP 401: Sessao invalida ou expirada. Faca login novamente.',
    )
  })

  it('turns CORS or network failures into an actionable OCR message', async () => {
    window.SUPABASE_CONFIG = { url: 'https://example.supabase.co', anonKey: 'anon-key' }
    window.supabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: 'token' } },
        })),
      },
    }
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    const file = new File(['img'], 'extrato.png', { type: 'image/png' })
    await expect(fetchStatementOcr(file)).rejects.toThrow(
      'OCR online indisponível. Tente novamente ou use CSV/PDF com texto selecionável.',
    )
  })
})
