/**
 * THE recommendation engine: one deterministic set of rules for every place a product is suggested
 * (cart, checkout, the post-payment offer, product pages, homepage). No AI, no external service.
 *
 * Order of the rules:
 *   1. Finish a promotion that is one step away (a third eligible product for the 20%, the next
 *      Amber pair for 2+1). Promotions only exist inside one order, so not after payment.
 *   2. The complementary pairs from `config/upsell.ts` (the same map the post-payment offer always used).
 *   3. Never suggest what is already there, unless quantity matters for a promotion (step 1).
 * NEUROS Flow is only suggested to complete the 20% in the cart (with its configuration picker), never
 * as an impulse cross-sell and never after payment: it is chosen with a specialist.
 */
import { UPSELL_MAP } from '@/config/upsell'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import { promotionProgress } from './promotions'

export type Placement = 'cart' | 'checkout' | 'post_purchase' | 'product_page' | 'homepage'

export type RecLine = { productId: string; variantId?: string; quantity: number }

export type Recommendation = {
  productId: ProductId
  reason: string
  /** Why it is shown: to complete a promotion, or as a complementary product. */
  kind: 'complete_offer' | 'cross_sell'
  promotionId?: string
  /** How it is added: directly, with the Amber pair picker, or with a variant picker (NEUROS Flow). */
  add: 'direct' | 'amber_pairs' | 'variant'
  /** For `amber_pairs`: how many pairs the picker asks for (3 for a fresh 2+1, fewer to complete one). */
  slots?: number
}

const LIMIT: Record<Placement, number> = { cart: 3, checkout: 2, post_purchase: 1, product_page: 1, homepage: 1 }
const AMBER: ProductId = 'ochelari-biohack'
const FLOW: ProductId = 'brain-flow'

const addMode = (id: ProductId): Recommendation['add'] => (id === AMBER ? 'amber_pairs' : getProduct(id)?.variants?.length ? 'variant' : 'direct')

/** A representative price per product (lowest variant) for the progress maths; the cart is priced by the catalog. */
const priceOf = (l: RecLine) => {
  const p = getProduct(l.productId)
  if (!p) return 0
  return unitPrice(p, p.variants?.find((v) => v.id === l.variantId)) ?? p.price ?? 0
}

export function recommend(lines: RecLine[], placement: Placement, limit = LIMIT[placement]): Recommendation[] {
  const inCart = new Set(lines.map((l) => l.productId))
  const out: Recommendation[] = []
  const push = (r: Recommendation) => {
    if (out.length < limit && !out.some((o) => o.productId === r.productId) && getProduct(r.productId)?.price != null) out.push(r)
  }

  // 1. Finish a promotion (inside one order only).
  if (placement !== 'post_purchase') {
    const progress = promotionProgress(lines.map((l, i) => ({ key: `${l.productId}:${l.variantId ?? ''}:${i}`, productId: l.productId, quantity: l.quantity, unitAmount: priceOf(l) })))
    // The next Amber pair first (one suggestion), then the choices for the 20% (at most two when both are close).
    const amber = progress.find((p) => p.kind === 'buy_x_get_y' && p.state === 'close')
    if (amber) push({ productId: AMBER, kind: 'complete_offer', promotionId: amber.id, add: 'amber_pairs', slots: amber.missing, reason: amber.missing === 1 ? 'Încă o pereche și a treia este gratuită.' : `Mai alege ${amber.missing} perechi pentru 2+1.` })
    const bundle = progress.find((p) => p.kind === 'bundle_percent' && p.state === 'close')
    if (bundle) {
      // Products not in the cart first; NEUROS Flow last (it needs a configuration and a considered choice).
      const ids = ([...bundle.products] as ProductId[]).sort((a, b) => Number(a === FLOW) - Number(b === FLOW) || Number(inCart.has(a)) - Number(inCart.has(b)))
      const room = amber ? Math.min(2, limit - out.length) : limit - out.length
      for (const id of ids.slice(0, room)) push({ productId: id, kind: 'complete_offer', promotionId: bundle.id, add: addMode(id), reason: 'Al treilea produs activează reducerea de 20%.' })
    }
  }

  // 2. Complementary products, from the products in the cart / order, in their order.
  for (const l of lines) {
    for (const c of UPSELL_MAP[l.productId as ProductId] ?? []) {
      if (inCart.has(c.productId) || c.productId === FLOW) continue
      push({
        productId: c.productId,
        kind: 'cross_sell',
        add: placement === 'post_purchase' ? 'direct' : addMode(c.productId),
        slots: c.productId === AMBER ? 3 : undefined,
        reason: c.reason,
      })
    }
  }

  // 3. Nothing in the cart that points anywhere (e.g. only Amber and all its pairs): suggest nothing.
  return out
}
