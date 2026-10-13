/**
 * THE recommendation engine: one deterministic set of rules for every place a product is suggested
 * (cart, checkout, the post-payment offer, product pages, homepage). No AI, no external service.
 *
 * Order of the rules:
 *   1. Finish a promotion that is one step away (a third eligible product for the 20%, the next
 *      Amber pair for 2+1). Promotions only exist inside one order, so not after payment.
 *   2. The complementary products from `config/upsell.ts`, merged over the products in the cart / order
 *      and deduplicated.
 *   3. Never suggest what is already there, unless quantity matters for a promotion (step 1).
 * Only catalog products with a price are ever suggested.
 */
import { UPSELL_MAP } from '@/config/upsell'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import type { Locale } from '@/i18n/locales'
import { promotionProgress } from './promotions'

export type Placement = 'cart' | 'checkout' | 'post_purchase' | 'product_page' | 'homepage'

export type RecLine = { productId: string; variantId?: string; quantity: number }

export type Recommendation = {
  productId: ProductId
  reason: string
  /** Why it is shown: to complete a promotion, or as a complementary product. */
  kind: 'complete_offer' | 'cross_sell'
  promotionId?: string
  /** How it is added: directly, with the Amber pair picker, the 3-product picker, or a variant picker. */
  add: 'direct' | 'amber_pairs' | 'bundle' | 'variant'
  /** For the pickers: how many units they ask for (3 for a fresh offer, fewer to complete one). */
  slots?: number
}

const LIMIT: Record<Placement, number> = { cart: 3, checkout: 2, post_purchase: 2, product_page: 1, homepage: 1 }
const AMBER: ProductId = 'ochelari-biohack'

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

  // The complementary products of what is there, merged and deduplicated.
  const complements = [...new Map(lines.flatMap((l) => UPSELL_MAP[l.productId as ProductId] ?? []).filter((c) => !inCart.has(c.productId)).map((c) => [c.productId, c])).values()]

  // 1. Finish a promotion (inside one order only).
  if (placement !== 'post_purchase') {
    const progress = promotionProgress(lines.map((l, i) => ({ key: `${l.productId}:${l.variantId ?? ''}:${i}`, productId: l.productId, quantity: l.quantity, unitAmount: priceOf(l) })))
    // The next Amber pair first (one suggestion), then one more unit of any product that is one away from 20%.
    const amber = progress.find((p) => p.kind === 'buy_x_get_y' && p.state === 'close')
    if (amber) push({ productId: AMBER, kind: 'complete_offer', promotionId: amber.id, add: 'amber_pairs', slots: amber.missing, reason: amber.missing === 1 ? 'Încă o pereche și a treia este gratuită.' : `Mai alege ${amber.missing} perechi pentru 2+1.` })
    // The quantity discount counts each product on its own: when a product is one unit from 20%, suggest
    // one more of that same product.
    for (const bundle of progress.filter((p) => p.kind === 'bundle_percent' && p.state === 'close' && p.productId)) {
      const id = bundle.productId as ProductId
      push({ productId: id, kind: 'complete_offer', promotionId: bundle.id, add: getProduct(id)?.variants?.length ? 'variant' : 'direct', reason: `Încă un ${getProduct(id)?.name} și primești 20% reducere la toate trei.` })
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

/** English for the reasons above (config/upsell.ts and the offer lines), keyed by the Romanian text. */
const REASON_EN: Record<string, string> = {
  'Seara, după ședința cu NEUROS Calm, ochelarii NEUROS Amber filtrează lumina albastră a ecranelor.': 'In the evening, after your NEUROS Calm session, NEUROS Amber glasses filter the blue light of screens.',
  'NEUROS Focus completează relaxarea cu antrenamentul atenției, prin jocuri pe tabletă.': 'NEUROS Focus adds attention training to your relaxation, with games on a tablet.',
  'Pentru orele de lucru la ecran dintre sesiunile cu NEUROS Focus.': 'For your hours at the screen between NEUROS Focus sessions.',
  'NEUROS Calm completează antrenamentul atenției cu câteva minute de relaxare.': 'NEUROS Calm adds a few minutes of relaxation to your attention training.',
  'Câteva minute de relaxare seara, cu NEUROS Calm purtat la gât.': 'A few minutes of relaxation in the evening, with NEUROS Calm worn around your neck.',
  'Antrenează-ți atenția prin jocuri pe tabletă, cu NEUROS Focus.': 'Train your attention with games on a tablet, with NEUROS Focus.',
  'NEUROS Calm adaugă câteva minute de relaxare, purtat la gât.': 'NEUROS Calm adds a few minutes of relaxation, worn around your neck.',
  'NEUROS Focus adaugă antrenamentul atenției, prin jocuri pe tabletă.': 'NEUROS Focus adds attention training, with games on a tablet.',
  'Încă o pereche și a treia este gratuită.': 'One more pair and the third one is free.',
}

/** A recommendation's reason in the visitor's language (the engine itself works in Romanian). */
export function reasonText(r: Pick<Recommendation, 'reason' | 'add' | 'slots'>, locale: Locale = 'ro'): string {
  if (locale !== 'en') return r.reason
  if (REASON_EN[r.reason]) return REASON_EN[r.reason]
  const one = r.reason.match(/^Încă un (.+) și primești 20% reducere la toate trei\.$/)
  if (one) return `One more ${one[1]} and you get 20% off all three.`
  if (r.add === 'amber_pairs' && r.slots) return `Choose ${r.slots} more pairs for 3 for 2.`
  return r.reason
}
