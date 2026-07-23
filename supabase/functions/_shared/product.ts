import {
  extractTextWithConfiguredOcr,
  parseProductText,
} from './deterministic-ocr.ts'

export const PRODUCT_OCR_PROMPT = `Você extrai dados de anúncios de e-commerce brasileiros (Mercado Livre, Amazon, Shopee, Magazine Luiza, Kabum, Pichau, Casas Bahia, Americanas).

Retorne SOMENTE JSON válido com estes campos:
- nome: string (nome do produto)
- marca: string ou null
- modelo: string ou null
- valor: number (preço em reais, ponto decimal, sem R$)
- marketplace: string (nome do marketplace identificado ou null)

Se não conseguir ler algum campo, use null. Nunca invente marca/modelo sem evidência na imagem.`

export type ProductOcrResult = {
  nome: string
  marca: string | null
  modelo: string | null
  valor: number | null
  marketplace: string | null
}

export function parseProductResponse(text: string): ProductOcrResult {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  const candidate = match ? match[0] : cleaned
  const parsed = JSON.parse(candidate)

  const valorRaw = parsed.valor ?? parsed.preco ?? parsed.price
  let valor: number | null = null
  if (typeof valorRaw === 'number' && Number.isFinite(valorRaw)) valor = valorRaw
  else if (valorRaw != null) {
    const s = String(valorRaw).replace(/\s/g, '').replace(/^R\$?/i, '').replace(/\./g, '').replace(',', '.')
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) valor = n
  }

  return {
    nome: parsed.nome ? String(parsed.nome).trim() : '',
    marca: parsed.marca ? String(parsed.marca).trim() : null,
    modelo: parsed.modelo ? String(parsed.modelo).trim() : null,
    valor,
    marketplace: parsed.marketplace ? String(parsed.marketplace).trim() : null,
  }
}

async function callGeminiProductOcr(
  cleanBase64: string,
  mimeType: string,
): Promise<ProductOcrResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente.')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PRODUCT_OCR_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [
            { text: 'Extraia nome, marca, modelo, valor e marketplace deste anúncio.' },
            { inlineData: { mimeType, data: cleanBase64 } },
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(45000),
    },
  )

  const data = await res.json()
  if (!res.ok) throw new Error(`Erro Gemini: ${JSON.stringify(data).slice(0, 200)}`)
  const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return parseProductResponse(outputText)
}

export async function extractProductFromImage(
  cleanBase64: string,
  mimeType: string,
  extractedText = '',
): Promise<ProductOcrResult> {
  const deterministicText = extractedText.trim() || await extractTextWithConfiguredOcr(
    cleanBase64,
    mimeType || 'image/jpeg',
  ).catch(() => '')
  if (deterministicText) {
    const deterministic = parseProductText(deterministicText)
    if (deterministic.confidence >= 80 && deterministic.nome && deterministic.valor) {
      return {
        nome: String(deterministic.nome),
        marca: deterministic.marca ? String(deterministic.marca) : null,
        modelo: deterministic.modelo ? String(deterministic.modelo) : null,
        valor: Number(deterministic.valor),
        marketplace: deterministic.marketplace ? String(deterministic.marketplace) : null,
      }
    }
  }

  const result = await callGeminiProductOcr(cleanBase64, mimeType || 'image/jpeg')
  if (!result.nome && result.valor == null) {
    throw new Error('OCR_UNAVAILABLE: Não foi possível identificar o produto no anúncio.')
  }
  return result
}
