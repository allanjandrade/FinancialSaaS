import { validateAiAssistPayload } from './payload.js'
import { sanitizeAiResponse } from './response.js'

export async function runAiAssistFlow(payload, dependencies) {
  const input = validateAiAssistPayload(payload)
  await dependencies.requireConsent()
  const quota = await dependencies.reserveQuota()
  let built
  let generated
  try {
    built = await dependencies.buildContext(input)
    generated = await dependencies.generate({ input, context: built.context })
  } catch (error) {
    await dependencies.finalizeQuota(quota, generated?.usage || { inputTokens: 0, outputTokens: 0 }).catch(() => {})
    await dependencies.log({ input, built, usage: generated?.usage, status: 'error', error }).catch(() => {})
    throw error
  }

  const response = sanitizeAiResponse(generated.data, built.basis, built.warnings)
  await dependencies.finalizeQuota(quota, generated.usage)
  await dependencies.log({ input, built, response, usage: generated.usage, status: 'success' }).catch((error) => {
    dependencies.onLogError?.(error)
  })
  return response
}
