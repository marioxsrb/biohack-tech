/**
 * The handoff from a landing to the checkout (see `lib/purchase.ts`). Only ids travel: product,
 * variant, quantity per line, and the attribution parameters of the landing URL. The server resolves
 * names and prices again when the order is placed.
 */
import { cartStore } from '@/components/cart/cart-store'
import type { ProductId } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import type { LandingSlug } from '@/lib/landing-hosts'
import { encodeItem } from '@/lib/purchase'

export type Pick = { productId: ProductId; variantId?: string; quantity?: number }

/** One `item` parameter per line, so a mixed selection (frame A × 1, frame B × 2) stays mixed. */
export function checkoutHref(slug: LandingSlug, picks: Pick | Pick[], from?: { search: string; host: string }) {
  const q = from ? attributionParams(from.search) : new URLSearchParams()
  for (const p of Array.isArray(picks) ? picks : [picks]) q.append('item', encodeItem(p))
  q.set('lp', slug)
  if (from?.host) q.set('lp_host', from.host)
  return `/checkout?${q}`
}

/**
 * "Comandă" on a landing: the selection goes into the cart first (the canonical state, so the checkout
 * has it on its first render and after any reload), then the checkout opens with the same selection
 * and the campaign parameters in its URL.
 *
 * One product (Calm, Focus, a NEUROS Flow configuration): the line is made sure to be there, never
 * doubled. A built selection (`exact`, NEUROS Amber frames): each chosen line gets exactly the chosen
 * quantity, as the customer saw it on the landing.
 */
export function startCheckout(push: (href: string) => void, slug: LandingSlug, picks: Pick | Pick[], { exact = false } = {}) {
  const list = (Array.isArray(picks) ? picks : [picks]).map((p) => ({ productId: p.productId, variantId: p.variantId, quantity: p.quantity ?? 1, source: 'landing' as const }))
  if (exact) cartStore.put(list)
  else cartStore.restore(list)
  push(checkoutHref(slug, picks, { search: window.location.search, host: window.location.host }))
}

/** Plain click only: a modified click (new tab, new window) follows the href, which carries the items. */
export const isPlainClick = (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
