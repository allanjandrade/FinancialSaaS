import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('AI view contract', () => {
  it('maps assistant messages to the rendered AI bubble and feedback controls', () => {
    const source = fs.readFileSync('src/views/AI.vue', 'utf8')

    expect(source).toContain(':class="messageClass(msg)"')
    expect(source).toContain("msg.role !== 'user'")
    expect(source).toContain('function messageClass(msg)')
    expect(source).not.toContain("msg.role === 'ai'")
  })
})
