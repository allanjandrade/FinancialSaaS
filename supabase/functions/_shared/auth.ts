export type AuthenticatedUser = {
  id: string
  email?: string
}

export class EdgeAuthError extends Error {
  status: number
  code: string

  constructor(message: string, status = 401, code = 'UNAUTHORIZED') {
    super(message)
    this.name = 'EdgeAuthError'
    this.status = status
    this.code = code
  }
}

export function getBearerToken(req: Request): string {
  const authorization = req.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    throw new EdgeAuthError('Sessao invalida ou expirada. Faca login novamente.')
  }
  return match[1].trim()
}

export async function requireAuthenticatedUser(
  req: Request,
): Promise<{ user: AuthenticatedUser; token: string }> {
  const token = getBearerToken(req)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !apiKey) {
    throw new EdgeAuthError(
      'Configuracao de autenticacao indisponivel.',
      500,
      'AUTH_CONFIGURATION_ERROR',
    )
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: apiKey },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new EdgeAuthError('Sessao invalida ou expirada. Faca login novamente.')
  }

  const user = await response.json().catch(() => null)
  if (!user?.id) {
    throw new EdgeAuthError('Sessao invalida ou expirada. Faca login novamente.')
  }

  return {
    user: { id: String(user.id), email: user.email ? String(user.email) : undefined },
    token,
  }
}

export function authErrorDetails(
  error: unknown,
): { status: number; code: string; message: string } | null {
  if (!(error instanceof EdgeAuthError)) return null
  return { status: error.status, code: error.code, message: error.message }
}

export function rejectIdentityOverride(
  body: Record<string, unknown>,
  fields = ['user_id', 'userId', 'created_by', 'createdBy'],
) {
  const attempted = fields.find((field) => body[field] != null)
  if (attempted) {
    throw new EdgeAuthError(
      'A identidade do usuario e definida exclusivamente pela sessao autenticada.',
      403,
      'FORBIDDEN',
    )
  }
}

export function assertBase64Size(base64: string, maxBytes = 12 * 1024 * 1024) {
  const normalized = base64.replace(/\s/g, '')
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const estimatedBytes = Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
  if (estimatedBytes > maxBytes) {
    throw new EdgeAuthError('Arquivo excede o limite de 12 MB.', 413, 'PAYLOAD_TOO_LARGE')
  }
}
