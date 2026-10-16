/**
 * The admin's live sales feed (KA-CHING in the browser): new orders as they are PLACED, read from the canonical
 * order history (order_events), never from a parallel list. An order is placed when it stands as a sale:
 *   - bank transfer and cash on delivery: when the order is created (paid or not);
 *   - card (checkout and post-purchase offer): when Stripe confirms the payment (before that it is only an attempt).
 * Not news: checkouts started, abandoned carts, failed card attempts, later payments of a transfer or a collection,
 * status changes, repeated webhooks (a payment is confirmed once per order). The cursor is the event id (primary
 * key), so each poll is a short index range scan. Without a cursor (first connection) only the cursor is returned:
 * old orders never ring.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import { orders } from '@/server/orders/repository'

export type SaleAlert = {
  eventId: number
  orderId: string
  number: string
  at: string
  items: string
  total: number
  currency: string
  totalLei: number
  paymentMethod: 'card' | 'bank_transfer' | 'cash_on_delivery'
  kind: 'checkout' | 'upsell'
  href: string
}

const PLACED = `((e.type = 'order.created' and o.payment_method <> 'card') or (e.type = 'payment.confirmed' and o.payment_method = 'card'))`

export async function salesFeed(q: Queryable, after: number | null, limit = 20): Promise<{ cursor: number; now: string; sales: SaleAlert[] }> {
  // The newest event first, so the window is closed: what arrives during this call is read by the next poll.
  const { rows: top } = await q.query<{ id: string | null }>('select max(id)::text as id from order_events')
  const max = Number(top[0]?.id ?? 0)
  const now = new Date().toISOString()
  if (after === null || after > max) return { cursor: max, now, sales: [] }
  const { rows } = await q.query<{ event_id: string; order_id: string; at: string }>(
    `select e.id::text as event_id, e.order_id, e.created_at as at from order_events e join orders o on o.id = e.order_id
     where e.id > $1 and e.id <= $2 and ${PLACED} order by e.id limit $3`,
    [after, max, limit],
  )
  const sales: SaleAlert[] = []
  for (const r of rows) {
    const o = await orders.byId(q, r.order_id)
    if (!o) continue
    sales.push({
      eventId: Number(r.event_id),
      orderId: o.id,
      number: o.orderNumber,
      at: new Date(r.at).toISOString(),
      items: o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', '),
      total: o.totalMinor / 100,
      currency: o.currency,
      totalLei: Math.round(o.totalMinor * o.fxRate) / 100,
      paymentMethod: o.paymentMethod,
      kind: o.kind,
      href: `/admin/orders/${o.id}`,
    })
  }
  // A full page: continue after its last row next time; otherwise everything up to `max` has been read.
  const cursor = rows.length === limit ? Number(rows[rows.length - 1].event_id) : max
  return { cursor, now, sales }
}
