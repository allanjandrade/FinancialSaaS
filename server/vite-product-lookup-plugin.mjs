import { lookupProduct } from './product-lookup.mjs'

export function productLookupPlugin() {
  return {
    name: 'product-lookup-api',
    configureServer(server) {
      server.middlewares.use('/api/product-lookup', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', async () => {
          try {
            const body = raw ? JSON.parse(raw) : {}
            const result = await lookupProduct(body)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: error?.message || 'Lookup failed' }))
          }
        })
      })
    },
  }
}
