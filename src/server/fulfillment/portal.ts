/**
 * The fulfillment portal's view of the orders: the queues a warehouse works through, from the canonical order state
 * (state.ts) and the portal's own marks (prepared_at, an AWB noted before pick-up, fulfillment_issue). No status of
 * its own. What it shows is what packing needs: no order values, except the cash the courier collects.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import type { Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { awaitsTeam, canFulfil } from '@/server/orders/state'

export const PORTAL_QUEUES = {
  noi: 'Comenzi noi',
  pregatire: 'De pregătit',
  pregatite: 'Pregătite',
  expediere: 'De expediat',
  expediate: 'Expediate',
  livrate: 'Livrate',
  probleme: 'Probleme',
} as const
export type PortalQueue = keyof typeof PORTAL_QUEUES
export const isPortalQueue = (k: string): k is PortalQueue => Object.prototype.hasOwnProperty.call(PORTAL_QUEUES, k)

/**
 * The queue of one order (null: not the warehouse's business yet or anymore).
 *   noi        accepted and preparable (paid, or cash on delivery; a business order confirmed by the team), not started
 *   pregatire  being packed ("în pregătire")
 *   pregatite  packed, the courier's AWB not noted yet
 *   expediere  packed and the AWB noted: waiting for the courier to pick it up
 *   expediate  with the courier; livrate: delivered in the last 14 days
 * A reported problem puts the order in "probleme" too (it stays in its own queue as well).
 */
export function queueOf(o: Order, now = Date.now()): PortalQueue | null {
  if (o.status === 'cancelled') return null
  if (o.status === 'shipped') return 'expediate'
  if (o.status === 'delivered') return o.deliveredAt && now - o.deliveredAt.getTime() < 14 * 86_400_000 ? 'livrate' : null
  if (!canFulfil(o)) return null
  if (o.status === 'confirmed') return 'noi'
  if (o.status === 'processing') return !o.preparedAt ? 'pregatire' : o.trackingNumber ? 'expediere' : 'pregatite'
  return null
}

/** Business orders (cash on delivery or transfer) the team has not confirmed by phone yet: shown, never workable. */
export const awaitingTeam = (o: Order) => awaitsTeam(o) && o.status !== 'cancelled'

export async function portalOrders(q: Queryable) {
  const { rows } = await q.query<{ id: string }>(
    `select id from orders
      where status in ('confirmed', 'processing', 'shipped')
         or (status = 'delivered' and delivered_at >= now() - interval '14 days')
         or (team_confirmation = 'awaiting' and status <> 'cancelled')
         or (fulfillment_issue is not null and status <> 'cancelled')
      order by created_at asc limit 400`,
  )
  const list = (await Promise.all(rows.map((r) => orders.byId(q, r.id)))).filter((o): o is Order => !!o)
  const byQueue = Object.fromEntries((Object.keys(PORTAL_QUEUES) as PortalQueue[]).map((k) => [k, [] as Order[]])) as Record<PortalQueue, Order[]>
  for (const o of list) {
    const k = queueOf(o)
    if (k) byQueue[k].push(o)
    if (o.fulfillmentIssue && o.status !== 'cancelled' && k !== null) byQueue.probleme.push(o)
  }
  // Shipped and delivered: newest first; the work queues: oldest first (first in, first out).
  byQueue.expediate.reverse()
  byQueue.livrate.reverse()
  return { byQueue, awaiting: list.filter(awaitingTeam) }
}
