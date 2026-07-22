import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { productLookupPlugin } from './server/vite-product-lookup-plugin.mjs'

export default defineConfig({
  plugins: [vue(), productLookupPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('chart.js') || id.includes('vue-chartjs')) return 'vendor-charts'
          if (id.includes('lucide-vue-next')) return 'vendor-icons'
          if (id.includes('marked')) return 'vendor-markdown'
          if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue'
          return 'vendor'
        },
      },
    },
  }
})
