/**
 * THE ONLY PLACE PROMOTIONS ARE DEFINED. The engine (lib/promotions.ts) applies them on the server for
 * every order and in the browser only to show the same numbers. Prices come from config/prices.ts.
 *
 * Rules (changed 09.10.2026):
 *   - Quantity discount, counted PER PRODUCT: 2 units of the same product (NEUROS Calm, NEUROS Focus or
 *     NEUROS Flow) get 10% off those 2 units, 3 or more get 20% off those units. Different products never
 *     add up (1 Calm + 1 Focus gets nothing), and the discount never touches the rest of the order.
 *     NEUROS Flow counts as one product whatever the configuration. NEUROS Amber has its own offer.
 *   - NEUROS Amber 2+1 gratis: in every complete group of 3 Amber units, one is free (any frame).
 * The two apply to separate products, so one unit is never discounted twice.
 */
import type { ProductId } from '@/content/catalog'
import type { Locale } from '@/i18n/locales'

/** How a promotion is presented: a short mark next to prices, one plain sentence where there is room. */
type Copy = { badge: string; line: string }

/** One step of a percentage bundle: from `minUnits` eligible units, `percent` (whole) off all of them. */
export type BundleTier = {
  minUnits: number
  percent: number
  /** Customer-facing name of this step, stored on the order. */
  label: string
}

export type BundlePercent = Copy & {
  kind: 'bundle_percent'
  id: string
  /** Name of the offer as a whole (the order stores the label of the tier that applied). */
  label: string
  products: ProductId[]
  /** Ascending by minUnits; per product, the highest tier its units reach applies, never two at once. */
  tiers: BundleTier[]
}

export type BuyXGetY = Copy & {
  kind: 'buy_x_get_y'
  id: string
  label: string
  products: ProductId[]
  /** Pay for `pay` units in every group of `group`. */
  group: number
  pay: number
}

export type Promotion = BundlePercent | BuyXGetY

export const PROMOTIONS: Promotion[] = [
  {
    kind: 'bundle_percent',
    id: 'trei-produse-20',
    label: '10% la 2 bucăți, 20% la 3 bucăți',
    badge: 'Până la 20% reducere',
    line: 'Iei 2 bucăți din același produs: 10% reducere la ele. Iei 3: 20%. Reducerea apare în coș.',
    products: ['balance-wave', 'brainlink-pro', 'brain-flow'],
    tiers: [
      { minUnits: 2, percent: 10, label: '10% la 2 bucăți' },
      { minUnits: 3, percent: 20, label: '20% la 3 bucăți' },
    ],
  },
  {
    kind: 'buy_x_get_y',
    id: 'amber-2-plus-1',
    label: 'NEUROS Amber 2+1 gratis',
    badge: '2+1 gratis',
    line: 'La fiecare 3 perechi NEUROS Amber, una este gratuită. Poți combina ramele.',
    products: ['ochelari-biohack'],
    group: 3,
    pay: 2,
  },
]

/**
 * English for the /en site. Orders keep the Romanian labels above; these only change what a visitor reads.
 * Keyed by the Romanian label, so a label taken from a computed price (a tier) translates too.
 */
const EN: Record<string, string> = {
  '10% la 2 bucăți, 20% la 3 bucăți': '10% off 2 units, 20% off 3',
  '10% la 2 bucăți': '10% off 2 units',
  '20% la 3 bucăți': '20% off 3 units',
  'Până la 20% reducere': 'Up to 20% off',
  'Iei 2 bucăți din același produs: 10% reducere la ele. Iei 3: 20%. Reducerea apare în coș.': 'Take 2 of the same product: 10% off those two. Take 3: 20%. The discount shows in the cart.',
  'NEUROS Amber 2+1 gratis': 'NEUROS Amber 3 for 2',
  '2+1 gratis': '3 for 2',
  'La fiecare 3 perechi NEUROS Amber, una este gratuită. Poți combina ramele.': 'In every 3 pairs of NEUROS Amber, one is free. You can mix the frames.',
}

/** A promotion text (label, badge, line, tier label) in the visitor's language. */
export const promoText = (ro: string, locale: Locale = 'ro'): string => {
  if (locale !== 'en') return ro
  if (EN[ro]) return EN[ro]
  // An applied per-product label: "20% la 3 bucăți NEUROS Calm" → "20% off 3 units, NEUROS Calm".
  const m = ro.match(/^(\d+% la \d+ bucăți) (.+)$/)
  return m && EN[m[1]] ? `${EN[m[1]]}, ${m[2]}` : ro
}
