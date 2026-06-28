# Product Search Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 1 of the approved product-search design: safer URL/text UX, clearer product states, better wishlist cards, and clearer product details without changing the persistence model.

**Architecture:** Keep the existing product flow and backend contracts. Add a focused presentation helper for product-search UI semantics, then consume it from `PurchaseNew.vue`, `PurchaseWishlist.vue`, and `PurchaseDetail.vue`. Domain safety stays in the existing canonicalization, identity lock, cache, and price-search code.

**Tech Stack:** Vue 3, Pinia, Vitest, Vite, Supabase Edge Functions, Lucide Vue icons.

---

## Scope

This plan implements only Phase 1 from `docs/superpowers/specs/2026-06-27-product-search-comparison-design.md`.

Included:

- Human-readable status mapping for product search and monitoring.
- Unified product card metrics: best compatible offer, shipping, total, history summary, canonical code.
- Input UX that auto-switches to link mode when a product URL is pasted.
- Wishlist cards that remove confusing labels such as `Status IA`.
- Detail view labels that match the approved Buscape/Zoom-style mental model.
- Source and unit tests for the UI contract.

Excluded:

- New database tables such as `product_offers`, `product_price_snapshots`, and `product_search_runs`.
- Adapter refactor into dedicated `AmazonAdapter` or `MercadoLivreAdapter` classes.
- Free/Premium entitlement enforcement for search limits.
- OCR/image improvements.
- Full charting for price history.

## File Structure

- Create `src/utils/product-search-presentation.js`: pure UI helper functions for status, prices, canonical code, history summary, and offer text.
- Create `tests/unit/product-search-presentation.test.js`: unit coverage for helper behavior.
- Create `tests/unit/product-search-ux-contract.test.js`: lightweight source contract tests for `PurchaseNew.vue`, `PurchaseWishlist.vue`, and `PurchaseDetail.vue`.
- Modify `src/views/PurchaseNew.vue`: add automatic URL mode detection and B2B copy.
- Modify `src/views/PurchaseWishlist.vue`: consume helper functions, rename metrics, improve card structure, keep actions stable.
- Modify `src/views/PurchaseDetail.vue`: consume helper functions and rename hero metrics/sections.

Keep changes small and do not modify the Edge Functions in this phase unless a test exposes a current regression.

---

### Task 1: Product Search Presentation Helper

**Files:**
- Create: `src/utils/product-search-presentation.js`
- Create: `tests/unit/product-search-presentation.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/product-search-presentation.test.js`:

```js
import { describe, expect, it } from 'vitest'
import {
  bestComparableOffer,
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'

describe('product search presentation helpers', () => {
  it('maps locked URL products with exact compatible price to Produto confirmado', () => {
    const item = {
      identity_locked: true,
      source: 'amazon',
      source_product_id: 'B0B3BHT71L',
      price_search_status: 'found_exact',
      best_compatible_offer: {
        price: 199.9,
        shipping: 19.9,
        total: 219.8,
        compatibility_status: 'accepted',
      },
    }

    expect(productSearchStatus(item)).toMatchObject({
      label: 'Produto confirmado',
      tone: 'success',
      description: 'Identidade confirmada e oferta compativel encontrada.',
    })
    expect(canonicalProductCode(item)).toBe('amazon · B0B3BHT71L')
    expect(totalComparablePrice(item)).toBe(219.8)
  })

  it('does not surface rejected or ambiguous candidates as comparable price', () => {
    const item = {
      product_identity: { match_policy: 'strict' },
      price_search_status: 'found_ambiguous',
      last_rejected_candidates: [
        { title: 'Lanterna Traseira Siena', total: 110.25, compatibility_status: 'rejected' },
      ],
      marketplaceOffers: [
        { title: 'Lanterna Traseira Siena', total: 110.25, compatibility_status: 'rejected' },
      ],
    }

    expect(bestComparableOffer(item)).toBeNull()
    expect(totalComparablePrice(item)).toBeNull()
    expect(productSearchStatus(item)).toMatchObject({
      label: 'Precisa revisar',
      tone: 'warning',
    })
  })

  it('summarizes accepted price history only', () => {
    const item = {
      priceHistory: [
        { total: 300, compatibility_status: 'accepted' },
        { total: 250, compatibility_status: 'accepted' },
        { total: 110, compatibility_status: 'rejected' },
      ],
    }

    expect(priceHistorySummary(item)).toEqual({
      lowest: 250,
      average: 275,
      highest: 300,
      count: 2,
    })
  })

  it('returns friendly states for pending, not found and error statuses', () => {
    expect(productSearchStatus({ priceStatus: 'pending_quote' }).label).toBe('Buscando preco')
    expect(productSearchStatus({ price_search_status: 'not_found' }).label).toBe('Nenhuma oferta compativel')
    expect(productSearchStatus({ price_search_status: 'error' }).label).toBe('Erro ao atualizar')
    expect(productSearchStatus({ monitorPrice: true, priceStatus: 'quoted' }).label).toBe('Monitorando')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- tests/unit/product-search-presentation.test.js
```

Expected: FAIL because `src/utils/product-search-presentation.js` does not exist.

- [ ] **Step 3: Add the helper implementation**

Create `src/utils/product-search-presentation.js`:

```js
import {
  hasCompatiblePrice,
  isAcceptedCompatibleOffer,
  requiresCompatiblePrice,
} from '@/utils/productIdentity.js'

function positiveNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function offerTotal(offer) {
  const total = positiveNumber(offer?.total ?? offer?.totalPrice)
  if (total) return total
  const price = positiveNumber(offer?.price)
  if (!price) return null
  const shipping = positiveNumber(offer?.shipping ?? offer?.shipping_price ?? offer?.shippingPrice) || 0
  return price + shipping
}

function acceptedOffers(item) {
  const candidates = [
    item?.best_compatible_offer,
    item?.bestCompatibleOffer,
    ...(Array.isArray(item?.accepted_candidates) ? item.accepted_candidates : []),
    ...(Array.isArray(item?.acceptedCandidates) ? item.acceptedCandidates : []),
    ...(Array.isArray(item?.marketplaceOffers) ? item.marketplaceOffers : []),
  ].filter(Boolean)

  return candidates
    .filter((offer) => !requiresCompatiblePrice(item) || isAcceptedCompatibleOffer(offer))
    .filter((offer) => offerTotal(offer))
}

export function bestComparableOffer(item) {
  const explicitBest = item?.best_compatible_offer || item?.bestCompatibleOffer || null
  if (explicitBest && (!requiresCompatiblePrice(item) || isAcceptedCompatibleOffer(explicitBest)) && offerTotal(explicitBest)) {
    return explicitBest
  }

  const offers = acceptedOffers(item)
  if (!offers.length) return null
  return [...offers].sort((a, b) => offerTotal(a) - offerTotal(b))[0]
}

export function totalComparablePrice(item) {
  const best = bestComparableOffer(item)
  if (best) return offerTotal(best)
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return null
  return positiveNumber(item?.lastQuotedPrice || item?.value)
}

export function canonicalProductCode(item) {
  const source = String(item?.source || item?.marketplace || '').trim()
  const id = String(item?.source_product_id || item?.sourceProductId || item?.marketplaceItemId || '').trim()
  if (source && id) return `${source} · ${id}`
  if (id) return id
  if (source) return source
  return 'Identidade pendente'
}

export function priceHistorySummary(item) {
  const rows = (Array.isArray(item?.priceHistory) ? item.priceHistory : [])
    .filter((entry) => !requiresCompatiblePrice(item) || isAcceptedCompatibleOffer(entry))
    .map((entry) => offerTotal(entry))
    .filter(Boolean)

  if (!rows.length) {
    return { lowest: null, average: null, highest: null, count: 0 }
  }

  const total = rows.reduce((sum, value) => sum + value, 0)
  return {
    lowest: Math.min(...rows),
    average: Number((total / rows.length).toFixed(2)),
    highest: Math.max(...rows),
    count: rows.length,
  }
}

export function offerShippingText(offer) {
  const shipping = positiveNumber(offer?.shipping ?? offer?.shipping_price ?? offer?.shippingPrice)
  if (shipping) return shipping
  if (offer && (offer.shipping === 0 || offer.shipping_price === 0 || offer.shippingPrice === 0)) return 0
  return null
}

export function productSearchStatus(item) {
  const status = item?.price_search_status || item?.priceSearchStatus || item?.priceStatus || ''
  const lockedNeedsReview = (item?.identity_locked || item?.identityLocked) && item?.identity_status === 'needs_review'

  if (lockedNeedsReview) {
    return {
      label: 'Precisa revisar',
      tone: 'danger',
      description: 'Nao conseguimos confirmar que este link corresponde ao produto correto.',
    }
  }

  if (status === 'error') {
    return {
      label: 'Erro ao atualizar',
      tone: 'danger',
      description: 'Nao foi possivel atualizar os precos agora.',
    }
  }

  if (hasCompatiblePrice(item)) {
    return {
      label: 'Produto confirmado',
      tone: 'success',
      description: 'Identidade confirmada e oferta compativel encontrada.',
    }
  }

  if (status === 'found_ambiguous') {
    return {
      label: 'Precisa revisar',
      tone: 'warning',
      description: 'Encontramos produtos parecidos, mas nenhum foi confirmado.',
    }
  }

  if (status === 'not_found') {
    return {
      label: 'Nenhuma oferta compativel',
      tone: 'warning',
      description: 'Ainda nao encontramos uma oferta compativel para este produto.',
    }
  }

  if (item?.monitorPrice && (status === 'quoted' || item?.priceStatus === 'quoted')) {
    return {
      label: 'Monitorando',
      tone: 'info',
      description: 'Produto salvo e monitorado para novas oportunidades.',
    }
  }

  return {
    label: 'Buscando preco',
    tone: 'pending',
    description: 'Estamos buscando ofertas compativeis para este produto.',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- tests/unit/product-search-presentation.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/product-search-presentation.js tests/unit/product-search-presentation.test.js
git commit -m "feat: add product search presentation helpers"
```

---

### Task 2: Purchase New Input Detection and Copy

**Files:**
- Modify: `src/views/PurchaseNew.vue`
- Create: `tests/unit/product-search-ux-contract.test.js`

- [ ] **Step 1: Write the failing source contract**

Create `tests/unit/product-search-ux-contract.test.js`:

```js
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const purchaseNew = () => fs.readFileSync('src/views/PurchaseNew.vue', 'utf8')
const wishlist = () => fs.readFileSync('src/views/PurchaseWishlist.vue', 'utf8')
const detail = () => fs.readFileSync('src/views/PurchaseDetail.vue', 'utf8')

describe('product search UX contract', () => {
  it('PurchaseNew auto-detects pasted product links without losing the input value', () => {
    const source = purchaseNew()

    expect(source).toContain("Descreva o produto ou cole um link")
    expect(source).toContain('watch(inputValue')
    expect(source).toContain('detectInputMode')
    expect(source).toContain("mode.value = 'link'")
    expect(source).toContain('function setMode(nextMode, options = {})')
    expect(source).toContain("if (!options.keepInput) inputValue.value = ''")
  })

  it('PurchaseWishlist uses human product-search labels instead of technical AI labels', () => {
    const source = wishlist()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain('productSearchStatus(item)')
    expect(source).not.toContain('Status IA')
    expect(source).not.toContain('Aguardando cotacao compativel')
    expect(source).not.toContain('Compatibilidade pendente')
  })

  it('PurchaseDetail exposes product, price, offers, compatibility and financial decision sections', () => {
    const source = detail()

    expect(source).toContain("from '@/utils/product-search-presentation.js'")
    expect(source).toContain('Produto')
    expect(source).toContain('Preco')
    expect(source).toContain('Ofertas')
    expect(source).toContain('Compatibilidade')
    expect(source).toContain('Decisao financeira')
    expect(source).not.toContain('Pendente de cotacao compativel')
  })
})
```

- [ ] **Step 2: Run source contract to verify it fails**

Run:

```bash
npm run test:run -- tests/unit/product-search-ux-contract.test.js
```

Expected: FAIL because `watch(inputValue`, `detectInputMode`, presentation helper imports, and new labels are not present yet.

- [ ] **Step 3: Update imports and mode detection in `PurchaseNew.vue`**

In `src/views/PurchaseNew.vue`, update the Vue import:

```js
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
```

Replace the hero copy with:

```vue
<h1>Compras planejadas</h1>
<p>Acompanhe produtos, compare precos e decida se vale comprar agora.</p>
```

Replace the text-mode label block with a single intelligent prompt:

```vue
<label v-if="mode === 'text'" data-testid="product-description-tab">
  <span>Descreva o produto ou cole um link</span>
  <textarea
    ref="descriptionInput"
    v-model="inputValue"
    rows="4"
    placeholder="Ex: lanterna traseira direita Fiat Punto 2012"
  ></textarea>
  <small>Digite uma descricao para buscar candidatos ou cole um link para travar a identidade do produto.</small>
</label>
```

Replace the link helper copy with:

```vue
<small data-testid="product-link-helper">Quando voce usa um link, monitoramos exatamente o produto informado e bloqueamos trocas por itens parecidos.</small>
```

Replace `setMode` with:

```js
function setMode(nextMode, options = {}) {
  mode.value = nextMode
  if (!options.keepInput) inputValue.value = ''
  imageFile.value = null
  review.value = null
}
```

Add this function below `setMode`:

```js
function detectInputMode(value) {
  if (mode.value === 'image') return
  const urls = extractProductUrls(value)
  if (urls.length && mode.value !== 'link') {
    setMode('link', { keepInput: true })
  }
  if (!urls.length && mode.value === 'link' && value.trim() && !inputValue.value.includes('://')) {
    setMode('text', { keepInput: true })
  }
}
```

Add the watcher after `detectInputMode`:

```js
watch(inputValue, (value) => {
  detectInputMode(value)
})
```

Change `multipleUrls` so it works whenever links are present:

```js
const multipleUrls = computed(() => extractProductUrls(inputValue.value).filter(Boolean))
```

Keep `primaryActionLabel` as:

```js
const primaryActionLabel = computed(() => {
  if (mode.value === 'link') return multipleUrls.value.length > 1 ? 'Escolher links' : 'Adicionar produto pelo link'
  return 'Pesquisar produto'
})
```

- [ ] **Step 4: Run source contract**

Run:

```bash
npm run test:run -- tests/unit/product-search-ux-contract.test.js
```

Expected: FAIL only on Wishlist and Detail assertions. The PurchaseNew assertion should pass.

- [ ] **Step 5: Run existing URL tests**

Run:

```bash
npm run test:run -- tests/unit/multiple-product-urls.test.js tests/unit/product-url-canonicalizer.test.js
```

Expected: PASS. This confirms the UI change did not require changing URL parsing rules.

- [ ] **Step 6: Commit**

```bash
git add src/views/PurchaseNew.vue tests/unit/product-search-ux-contract.test.js
git commit -m "feat: improve product search input detection"
```

---

### Task 3: Wishlist Card States and Metrics

**Files:**
- Modify: `src/views/PurchaseWishlist.vue`
- Test: `tests/unit/product-search-ux-contract.test.js`
- Test: `tests/unit/product-search-presentation.test.js`

- [ ] **Step 1: Confirm current UX contract fails on Wishlist**

Run:

```bash
npm run test:run -- tests/unit/product-search-ux-contract.test.js
```

Expected: FAIL because `PurchaseWishlist.vue` still contains `Status IA`, `Aguardando cotacao compativel`, and no presentation helper import.

- [ ] **Step 2: Update imports**

In `src/views/PurchaseWishlist.vue`, add the helper import:

```js
import {
  bestComparableOffer,
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'
```

Keep existing imports from `@/utils/productIdentity.js`, but remove unused imports after the template refactor.

- [ ] **Step 3: Add UI helper functions**

Add these functions below `potentialSavings`:

```js
function itemStatus(item) {
  return productSearchStatus(item)
}

function itemCode(item) {
  return canonicalProductCode(item)
}

function currentOffer(item) {
  return bestComparableOffer(item)
}

function comparablePrice(item) {
  return totalComparablePrice(item)
}

function historySummary(item) {
  return priceHistorySummary(item)
}
```

Replace `bestPrice(item)` with:

```js
function bestPrice(item) {
  return comparablePrice(item)
}
```

Replace `decisionText(item)` with:

```js
function decisionText(item) {
  if (requiresCompatiblePrice(item) && !hasCompatiblePrice(item)) return 'Aguardando preco confiavel'
  const analysis = workflow.analysisFor(item)
  if (!analysis) return isPending(item) ? 'Aguardar cotacao' : 'A monitorar'
  return analysis.buyTodayRecommended ? 'Comprar' : 'Aguardar'
}
```

Replace `statusLabel(item)` with:

```js
function statusLabel(item) {
  return itemStatus(item).label
}
```

Replace `statusClass(item)` with:

```js
function statusClass(item) {
  return itemStatus(item).tone
}
```

- [ ] **Step 4: Replace the card metrics markup**

In the card template, replace the current `technical-meta` and `metrics` block with:

```vue
<p class="meta">
  {{ item.marketplace || 'Loja pendente' }} · {{ itemCode(item) }} · {{ item.category || 'Outros' }}
</p>
<p v-if="item.identity_locked" class="meta technical-meta">
  Produto travado pelo link informado. Nenhuma oferta parecida sera usada como melhor preco.
</p>
<p v-if="item.product_identity" class="meta technical-meta">
  {{ describeProductIdentity(item.product_identity) }} · {{ itemStatus(item).description }}
</p>

<div class="metrics">
  <div>
    <span>Melhor oferta compativel</span>
    <strong>{{ formatCurrency(bestPrice(item)) }}</strong>
  </div>
  <div>
    <span>Preco com frete</span>
    <strong>{{ formatCurrency(comparablePrice(item)) }}</strong>
  </div>
  <div>
    <span>Historico</span>
    <strong>
      {{ historySummary(item).count ? `Menor ${formatCurrency(historySummary(item).lowest)}` : 'Sem historico' }}
    </strong>
  </div>
  <div>
    <span>Decisao financeira</span>
    <strong>{{ decisionText(item) }}</strong>
  </div>
</div>
```

Replace action button labels:

```vue
{{ refreshingId === item.id ? 'Atualizando' : 'Atualizar preco' }}
```

Keep the `Detalhes` router link and `Excluir` button.

- [ ] **Step 5: Update section copy**

Replace group titles/descriptions:

```js
const wishlistGroups = computed(() => [
  {
    key: 'quoted',
    title: 'Com preco para avaliar',
    description: 'Itens com oferta compativel, historico ou recomendacao financeira.',
    items: quotedItems.value,
  },
  {
    key: 'pending',
    title: 'Buscando preco',
    description: 'Itens salvos que ainda precisam de oferta compativel.',
    items: pendingItems.value,
  },
])
```

Replace the empty state description:

```vue
description="Comece por uma descricao ou link de produto para comparar precos e planejar a compra."
```

- [ ] **Step 6: Update CSS for four compact metrics and status tones**

In the `<style scoped>` block, replace the metrics grid with:

```css
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.75rem;
}
```

Replace status tone styles with:

```css
.status-pill.success { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.info { color: var(--accent-hover); background: var(--blue-dim); }
.status-pill.warning,
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.status-pill.danger { color: #f87171; background: rgba(248, 113, 113, 0.12); }
```

Keep the existing mobile media query but ensure `.metrics` collapses to one column there.

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test:run -- tests/unit/product-search-presentation.test.js tests/unit/product-search-ux-contract.test.js tests/unit/wishlist-compatible-price.test.js
```

Expected: `product-search-ux-contract.test.js` still fails only on Detail assertions. The Wishlist assertions should pass.

- [ ] **Step 8: Commit**

```bash
git add src/views/PurchaseWishlist.vue tests/unit/product-search-ux-contract.test.js
git commit -m "feat: clarify wishlist product search cards"
```

---

### Task 4: Product Detail Phase 1 Sections and Labels

**Files:**
- Modify: `src/views/PurchaseDetail.vue`
- Test: `tests/unit/product-search-ux-contract.test.js`

- [ ] **Step 1: Confirm current UX contract fails on Detail**

Run:

```bash
npm run test:run -- tests/unit/product-search-ux-contract.test.js
```

Expected: FAIL because Detail still lacks the presentation helper import and still uses `Pendente de cotacao compativel`.

- [ ] **Step 2: Update imports**

In `src/views/PurchaseDetail.vue`, add:

```js
import {
  canonicalProductCode,
  priceHistorySummary,
  productSearchStatus,
  totalComparablePrice,
} from '@/utils/product-search-presentation.js'
```

- [ ] **Step 3: Add computed presentation values**

Add below `const compatiblePriceReady`:

```js
const uiStatus = computed(() => productSearchStatus(item.value || {}))
const canonicalCode = computed(() => canonicalProductCode(item.value || {}))
const comparableTotal = computed(() => totalComparablePrice(item.value || {}))
const historySummary = computed(() => priceHistorySummary(item.value || {}))
```

Replace `compatibleTotal` with:

```js
const compatibleTotal = computed(() => Number(comparableTotal.value || 0))
```

- [ ] **Step 4: Replace top status and metrics labels**

Replace the status pill:

```vue
<span class="status-pill" :class="uiStatus.tone">
  {{ uiStatus.label }}
</span>
```

Replace the hero metrics block with:

```vue
<div class="hero-metrics">
  <div>
    <span>Preco atual</span>
    <strong>{{ comparableTotal ? formatCurrency(comparableTotal) : 'Nao encontrado' }}</strong>
  </div>
  <div>
    <span>Menor historico</span>
    <strong>{{ historySummary.lowest ? formatCurrency(historySummary.lowest) : 'Sem historico' }}</strong>
  </div>
  <div>
    <span>Decisao financeira</span>
    <strong>{{ analysis ? (analysis.buyTodayRecommended ? 'Comprar' : 'Aguardar') : 'Pendente' }}</strong>
  </div>
</div>
```

Replace the identity box content:

```vue
<div v-if="item.identity_locked" class="identity-box">
  <span>Produto</span>
  <strong>{{ item.name }}</strong>
  <small>Codigo canonico: {{ canonicalCode }}</small>
  <small>URL canonica: {{ item.canonicalUrl || item.originalLink || 'Nao informada' }}</small>
</div>
```

Replace the warning message:

```vue
<p v-if="compatibleRequired && !compatiblePriceReady" class="identity-warning">
  Ainda nao encontramos uma oferta compativel para este produto. Produtos parecidos ficam separados e nao entram como melhor preco.
</p>
```

- [ ] **Step 5: Rename sections to approved labels**

Change section headings:

```vue
<h2>Preco</h2>
```

for the first panel currently named `Inteligencia de compra`.

Change history heading:

```vue
<h2>Historico</h2>
```

Change marketplace section eyebrow and heading:

```vue
<p class="eyebrow">Ofertas</p>
<h2>Ofertas compativeis</h2>
```

Add a compatibility subheading before rejected candidates:

```vue
<summary>Compatibilidade</summary>
```

Keep `Decisao financeira` as the first panel heading.

- [ ] **Step 6: Update status tone CSS**

Replace current `.status-pill.quoted` and `.status-pill.pending` styles with:

```css
.status-pill.success { color: #34d399; background: rgba(52, 211, 153, 0.14); }
.status-pill.info { color: var(--accent-hover); background: var(--blue-dim); }
.status-pill.warning,
.status-pill.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.14); }
.status-pill.danger { color: #f87171; background: rgba(248, 113, 113, 0.12); }
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test:run -- tests/unit/product-search-ux-contract.test.js tests/unit/purchase-intelligence-compatible-price.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/views/PurchaseDetail.vue tests/unit/product-search-ux-contract.test.js
git commit -m "feat: clarify product detail price comparison"
```

---

### Task 5: Full Verification and Build

**Files:**
- No new files.
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run product identity validations**

Run:

```bash
npm run validate-product-url-identity
npm run validate-product-search-description
npm run validate-product-cache-key
npm run validate-price-search-identity
npm run validate-valueserp-price-search
```

Expected:

- `Product URL identity validation: PASS`
- Description, cache, identity, and ValueSERP validations all pass.

- [ ] **Step 2: Run unit suite for this phase**

Run:

```bash
npm run test:run -- tests/unit/product-search-presentation.test.js tests/unit/product-search-ux-contract.test.js tests/unit/product-url-canonicalizer.test.js tests/unit/multiple-product-urls.test.js tests/unit/price-search-identity-locked.test.js tests/unit/price-search-compatibility.test.js tests/unit/wishlist-compatible-price.test.js tests/unit/purchase-intelligence-compatible-price.test.js
```

Expected: all listed test files pass.

- [ ] **Step 3: Run UX/layout validations**

Run:

```bash
npm run validate:page-layout
npm run validate:ux
npm run validate:global-ux
```

Expected: all pass.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds and SPA fallbacks are generated.

- [ ] **Step 5: Optional local smoke check**

If no Vite server is running, start it:

```bash
npm run dev -- --host 127.0.0.1
```

Open:

- `http://127.0.0.1:8080/purchases/new`
- `http://127.0.0.1:8080/purchases`

Manual checks:

- Pasting `https://www.amazon.com.br/dp/B0B3BHT71L?tag=abc` switches to link mode and keeps the pasted value.
- Typing `lanterna traseira direita Fiat Punto` stays in description mode.
- Wishlist cards do not show `Status IA`.
- Locked products show canonical source/id.
- Mobile width around 375px has no horizontal scroll.

- [ ] **Step 6: Commit verification fixes if any**

If verification required small fixes, commit them:

```bash
git add src tests
git commit -m "fix: stabilize product search phase one"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- URL identity lock: covered by existing Edge Function and validation commands, and surfaced in UI by Task 3 and Task 4.
- Description search: preserved in `PurchaseNew.vue`; Task 2 improves the entry UX without changing domain behavior.
- Multiple links: preserved and validated by existing tests in Task 2 and Task 5.
- Human states: implemented by Task 1 and consumed by Task 3 and Task 4.
- Cards and details: implemented by Task 3 and Task 4.
- Rejected offers not used as best price: covered by Task 1 helper tests and existing compatibility tests.
- Cache and provider behavior: not changed in Phase 1, verified in Task 5.
- Free/Premium limits, dedicated tables, adapters, and OCR: intentionally excluded for later phases.

Red-flag scan:

- No unresolved plan markers are intended in this plan.
- Every code-changing task has concrete code snippets and commands.

Type consistency:

- Helper exports are `bestComparableOffer`, `canonicalProductCode`, `priceHistorySummary`, `productSearchStatus`, and `totalComparablePrice`.
- Vue imports use those exact names.
- Tests import those exact names.
