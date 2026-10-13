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
    { productId: 'ochelari-biohack', reason: 'Seara, după ședința cu NEUROS Calm, ochelarii NEUROS Amber filtrează lumina albastră a ecranelor.' },
    { productId: 'brainlink-pro', reason: 'NEUROS Focus completează relaxarea cu antrenamentul atenției, prin jocuri pe tabletă.' },
  ],
  'brainlink-pro': [
    { productId: 'ochelari-biohack', reason: 'Pentru orele de lucru la ecran dintre sesiunile cu NEUROS Focus.' },
    { productId: 'balance-wave', reason: 'NEUROS Calm completează antrenamentul atenției cu câteva minute de relaxare.' },
  ],
  'ochelari-biohack': [
    { productId: 'balance-wave', reason: 'Câteva minute de relaxare seara, cu NEUROS Calm purtat la gât.' },
    { productId: 'brainlink-pro', reason: 'Antrenează-ți atenția prin jocuri pe tabletă, cu NEUROS Focus.' },
  ],
}

/** How long after the payment the offer (and the card kept for it) stays available. */
export const UPSELL_WINDOW_MINUTES = 30
