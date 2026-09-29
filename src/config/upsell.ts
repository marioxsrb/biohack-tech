/**
 * THE ONLY PLACE the post-purchase offer is configured. After a confirmed card payment the customer may
 * see ONE optional offer: the first product in the list for what they bought that is not already in the
 * order. Prices are the normal catalog prices (no special upsell discount exists).
 *
 * Why these pairs: Amber is the everyday screen companion to any device and the natural small addition;
 * Calm and Focus complement each other (relaxation / attention). Brain Flow is never offered after a
 * purchase: it is chosen with a specialist, not in one click.
 */
import type { ProductId } from '@/content/catalog'

export type UpsellCandidate = { productId: ProductId; reason: string }

export const UPSELL_MAP: Record<ProductId, UpsellCandidate[]> = {
  'balance-wave': [
    { productId: 'ochelari-biohack', reason: 'Seara, după ședința cu NEUROS Calm, ecranele rămân mai blânde cu ochelarii NEUROS Amber.' },
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
  'brain-flow': [
    { productId: 'ochelari-biohack', reason: 'Pentru serile cu ecrane, o pereche NEUROS Amber completează rutina de acasă.' },
    { productId: 'balance-wave', reason: 'NEUROS Calm adaugă câteva minute de relaxare, purtat la gât.' },
  ],
}

/** How long after the payment the offer (and the card kept for it) stays available. */
export const UPSELL_WINDOW_MINUTES = 30
