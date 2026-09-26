/**
 * THE ONLY PLACE PRICES LIVE.
 *
 * Amounts are in bani (1 leu = 100 bani), VAT included, as integers so money is never a
 * floating-point number. Homepage, product pages, cart, checkout, the server-side order
 * total, Stripe, FGO invoice lines, GoHighLevel values and structured data all read from here.
 *
 * `null` would mean "no approved price in lei": the product shows "Preț în curând" and
 * cannot be bought. No exchange rate is applied anywhere.
 */
import type { ProductId } from '@/content/catalog'

export const PRICES_RON: Record<ProductId, number | null> = {
  // NEUROS Calm. Approved 26.09.2026: 6.380 lei.
  'balance-wave': 638000,
  // NEUROS Focus. Source material: 2.490 RON (the only price given in lei in the source).
  'brainlink-pro': 249000,
  // NEUROS Amber, all four frames. Approved 26.09.2026: 315 lei.
  'ochelari-biohack': 31500,
}
