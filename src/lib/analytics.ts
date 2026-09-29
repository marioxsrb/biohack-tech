/**
 * Ecommerce events (GA4 names), sent only to tools the visitor allowed and that are running:
 * Google Analytics 4 with analytics consent, Meta Pixel with marketing consent. Without consent,
 * or without configured tools, every call does nothing: nothing is queued for later either.
 *
 * Events carry products and amounts only, never contact details. `purchase` is sent only from the
 * order page, only when the server says the order is paid, and only once per order per browser.
 */
import type { ResolvedLine } from '@/components/cart/CartProvider'
import { lineRef, unitPrice, type Product, type Variant } from '@/content/catalog'
import { consentStore } from '@/lib/consent/store'
import { isLoaded } from '@/lib/consent/vendors'

export type EcomEvent = 'view_item' | 'select_item' | 'select_variant' | 'add_to_cart' | 'view_cart' | 'begin_checkout' | 'add_payment_info' | 'purchase'

type Item = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number }

const lei = (minor: number) => Math.round(minor) / 100

export const itemOf = (p: Product, v?: Variant, variantLabel?: string, quantity = 1): Item => ({
  item_id: lineRef(p.id, v?.id),
  item_name: p.name,
  ...(variantLabel && { item_variant: variantLabel }),
  price: lei(unitPrice(p, v) ?? p.price ?? 0),
  quantity,
})

const lineItem = (l: ResolvedLine): Item => itemOf(l.product, l.variant, l.variantLabel, l.quantity)

const META_EVENT: Partial<Record<EcomEvent, string>> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
}

/** True when at least one running tool may receive events (used to avoid marking a purchase as reported). */
export const canTrack = () => (consentStore.allows('analytics') && isLoaded('ga4')) || (consentStore.allows('marketing') && isLoaded('meta'))

export function track(
  event: EcomEvent,
  data: { value: number; items: (Item | ResolvedLine)[]; transaction_id?: string; payment_type?: string },
) {
  if (typeof window === 'undefined' || !canTrack()) return
  const items = data.items.map((i) => ('product' in i ? lineItem(i) : i))
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void }
  if (consentStore.allows('analytics') && isLoaded('ga4')) {
    w.gtag?.('event', event, {
      currency: 'RON',
      value: lei(data.value),
      ...(data.transaction_id && { transaction_id: data.transaction_id }),
      ...(data.payment_type && { payment_type: data.payment_type }),
      items,
    })
  }
  const meta = META_EVENT[event]
  if (meta && consentStore.allows('marketing') && isLoaded('meta')) {
    w.fbq?.('track', meta, { currency: 'RON', value: lei(data.value), content_type: 'product', content_ids: items.map((i) => i.item_id), num_items: items.reduce((n, i) => n + i.quantity, 0) }, data.transaction_id ? { eventID: data.transaction_id } : undefined)
  }
}

/** Interactions around suggestions and the NEUROS Amber 2+1 picker (GA4 only, never Meta). */
export type UiEvent = 'view_cross_sell' | 'select_cross_sell' | 'add_cross_sell' | 'open_amber_bundle_configurator' | 'complete_amber_bundle_configurator'
export type UiPlacement = 'cart' | 'checkout' | 'post_purchase' | 'product_page' | 'homepage'

/** Same consent rule as `track`: nothing is sent, or queued, without analytics consent and a running GA4. */
export function trackUi(event: UiEvent, params: { placement: UiPlacement; product_id?: string; variant_id?: string; items?: number }) {
  if (typeof window === 'undefined' || !consentStore.allows('analytics') || !isLoaded('ga4')) return
  ;(window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', event, params)
}
