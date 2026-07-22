import { indexKnowledgeDocument, searchKnowledge } from '@/api/knowledge.js'
import {
  financialFactsForAI,
  financialSnapshotContent,
} from '@/utils/financial-intelligence.js'
import { v3CommandFactsForAI } from '@/domain/v3/commandCenter.js'

async function authenticatedHeaders() {
  const supabase = window.supabase
  if (!supabase) throw new Error('Supabase não inicializado')
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Faça login para usar o analista financeiro')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: window.SUPABASE_CONFIG?.anonKey || '',
  }
}

export async function rememberFinancialSnapshot(familyId, analysis) {
  if (!familyId) throw new Error('Família não identificada para memória financeira')
  return indexKnowledgeDocument({
    familyId,
    sourceType: 'financial_snapshot',
    sourceId: String(analysis.period.key),
    title: `Resumo financeiro ${analysis.period.key}`,
    content: financialSnapshotContent(analysis),
    metadata: {
      periodKey: analysis.period.key,
      aggregateOnly: true,
      generatedAt: analysis.generatedAt,
      confidence: analysis.dataQuality.confidence,
    },
  })
}

export async function explainFinancialAnalysis({ familyId, analysis, question, commandCenter = null }) {
  let memory = []
  let memoryStatus = 'unavailable'

  if (familyId) {
    try {
      const result = await searchKnowledge(
        familyId,
        question || 'mudanças financeiras, riscos, oportunidades e decisões recentes',
        { threshold: 0.55, matchCount: 6 },
      )
      memory = (result.matches || []).map((match) => ({
        title: match.title,
        content: match.content,
        similarity: match.similarity,
      }))
      memoryStatus = memory.length ? 'ready' : 'empty'
    } catch (error) {
      console.info('FINANCIAL_MEMORY_SEARCH_UNAVAILABLE', error.message)
    }
  }

  const response = await fetch(`${window.SUPABASE_CONFIG.url}/functions/v1/chat`, {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: JSON.stringify({
      mode: 'financial-analysis',
      message: question || 'Explique o diagnóstico e indique as três ações mais importantes.',
      facts: {
        ...financialFactsForAI(analysis),
        v3Command: commandCenter ? v3CommandFactsForAI(commandCenter) : null,
      },
      memory,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || data.error || 'Analista financeiro indisponível')
  }

  return {
    response: data.response || '',
    memoryStatus,
    memoryMatches: memory.length,
  }
}
