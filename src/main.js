import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initSupabase } from '@/lib/supabase-client.js'
import { initializeSession } from '@/lib/session-bootstrap.js'
import './styles/main.css'

initSupabase()

// The legacy app used a cache-first service worker. Remove any remaining
// registration so a deployment cannot keep serving an obsolete JS bundle.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {})
}

if ('caches' in window) {
  caches.keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {})
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

async function bootstrap() {
  await initializeSession()
  app.use(router)
  app.mount('#app')
}

bootstrap()
