import { UPSELL_MAP, type UpsellCandidate } from '@/config/upsell'
import type { ProductId } from '@/content/catalog'

/** The one product offered after an order with these products, or null. Pure: used by page and API alike. */
export function upsellFor(productIds: string[]): UpsellCandidate | null {
  const bought = new Set(productIds)
  for (const id of productIds) {
    const hit = (UPSELL_MAP[id as ProductId] ?? []).find((c) => !bought.has(c.productId))
    if (hit) return hit
  }
  return null
}
