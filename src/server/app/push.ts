/**
 * Sale notifications for the private iOS app. Queued in the same transaction as the order event that causes them
 * (lib: orders/service.ts jobsFor), run before every other job of the batch:
 *   payment   — money is in: a card payment Stripe confirmed (verified webhook or reconciliation), a bank transfer
 *               recorded as received, a cash-on-delivery collection recorded. The KA-CHING sound (if the phone
 *               wants it). Never on an attempt, a pending 3-D Secure, a failure or an unpaid order.
 *   new_cod / new_transfer — an order placed that is not paid yet: an ordinary notification, worded differently.
 * One job per event and order (dedupe key); one delivery per job and phone (push_deliveries), so a webhook retry or
 * a job retry never rings a phone twice. A dead token is switched off; a temporary APNs failure is retried by the
 * queue for the phones still missing it. The lock screen shows only the order number, the amount and the kind.
 */
import 'server-only'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { formatMoney } from '@/lib/currency'
import type { Order } from '@/server/orders/model'
import { appDevices, type DevicePrefs } from './auth'
import { sendApns, type ApnsMessage, type ApnsResult } from './apns'

export type PushEvent = 'payment' | 'new_cod' | 'new_transfer'
export const KACHING_SOUND = 'kaching.caf'

const METHOD: Record<Order['paymentMethod'], string> = { card: 'card', bank_transfer: 'transfer bancar', cash_on_delivery: 'ramburs' }

/** What the phone shows and plays. Minimal: no customer name, no address. */
export function pushPayload(event: PushEvent, o: Pick<Order, 'id' | 'orderNumber' | 'totalMinor' | 'currency' | 'paymentMethod' | 'kind'>, prefs: DevicePrefs) {
  const amount = formatMoney(o.totalMinor, o.currency)
  const alert =
    event === 'payment'
      ? { title: o.kind === 'upsell' ? 'Plată încasată · produs adăugat' : 'Plată încasată', body: `${amount} · ${METHOD[o.paymentMethod]} · ${o.orderNumber}` }
      : event === 'new_cod'
        ? { title: 'Comandă nouă · ramburs', body: `${amount} de încasat la livrare · ${o.orderNumber}` }
        : { title: 'Comandă nouă · transfer', body: `${amount}, așteaptă plata · ${o.orderNumber}` }
  return {
    aps: {
      alert,
      sound: event === 'payment' && prefs.kaching ? KACHING_SOUND : 'default',
      'thread-id': event === 'payment' ? 'payments' : 'orders',
      category: event === 'payment' ? 'PAYMENT' : 'ORDER',
      'interruption-level': 'active',
      'relevance-score': event === 'payment' ? 1 : 0.5,
    },
    orderId: o.id,
    event,
  }
}

/** Whether a phone wants this kind of notification. */
export const wants = (event: PushEvent, prefs: DevicePrefs) => (event === 'payment' ? prefs.payments : prefs.newOrders)

/** Is the event still true right before sending (the order may have changed since it was queued)? */
export function stillTrue(event: PushEvent, o: Order) {
  if (event === 'payment') return o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
  return o.status !== 'cancelled'
}

export type SendFn = (c: NonNullable<Config['apns']>, m: ApnsMessage) => Promise<ApnsResult>

/**
 * Delivers one notification to every phone that wants it and does not have it yet. Returns a summary; throws only
 * when some phone must be retried (the queue runs the job again, and phones already notified are skipped).
 */
export async function deliverPush(q: Queryable, c: NonNullable<Config['apns']>, dedupeKey: string, event: PushEvent, o: Order, send: SendFn = sendApns) {
  const devices = (await appDevices.targets(q)).filter((d) => wants(event, d.prefs))
  const { rows: done } = await q.query<{ device_id: string }>(`select device_id from push_deliveries where dedupe_key = $1 and status = 'sent'`, [dedupeKey])
  const already = new Set(done.map((r) => r.device_id))
  let sent = 0
  let dead = 0
  const retry: string[] = []
  await Promise.all(
    devices
      .filter((d) => !already.has(d.id))
      .map(async (d) => {
        const r = await send(c, { token: d.token, environment: d.environment, payload: pushPayload(event, o, d.prefs), collapseId: dedupeKey, priority: 10 })
        const status = r.ok ? 'sent' : r.dead ? 'dead' : r.retry ? 'retry' : 'failed'
        await q.query(
          `insert into push_deliveries (dedupe_key, device_id, status, apns_id, error) values ($1, $2, $3, $4, $5)
           on conflict (dedupe_key, device_id) do update set status = excluded.status, apns_id = excluded.apns_id, error = excluded.error, created_at = now()`,
          [dedupeKey, d.id, status, r.ok ? r.apnsId : null, r.ok ? null : r.reason],
        )
        if (r.ok) sent++
        else if (r.dead) {
          dead++
          await appDevices.disable(q, d.id, `APNs: ${r.reason}`)
        } else if (r.retry) retry.push(r.reason)
      }),
  )
  const note = `${sent} sent, ${already.size} already, ${dead} removed${retry.length ? `, ${retry.length} to retry (${retry[0]})` : ''}`
  if (retry.length) throw new Error(`push: ${note}`)
  return note
}
