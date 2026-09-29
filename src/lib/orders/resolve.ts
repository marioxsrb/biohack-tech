/**
 * Turns what the browser sent (product id, variant id, quantity) into priced order lines.
 * Names, variants and prices come from the catalog only. Anything unknown, unpriced or
 * out of range rejects the whole order, so the customer never pays for a cart they didn't see.
 */
import { lineKey, MAX_QTY } from '@/components/cart/cart-store'
import { resolveLine, variantLabel } from '@/content/catalog'
import { priceLines, type AppliedPromotion } from '@/lib/promotions'

export type OrderLine = {
  /** Cart line key, so paid lines can be removed from the cart afterwards. */
  key: string
  productId: string
  variantId?: string
  name: string
  description?: string
  quantity: number
  /** Unit price in bani. */
  unitAmount: number
  /** This line's share of the order's promotions, in bani (0 when none applies). */
  discountMinor: number
  /** The promotion that discounted this line, if any. */
  promotionId?: string
}

export type ResolvedOrder =
  | { ok: true; lines: OrderLine[]; subtotal: number; discount: number; total: number; promotions: AppliedPromotion[] }
  | { ok: false; reason: 'EMPTY' | 'BAD_LINE' }

export const MAX_LINES = 20

export function resolveOrderLines(raw: unknown): ResolvedOrder {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'EMPTY' }
  if (raw.length > MAX_LINES) return { ok: false, reason: 'BAD_LINE' }

  const byKey = new Map<string, OrderLine>()
  for (const item of raw) {
    const { productId, variantId, quantity } = (item ?? {}) as Record<string, unknown>
    if (typeof productId !== 'string') return { ok: false, reason: 'BAD_LINE' }
    const v = typeof variantId === 'string' && variantId ? variantId : undefined
    const r = resolveLine(productId, v)
    const q = Number(quantity)
    if (!r || r.unit === null || !Number.isInteger(q) || q < 1 || q > MAX_QTY) return { ok: false, reason: 'BAD_LINE' }

    const key = lineKey({ productId: r.product.id, variantId: r.variant?.id })
    const prev = byKey.get(key)
    const quantityTotal = (prev?.quantity ?? 0) + q
    if (quantityTotal > MAX_QTY) return { ok: false, reason: 'BAD_LINE' }
    byKey.set(key, {
      key,
      productId: r.product.id,
      variantId: r.variant?.id,
      name: r.product.name,
      description: r.variant ? variantLabel(r.product, r.variant) : undefined,
      quantity: quantityTotal,
      unitAmount: r.unit,
      discountMinor: 0,
    })
  }

  // Promotions are computed here, from the lines just priced; nothing about discounts comes from the browser.
  const priced = [...byKey.values()]
  const p = priceLines(priced)
  const lines = priced.map((l) => ({ ...l, discountMinor: p.lineDiscounts[l.key] ?? 0, promotionId: p.linePromotion[l.key] }))
  return { ok: true, lines, subtotal: p.subtotalMinor, discount: p.discountMinor, total: p.totalMinor, promotions: p.promotions }
}
