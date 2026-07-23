import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAIStore } from '@/stores/ai'

describe('AI markdown security', () => {
  it('sanitizes assistant markdown before v-html rendering', () => {
    setActivePinia(createPinia())
    const aiStore = useAIStore()

    const html = aiStore.renderMarkdown('[link](javascript:alert(1)) <img src=x onerror="alert(1)"><script>alert(1)</script> **safe**')

    expect(html).toContain('<strong>safe</strong>')
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toMatch(/<script/i)
  })
})
