/**
 * The handoff from a landing to the checkout (see `lib/purchase.ts`). Only ids travel: product,
 * variant, quantity, and the attribution parameters of the landing URL. The server resolves names
 * and prices again when the order is placed.
 */
import { cartStore } from '@/components/cart/cart-store'
import type { ProductId } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import type { LandingSlug } from '@/lib/landing-hosts'
import { encodeItem } from '@/lib/purchase'

type Pick = { productId: ProductId; variantId?: string; quantity?: number }

export function checkoutHref(slug: LandingSlug, pick: Pick, from?: { search: string; host: string }) {
  const q = from ? attributionParams(from.search) : new URLSearchParams()
  q.set('item', encodeItem(pick))
  q.set('lp', slug)
  if (from?.host) q.set('lp_host', from.host)
  return `/checkout?${q}`
}

/**
 * "Comandă" on a landing: the selection goes into the cart first (the canonical state, so the checkout
 * has it on its first render and after any reload), then the checkout opens with the same selection
 * and the campaign parameters in its URL.
 */
export function startCheckout(push: (href: string) => void, slug: LandingSlug, pick: Pick) {
  cartStore.restore([{ productId: pick.productId, variantId: pick.variantId, quantity: pick.quantity ?? 1, source: 'landing' }])
  push(checkoutHref(slug, pick, { search: window.location.search, host: window.location.host }))
}

/** Plain click only: a modified click (new tab, new window) follows the href, which carries the item. */
export const isPlainClick = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
