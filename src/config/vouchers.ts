/**
 * Personal vouchers (server/vouchers.ts), the values the approved emails promise (21.10.2026):
 * „Ți-am adăugat X lei în contul tău Biohack Tech.” Each voucher belongs to one contact (email), one product and has a
 * fixed value in bani. The customer uses it once, through the checkout's code field; the server checks it inside the
 * order's transaction. Nothing here is issued by itself: a workflow (or the admin) issues a voucher.
 *
 * Amounts in bani (integers). Product ids: balance-wave = NEUROS Calm, brainlink-pro = NEUROS Focus,
 * ochelari-biohack = NEUROS Amber, carte-diana = the book (no automatic voucher).
 */
import type { ProductId } from '@/content/catalog'

export type VoucherProduct = 'balance-wave' | 'brainlink-pro' | 'ochelari-biohack'

export const VOUCHER_VALUE: Record<VoucherProduct, number> = {
  'balance-wave': 64000,
  'brainlink-pro': 32500,
  'ochelari-biohack': 3000,
}

export const isVoucherProduct = (id: string): id is VoucherProduct => id in VOUCHER_VALUE

/**
 * NEUROS Amber with the 2+1 offer (final rule, 21.10.2026): the third pair is free AND each paid pair gets 30 lei off,
 * so 3 pairs at 315 lei = 315 + 315 + 0 − 30 − 30 = 570 lei. The free pair never gets the 30 lei.
 *   perPairMinor  the reduction per paid pair (the Amber voucher's value);
 *   maxPairs      null: EVERY paid pair gets it (no global cap, decided 21.10.2026). The 2+1 groups: in every complete
 *                 group of 3 pairs one is free (the cheapest units), so paid = units − floor(units / 3):
 *                 1→1, 2→2, 3→2, 4→3, 5→4, 6→4, 7→5 paid pairs, each 30 lei off;
 *   audience      'voucher': only an order that uses the contact's Amber voucher (the offer the Amber landing emails
 *                 promise); 'all': every order with Amber, automatically (a live price change: needs approval).
 * In both cases the 30 lei are never given twice: with 'all', an Amber voucher adds nothing on top.
 */
export const AMBER_PAIR_DISCOUNT: { productId: ProductId; perPairMinor: number; maxPairs: number | null; audience: 'voucher' | 'all' } = {
  productId: 'ochelari-biohack',
  perPairMinor: VOUCHER_VALUE['ochelari-biohack'],
  maxPairs: null,
  audience: 'voucher',
}

/**
 * How long a voucher stays valid (approved 22.10.2026): 30 days from issue, for every source (days from issue, not
 * from opening the email). Kept per source so one can change without touching the others.
 * Note for the copy (not changed here): the landing emails say "în următoarele 7 zile"; with 30 days they understate
 * the validity, never overstate it. The other emails print the real {{voucher_expiry}}.
 */
export const VOUCHER_VALIDITY_DAYS = {
  'landing-calm': 30,
  'landing-focus': 30,
  'landing-amber': 30,
  'abandoned-cart': 30,
  'win-back': 30,
  nudge: 30,
  craciun: 30,
  'anul-nou': 30,
  review: 30,
  referral: 30,
  vip: 30,
  admin: 30,
} as const

export type VoucherSource = keyof typeof VOUCHER_VALIDITY_DAYS

export const isVoucherSource = (s: unknown): s is VoucherSource => typeof s === 'string' && s in VOUCHER_VALIDITY_DAYS

/** Gifts of the Review Video, Referral and VIP rewards: the product is free, the customer pays the delivery. */
export const GIFT_PRODUCTS = ['ochelari-biohack', 'carte-diana'] as const satisfies readonly ProductId[]
export type GiftProduct = (typeof GIFT_PRODUCTS)[number]
export const isGiftProduct = (id: string): id is GiftProduct => (GIFT_PRODUCTS as readonly string[]).includes(id)

/**
 * Delivery of an order with gift products (approved 22.10.2026): 25 lei (VAT included), ONCE per order, whatever the
 * number of gifts. Devices ship free; the book alone pays BOOK_SHIPPING_RON. An order with a gift and the book pays the
 * higher of the two fees, once (25 lei), never both: see lib/shipping.ts (to confirm before the rewards go live).
 */
export const GIFT_SHIPPING_RON = 2500

/** The friend's discount on a first order through a referral link (referral-01: "Prietenul tău primește 10% reducere"). */
export const REFERRAL_FRIEND_PERCENT = 10

/** Days after delivery before a referral or a reward counts: the 14-day right of withdrawal has passed. */
export const RETURN_WINDOW_DAYS = 14

/** VIP threshold (vip-01): valid purchases adding up to at least 6.380 lei. */
export const VIP_THRESHOLD_RON = 638000
