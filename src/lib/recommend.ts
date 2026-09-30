/**
 * THE recommendation engine: one deterministic set of rules for every place a product is suggested
 * (cart, checkout, the post-payment offer, product pages, homepage). No AI, no external service.
 *
 * Order of the rules:
 *   1. Finish a promotion that is one step away (a third eligible product for the 20%, the next
 *      Amber pair for 2+1). Promotions only exist inside one order, so not after payment.
 *   2. The complementary products from `config/upsell.ts`, merged over the products in the cart / order
 *      and deduplicated. NEUROS Amber is not a complement of NEUROS Flow, also when Flow shares the cart
 *      with another product (Flow + Calm → Focus, Flow + Focus → Calm).
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
  /** How it is added: directly, with the Amber pair picker, the 3-product picker, or a variant picker (NEUROS Flow). */
  add: 'direct' | 'amber_pairs' | 'bundle' | 'variant'
  /** For the pickers: how many units they ask for (3 for a fresh offer, fewer to complete one). */
  slots?: number
}

const LIMIT: Record<Placement, number> = { cart: 3, checkout: 2, post_purchase: 2, product_page: 1, homepage: 1 }
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

  // The complementary products of what is there, merged and deduplicated (NEUROS Amber is not a complement
  // of NEUROS Flow, also when Flow shares the cart with another product).
  const excluded = (id: ProductId) => id === FLOW || (id === AMBER && inCart.has(FLOW))
  const complements = [...new Map(lines.flatMap((l) => UPSELL_MAP[l.productId as ProductId] ?? []).filter((c) => !inCart.has(c.productId) && !excluded(c.productId)).map((c) => [c.productId, c])).values()]

  // 1. Finish a promotion (inside one order only).
  if (placement !== 'post_purchase') {
    const progress = promotionProgress(lines.map((l, i) => ({ key: `${l.productId}:${l.variantId ?? ''}:${i}`, productId: l.productId, quantity: l.quantity, unitAmount: priceOf(l) })))
    // The next Amber pair first (one suggestion), then the choices for the 20% (at most two when both are close).
    const amber = progress.find((p) => p.kind === 'buy_x_get_y' && p.state === 'close')
    if (amber) push({ productId: AMBER, kind: 'complete_offer', promotionId: amber.id, add: 'amber_pairs', slots: amber.missing, reason: amber.missing === 1 ? 'Încă o pereche și a treia este gratuită.' : `Mai alege ${amber.missing} perechi pentru 2+1.` })
    const bundle = progress.find((p) => p.kind === 'bundle_percent' && p.state === 'close')
    if (bundle) {
      const reason = 'Al treilea produs activează reducerea de 20%.'
      // When a complementary product is itself the missing product (NEUROS Flow + Calm → Focus), it is
      // offered directly; otherwise one suggestion opens the 3-product picker (asking only for the missing
      // product), its image the first eligible product not already in the cart.
      const direct = bundle.missing === 1 ? complements.find((c) => (bundle.products as string[]).includes(c.productId) && !getProduct(c.productId)?.variants?.length) : undefined
      if (direct) push({ productId: direct.productId, kind: 'complete_offer', promotionId: bundle.id, add: 'direct', reason })
      else {
        const ids = ([...bundle.products] as ProductId[]).sort((a, b) => Number(a === FLOW) - Number(b === FLOW) || Number(inCart.has(a)) - Number(inCart.has(b)))
        push({ productId: ids[0], kind: 'complete_offer', promotionId: bundle.id, add: 'bundle', slots: bundle.missing, reason })
      }
    }
  }

  // 2. Complementary products, in the order of the products in the cart / order.
  for (const c of complements) {
    push({
      productId: c.productId,
      kind: 'cross_sell',
      add: placement === 'post_purchase' ? 'direct' : addMode(c.productId),
      slots: c.productId === AMBER ? 3 : undefined,
      reason: c.reason,
    })
  }

  // 3. Nothing in the cart that points anywhere (e.g. only Amber and all its pairs): suggest nothing.
  return out
}
