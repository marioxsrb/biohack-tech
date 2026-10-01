/**
 * The 20% for 3 products picker, without UI: which products count (from config/promotions.ts), how many
 * the cart still needs, the lines a set of picks becomes, and the totals from the promotion engine.
 * NEUROS Flow counts only with a configuration; nothing is chosen for the customer.
 */
import { PROMOTIONS, type BundlePercent } from '@/config/promotions'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import { priceLines, tierFor, topTier } from './promotions'

export const BUNDLE = PROMOTIONS.find((p): p is BundlePercent => p.kind === 'bundle_percent')!

export type BundlePick = { productId: ProductId | null; variantId: string | null }

const isEligible = (id: string) => (BUNDLE.products as string[]).includes(id)

/** Eligible units already in the cart, and how many more the 20% needs (0 once it applies). */
export function bundleNeeds(cart: { productId: string; quantity: number }[]) {
  const units = cart.filter((l) => isEligible(l.productId)).reduce((n, l) => n + l.quantity, 0)
  return { units, missing: Math.max(0, topTier(BUNDLE).minUnits - units) }
}

/** A pick is complete when its product is eligible and, for a product with configurations, one is chosen. */
export function pickComplete(p: BundlePick) {
  if (!p.productId || !isEligible(p.productId)) return false
  const product = getProduct(p.productId)
  if (!product) return false
  if (product.variants?.length) return !!p.variantId && product.variants.some((v) => v.id === p.variantId) && unitPrice(product, product.variants.find((v) => v.id === p.variantId)) !== null
  return !p.variantId && unitPrice(product) !== null
}

/** Picks → cart lines (identical picks merged), or null while any pick is incomplete. */
export function bundleToLines(picks: BundlePick[]) {
  if (!picks.length || !picks.every(pickComplete)) return null
  const by = new Map<string, { productId: ProductId; variantId?: string; quantity: number }>()
  for (const p of picks) {
    const key = `${p.productId}:${p.variantId ?? ''}`
    const prev = by.get(key)
    by.set(key, { productId: p.productId!, ...(p.variantId && { variantId: p.variantId }), quantity: (prev?.quantity ?? 0) + 1 })
  }
  return [...by.values()]
}

const priceOf = (productId: string, variantId?: string | null) => {
  const p = getProduct(productId)
  return p ? (unitPrice(p, p.variants?.find((v) => v.id === variantId)) ?? 0) : 0
}

/** Totals for the eligible products after adding the picks to what the cart already has (promotion engine). */
export function bundleTotals(cart: { productId: string; variantId?: string; quantity: number }[], picks: BundlePick[]) {
  const lines = [
    ...cart.filter((l) => isEligible(l.productId)).map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity })),
    ...picks.filter(pickComplete).map((p) => ({ productId: p.productId!, variantId: p.variantId, quantity: 1 })),
  ]
  const r = priceLines(lines.map((l, i) => ({ key: `${l.productId}:${l.variantId ?? ''}:${i}`, productId: l.productId, quantity: l.quantity, unitAmount: priceOf(l.productId, l.variantId) })))
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const percent = (tierFor(BUNDLE, units) ?? topTier(BUNDLE)).percent
  return { subtotalMinor: r.subtotalMinor, discountMinor: r.discountMinor, totalMinor: r.totalMinor, units, percent }
}
