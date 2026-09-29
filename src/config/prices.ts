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
  // NEUROS Focus. Source material: 2.490 RON (the only price given in lei in the source).
  'brainlink-pro': 249000,
  // NEUROS Amber, all four frames. Approved 26.09.2026: 315 lei.
  'ochelari-biohack': 31500,
  // NEUROS Flow, per configuration. Source: the product page of the previous site (docs/audit.md in
  // neuros-ecom, rebuild 2d1eae6): 12.900 / 14.900 / 13.900 lei. 13 zones costing less than 4 zones is
  // how the source lists it; not yet confirmed by the business (docs/OPEN-POINTS.md, NEEDS BUSINESS INPUT).
  'brain-flow': { '1-zona': 1290000, '4-zone': 1490000, '13-zone': 1390000 },
}
