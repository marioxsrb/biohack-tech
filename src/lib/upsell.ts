import type { UpsellCandidate } from '@/config/upsell'
import { recommend } from './recommend'

/**
 * The products offered after an order with these products (at most two, the customer chooses one), or
 * an empty list. Pure: used by page and API alike. The same engine as the cart and checkout suggestions
 * (`lib/recommend.ts`), placement `post_purchase`: complementary products only, no promotion completion.
 */
export function upsellsFor(productIds: string[]): UpsellCandidate[] {
  return recommend(
    productIds.map((productId) => ({ productId, quantity: 1 })),
    'post_purchase',
  ).map((r) => ({ productId: r.productId, reason: r.reason }))
}
