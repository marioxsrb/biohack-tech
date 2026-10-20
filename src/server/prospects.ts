/**
 * Where a person who left an address stands, for the CRM's leads pipeline (one opportunity per address): the
 * furthest step reached across the 10% popup, the checkout and orders, or "unsubscribed" when the
 * latest marketing decision is a withdrawal. Computed from our database every time, so a resync is always right.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import type { LeadStageKey } from '@/server/integrations/ghl'

/** `products` and `valueRon`: what a customer bought (orders that stand), for the customers pipeline. */
export type Prospect = { name: string; stage: LeadStageKey; site: 'ro' | 'net'; products: string[]; valueRon: number }

const INTL_HOST = /(^|\.)biohack-tech\.net$/i

export async function prospectFor(q: Queryable, email: string, hint?: { site?: 'ro' | 'net' }): Promise<Prospect | null> {
  const addr = email.trim().toLowerCase()
  const [leadRows, popup, placed, consent] = await Promise.all([
    q.query<{ name: string | null; stage: string; landing_host: string | null }>('select name, stage, landing_host from leads where email = $1 order by created_at', [addr]),
    q.query('select 1 from welcome_signups where email = $1', [addr]),
    // Orders that stand (cash on delivery and transfer once placed, card once paid; never cancelled or refunded),
    // with the products they hold (post-purchase additions included) and their value in lei.
    q.query<{ product_id: string; value: string }>(
      `select i.product_id, (o.total_minor - o.refunded_minor) * o.fx_rate / 100.0 as value
       from orders o join order_items i on i.order_id = o.id
       where o.email = $1 and o.status in ('confirmed', 'processing', 'shipped', 'delivered', 'pending') and o.payment_status in ('paid', 'partially_refunded', 'awaiting_collection', 'awaiting_transfer')`,
      [addr],
    ),
    q.query<{ granted: boolean }>('select granted from marketing_consent_events where email = $1 order by id desc limit 1', [addr]),
  ])
  const stages = new Set(leadRows.rows.map((r) => r.stage))
  const products = [...new Set(placed.rows.map((r) => r.product_id))]
  if (!leadRows.rows.length && !popup.rows.length && !placed.rows.length) return null
  const stage: LeadStageKey =
    products.length || stages.has('ordered') || stages.has('purchased')
      ? 'ordered'
      : consent.rows[0]?.granted === false
        ? 'unsubscribed'
        : stages.has('checkout_started')
          ? 'checkout'
          : leadRows.rows.length
            ? 'lead'
            : 'popup'
  const name = leadRows.rows.map((r) => r.name?.trim()).find(Boolean) ?? addr
  const site = hint?.site ?? (leadRows.rows.some((r) => r.landing_host && INTL_HOST.test(r.landing_host)) ? 'net' : 'ro')
  // The value of each order once (the join repeats it per item).
  const { rows: totals } = await q.query<{ v: string | null }>(
    `select sum((total_minor - refunded_minor) * fx_rate) / 100.0 as v from orders where email = $1 and status in ('confirmed', 'processing', 'shipped', 'delivered', 'pending') and payment_status in ('paid', 'partially_refunded', 'awaiting_collection', 'awaiting_transfer')`,
    [addr],
  )
  return { name, stage, site, products, valueRon: Math.round(Number(totals[0]?.v ?? 0)) }
}
