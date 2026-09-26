/**
 * THE ONLY PLACE PRICES LIVE.
 *
 * Amounts are in bani (1 leu = 100 bani), VAT included, as integers so money is never
 * a floating-point number. The homepage, product pages, cart, checkout, the server-side
 * order total and structured data all read from here.
 *
 * `null` means "no approved price in lei yet": the product is shown with "Preț în curând"
 * and cannot be added to the cart. No exchange rate is applied anywhere on purpose.
 * See docs/OPEN-POINTS.md.
 */
import type { ProductId } from '@/content/catalog'

export const PRICES_RON: Record<ProductId, number | null> = {
  // Source material: 1.210 EUR. Approved price in lei still to be confirmed.
  'balance-wave': null,
  // Source material: 2.490 RON.
  'brainlink-pro': 249000,
  // Source material: 60 EUR. Approved price in lei still to be confirmed.
  'ochelari-biohack': null,
}
