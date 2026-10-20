/**
 * The quantity-discount picker, without UI. The discount is counted per product (config/promotions.ts):
 * 2 units of the same product get 10%, 3 or more get 20%, on that product only. So the picker asks for
 * one product (with its configuration, if it has one) and how many; units already in the cart count too.
 * Totals come from the promotion engine. Nothing is chosen for the customer.
 */
import { PROMOTIONS, type BundlePercent } from '@/config/promotions'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import { groupId, priceLines, tierFor } from './promotions'
import { convertUnit, type Currency } from './currency'

export const BUNDLE = PROMOTIONS.find((p): p is BundlePercent => p.kind === 'bundle_percent')!

export type BundlePick = { productId: ProductId | null; variantId: string | null; quantity: number }

const isEligible = (id: string) => (BUNDLE.products as string[]).includes(id)

/** Units of one product already in the cart (every configuration counts). */
export const unitsInCart = (cart: { productId: string; quantity: number }[], productId: string | null) =>
  productId ? cart.filter((l) => l.productId === productId).reduce((n, l) => n + l.quantity, 0) : 0

/** A pick is complete when its product is eligible, priced, and for a product with configurations one is chosen. */
export function pickComplete(p: BundlePick) {
  if (!p.productId || !isEligible(p.productId) || p.quantity < 1) return false
  const product = getProduct(p.productId)
  if (!product) return false
  if (product.variants?.length) return !!p.variantId && product.variants.some((v) => v.id === p.variantId) && unitPrice(product, product.variants.find((v) => v.id === p.variantId)) !== null
  return !p.variantId && unitPrice(product) !== null
}

/** The pick → cart lines, or null while it is incomplete. */
export function bundleToLines(p: BundlePick) {
  if (!pickComplete(p)) return null
  return [{ productId: p.productId!, ...(p.variantId && { variantId: p.variantId }), quantity: p.quantity }]
}

const priceOf = (productId: string, variantId: string | null | undefined, currency: Currency) => {
  const p = getProduct(productId)
  return p ? convertUnit(unitPrice(p, p.variants?.find((v) => v.id === variantId)) ?? 0, currency) : 0
}

/** Totals for the chosen product after adding the pick to what the cart already has of it (promotion engine). */
export function bundleTotals(cart: { productId: string; variantId?: string; quantity: number }[], pick: BundlePick, currency: Currency = 'RON') {
  const lines = [
    ...cart.filter((l) => l.productId === pick.productId).map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity })),
    ...(pickComplete(pick) ? [{ productId: pick.productId!, variantId: pick.variantId, quantity: pick.quantity }] : []),
  ]
  const r = priceLines(lines.map((l, i) => ({ key: `${l.productId}:${l.variantId ?? ''}:${i}`, productId: l.productId, variantId: l.variantId ?? undefined, quantity: l.quantity, unitAmount: priceOf(l.productId, l.variantId, currency) })))
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const discountMinor = pick.productId ? (r.promotions.find((a) => a.id === groupId(BUNDLE.id, pick.productId!))?.amountMinor ?? 0) : 0
  return { subtotalMinor: r.subtotalMinor, discountMinor, totalMinor: r.subtotalMinor - discountMinor, units, percent: tierFor(BUNDLE, units)?.percent ?? 0 }
}
