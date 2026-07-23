const AUTO_PART_ABBREVIATIONS = new Map([
  ['tras', 'traseira'],
  ['trase', 'traseira'],
  ['ld', 'lado direito'],
  ['le', 'lado esquerdo'],
  ['dir', 'direito'],
  ['esq', 'esquerdo'],
  ['diante', 'dianteira'],
  ['dt', 'dianteira'],
  ['punto', 'fiat punto'],
  ['frontier', 'nissan frontier'],
])

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

const CONFLICT_DISPLAY = new Map([
  ['frontier', 'Frontier'],
  ['palio', 'Palio'],
  ['siena', 'Siena'],
  ['uno', 'Uno'],
  ['argo', 'Argo'],
  ['cronos', 'Cronos'],
  ['mobi', 'Mobi'],
  ['strada', 'Strada'],
  ['toro', 'Toro'],
  ['gol', 'Gol'],
  ['fox', 'Fox'],
  ['corsa', 'Corsa'],
  ['celta', 'Celta'],
  ['onix', 'Onix'],
  ['ka', 'Ka'],
  ['fiesta', 'Fiesta'],
  ['sandero', 'Sandero'],
  ['logan', 'Logan'],
  ['hilux', 'Hilux'],
  ['corolla', 'Corolla'],
  ['civic', 'Civic'],
])

const KNOWN_VEHICLES = [
  { term: 'punto', make: 'Fiat', model: 'Punto' },
  { term: 'frontier', make: 'Nissan', model: 'Frontier' },
]

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeText(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandAbbreviations(value) {
  const words = normalizeText(value).split(' ').filter(Boolean)
  const expanded = words.flatMap((word) => {
    const replacement = AUTO_PART_ABBREVIATIONS.get(word)
    return replacement ? replacement.split(' ') : [word]
  })
  return expanded.join(' ')
}

function knownVehicleFromText(text) {
  return KNOWN_VEHICLES.find((vehicle) => text.includes(vehicle.term)) || null
}

function vehicleYearFromText(text) {
  const match = String(text || '').match(/\b(19[8-9]\d|20[0-3]\d)\b/)
  return match?.[1] || ''
}

export function normalizeProductIdentity(rawName) {
  const expanded = expandAbbreviations(rawName)
  const hasLanterna = expanded.includes('lanterna')
  const hasRear = expanded.includes('traseira')
  const hasRight = expanded.includes('lado direito') || expanded.includes(' direito') || expanded.includes(' direita')
  const hasLeft = expanded.includes('lado esquerdo') || expanded.includes(' esquerdo') || expanded.includes(' esquerda')
  const vehicle = knownVehicleFromText(expanded)
  const vehicleYear = vehicleYearFromText(expanded)
  const vehicleTerm = vehicle?.term || ''
  const mustMatchTerms = hasLanterna && hasRear && vehicle
    ? ['lanterna', 'traseira', vehicleTerm]
    : []
  if (hasRight) mustMatchTerms.push('direita')
  if (hasLeft) mustMatchTerms.push('esquerda')

  const identity = {
    original_text: String(rawName || '').trim(),
    normalized_text: expanded,
    product_type: hasLanterna ? 'auto_part' : 'generic',
    part_name: hasLanterna ? 'lanterna traseira' : '',
    side: hasRight ? 'right' : hasLeft ? 'left' : '',
    vehicle_make: vehicle?.make || '',
    vehicle_model: vehicle?.model || '',
    vehicle_year: vehicleYear,
    must_match_terms: mustMatchTerms,
    negative_terms: hasLanterna
      ? NEGATIVE_AUTO_MODELS.filter((term) => term !== vehicleTerm)
      : [],
    match_policy: hasLanterna ? 'strict' : 'text',
    side_required: Boolean(hasRight || hasLeft),
    needs_confirmation: hasLanterna,
    confidence: [hasLanterna, hasRear, vehicle, hasRight || hasLeft].filter(Boolean).length / 4,
  }
  return identity
}

export function buildProductSearchQuery(identity) {
  if (!identity || identity.match_policy !== 'strict') {
    return normalizeText(identity?.original_text || '').trim()
  }
  const side = identity.side === 'right' ? 'direita' : identity.side === 'left' ? 'esquerda' : ''
  return [identity.part_name, side, identity.vehicle_make, identity.vehicle_model, identity.vehicle_year]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentenceCase(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

export function describeProductIdentity(identity) {
  if (!identity || identity.match_policy !== 'strict') return 'Produto em texto livre'
  const side = identity.side === 'right' ? 'Direito' : identity.side === 'left' ? 'Esquerdo' : 'Não definido'
  const part = sentenceCase(identity.part_name || 'Peca automotiva')
  return `Peca: ${part} / Lado: ${side} / Veiculo: ${[identity.vehicle_make, identity.vehicle_model, identity.vehicle_year].filter(Boolean).join(' ')}`.trim()
}

function sideTerms(side) {
  if (side === 'right') return ['direita', 'direito', 'lado direito']
  if (side === 'left') return ['esquerda', 'esquerdo', 'lado esquerdo']
  return []
}

function hasRequiredSide(text, side) {
  if (!side) return true
  return sideTerms(side).some((term) => text.includes(term))
}

function hasConflictingSide(text, side) {
  if (!side) return false
  return sideTerms(side === 'right' ? 'left' : 'right').some((term) => text.includes(term))
}

function requiredTermMatches(text, term) {
  const normalized = normalizeText(term)
  if (normalized === 'direita') return sideTerms('right').some((value) => text.includes(value))
  if (normalized === 'esquerda') return sideTerms('left').some((value) => text.includes(value))
  return text.includes(normalized)
}

function normalizeOfferTotal(candidate) {
  return Number(candidate?.total ?? candidate?.totalPrice ?? candidate?.price ?? 0)
}

function candidateLabel(candidate) {
  return candidate?.title || candidate?.name || candidate?.description || ''
}

function displayConflict(term) {
  return CONFLICT_DISPLAY.get(term) || term
}

function normalizeEvaluatedCandidate(candidate, match) {
  const total = normalizeOfferTotal(candidate)
  return {
    ...candidate,
    title: candidateLabel(candidate),
    price: Number(candidate?.price ?? total ?? 0),
    total,
    totalPrice: Number(candidate?.totalPrice ?? total ?? 0),
    match,
    match_score: match.score,
    match_reason: match.reason,
    compatibility_status: match.status,
  }
}

export function scoreProductCandidate(candidate, identity) {
  const text = normalizeText([
    candidate?.title,
    candidate?.name,
    candidate?.description,
    candidate?.url,
  ].filter(Boolean).join(' '))

  if (!identity || identity.match_policy !== 'strict') {
    return {
      accepted: false,
      compatible: false,
      score: 0,
      status: 'ambiguous',
      reason: 'Identidade estruturada ausente.',
      missing_terms: ['identity'],
      conflicting_terms: [],
      conflicts: [],
    }
  }

  const conflicts = (identity.negative_terms || []).filter((term) => text.includes(term))
  if (conflicts.length) {
    const displayConflicts = conflicts.map(displayConflict)
    return {
      accepted: false,
      compatible: false,
      score: 0,
      status: 'rejected',
      reason: `Candidato contem veiculo conflitante: ${displayConflicts.join(', ')}.`,
      missing_terms: [],
      conflicting_terms: displayConflicts,
      conflicts: displayConflicts,
    }
  }

  if (hasConflictingSide(text, identity.side)) {
    const conflict = identity.side === 'right' ? 'esquerda' : 'direita'
    return {
      accepted: false,
      compatible: false,
      score: 0.2,
      status: 'rejected',
      reason: 'Lado divergente para a identidade do produto.',
      missing_terms: [],
      conflicting_terms: [conflict],
      conflicts: [conflict],
    }
  }

  const required = [...(identity.must_match_terms || [])]
  const missing = required.filter((term) => !requiredTermMatches(text, term))
  const matched = required.length - missing.length
  const requiredRatio = required.length ? matched / required.length : 0
  const hasModel = identity.vehicle_model ? text.includes(normalizeText(identity.vehicle_model)) : true
  const hasPart = identity.part_name
    ? normalizeText(identity.part_name).split(' ').every((term) => text.includes(term))
    : text.includes('lanterna') && text.includes('traseira')
  const sideOk = hasRequiredSide(text, identity.side)
  if (identity.side_required && !sideOk && !missing.includes(identity.side === 'right' ? 'direita' : 'esquerda')) {
    missing.push(identity.side === 'right' ? 'direita' : 'esquerda')
  }
  const score = Math.min(1, (requiredRatio * 0.55) + (hasModel ? 0.15 : 0) + (hasPart ? 0.2 : 0) + (sideOk ? 0.1 : 0))
  const accepted = score >= 0.85 && hasModel && hasPart && sideOk
  const missingModel = !hasModel && Boolean(identity.vehicle_model)
  const status = accepted ? 'accepted' : missingModel || missing.length ? 'ambiguous' : 'rejected'

  return {
    accepted,
    compatible: accepted,
    score: Math.round(score * 100) / 100,
    status,
    reason: accepted
      ? `Contem ${identity.part_name || 'produto'}, ${identity.side === 'right' ? 'lado direito' : identity.side === 'left' ? 'lado esquerdo' : 'lado informado'} e ${identity.vehicle_model || 'veiculo informado'}.`
      : missingModel
        ? 'Modelo obrigatorio ausente.'
        : 'Candidato ambiguo ou incompleto para a identidade exigida.',
    missing_terms: [...new Set(missing)],
    conflicting_terms: [],
    conflicts: [],
  }
}

export function chooseBestCompatibleOffer(candidates, identity) {
  const evaluated = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const match = scoreProductCandidate(candidate, identity)
    return normalizeEvaluatedCandidate(candidate, match)
  })
  const compatible = evaluated
    .filter((candidate) => candidate.match.accepted)
    .sort((a, b) => normalizeOfferTotal(a) - normalizeOfferTotal(b))
  const rejected = evaluated
    .filter((candidate) => candidate.match.status === 'rejected')
    .map((candidate) => ({
      title: candidateLabel(candidate),
      reason: candidate.match.reason,
      score: candidate.match.score,
      match_score: candidate.match.score,
      match_reason: candidate.match.reason,
      compatibility_status: 'rejected',
      conflicting_terms: candidate.match.conflicting_terms || [],
      total: normalizeOfferTotal(candidate),
      price: Number(candidate.price || normalizeOfferTotal(candidate) || 0),
      marketplace: candidate.marketplace || candidate.source || '',
      url: candidate.url || candidate.link || '',
    }))
  const ambiguous = evaluated
    .filter((candidate) => candidate.match.status === 'ambiguous')
    .map((candidate) => ({
      title: candidateLabel(candidate),
      reason: candidate.match.reason,
      score: candidate.match.score,
      match_score: candidate.match.score,
      match_reason: candidate.match.reason,
      compatibility_status: 'ambiguous',
      missing_terms: candidate.match.missing_terms || [],
      total: normalizeOfferTotal(candidate),
      price: Number(candidate.price || normalizeOfferTotal(candidate) || 0),
      marketplace: candidate.marketplace || candidate.source || '',
      url: candidate.url || candidate.link || '',
    }))
  const best = compatible[0] || null

  if (best) {
    return {
      status: 'found_compatible',
      best,
      best_compatible_offer: best,
      accepted_candidates: compatible,
      compatible,
      ambiguous_candidates: ambiguous,
      rejected_candidates: rejected,
      rejected,
      score: best.match.score,
      reason: best.match.reason,
    }
  }

  return {
    status: ambiguous.length ? 'found_ambiguous' : 'not_found',
    best: null,
    best_compatible_offer: null,
    accepted_candidates: [],
    compatible: [],
    ambiguous_candidates: ambiguous,
    rejected_candidates: rejected,
    rejected,
    score: evaluated.reduce((max, candidate) => Math.max(max, candidate.match.score), 0),
    reason: evaluated.length
      ? 'Nenhum candidato atingiu compatibilidade minima.'
      : 'Nenhum candidato retornado.',
  }
}

export function hasCompatiblePrice(item) {
  if (!requiresCompatiblePrice(item)) return false
  if (item?.identity_locked || item?.identityLocked || item?.product_identity?.match_policy === 'url_exact') {
    const best = item?.best_compatible_offer || item?.bestCompatibleOffer || null
    return (item?.price_search_status || item?.priceSearchStatus) === 'found_exact'
      && Boolean(best || Number(item?.lastQuotedPrice || item?.value || 0) > 0)
  }
  const best = item?.best_compatible_offer || item?.bestCompatibleOffer || null
  const acceptedCandidates = [
    ...(Array.isArray(item?.accepted_candidates) ? item.accepted_candidates : []),
    ...(Array.isArray(item?.acceptedCandidates) ? item.acceptedCandidates : []),
    ...(Array.isArray(item?.marketplaceOffers) ? item.marketplaceOffers : []),
  ].filter(isAcceptedCompatibleOffer)
  const status = String(item?.price_search_status || item?.priceSearchStatus || '').toLowerCase()
  const explicitNegativeStatus = ['found_ambiguous', 'not_found', 'error'].includes(status)
  const score = Number(
    item?.last_match_score
    || item?.lastMatchScore
    || best?.match_score
    || best?.match?.score
    || 0,
  )
  return !explicitNegativeStatus
    && (status === 'found_compatible' || isAcceptedCompatibleOffer(best) || acceptedCandidates.length > 0)
    && score >= 0.85
    && Boolean(best || acceptedCandidates.length || Number(item?.lastQuotedPrice || item?.value || 0) > 0)
}

export function canTriggerWishlistTargetAlert(item) {
  const currentPrice = Number(item?.best_compatible_offer?.total || item?.best_compatible_offer?.price || item?.lastQuotedPrice || 0)
  const target = Number(item?.targetPrice || 0)
  return hasCompatiblePrice(item)
    && target > 0
    && currentPrice > 0
    && currentPrice <= target
}

export function isAcceptedCompatibleOffer(offer) {
  if (!offer) return false
  return offer.compatibility_status === 'accepted'
    || Number(offer.match_score || offer.matchScore || offer.match?.score || 0) >= 0.85
}

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0
}

export function requiresCompatiblePrice(item) {
  if (!item) return false
  const identity = item.product_identity || item.productIdentity || null
  if (item.identity_locked || item.identityLocked || identity?.match_policy === 'url_exact') return true
  if (identity?.match_policy === 'strict') return true
  const status = item.price_search_status || item.priceSearchStatus || ''
  if (['found_compatible', 'found_ambiguous', 'not_found', 'error'].includes(status)) return true
  if (item.best_compatible_offer || item.bestCompatibleOffer) return true
  return hasArrayItems(item.accepted_candidates)
    || hasArrayItems(item.acceptedCandidates)
    || hasArrayItems(item.ambiguous_candidates)
    || hasArrayItems(item.ambiguousCandidates)
    || hasArrayItems(item.last_rejected_candidates)
    || hasArrayItems(item.lastRejectedCandidates)
    || hasArrayItems(item.rejected_candidates)
    || hasArrayItems(item.rejectedCandidates)
}
