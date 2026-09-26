/**
 * Ecommerce events in the GA4 shape, pushed to window.dataLayer. Nothing is loaded here:
 * a tag manager (GTM / GA4 / Meta) installed later, behind cookie consent, reads the layer.
 * Until then the calls are harmless no-ops for visitors.
 *
 * `purchase` is sent only from the order page, only when the server says the order is paid,
 * and only once per order per browser.
 */
import type { ResolvedLine } from '@/components/cart/CartProvider'
import type { Product, Variant } from '@/content/catalog'

export type EcomEvent = 'view_item' | 'select_item' | 'add_to_cart' | 'view_cart' | 'begin_checkout' | 'add_payment_info' | 'purchase'

type Item = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number }

const lei = (minor: number) => Math.round(minor) / 100

export const itemOf = (p: Product, v?: Variant, variantLabel?: string, quantity = 1): Item => ({
  item_id: v ? `${p.id}/${v.id}` : p.id,
  item_name: p.name,
  ...(variantLabel && { item_variant: variantLabel }),
  price: lei(p.price ?? 0),
  quantity,
})

const lineItem = (l: ResolvedLine): Item => itemOf(l.product, l.variant, l.variantLabel, l.quantity)

export function track(
  event: EcomEvent,
  data: { value: number; items: (Item | ResolvedLine)[]; transaction_id?: string; payment_type?: string },
) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer ??= []
  w.dataLayer.push({ ecommerce: null })
  w.dataLayer.push({
    event,
    ecommerce: {
      currency: 'RON',
      value: lei(data.value),
      ...(data.transaction_id && { transaction_id: data.transaction_id }),
      ...(data.payment_type && { payment_type: data.payment_type }),
      items: data.items.map((i) => ('product' in i ? lineItem(i) : i)),
    },
  })
}
