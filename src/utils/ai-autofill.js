import { fetchProductOcr, parseProductLink } from './product-ocr-api.js'
import { enforceExactProductIdentity, fetchLiveMarketplaceOffers } from './marketplace-prices-api.js'
import { pickBestOffers } from './marketplace-comparator.js'
import { classifyPurchaseMotivation, computeNecessityScore, computeOpportunityIndex } from './purchase-intelligence.js'
import { OFFICIAL_EXPENSE_CATEGORIES } from '@/constants/finance.js'

const PRODUCT_CATEGORIES = [
  'Smartphone',
  'Notebook',
  'TV',
  'Eletrodoméstico',
  'Ferramenta',
  'Móvel',
  'Automóvel',
  'Curso',
  'Viagem',
  'Outros'
]

const MOTIVATION_OPTIONS = ['Necessidade', 'Desejo', 'Investimento', 'Trabalho', 'Estudo', 'Lazer']

const PRIORITY_RULES = {
  'Geladeira': 'Alta',
  'Fogão': 'Alta',
  'Máquina de lavar': 'Alta',
  'Notebook': 'Média',
  'Smartphone': 'Média',
  'Playstation': 'Média',
  'Xbox': 'Média',
  'TV': 'Média',
  'Funko Pop': 'Baixa',
  'Brinquedo': 'Baixa',
  'Jogo': 'Baixa',
  'Curso': 'Alta',
  'Viagem': 'Média'
}

function classifyPriority(productName, category, value) {
  const name = String(productName || '').toLowerCase()
  const cat = String(category || '').toLowerCase()

  // Check specific product rules
  for (const [keyword, priority] of Object.entries(PRIORITY_RULES)) {
    if (name.includes(keyword.toLowerCase()) || cat.includes(keyword.toLowerCase())) {
      return priority
    }
  }

  // Value-based classification
  if (value > 5000) return 'Alta'
  if (value > 1000) return 'Média'
  return 'Baixa'
}

function classifyMotivation(productName, category) {
  const name = String(productName || '').toLowerCase()
  const cat = String(category || '').toLowerCase()

  if (name.includes('curso') || name.includes('livro') || name.includes('certific') || cat.includes('educação')) {
    return 'Estudo'
  }
  if (name.includes('notebook') || name.includes('computador') || name.includes('ferramenta') || cat.includes('trabalho')) {
    return 'Trabalho'
  }
  if (name.includes('playstation') || name.includes('xbox') || name.includes('jogo') || cat.includes('lazer')) {
    return 'Lazer'
  }
  if (name.includes('geladeira') || name.includes('fogão') || name.includes('máquina') || cat.includes('necessidade')) {
    return 'Necessidade'
  }
  if (name.includes('investimento') || name.includes('ação') || name.includes('cripto')) {
    return 'Investimento'
  }

  return 'Desejo'
}

function classifyCategory(productName, brand) {
  const name = String(productName || '').toLowerCase()
  const brandStr = String(brand || '').toLowerCase()

  if (name.includes('smartphone') || name.includes('celular') || name.includes('iphone') || name.includes('galaxy') || name.includes('samsung') || name.includes('xiaomi')) {
    return 'Smartphone'
  }
  if (name.includes('notebook') || name.includes('laptop') || name.includes('macbook') || name.includes('dell') || name.includes('lenovo')) {
    return 'Notebook'
  }
  if (name.includes('tv') || name.includes('televisão') || name.includes('smart tv')) {
    return 'TV'
  }
  if (name.includes('geladeira') || name.includes('fogão') || name.includes('máquina') || name.includes('eletro')) {
    return 'Eletrodoméstico'
  }
  if (name.includes('ferramenta') || name.includes('furadeira') || name.includes('serra')) {
    return 'Ferramenta'
  }
  if (name.includes('sofá') || name.includes('mesa') || name.includes('cadeira') || name.includes('cama')) {
    return 'Móvel'
  }
  if (name.includes('carro') || name.includes('automóvel') || name.includes('veículo')) {
    return 'Automóvel'
  }
  if (name.includes('curso') || name.includes('treinamento') || name.includes('workshop')) {
    return 'Curso'
  }
  if (name.includes('viagem') || name.includes('passagem') || name.includes('hotel')) {
    return 'Viagem'
  }

  return 'Outros'
}

function extractPriceFromText(text) {
  if (!text) return null
  const priceMatch = text.match(/R\$\s*[\d.,]+/g)
  if (priceMatch) {
    const price = priceMatch[0].replace(/[R$\s.]/g, '').replace(',', '.')
    const parsed = parseFloat(price)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

function calculatePriceComparison(offers) {
  if (!offers || offers.length === 0) {
    return {
      precoMedio: null,
      menorPreco: null,
      maiorPreco: null,
      marketplaceMaisBarato: ''
    }
  }

  const prices = offers.map(o => o.total).filter(p => p > 0)
  if (prices.length === 0) {
    return {
      precoMedio: null,
      menorPreco: null,
      maiorPreco: null,
      marketplaceMaisBarato: ''
    }
  }

  const sortedOffers = [...offers].sort((a, b) => a.total - b.total)
  const cheapest = sortedOffers[0]

  return {
    precoMedio: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    menorPreco: Math.min(...prices),
    maiorPreco: Math.max(...prices),
    marketplaceMaisBarato: cheapest?.marketplace || ''
  }
}

function calculatePurchaseScores(item, context, offers) {
  const necessity = computeNecessityScore(item, context)
  const opportunity = computeOpportunityIndex(item, offers)

  // Calculate financial impact score
  const value = Number(item?.value || 0)
  const monthlySurplus = Number(context?.monthlySurplus || 0)
  let impactScore = 0

  if (monthlySurplus > 0) {
    const ratio = value / monthlySurplus
    if (ratio <= 0.5) impactScore = 20
    else if (ratio <= 1) impactScore = 40
    else if (ratio <= 2) impactScore = 60
    else if (ratio <= 3) impactScore = 80
    else impactScore = 95
  } else {
    impactScore = 90
  }

  return {
    necessidade: necessity.score,
    oportunidade: opportunity.score,
    impactoFinanceiro: impactScore
  }
}

export async function autofillFromLink(link, onProgress) {
  onProgress?.('Analisando link...')

  const {
    marketplace,
    slug,
    itemId,
    canonicalUrl,
    originalUrl,
    removedParams,
    hasVariation,
  } = parseProductLink(link)

  const productInfo = {
    originalLink: originalUrl || link,
    originalUrl: originalUrl || link,
    canonicalUrl: canonicalUrl || link,
    marketplace: marketplace || '',
    name: slug || '',
    marketplaceItemId: itemId || '',
    removedUrlParams: removedParams || [],
    hasVariation: Boolean(hasVariation),
  }

  onProgress?.('Identificando produto...')

  // Search for live prices to get more info
  try {
    const rawLiveResult = await fetchLiveMarketplaceOffers({
      nome: productInfo.name,
      marketplace: productInfo.marketplace,
      marketplaceItemId: productInfo.marketplaceItemId,
      originalLink: productInfo.canonicalUrl || productInfo.originalLink,
      originalUrl: productInfo.originalUrl,
      canonicalUrl: productInfo.canonicalUrl,
    })
    const liveResult = enforceExactProductIdentity(productInfo, rawLiveResult)

    onProgress?.('Comparando preços...')

    const offers = liveResult.offers || []
    const best = pickBestOffers(offers)
    const metadata = liveResult.metadata || {}
    if (metadata.name) productInfo.name = metadata.name
    if (Number(metadata.value) > 0) productInfo.value = Number(metadata.value)
    if (metadata.imageUrl) productInfo.imageUrl = metadata.imageUrl
    if (metadata.brand) productInfo.brand = metadata.brand
    if (metadata.model) productInfo.model = metadata.model
    if (metadata.attributes && Object.keys(metadata.attributes).length) {
      productInfo.attributes = metadata.attributes
    }

    // Extract additional info from offers
    if (offers.length > 0) {
      const firstOffer = offers[0]
      productInfo.value = best.best?.total || firstOffer.total
      productInfo.imageUrl = firstOffer.imageUrl || productInfo.imageUrl || ''
      productInfo.name = firstOffer.title || productInfo.name
    }

    onProgress?.('Calculando viabilidade financeira...')

    return {
      ...productInfo,
      priceComparison: calculatePriceComparison(offers),
      offers,
      liveResult: {
        ...liveResult,
        offers,
        summary: offers.length ? liveResult.summary : { status: 'pending_quote', offerCount: 0 },
      }
    }
  } catch (error) {
    // Silently fall back when live price search fails
    return {
      ...productInfo,
      priceComparison: null,
      offers: [],
      liveResult: null
    }
  }
}

export async function autofillFromImage(file, onProgress) {
  onProgress?.('Processando imagem...')

  const ocrResult = await fetchProductOcr(file)

  onProgress?.('Identificando produto...')

  const productInfo = {
    name: ocrResult.nome || '',
    value: ocrResult.valor || null,
    brand: ocrResult.marca || '',
    model: ocrResult.modelo || '',
    marketplace: ocrResult.marketplace || '',
    imageUrl: URL.createObjectURL(file)
  }

  onProgress?.('Buscando complemento...')

  // Search for live prices to enrich data
  try {
    const liveResult = await fetchLiveMarketplaceOffers({
      nome: productInfo.name,
      marca: productInfo.brand,
      modelo: productInfo.model
    })

    onProgress?.('Comparando preços...')

    const offers = liveResult.offers || []
    const best = pickBestOffers(offers)

    // Enrich with live data
    if (offers.length > 0) {
      if (!productInfo.value) {
        productInfo.value = best.best?.total || offers[0].total
      }
      if (!productInfo.marketplace) {
        productInfo.marketplace = best.best?.marketplace || offers[0].marketplace
      }
    }

    onProgress?.('Calculando viabilidade financeira...')

    return {
      ...productInfo,
      priceComparison: calculatePriceComparison(offers),
      offers,
      liveResult
    }
  } catch (error) {
    // Silently fall back when live price search fails
    return {
      ...productInfo,
      priceComparison: null,
      offers: [],
      liveResult: null
    }
  }
}

export function completeAutofill(productInfo, context) {
  // Auto-classify category
  const category = classifyCategory(productInfo.name, productInfo.brand)

  // Auto-classify priority
  const priority = classifyPriority(productInfo.name, category, productInfo.value || 0)

  // Auto-classify motivation
  const motivation = classifyMotivation(productInfo.name, category)

  // Map to official categories
  const officialCategory = mapToOfficialCategory(category)

  return {
    ...productInfo,
    category: officialCategory,
    priority,
    purchaseMotivation: motivation
  }
}

function mapToOfficialCategory(aiCategory) {
  const mapping = {
    'Smartphone': 'Outros',
    'Notebook': 'Outros',
    'TV': 'Outros',
    'Eletrodoméstico': 'Moradia',
    'Ferramenta': 'Outros',
    'Móvel': 'Moradia',
    'Automóvel': 'Transporte',
    'Curso': 'Educação',
    'Viagem': 'Lazer',
    'Outros': 'Outros'
  }

  // If the mapped category exists in official categories, use it
  const mapped = mapping[aiCategory]
  if (mapped && OFFICIAL_EXPENSE_CATEGORIES.includes(mapped)) {
    return mapped
  }

  // Default to Outros for electronics and other unmapped categories
  return 'Outros'
}

export function calculateFinalScores(item, context, offers) {
  return calculatePurchaseScores(item, context, offers)
}

export { PRODUCT_CATEGORIES, MOTIVATION_OPTIONS }
