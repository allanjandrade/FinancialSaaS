export type ProductIdentity = {
  original_text: string
  normalized_text: string
  product_type: 'auto_part' | 'generic'
  part_name: string
  side: 'right' | 'left' | ''
  vehicle_make: string
  vehicle_model: string
  vehicle_year?: string
  must_match_terms: string[]
  negative_terms: string[]
  match_policy: 'strict' | 'text'
  side_required?: boolean
}

export type ProductCandidate = {
  title?: string
  name?: string
  description?: string
  url?: string
  price?: number
  total?: number
  totalPrice?: number
  marketplace?: string
  source?: string
  [key: string]: unknown
}

const NEGATIVE_AUTO_MODELS = [
  'frontier',
  'palio',
  'siena',
  'uno',
  'argo',
  'cronos',
  'mobi',
  'strada',
  'toro',
  'gol',
  'fox',
  'corsa',
  'celta',
  'onix',
  'ka',
  'fiesta',
  'sandero',
  'logan',
  'hilux',
  'corolla',
  'civic',
]

const CONFLICT_DISPLAY: Record<string, string> = {
  frontier: 'Frontier',
  palio: 'Palio',
  siena: 'Siena',
  uno: 'Uno',
  argo: 'Argo',
  cronos: 'Cronos',
  mobi: 'Mobi',
  strada: 'Strada',
  toro: 'Toro',
  gol: 'Gol',
  fox: 'Fox',
  corsa: 'Corsa',
  celta: 'Celta',
  onix: 'Onix',
  ka: 'Ka',
  fiesta: 'Fiesta',
  sandero: 'Sandero',
  logan: 'Logan',
  hilux: 'Hilux',
  corolla: 'Corolla',
  civic: 'Civic',
}

const KNOWN_VEHICLES = [
  { term: 'punto', make: 'Fiat', model: 'Punto' },
  { term: 'frontier', make: 'Nissan', model: 'Frontier' },
]

export function normalizeProductText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandAbbreviations(value: string): string {
  return normalizeProductText(value)
    .split(' ')
    .filter(Boolean)
    .flatMap((word) => {
      if (word === 'tras' || word === 'trase') return ['traseira']
      if (word === 'ld') return ['lado', 'direito']
      if (word === 'le') return ['lado', 'esquerdo']
      if (word === 'dir') return ['direito']
      if (word === 'esq') return ['esquerdo']
      if (word === 'punto') return ['fiat', 'punto']
      if (word === 'frontier') return ['nissan', 'frontier']
      return [word]
    })
    .join(' ')
}

function knownVehicleFromText(text: string) {
  return KNOWN_VEHICLES.find((vehicle) => text.includes(vehicle.term)) || null
}

function vehicleYearFromText(text: string) {
  return String(text || '').match(/\b(19[8-9]\d|20[0-3]\d)\b/)?.[1] || ''
}

export function normalizeProductIdentity(rawName: string): ProductIdentity {
  const text = expandAbbreviations(rawName)
  const hasLanterna = text.includes('lanterna')
  const hasRear = text.includes('traseira')
  const hasRight = text.includes('lado direito') || text.includes(' direito') || text.includes(' direita')
  const hasLeft = text.includes('lado esquerdo') || text.includes(' esquerdo') || text.includes(' esquerda')
  const vehicle = knownVehicleFromText(text)
  const vehicleYear = vehicleYearFromText(text)
  const side = hasRight ? 'right' : hasLeft ? 'left' : ''
  const mustMatch = hasLanterna && hasRear && vehicle ? ['lanterna', 'traseira', vehicle.term] : []
  if (side === 'right') mustMatch.push('direita')
  if (side === 'left') mustMatch.push('esquerda')

  return {
    original_text: String(rawName || '').trim(),
    normalized_text: text,
    product_type: hasLanterna ? 'auto_part' : 'generic',
    part_name: hasLanterna ? 'lanterna traseira' : '',
    side,
    vehicle_make: vehicle?.make || '',
    vehicle_model: vehicle?.model || '',
    vehicle_year: vehicleYear,
    must_match_terms: mustMatch,
    negative_terms: hasLanterna
      ? NEGATIVE_AUTO_MODELS.filter((term) => term !== vehicle?.term)
      : [],
    match_policy: hasLanterna ? 'strict' : 'text',
    side_required: Boolean(side),
  }
}

export function buildProductSearchQuery(identity: ProductIdentity): string {
  if (!identity || identity.match_policy !== 'strict') return ''
  const side = identity.side === 'right' ? 'direita' : identity.side === 'left' ? 'esquerda' : ''
  return [
    identity.part_name,
    side,
    identity.vehicle_make,
    identity.vehicle_model,
    identity.vehicle_year,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function isIdentityCompleteForProvider(identity: ProductIdentity | null | undefined): boolean {
  if (!identity || identity.match_policy !== 'strict') return false
  if (identity.product_type === 'auto_part') {
    return Boolean(identity.part_name && identity.vehicle_model && (!identity.side_required || identity.side))
  }
  return Boolean(identity.normalized_text || identity.original_text)
}

function sideTerms(side: ProductIdentity['side']) {
  if (side === 'right') return ['direita', 'direito', 'lado direito']
  if (side === 'left') return ['esquerda', 'esquerdo', 'lado esquerdo']
  return []
}

function requiredTermMatches(text: string, term: string) {
  const normalized = normalizeProductText(term)
  if (normalized === 'direita') return sideTerms('right').some((value) => text.includes(value))
  if (normalized === 'esquerda') return sideTerms('left').some((value) => text.includes(value))
  return text.includes(normalized)
}

function hasRequiredSide(text: string, side: ProductIdentity['side']) {
  if (!side) return true
  return sideTerms(side).some((term) => text.includes(term))
}

function hasConflictingSide(text: string, side: ProductIdentity['side']) {
  if (!side) return false
  return sideTerms(side === 'right' ? 'left' : 'right').some((term) => text.includes(term))
}

function total(candidate: ProductCandidate) {
  return Number(candidate.total ?? candidate.totalPrice ?? candidate.price ?? 0)
}

function label(candidate: ProductCandidate) {
  return String(candidate.title || candidate.name || candidate.description || '')
}

export function scoreProductCandidate(candidate: ProductCandidate, identity: ProductIdentity) {
  const text = normalizeProductText([candidate.title, candidate.name, candidate.description, candidate.url].filter(Boolean).join(' '))
  if (identity.match_policy !== 'strict') {
    return { accepted: false, compatible: false, score: 0, status: 'ambiguous', reason: 'Identidade estruturada ausente.', missing_terms: ['identity'], conflicting_terms: [] }
  }
  const conflicts = (identity.negative_terms || []).filter((term) => text.includes(term)).map((term) => CONFLICT_DISPLAY[term] || term)
  if (conflicts.length) {
    return { accepted: false, compatible: false, score: 0, status: 'rejected', reason: `Candidato contem veiculo conflitante: ${conflicts.join(', ')}.`, missing_terms: [], conflicting_terms: conflicts }
  }
  if (hasConflictingSide(text, identity.side)) {
    return { accepted: false, compatible: false, score: 0.2, status: 'rejected', reason: 'Lado divergente para a identidade do produto.', missing_terms: [], conflicting_terms: [identity.side === 'right' ? 'esquerda' : 'direita'] }
  }
  const required = identity.must_match_terms || []
  const missing = required.filter((term) => !requiredTermMatches(text, term))
  const matched = required.length - missing.length
  const requiredRatio = required.length ? matched / required.length : 0
  const hasModel = identity.vehicle_model ? text.includes(normalizeProductText(identity.vehicle_model)) : true
  const hasPart = identity.part_name
    ? normalizeProductText(identity.part_name).split(' ').every((term) => text.includes(term))
    : text.includes('lanterna') && text.includes('traseira')
  const sideOk = hasRequiredSide(text, identity.side)
  if (identity.side_required && !sideOk && !missing.includes(identity.side === 'right' ? 'direita' : 'esquerda')) {
    missing.push(identity.side === 'right' ? 'direita' : 'esquerda')
  }
  const score = Math.min(1, (requiredRatio * 0.55) + (hasModel ? 0.15 : 0) + (hasPart ? 0.2 : 0) + (sideOk ? 0.1 : 0))
  const accepted = score >= 0.85 && hasModel && hasPart && sideOk
  return {
    accepted,
    compatible: accepted,
    score: Math.round(score * 100) / 100,
    status: accepted ? 'accepted' : !hasModel || missing.length ? 'ambiguous' : 'rejected',
    reason: accepted
      ? `Contem ${identity.part_name || 'produto'}, ${identity.side === 'right' ? 'lado direito' : identity.side === 'left' ? 'lado esquerdo' : 'lado informado'} e ${identity.vehicle_model || 'veiculo informado'}.`
      : !hasModel
        ? 'Modelo obrigatorio ausente.'
        : 'Candidato ambiguo ou incompleto para a identidade exigida.',
    missing_terms: [...new Set(missing)],
    conflicting_terms: [],
  }
}

export function chooseBestCompatibleOffer(candidates: ProductCandidate[], identity: ProductIdentity) {
  const evaluated = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const match = scoreProductCandidate(candidate, identity)
    return {
      ...candidate,
      title: label(candidate),
      total: total(candidate),
      totalPrice: total(candidate),
      price: Number(candidate.price ?? total(candidate) ?? 0),
      match,
      match_score: match.score,
      match_reason: match.reason,
      compatibility_status: match.status,
    }
  })
  const accepted = evaluated.filter((candidate) => candidate.match.accepted).sort((a, b) => total(a) - total(b))
  const rejected = evaluated.filter((candidate) => candidate.match.status === 'rejected').map((candidate) => ({
    title: label(candidate),
    price: Number(candidate.price || total(candidate) || 0),
    total: total(candidate),
    marketplace: String(candidate.marketplace || candidate.source || ''),
    url: String(candidate.url || ''),
    compatibility_status: 'rejected',
    match_score: candidate.match.score,
    match_reason: candidate.match.reason,
    reason: candidate.match.reason,
    conflicting_terms: candidate.match.conflicting_terms || [],
  }))
  const ambiguous = evaluated.filter((candidate) => candidate.match.status === 'ambiguous').map((candidate) => ({
    title: label(candidate),
    price: Number(candidate.price || total(candidate) || 0),
    total: total(candidate),
    marketplace: String(candidate.marketplace || candidate.source || ''),
    url: String(candidate.url || ''),
    compatibility_status: 'ambiguous',
    match_score: candidate.match.score,
    match_reason: candidate.match.reason,
    reason: candidate.match.reason,
    missing_terms: candidate.match.missing_terms || [],
  }))
  const best = accepted[0] || null
  return {
    status: best ? 'found_compatible' : ambiguous.length ? 'found_ambiguous' : 'not_found',
    best,
    best_compatible_offer: best,
    accepted_candidates: accepted,
    compatible: accepted,
    ambiguous_candidates: ambiguous,
    rejected_candidates: rejected,
    rejected,
    score: best?.match.score || evaluated.reduce((max, candidate) => Math.max(max, candidate.match.score), 0),
    reason: best?.match.reason || (evaluated.length ? 'Nenhum candidato atingiu compatibilidade minima.' : 'Nenhum candidato retornado.'),
  }
}
