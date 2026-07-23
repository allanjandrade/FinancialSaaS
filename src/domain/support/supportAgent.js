import { SUPPORT_FAQ } from './staticFaq.js'

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function searchSupportFaq(query, limit = 3) {
  const term = normalize(query)
  if (!term) return SUPPORT_FAQ.slice(0, limit)

  return SUPPORT_FAQ
    .map((item) => {
      const keywords = (item.keywords || []).map(normalize)
      const haystack = normalize([
        item.question,
        item.answer,
        ...(item.keywords || []),
      ].join(' '))
      const score = term.split(/\s+/).filter(Boolean).reduce((sum, word) => {
        const keywordScore = keywords.includes(word) ? 4 : 0
        const questionScore = normalize(item.question).includes(word) ? 2 : 0
        const contentScore = haystack.includes(word) ? 1 : 0
        return sum + keywordScore + questionScore + contentScore
      }, 0)
      return { item, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item)
}

export function answerSupportQuestion(query) {
  const [first] = searchSupportFaq(query, 1)
  if (!first) {
    return {
      answer: 'Não encontrei uma resposta segura para essa dúvida na base de ajuda. Use os links legais ou fale com o suporte quando o canal oficial estiver disponível.',
      matched: null,
    }
  }
  return {
    answer: first.answer,
    matched: first,
  }
}
