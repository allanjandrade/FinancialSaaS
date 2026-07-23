type GenericRecord = Record<string, unknown>

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseDate(text: string): string | null {
  const match = text.match(/\b(\d{2})[/.\-](\d{2})[/.\-](\d{4})\b/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function findReceiptAmount(text: string): number | null {
  const patterns = [
    /(?:valor\s+(?:total|pago|cobrado)|total\s+(?:a\s+pagar|pago|geral)|total)\D{0,18}(?:r\$\s*)?([\d.]+,\d{2})/gi,
    /(?:r\$\s*)([\d.]+,\d{2})/gi,
  ]

  for (const pattern of patterns) {
    const values = [...text.matchAll(pattern)]
      .map((match) => parseMoney(match[1]))
      .filter((value): value is number => value != null)
    if (values.length) return Math.max(...values)
  }
  return null
}

function findEstablishment(lines: string[]): string {
  const ignored = /^(?:documento|comprovante|cupom|extrato|nf-?ce|nota fiscal|cnpj|cpf|data|hora|total|valor|pix|boleto)/i
  return lines.find((line) => /[a-zá-ú]/i.test(line) && !ignored.test(line) && line.length >= 3)?.slice(0, 120) || ''
}

export function parseReceiptText(text: string): GenericRecord {
  const lines = normalizeLines(text)
  const lower = text.toLowerCase()
  const metodo = lower.includes('pix')
    ? 'Pix'
    : /boleto|linha digitável|linha digitavel/.test(lower)
      ? 'Boleto'
      : /crédito|credito/.test(lower)
        ? 'Crédito'
        : /débito|debito/.test(lower)
          ? 'Débito'
          : /transferência|transferencia|ted/.test(lower)
            ? 'Transferência'
            : ''

  const categoria = /supermercado|mercado|mercearia|atacad/.test(lower)
    ? 'Mercado'
    : /energia|eletric|enel|light/.test(lower)
      ? 'Energia'
      : /água|agua|saneamento|sabesp/.test(lower)
        ? 'Água'
        : /internet|telefone|fibra|telecom/.test(lower)
          ? 'Internet'
          : metodo === 'Boleto'
            ? 'Contas'
            : ''

  return {
    valor: findReceiptAmount(text),
    estabelecimento: findEstablishment(lines),
    data: parseDate(text),
    metodo,
    categoria,
    cnpj: text.match(/\b\d{2}[.]?\d{3}[.]?\d{3}[\/]?\d{4}-?\d{2}\b/)?.[0] || '',
    chave: text.match(/(?:\d[\s.-]?){44}/)?.[0] || '',
  }
}

export function parseProductText(text: string): GenericRecord & { confidence: number } {
  const lines = normalizeLines(text)
  const lower = text.toLowerCase()
  const priceMatch = text.match(/(?:r\$\s*)?([\d.]+,\d{2})/i)
  const marketplace = lower.includes('mercado livre')
    ? 'Mercado Livre'
    : lower.includes('shopee')
      ? 'Shopee'
      : lower.includes('amazon')
        ? 'Amazon'
        : lower.includes('kabum')
          ? 'Kabum'
          : null
  const ignored = /^(?:r\$|frete|cupom|desconto|oferta|comprar|adicionar|parcel|avalia)/i
  const marketplaceOnly = /^(?:mercado livre|shopee|amazon|kabum)$/i
  const nome = lines.find((line) =>
    /[a-zá-ú]/i.test(line) &&
    !ignored.test(line) &&
    !marketplaceOnly.test(line) &&
    line.length >= 4
  ) || ''
  const knownBrands = ['Samsung', 'Apple', 'Motorola', 'Xiaomi', 'LG', 'Dell', 'Lenovo', 'Acer', 'Asus', 'Sony']
  const marca = knownBrands.find((brand) => lower.includes(brand.toLowerCase())) || null
  const modelo = text.match(/\b(?:[A-Z]{1,4}[\s-]?)?\d{2,5}[A-Z]{0,4}\b/)?.[0] || null
  const valor = parseMoney(priceMatch?.[1])
  const confidence = (nome ? 40 : 0) + (valor ? 40 : 0) + (marketplace ? 10 : 0) + (marca || modelo ? 10 : 0)

  return { nome, marca, modelo, valor, marketplace, confidence }
}

export async function extractTextWithConfiguredOcr(
  cleanBase64: string,
  mimeType: string,
): Promise<string> {
  const endpoint = Deno.env.get('DOCUMENT_OCR_ENDPOINT')
  if (!endpoint) return ''

  const apiKey = Deno.env.get('DOCUMENT_OCR_API_KEY')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ imageBase64: cleanBase64, mimeType }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    console.warn('[deterministic-ocr] OCR provider error:', response.status)
    return ''
  }

  const data = await response.json().catch(() => null)
  return String(data?.text || data?.result?.text || data?.parsedText || '').trim()
}
