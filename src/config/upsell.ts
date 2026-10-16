/**
 * THE ONLY PLACE the complementary products are configured, for every placement (cart, checkout and the
 * offer after payment, through `lib/recommend.ts`). For each product, its two complements in order;
 * a cart or order with several products merges its lists and drops what it already has. After payment the
 * customer may choose ONE of up to two products. Prices are the normal catalog prices (no upsell discount).
 *
 *   NEUROS Calm  → NEUROS Amber, NEUROS Focus
 *   NEUROS Focus → NEUROS Amber, NEUROS Calm
 *   NEUROS Amber → NEUROS Calm, NEUROS Focus
 *
 * Only products of the catalog can be suggested (NEUROS Flow was discontinued on 13.10.2026).
 */
import type { ProductId } from '@/content/catalog'

export type UpsellCandidate = { productId: ProductId; reason: string }

export const UPSELL_MAP: Record<ProductId, UpsellCandidate[]> = {
  'balance-wave': [
    { productId: 'ochelari-biohack', reason: 'După calm, NEUROS Amber face lumina ecranelor mai blândă, ca seara să se așeze mai ușor.' },
    { productId: 'brainlink-pro', reason: 'NEUROS Focus te ajută să ai mai multă concentrare ziua, după ce seara te-ai liniștit.' },
  ],
  'brainlink-pro': [
    { productId: 'ochelari-biohack', reason: 'Între sesiunile de focus, NEUROS Amber te ajută să stai la ecran cu o lumină mai blândă.' },
    { productId: 'balance-wave', reason: 'NEUROS Calm te ajută să lași ziua în urmă, în câteva minute de liniște.' },
  ],
  'ochelari-biohack': [
    { productId: 'balance-wave', reason: 'NEUROS Calm te ajută să treci seara spre un somn mai lin, în câteva minute.' },
    { productId: 'brainlink-pro', reason: 'NEUROS Focus te ajută să-ți aduni atenția, prin jocuri scurte pe tabletă.' },
  ],
}

/** How long after the payment the offer (and the card kept for it) stays available. */
export const UPSELL_WINDOW_MINUTES = 30
