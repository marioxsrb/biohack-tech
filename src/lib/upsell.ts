import type { UpsellCandidate } from '@/config/upsell'
import { recommend } from './recommend'

/**
 * The one product offered after an order with these products, or null. Pure: used by page and API alike.
 * The same engine as the cart and checkout suggestions (`lib/recommend.ts`), placement `post_purchase`.
 */
export function upsellFor(productIds: string[]): UpsellCandidate | null {
  const r = recommend(
    productIds.map((productId) => ({ productId, quantity: 1 })),
    'post_purchase',
  )[0]
  return r ? { productId: r.productId, reason: r.reason } : null
}
