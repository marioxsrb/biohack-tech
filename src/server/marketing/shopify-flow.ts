/**
 * Shopify (biohack-tech.ro) → GoHighLevel, through Shopify Flow ("Send HTTP request" → /api/webhooks/shopify-flow),
 * instead of GHL's own Shopify integration, which (audit 07.11.2026) started the abandoned-cart emails for people who
 * had already ordered, missed real abandoned checkouts and stopped syncing the newsletter tag after 1 November.
 *
 * - abandoned  ("Customer abandons checkout": Shopify fires it only for a checkout that was not completed): the cart
 *   goes into the contact's bt_checkout_url / bt_cart_items / bt_product_name (what the emails of
 *   "BT · S01 · Abandoned Checkout Shopify" read), then the tag bt-abandon-shopify starts that workflow again.
 * - subscribed ("Customer subscribed to email marketing", popup or newsletter): the contact gets shopify_newsletter,
 *   which starts "BT · S03 · Welcome Shopify (newsletter)" once (an address that already has it is left alone), and
 *   shopify_popup-bf-2026 when the signup came from the Black Friday popup.
 * Contacts are created or updated by email in the Biohack sub-account (GHL_LOCATION_ID).
 */
import 'server-only'
import type { GhlConfig } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'

export const SHOPIFY_FLOW_TAGS = {
  abandoned: 'bt-abandon-shopify',
  newsletter: 'shopify_newsletter',
  popup: 'shopify_popup-bf-2026',
} as const
export const SHOPIFY_FLOW_FIELDS = { checkoutUrl: 'bt_checkout_url', cartItems: 'bt_cart_items', productName: 'bt_product_name' } as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export type FlowItem = { title: string; qty: number }
export type FlowEvent =
  | { type: 'abandoned'; email: string; name: string | null; phone: string | null; checkoutUrl: string; items: FlowItem[] }
  | { type: 'subscribed'; email: string; name: string | null; phone: string | null; popup: boolean }

/** "Calm x1, Amber x2" or [{title, qty}] (Flow's Liquid can send either); empty titles dropped. */
function parseItems(v: unknown): FlowItem[] {
  const list: FlowItem[] = []
  if (Array.isArray(v)) {
    for (const x of v.slice(0, 20)) {
      const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
      const title = text(o.title, 120)
      if (title) list.push({ title, qty: Math.max(1, Math.min(99, Math.round(Number(o.qty ?? o.quantity) || 1))) })
    }
  } else if (typeof v === 'string') {
    for (const part of v.split(/[,;\n]/).slice(0, 20)) {
      const m = part.trim().match(/^(.*?)(?:\s*[x×]\s*(\d+))?$/i)
      const title = text(m?.[1], 120)
      if (title) list.push({ title, qty: Math.max(1, Math.min(99, Number(m?.[2]) || 1)) })
    }
  }
  return list
}

/** The Flow's JSON, checked; null when it cannot be used (no valid email, unknown type, no cart link). */
export function parseFlowEvent(body: Record<string, unknown>): FlowEvent | null {
  const email = text(body.email, 254).toLowerCase()
  if (!EMAIL.test(email)) return null
  const name = [text(body.firstName, 60), text(body.lastName, 60)].filter(Boolean).join(' ') || null
  const phone = text(body.phone, 30) || null
  if (body.type === 'abandoned') {
    const checkoutUrl = text(body.checkoutUrl, 1000)
    if (!/^https:\/\/[^\s]+$/.test(checkoutUrl)) return null
    return { type: 'abandoned', email, name, phone, checkoutUrl, items: parseItems(body.items) }
  }
  if (body.type === 'subscribed') {
    const tags = text(body.tags, 1000).toLowerCase()
    return { type: 'subscribed', email, name, phone, popup: /(^|[,\s])popup-bf-2026($|[,\s])/.test(tags) }
  }
  return null
}

/** Abandoned-cart products as the emails show them ("NEUROS Calm x1, NEUROS Amber x2") and the first product. */
export const cartLabel = (items: FlowItem[]) => items.map((i) => `${i.title} x${i.qty}`).join(', ')

export type FlowResult = { contactId: string; action: 'abandoned' | 'subscribed' | 'already_subscribed' }

export async function applyFlowEvent(c: GhlConfig, e: FlowEvent): Promise<FlowResult> {
  const known = await ghl.contactsByEmail(c, e.email)
  const existing = known[0] ?? null
  const contactId = await ghl.upsertLeadContact(c, { name: e.name, email: e.email, phone: e.phone }, existing?.id ?? null)
  if (e.type === 'abandoned') {
    // The emails read these fields, so they are written before the tag that starts the workflow.
    await ghl.updateFields(c, contactId, [
      { key: SHOPIFY_FLOW_FIELDS.checkoutUrl, field_value: e.checkoutUrl },
      { key: SHOPIFY_FLOW_FIELDS.cartItems, field_value: cartLabel(e.items) },
      { key: SHOPIFY_FLOW_FIELDS.productName, field_value: e.items[0]?.title ?? '' },
    ])
    // GHL fires "tag added" only when the tag was absent: a new abandoned checkout starts the workflow again.
    await ghl.removeTags(c, contactId, [SHOPIFY_FLOW_TAGS.abandoned])
    await ghl.addTags(c, contactId, [SHOPIFY_FLOW_TAGS.abandoned])
    return { contactId, action: 'abandoned' }
  }
  const had = existing?.tags.includes(SHOPIFY_FLOW_TAGS.newsletter) ?? false
  const tags = [...(had ? [] : [SHOPIFY_FLOW_TAGS.newsletter]), ...(e.popup ? [SHOPIFY_FLOW_TAGS.popup] : [])]
  await ghl.addTags(c, contactId, tags)
  return { contactId, action: had ? 'already_subscribed' : 'subscribed' }
}
