const COMMON_PASSWORDS = new Set([
  '123456',
  '12345678',
  '123456789',
  'password',
  'senha123',
  'qwerty123',
])

export function validateStrongPassword(password) {
  const value = String(password || '')
  if (value.length < 12) {
    throw new Error('A senha deve ter pelo menos 12 caracteres.')
  }
  if (!/[A-Z]/.test(value)) {
    throw new Error('A senha deve ter pelo menos uma letra maiuscula.')
  }
  if (!/[a-z]/.test(value)) {
    throw new Error('A senha deve ter pelo menos uma letra minuscula.')
  }
  if (!/\d/.test(value)) {
    throw new Error('A senha deve ter pelo menos um numero.')
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    throw new Error('A senha deve ter pelo menos um simbolo.')
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    throw new Error('Use uma senha mais forte.')
  }
  return true
}
