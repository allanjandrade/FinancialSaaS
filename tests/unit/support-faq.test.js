import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SUPPORT_FAQ } from '@/domain/support/staticFaq.js'
import { answerSupportQuestion, searchSupportFaq } from '@/domain/support/supportAgent.js'

describe('support FAQ', () => {
  it('ships ten fixed support answers', () => {
    expect(SUPPORT_FAQ).toHaveLength(10)
    expect(searchSupportFaq('senha')[0].id).toBe('senha')
    expect(answerSupportQuestion('alerta dinheiro').answer).toMatch(/não criam lançamentos/i)
  })

  it('does not access financial state', () => {
    const source = fs.readFileSync('src/domain/support/supportAgent.js', 'utf8')
    expect(source).not.toMatch(/finance_states|useFinanceStore|financeStore|expenses|incomes/)
  })
})
