import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Release 11 UX contracts', () => {
  it('uses accessible confirmation and toast primitives', () => {
    const modal = fs.readFileSync('src/components/ConfirmModal.vue', 'utf8')
    const toast = fs.readFileSync('src/components/ui/AppToast.vue', 'utf8')
    const css = fs.readFileSync('src/styles/main.css', 'utf8')

    expect(modal).toContain('ref="cancelButton"')
    expect(modal).toContain('@keydown.esc')
    expect(modal).toContain('destructive')
    expect(toast).toContain('role="alert"')
    expect(css).toContain('--touch-target-min: 44px')
  })

  it('keeps chat centered with cold-start suggestions', () => {
    const chat = fs.readFileSync('src/views/AI.vue', 'utf8')
    expect(chat).toContain('chat-suggestion-cards')
    expect(chat).toContain('width: min(800px, 100%)')
    expect(chat).toContain('Resumo dos gastos do mês')
  })
})
