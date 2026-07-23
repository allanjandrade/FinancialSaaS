export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-connector-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(error: string, status = 500, details?: string) {
  if (status === 401) {
    return authErrorResponse('UNAUTHORIZED', error, status)
  }
  if (status === 403) {
    return authErrorResponse('FORBIDDEN', error, status)
  }
  return jsonResponse({ error, ...(details ? { details } : {}) }, status)
}

export function authErrorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status)
}
