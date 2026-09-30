/**
 * THE ONLY PLACE PROMOTIONS ARE DEFINED. The engine (lib/promotions.ts) applies them on the server for
 * every order and in the browser only to show the same numbers. Prices come from config/prices.ts.
 *
 * Rules agreed on 29.09.2026:
 *   - 3+ eligible units (NEUROS Calm, NEUROS Focus, NEUROS Flow, any mix, any NEUROS Flow configuration):
 *     20% off those eligible units. NEUROS Amber neither counts nor is discounted by it.
 *   - NEUROS Amber 2+1 gratis: in every complete group of 3 Amber units, one is free (any frame).
 * The two apply to separate products, so one unit is never discounted twice.
 */
import type { ProductId } from '@/content/catalog'

/** How a promotion is presented: a short mark next to prices, one plain sentence where there is room. */
type Copy = { badge: string; line: string }

export type BundlePercent = Copy & {
  kind: 'bundle_percent'
  id: string
  /** Customer-facing name, stored on the order. */
  label: string
  products: ProductId[]
  minUnits: number
  /** Whole percent. */
  percent: number
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
    label: '20% la 3 produse',
    badge: '20% la 3 produse',
    line: 'NEUROS Calm, Focus sau Flow, în orice combinație. Reducerea apare în coș.',
    products: ['balance-wave', 'brainlink-pro', 'brain-flow'],
    minUnits: 3,
    percent: 20,
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
