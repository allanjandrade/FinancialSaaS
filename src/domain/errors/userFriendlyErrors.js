const DUPLICATE_ACCOUNT = 'Uma conta com este nome já existe. Escolha um nome diferente.'
const NO_PERMISSION = 'Você não tem permissão para alterar este item.'
const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente para continuar.'
const PREMIUM_REQUIRED = 'Este recurso faz parte do plano Premium.'
const NO_COMPATIBLE_OFFER = 'Ainda não encontramos uma oferta compatível para este produto.'

export function toUserFriendlyError(error, context = {}) {
  const message = String(error?.message || error || '')
  const code = Number(error?.code || error?.status || error?.statusCode)

  if (context.type === 'duplicate_account' || /account.*duplicate|duplicate.*account/i.test(message)) {
    return DUPLICATE_ACCOUNT
  }

  if (context.type === 'no_permission') return NO_PERMISSION
  if (context.type === 'premium') return PREMIUM_REQUIRED
  if (context.type === 'no_compatible_offer') return NO_COMPATIBLE_OFFER

  if (code === 409 || /duplicate key|unique constraint/i.test(message)) {
    return 'Já existe um registro com essas informações. Revise os dados e tente novamente.'
  }

  if (code === 401 || /jwt expired|session expired/i.test(message)) {
    return SESSION_EXPIRED
  }

  if (code === 403 || /permission denied|rls policy/i.test(message)) {
    return NO_PERMISSION
  }

  if (code === 404) {
    return 'Não encontramos esse item. Ele pode ter sido removido ou não estar disponível.'
  }

  if (code === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.'
  }

  if (code >= 500 || /edge function returned non-2xx/i.test(message)) {
    return 'Não conseguimos concluir a operação agora. Tente novamente em alguns instantes.'
  }

  return 'Não foi possível concluir a ação. Revise as informações e tente novamente.'
}

export const friendlyErrorMessages = {
  DUPLICATE_ACCOUNT,
  NO_PERMISSION,
  SESSION_EXPIRED,
  PREMIUM_REQUIRED,
  NO_COMPATIBLE_OFFER,
}
