import {
  extractTextWithConfiguredOcr,
  parseReceiptText,
} from './deterministic-ocr.ts'

const RECEIPT_SCHEMA_KEYS = [
  'valor',
  'estabelecimento',
  'data',
  'metodo',
  'categoria',
  'confianca',
  'tipoDocumento',
  'observacoes',
  'cnpj',
  'chave',
  'itens',
] as const

export const OCR_SYSTEM_PROMPT = `Você é um extrator OCR especializado em documentos financeiros brasileiros: boletos bancários, boletos de concessionárias (água, luz, gás, internet), faturas, comprovantes de Pix e cupons fiscais.

Leia TODO o texto visível na imagem ou PDF. NUNCA devolva todos os campos nulos se existir qualquer informação legível.

Mapeamento de campos (use exatamente estes nomes no JSON):
- valor: valor numérico a pagar. Priorize "Valor do documento", "(=) Valor cobrado", "Valor a pagar", "Total", "R$" na linha de valor. Ignore códigos de barras e linha digitável como número.
- estabelecimento: nome do Beneficiário, Cedente, Empresa, Instituição ou Sacador. Não use o nome do pagador/sacado.
- data: data de VENCIMENTO no formato AAAA-MM-DD (converta DD/MM/AAAA).
- metodo: use "Boleto" para boletos; "Pix" para comprovante Pix; ou o meio indicado.
- categoria: infira a categoria da despesa (ex.: Moradia para aluguel/condomínio, Contas para concessionária, Saúde, Educação, Transporte, Alimentação, Outro).

Regras:
- Retorne SOMENTE um objeto JSON válido, sem markdown nem texto extra.
- valor: número decimal com ponto (ex.: 1234.56), sem símbolo R$.
- Se um campo realmente não existir no documento, use null apenas para esse campo.
- Em boletos, quase sempre há valor, beneficiário e vencimento — procure nas seções superiores e na linha de vencimento.

Exemplo boleto: {"valor":189.9,"estabelecimento":"Companhia de Energia","data":"2025-07-10","metodo":"Boleto","categoria":"Contas"}
Exemplo comprovante: {"valor":42.5,"estabelecimento":"Padaria X","data":"2025-06-01","metodo":"Pix","categoria":"Alimentação"}`

export const OCR_USER_PROMPT =
  'Analise este documento (boleto, fatura ou comprovante brasileiro) e extraia valor, estabelecimento/beneficiário, data de vencimento, método e categoria.'

export const OCR_BOLETO_RETRY_PROMPT =
  'Este documento é um BOLETO brasileiro. Localize: Beneficiário/Cedente, Valor do documento ou Valor cobrado, e Vencimento. Preencha o JSON. metodo deve ser "Boleto". Não retorne tudo null se houver texto legível.'

export const OCR_MARKET_RECEIPT_PROMPT =
  'Se este documento for cupom fiscal, NFC-e, nota de mercado ou recibo de compra recorrente, extraia tambem cnpj, chave e itens. Retorne JSON com: valor, estabelecimento, cnpj, data, metodo, categoria, tipoDocumento, chave, itens. Cada item deve ter nome, quantidade, unidade, preco_unitario, preco_total e codigo_barras quando existir.'

export type ReceiptFields = {
  valor: number | null
  estabelecimento: string
  data: string
  metodo: string
  categoria: string
  confianca: number
  tipoDocumento: string
  observacoes: string
  cnpj?: string
  chave?: string
  itens?: ReceiptItem[]
}

export type ReceiptItem = {
  nome: string
  quantidade: number
  unidade: string
  preco_unitario: number
  preco_total: number
  codigo_barras: string
}

const VALOR_KEYS = [
  'valor', 'valor_documento', 'valor_cobrado', 'valor_pagar', 'valor_titulo',
  'valor_boleto', 'valor_total', 'amount', 'total', 'value',
]
const NAME_KEYS = [
  'estabelecimento', 'beneficiario', 'beneficiário', 'cedente', 'sacador',
  'empresa', 'nome_beneficiario', 'razao_social', 'instituicao', 'credor',
]
const DATE_KEYS = ['data', 'vencimento', 'data_vencimento', 'data_venc', 'due_date', 'dt_vencimento']
const METODO_KEYS = ['metodo', 'metodo_pagamento', 'forma_pagamento', 'tipo_pagamento', 'payment_method']
const CAT_KEYS = ['categoria', 'tipo', 'tipo_despesa', 'category']
const CNPJ_KEYS = ['cnpj', 'cnpj_emitente', 'establishmentCnpj']
const KEY_KEYS = ['chave', 'chave_acesso', 'chNFe', 'receiptKey']
const ITEMS_KEYS = ['itens', 'items', 'produtos', 'products']

function pickField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = record[key]
    if (v !== null && v !== undefined && String(v).trim() !== '') return v
  }
  return null
}

export function parseBrazilianMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let s = String(value).replace(/\s/g, '').replace(/^R\$?/i, '')
  if (!s) return null

  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }

  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseBrazilianDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()

  const br = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  return null
}

function inferMetodo(record: Record<string, unknown>, metodoRaw: unknown): string | null {
  if (metodoRaw) {
    const s = String(metodoRaw).trim().toLowerCase()
    if (s.includes('boleto') || s.includes('linha digit') || s.includes('código de barras')) return 'Boleto'
    if (s.includes('pix')) return 'Pix'
    if (s.includes('vale refeição') || s.includes('vale refeicao') || s.includes('vr')) return 'VR'
    if (s.includes('vale alimentação') || s.includes('vale alimentacao') || s.includes('va')) return 'VA'
    if (s.includes('transfer') || s.includes('ted') || s.includes('doc')) return 'Transferência'
    if (s.includes('cartão de débito') || s.includes('cartao de debito') || s.includes('débito') || s.includes('debito')) return 'Débito'
    if (s.includes('cartão de crédito') || s.includes('cartao de credito') || s.includes('crédito') || s.includes('credito')) return 'Crédito'
    // Keep as-is when unknown; validateReceiptSchema will clamp later.
    return String(metodoRaw).trim()
  }
  const blob = JSON.stringify(record).toLowerCase()
  if (blob.includes('boleto') || blob.includes('linha digit') || blob.includes('código de barras')) {
    return 'Boleto'
  }
  if (blob.includes('pix')) return 'Pix'
  return null
}

function inferCategoria(record: Record<string, unknown>, catRaw: unknown): string | null {
  if (catRaw) return String(catRaw).trim()
  const blob = JSON.stringify(record).toLowerCase()
  if (/energia|eletric|luz|light|enel/.test(blob)) {
    return 'Energia'
  }
  if (/água|agua|saneamento|sanear|sabesp|water/.test(blob)) {
    return 'Água'
  }
  if (/telefone|internet|fibra|oi|claro|tim|net/.test(blob)) {
    return 'Internet'
  }
  if (/condomínio|condominio|aluguel|locação|locacao/.test(blob)) {
    return 'Moradia'
  }
  if (/imposto|taxa|boleto|fatura|conta|tributo/.test(blob)) {
    return 'Impostos'
  }
  return null
}

export function mapRawOcrToReceipt(record: Record<string, unknown>): Record<string, unknown> {
  const valorRaw = pickField(record, VALOR_KEYS)
  const dataRaw = pickField(record, DATE_KEYS)
  const metodoRaw = pickField(record, METODO_KEYS)
  const catRaw = pickField(record, CAT_KEYS)

  return {
    valor: parseBrazilianMoney(valorRaw),
    estabelecimento: pickField(record, NAME_KEYS),
    data: parseBrazilianDate(dataRaw) ?? dataRaw,
    metodo: inferMetodo(record, metodoRaw),
    categoria: inferCategoria(record, catRaw),
    cnpj: pickField(record, CNPJ_KEYS),
    chave: pickField(record, KEY_KEYS),
    itens: pickField(record, ITEMS_KEYS),
  }
}

function normalizeReceiptItem(raw: unknown): ReceiptItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const nome = String(pickField(record, ['nome', 'name', 'produto', 'descricao', 'xProd']) || '').trim()
  const quantidade = parseBrazilianMoney(pickField(record, ['quantidade', 'quantity', 'qtd', 'qCom'])) || 1
  const precoTotal = parseBrazilianMoney(pickField(record, ['preco_total', 'total', 'valor_total', 'vProd'])) || 0
  const precoUnitario = parseBrazilianMoney(pickField(record, ['preco_unitario', 'unitPrice', 'valor_unitario', 'vUnCom'])) || (precoTotal / quantidade)
  if (!nome || !precoTotal || precoTotal <= 0) return null
  return {
    nome,
    quantidade,
    unidade: String(pickField(record, ['unidade', 'unit', 'uCom']) || 'un').trim(),
    preco_unitario: Number(precoUnitario.toFixed(4)),
    preco_total: Number(precoTotal.toFixed(2)),
    codigo_barras: String(pickField(record, ['codigo_barras', 'barcode', 'ean', 'cEAN', 'cProd']) || '').trim(),
  }
}

export function isEmptyReceipt(fields: ReceiptFields): boolean {
  const hasName = Boolean(fields.estabelecimento && String(fields.estabelecimento).trim())
  const hasValor = fields.valor != null && fields.valor > 0
  const hasDate = Boolean(fields.data && String(fields.data).trim())
  return !hasValor && !hasName && !hasDate
}

export function safeParseJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  const candidate = objectMatch ? objectMatch[0] : cleaned
  try {
    return JSON.parse(candidate)
  } catch {
    throw new Error('INVALID_JSON: resposta da IA não é JSON válido')
  }
}

export function validateReceiptSchema(data: unknown): ReceiptFields {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('INVALID_SCHEMA: corpo da resposta não é um objeto')
  }

  const record = mapRawOcrToReceipt(data as Record<string, unknown>)

  const valor: number | null =
    record.valor === null || record.valor === undefined ? null : parseBrazilianMoney(record.valor)

  const estabelecimento = record.estabelecimento ? String(record.estabelecimento).trim() : ''
  const dataStr = parseBrazilianDate(record.data) ?? (record.data ? String(record.data).trim() : '')
  const metodo = record.metodo ? String(record.metodo).trim() : ''
  const categoria = record.categoria ? String(record.categoria).trim() : ''
  const itensRaw = Array.isArray(record.itens) ? record.itens : []
  const itens = itensRaw.map(normalizeReceiptItem).filter((item): item is ReceiptItem => Boolean(item))
  const cnpj = record.cnpj ? String(record.cnpj).replace(/\D/g, '') : ''
  const chave = record.chave ? String(record.chave).replace(/\D/g, '') : ''

  // Infer type/document/misc fields from what we already extracted.
  // We keep this tolerant because OCR providers may output partial/varied JSON.
  let tipoDocumento = 'Outros'
  if (metodo === 'Boleto') tipoDocumento = 'Boleto'
  else if (metodo === 'Pix') tipoDocumento = 'Comprovante PIX'
  else if (metodo === 'Crédito' || metodo === 'Débito' || /cart/i.test(metodo)) tipoDocumento = 'Comprovante Cartão'
  else if (tipoDocumento === 'Outros' && categoria) tipoDocumento = 'Outros'

  let confianca = 0
  if (valor != null && valor > 0) confianca += 30
  if (estabelecimento) confianca += 20
  if (dataStr) confianca += 20
  if (metodo) confianca += 15
  if (categoria) confianca += 10
  if (itens.length) confianca += 10
  if (tipoDocumento) confianca += 5
  confianca = Math.max(0, Math.min(100, Math.round(confianca)))

  return {
    valor: valor != null ? valor : null,
    estabelecimento: estabelecimento || '',
    data: dataStr || '',
    metodo: metodo || '',
    categoria: categoria || (metodo === 'Boleto' ? 'Outros' : ''),
    confianca,
    tipoDocumento,
    observacoes: '',
    cnpj,
    chave,
    itens,
  }
}

export function parseReceiptResponse(text: string): ReceiptFields {
  const parsed = safeParseJson(text)
  return validateReceiptSchema(parsed)
}

const VISION_AGENT_POOL = [
  { id: 'gemini-2.5-flash', provider: 'google' as const, model: 'gemini-2.5-flash' },
  { id: 'gpt-4o-mini', provider: 'openai' as const, model: 'gpt-4o-mini' },
  { id: 'claude-3-5-haiku', provider: 'anthropic' as const, model: 'claude-3-5-haiku-20241022' },
]

type AgentCallOptions = {
  userPrompt: string
  cleanBase64: string
  mimeType: string
}

async function callVisionAgent(
  agent: (typeof VISION_AGENT_POOL)[number],
  options: AgentCallOptions,
): Promise<ReceiptFields> {
  const { userPrompt, cleanBase64, mimeType } = options

  if (agent.provider === 'google') {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY ausente.')

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
          contents: [{
            role: 'user',
            parts: [
              { text: userPrompt },
              { inlineData: { mimeType, data: cleanBase64 } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(45000),
      },
    )

    const data = await res.json()
    if (res.status === 429 || res.status === 503) throw Object.assign(new Error('rate limit'), { retry: true, data })
    if (!res.ok) throw new Error(`Erro Gemini: ${JSON.stringify(data).slice(0, 200)}`)

    const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return parseReceiptResponse(outputText)
  }

  if (agent.provider === 'openai') {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY ausente.')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          { role: 'system', content: OCR_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } },
            ],
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000),
    })

    const data = await res.json()
    if (res.status === 429 || res.status === 503) throw Object.assign(new Error('rate limit'), { retry: true, data })
    if (!res.ok) throw new Error(`Erro OpenAI: ${JSON.stringify(data).slice(0, 200)}`)

    const outputText = data.choices?.[0]?.message?.content || ''
    return parseReceiptResponse(outputText)
  }

  if (agent.provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente.')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: 1024,
        system: OCR_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: cleanBase64 },
            },
            { type: 'text', text: userPrompt },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45000),
    })

    const data = await res.json()
    if (res.status === 429 || res.status === 503) throw Object.assign(new Error('rate limit'), { retry: true, data })
    if (!res.ok) throw new Error(`Erro Claude: ${JSON.stringify(data).slice(0, 200)}`)

    const outputText = data.content?.[0]?.text || ''
    return parseReceiptResponse(outputText)
  }

  throw new Error('Agente desconhecido')
}

export async function extractReceiptFromImage(
  cleanBase64: string,
  mimeType: string,
  extractedText = '',
): Promise<ReceiptFields> {
  const normalizedMime = mimeType || 'image/jpeg'
  let lastError: unknown = null
  const agentErrors: string[] = []
  let bestPartial: ReceiptFields | null = null

  const deterministicText = extractedText.trim() || await extractTextWithConfiguredOcr(
    cleanBase64,
    normalizedMime,
  ).catch(() => '')
  if (deterministicText) {
    const deterministicResult = validateReceiptSchema(parseReceiptText(deterministicText))
    if (deterministicResult.confianca >= 80) {
      return {
        ...deterministicResult,
        observacoes: 'Extraído por OCR determinístico; revise antes de confirmar.',
      }
    }
    if (!isEmptyReceipt(deterministicResult)) bestPartial = deterministicResult
  }

  const prompts = [OCR_MARKET_RECEIPT_PROMPT, OCR_USER_PROMPT, OCR_BOLETO_RETRY_PROMPT]

  for (const userPrompt of prompts) {
    for (const agent of VISION_AGENT_POOL) {
      try {
        const result = await callVisionAgent(agent, {
          userPrompt,
          cleanBase64,
          mimeType: normalizedMime,
        })

        if (!isEmptyReceipt(result)) {
          return {
            ...result,
            metodo: result.metodo || (userPrompt.includes('BOLETO') ? 'Boleto' : result.metodo),
            categoria: result.categoria || (result.metodo === 'Boleto' ? 'Contas' : 'Outro'),
          }
        }

        if (!bestPartial || (result.valor && !bestPartial.valor)) {
          bestPartial = result
        }
      } catch (err) {
        const retry = err && typeof err === 'object' && 'retry' in err
        console.warn(`[receipt-ocr] Falha ${agent.id}:`, err)
        lastError = err
        const msg = err instanceof Error ? err.message : String(err ?? 'unknown')
        agentErrors.push(`${agent.id}: ${msg}`)
        if (!retry && err instanceof Error && err.message.startsWith('INVALID_')) {
          throw err
        }
      }
    }
  }

  if (bestPartial && !isEmptyReceipt(bestPartial)) {
    return bestPartial
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown')
  const providersDetail = agentErrors.length
    ? ` Tentativas: ${agentErrors.join(' | ')}`
    : ''
  throw new Error(`OCR_UNAVAILABLE: Não foi possível ler o boleto. ${detail}.${providersDetail}`)
}
