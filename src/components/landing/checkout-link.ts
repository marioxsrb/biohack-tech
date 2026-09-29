/**
 * The link from a landing to the checkout. Only ids travel: product, variant, and the attribution
 * parameters of the landing URL. The server resolves names and prices again when the order is placed.
 */
import { attributionParams } from '@/lib/attribution'
import type { LandingSlug } from '@/lib/landing-hosts'

export function checkoutHref(slug: LandingSlug, productId: string, variantId?: string, from?: { search: string; host: string }) {
  const q = from ? attributionParams(from.search) : new URLSearchParams()
  q.set('item', variantId ? `${productId}:${variantId}` : productId)
  q.set('lp', slug)
  if (from?.host) q.set('lp_host', from.host)
  return `/checkout?${q}`
}
