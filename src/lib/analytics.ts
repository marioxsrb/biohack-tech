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
import { isConfigured, whenLoaded } from '@/lib/consent/vendors'

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

/** A tool the visitor allowed and that is configured (it starts on this page, if not already running). */
const ga4On = () => consentStore.allows('analytics') && isConfigured('ga4')
const metaOn = () => consentStore.allows('marketing') && isConfigured('meta')

/** True when at least one allowed tool will receive events (used to avoid marking a purchase as reported). */
export const canTrack = () => ga4On() || metaOn()

export function track(
  event: EcomEvent,
  data: { value: number; items: (Item | ResolvedLine)[]; transaction_id?: string; payment_type?: string },
) {
  if (typeof window === 'undefined' || !canTrack()) return
  const items = data.items.map((i) => ('product' in i ? lineItem(i) : i))
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void }
  if (ga4On()) {
    whenLoaded('ga4', () => w.gtag?.('event', event, {
      currency: 'RON',
      value: lei(data.value),
      ...(data.transaction_id && { transaction_id: data.transaction_id }),
      ...(data.payment_type && { payment_type: data.payment_type }),
      items,
    }))
  }
  const meta = META_EVENT[event]
  if (meta && metaOn()) {
    whenLoaded('meta', () => w.fbq?.('track', meta, { currency: 'RON', value: lei(data.value), content_type: 'product', content_ids: items.map((i) => i.item_id), content_name: [...new Set(items.map((i) => i.item_name))].join(', '), num_items: items.reduce((n, i) => n + i.quantity, 0) }, data.transaction_id ? { eventID: data.transaction_id } : undefined))
  }
}

/** Interactions around suggestions and the NEUROS Amber 2+1 picker (GA4 only, never Meta). */
export type UiEvent = 'view_cross_sell' | 'select_cross_sell' | 'add_cross_sell' | 'open_amber_bundle_configurator' | 'complete_amber_bundle_configurator' | 'open_bundle_configurator' | 'complete_bundle_configurator'
export type UiPlacement = 'cart' | 'checkout' | 'post_purchase' | 'product_page' | 'homepage'

/** Same consent rule as `track`: nothing is sent, or queued, without analytics consent and a running GA4. */
export function trackUi(event: UiEvent, params: { placement: UiPlacement; product_id?: string; variant_id?: string; items?: number }) {
  if (typeof window === 'undefined' || !ga4On()) return
  whenLoaded('ga4', () => (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', event, params))
}

/**
 * Funnel events for Meta (marketing consent and a running pixel, like everything else). `Lead` is Meta's
 * standard event and fires only after the server stored the lead, with the lead id as event id (Meta drops a
 * repeat). The others are custom: the price button, the form opened, the price shown, an order placed without
 * card payment (cash on delivery or transfer: not a Purchase until the money arrives), a visit from a recovery link.
 * No personal data is ever sent.
 */
export type FunnelEvent = 'PriceRevealClick' | 'LeadFormStart' | 'Lead' | 'PriceRevealed' | 'OrderPlaced' | 'RecoveryVisit'

export function trackFunnel(event: FunnelEvent, params: { product?: string; funnel?: 'visible_price' | 'gated_price'; value?: number; payment?: 'cod' | 'transfer' } = {}, eventId?: string) {
  if (typeof window === 'undefined' || !metaOn()) return
  const data = {
    ...(params.product && { content_ids: [params.product], content_type: 'product' }),
    ...(params.funnel && { funnel: params.funnel }),
    ...(params.value !== undefined && { currency: 'RON', value: lei(params.value) }),
    ...(params.payment && { payment_method: params.payment }),
  }
  whenLoaded('meta', () => (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.(event === 'Lead' ? 'track' : 'trackCustom', event, data, eventId ? { eventID: eventId } : undefined))
}
