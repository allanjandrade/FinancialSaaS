import { createClient } from '@supabase/supabase-js'
import { assertProductIdentityMatch } from '../src/domain/products/canonicalizeProductUrl.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
const apply = process.argv.includes('--apply')

if (!supabaseUrl || !serviceRoleKey) {
  console.log('Repair product identity mismatches: SKIP, Supabase service credentials not configured.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await supabase
  .from('finance_states')
  .select('id,user_id,data')

if (error) throw error

const changes = []

for (const row of data || []) {
  const wishlist = Array.isArray(row.data?.wishlist) ? row.data.wishlist : []
  let changed = false
  const nextWishlist = wishlist.map((item) => {
    const identity = item.product_identity || null
    const shouldReview = !item.identity_locked || item.identity_status === 'needs_review'
    if (!shouldReview || !identity?.source || !identity?.source_product_id) return item

    try {
      assertProductIdentityMatch(identity, {
        source: item.source,
        source_product_id: item.source_product_id || item.marketplaceItemId,
        title: item.name,
        name: item.name,
        url: item.canonicalUrl || item.originalLink,
      })
      return item
    } catch {
      changed = true
      changes.push({
        finance_state_id: row.id,
        user_id: row.user_id,
        item_id: item.id,
        name: item.name,
        source: identity.source,
        source_product_id: identity.source_product_id,
      })
      return {
        ...item,
        identity_status: 'needs_review',
        last_match_reason: 'Identidade antiga marcada para revisao por possivel divergencia de produto.',
      }
    }
  })

  if (changed && apply) {
    const { error: updateError } = await supabase
      .from('finance_states')
      .update({ data: { ...row.data, wishlist: nextWishlist } })
      .eq('id', row.id)
    if (updateError) throw updateError
  }
}

console.log(JSON.stringify({
  status: 'PASS',
  mode: apply ? 'applied' : 'dry_run',
  mismatches_marked: changes.length,
  changes,
}, null, 2))
