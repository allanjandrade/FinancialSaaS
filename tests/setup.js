import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('VITE_APP_URL', 'http://localhost:5173')

function createMemoryStorage() {
  const data = new Map()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null
    },
    key(index) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key) {
      data.delete(String(key))
    },
    setItem(key, value) {
      data.set(String(key), String(value))
    },
  }
}

const localStorageMock = createMemoryStorage()
const sessionStorageMock = createMemoryStorage()

Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true })
vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('sessionStorage', sessionStorageMock)

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})
