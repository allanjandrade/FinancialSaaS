import { lookupProduct } from '../server/product-lookup.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const result = await lookupProduct(req.body || {})
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Lookup failed' })
  }
}
