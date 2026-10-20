/**
 * THE ONLY PLACE PRICES LIVE.
 *
 * Amounts are in bani (1 leu = 100 bani), VAT included, as integers so money is never a
 * floating-point number. Homepage, product pages, cart, checkout, the server-side order
 * total, Stripe, FGO invoice lines, GoHighLevel values and structured data all read from here.
 *
 * `null` would mean "no approved price in lei": the product shows "Preț în curând" and
 * cannot be bought. A per-variant table prices each configuration; the product shows "de la"
 * the lowest one, and the server always charges the price of the chosen variant.
 * No exchange rate is applied anywhere.
 */
import type { ProductId } from '@/content/catalog'

/** One price for the product, or one per variant id (products whose configurations cost differently). */
export type PriceEntry = number | null | Readonly<Record<string, number | null>>

export const PRICES_RON: Record<ProductId, PriceEntry> = {
  // NEUROS Calm. Approved 26.09.2026: 6.380 lei.
  'balance-wave': 638000,
  // NEUROS Focus. Confirmed 20.10.2026: 3.225 lei, 21% VAT included, with the tablet, the 10 games and 20 free sessions included.
  // A list price, not a reduction: no comparison price is shown (earlier lists were 790 lei, then 1.800 lei, then 3.337 lei).
  'brainlink-pro': 322500,
  // NEUROS Amber, all five frames. Approved 26.09.2026: 315 lei. (The red lens and the pachet were withdrawn on 20.10.2026.)
  'ochelari-biohack': 31500,
  // NEUROS Flow was discontinued on 13.10.2026: no price, so it can never be charged.
  // Diana L. Palotaș's book, print edition + PDF. Set 16.10.2026: 120 lei with 21% VAT (base 99,17 lei + VAT 20,83 lei).
  'carte-diana': 12000,
}

/**
 * Delivery: free for every order, except an order that contains the book: then a flat 10 lei + 21% VAT = 12,10 lei,
 * once per order, whatever the quantities (NEUROS's book shipping, 16.10.2026). Never discounted by a promotion or a
 * promo code. Applied by lib/shipping.ts on the server and in the browser alike.
 */
export const BOOK_SHIPPING_RON = 1210
