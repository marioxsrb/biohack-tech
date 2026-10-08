/**
 * How an order reads for CRM and future email segmentation, derived only from the canonical order
 * (never from free text or CRM tags). Nothing here is stored twice: the order row already holds the
 * product and variant ids, the applied promotion ids, the kind (checkout / upsell), the attribution
 * (landing, UTM, entry surface) and the marketing consent. This file is the one agreed reading of them.
 *
 * Purchase ≠ intent: only `purchase === 'confirmed'` means the customer bought (the same rule that adds
 * the bt-cumparat-* tags in GHL). Marketing consent is reported as its own field and never implied by
 * a purchase.
 */
import { PROMOTIONS } from '@/config/promotions'
import type { Attribution } from './attribution'

export type SegmentInput = {
  status: string
  paymentStatus: string
  kind: 'checkout' | 'upsell'
  items: { productId: string; variantId: string | null; quantity: number; promotionId: string | null }[]
  promotions: { id: string; amountMinor: number }[]
  attribution: Attribution | null
  marketingConsent: boolean
}

/**
 * confirmed: paid (or partly refunded, or already shipped / delivered). refunded: paid, then fully refunded.
 * open: waiting for a transfer or a card confirmation. abandoned: card not completed, failed or cancelled
 * before money moved (a recoverable intent). cancelled: cancelled by us or the customer.
 */
export type PurchaseState = 'confirmed' | 'refunded' | 'open' | 'abandoned' | 'cancelled'

export function purchaseState(o: Pick<SegmentInput, 'status' | 'paymentStatus'>): PurchaseState {
  if (o.paymentStatus === 'refunded') return 'refunded'
  if (isConfirmedPurchase(o)) return 'confirmed'
  if (o.status === 'cancelled') return 'cancelled'
  if (o.status === 'abandoned' || o.paymentStatus === 'failed' || o.paymentStatus === 'cancelled') return 'abandoned'
  return 'open'
}

/** The single rule for "this customer bought it": used for segments and for the GHL product tags. */
export function isConfirmedPurchase(o: Pick<SegmentInput, 'status' | 'paymentStatus'>): boolean {
  // A cash-on-delivery parcel can still be refused at the door: it counts once the collection is recorded.
  if (o.paymentStatus === 'awaiting_collection') return false
  return o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded' || o.status === 'shipped' || o.status === 'delivered'
}

export type PromotionSegment = {
  /** The order held at least one unit the promotion covers. */
  eligible: boolean
  /** Units that count toward it. */
  units: number
  /** Enough units for it to apply (3 for both current promotions). */
  qualified: boolean
  /** The order carries this promotion id with an amount. */
  applied: boolean
  amountMinor: number
}

export type OrderSegments = {
  purchase: PurchaseState
  /** original = a normal checkout order; upsell = the optional order added after a card payment. */
  origin: 'original' | 'upsell'
  /** Canonical product ids (brain-flow stays the id of NEUROS Flow). */
  products: string[]
  /** productId:variantId for products with variants (Amber frame, NEUROS Flow configuration). */
  variants: string[]
  promotions: Record<string, PromotionSegment>
  /** landing = came through an advertising landing; site = the main site. */
  channel: 'landing' | 'site'
  landing: string | null
  /** Where the first product was added: home, catalog, product, landing, cart_offer, recovery, link. */
  entry: string | null
  utm: Record<string, string>
  marketingConsent: boolean
}

export function orderSegments(o: SegmentInput): OrderSegments {
  const promotions: Record<string, PromotionSegment> = {}
  for (const p of PROMOTIONS) {
    const units = o.items.filter((i) => (p.products as string[]).includes(i.productId)).reduce((n, i) => n + i.quantity, 0)
    const threshold = p.kind === 'bundle_percent' ? p.tiers[0].minUnits : p.group
    const applied = o.promotions.find((a) => a.id === p.id)
    promotions[p.id] = { eligible: units > 0, units, qualified: units >= threshold, applied: !!applied && applied.amountMinor > 0, amountMinor: applied?.amountMinor ?? 0 }
  }
  const a = o.attribution
  return {
    purchase: purchaseState(o),
    origin: o.kind === 'upsell' ? 'upsell' : 'original',
    products: [...new Set(o.items.map((i) => i.productId))],
    variants: [...new Set(o.items.filter((i) => i.variantId).map((i) => `${i.productId}:${i.variantId}`))],
    promotions,
    channel: a?.landing ? 'landing' : 'site',
    landing: a?.landing ?? null,
    entry: a?.entry ?? null,
    utm: { ...(a?.utm ?? {}) } as Record<string, string>,
    marketingConsent: o.marketingConsent,
  }
}

/**
 * A customer's purchase profile from all their orders (same email): what they bought (confirmed only),
 * which configurations, which promotions they used, what they left unfinished, where they came from.
 * Answers "bought Calm but never Amber" style questions without any CRM state.
 */
export function customerProfile(orders: SegmentInput[]) {
  const segs = orders.map(orderSegments)
  const bought = segs.filter((s) => s.purchase === 'confirmed')
  const boughtProducts = new Set(bought.flatMap((s) => s.products))
  return {
    bought: [...boughtProducts],
    boughtVariants: [...new Set(bought.flatMap((s) => s.variants))],
    promotionsUsed: [...new Set(bought.flatMap((s) => Object.entries(s.promotions).filter(([, p]) => p.applied).map(([id]) => id)))],
    /** Products left in unfinished orders and never bought. */
    abandoned: [...new Set(segs.filter((s) => s.purchase === 'abandoned').flatMap((s) => s.products))].filter((p) => !boughtProducts.has(p)),
    upsellOrders: bought.filter((s) => s.origin === 'upsell').length,
    landings: [...new Set(bought.map((s) => s.landing).filter((l): l is string => !!l))],
  }
}
