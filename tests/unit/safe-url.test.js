import { describe, expect, it } from 'vitest'
import {
  normalizeExternalUrl,
  normalizeImageUrl,
  sanitizeExternalUrlFields,
} from '@/utils/safe-url.js'

describe('safe url helpers', () => {
  it('allows only http and https external URLs', () => {
    expect(normalizeExternalUrl('https://loja.example/produto')).toBe('https://loja.example/produto')
    expect(normalizeExternalUrl('www.loja.example/produto')).toBe('https://www.loja.example/produto')
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('')
    expect(normalizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('')
  })

  it('allows only safe image protocols', () => {
    expect(normalizeImageUrl('https://cdn.example/avatar.png')).toBe('https://cdn.example/avatar.png')
    expect(normalizeImageUrl('blob:http://localhost/avatar-preview')).toBe('blob:http://localhost/avatar-preview')
    expect(normalizeImageUrl('javascript:alert(1)')).toBe('')
    expect(normalizeImageUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe('')
  })

  it('sanitizes known URL fields recursively without touching non-url content', () => {
    const sanitized = sanitizeExternalUrlFields({
      name: 'Produto',
      originalUrl: 'javascript:alert(1)',
      canonical_url: 'https://loja.example/item',
      imageUrl: 'data:image/svg+xml,<svg></svg>',
      image: 'javascript:alert(1)',
      offers: [
        { url: 'javascript:alert(1)', link: 'https://loja.example/oferta' },
      ],
    })

    expect(sanitized.name).toBe('Produto')
    expect(sanitized.originalUrl).toBe('')
    expect(sanitized.canonical_url).toBe('https://loja.example/item')
    expect(sanitized.imageUrl).toBe('')
    expect(sanitized.image).toBe('')
    expect(sanitized.offers[0]).toMatchObject({
      url: '',
      link: 'https://loja.example/oferta',
    })
  })
})
