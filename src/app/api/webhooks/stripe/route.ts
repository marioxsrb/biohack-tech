import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { verifyWebhook, type StripeEvent } from '@/server/integrations/stripe'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { orders } from '@/server/orders/repository'
import { confirmPayment, recordPaymentCancelled, recordPaymentFailure, recordRefund } from '@/server/orders/service'

export const runtime = 'nodejs'

/**
 * Stripe → us. The only card events we act on:
 *   payment_intent.succeeded       → order paid (amount, currency and PaymentIntent checked against the order)
 *   payment_intent.payment_failed  → payment failed (customer can retry)
 *   payment_intent.canceled        → payment cancelled; an unpaid order is closed
 *   charge.refunded                → refund recorded (cumulative amount)
 * Signature checked on the raw body; every handler is idempotent, so retries and concurrent
 * deliveries are safe (the order row is locked and the state machine refuses repeats).
 * Each processed event is stored with its outcome. A 2xx tells Stripe to stop retrying;
 * a 5xx asks it to try again later, and the event is then processed again.
 *
 * This, not the order page, is what marks card orders paid: a customer who closes the
 * browser right after paying still gets a paid, confirmed order.
 *
 * The Stripe account is shared with other NEUROS shops, so this endpoint also receives their
 * PaymentIntents. Ours always carry metadata.order_number "BHT-…" (integrations/stripe.ts). Anything
 * else with no matching order is stored as "unrelated" and acknowledged: it is not ours to retry.
 * Our own money that cannot be applied (wrong amount or PaymentIntent, paid after the order was
 * cancelled, refund on an order in the wrong state, our order missing) is acknowledged too, since a
 * retry would change nothing, but stored as "attention:<reason>", logged as an error, written to the
 * order's history and listed in /admin for a person.
 */
const OUR_ORDER_NUMBER = /^BHT-/
// Skips that only mean "already done": everything else on money events needs a person.
const SETTLED = new Set(['already_paid', 'refund_already_recorded'])
export async function POST(req: NextRequest) {
  const c = getConfig()
  if (!c.stripe) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const raw = await req.text()
  let event: StripeEvent
  try {
    event = verifyWebhook(raw, req.headers.get('stripe-signature'), c.stripe.webhookSecret)
  } catch (e) {
    log.warn('stripe.webhook_rejected', { error: errText(e) })
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
  if (event.livemode !== c.stripe.live) return NextResponse.json({ ignored: 'mode mismatch' })

  const obj = event.data.object
  try {
    const db = await getDb()
    const seen = await db.query('select 1 from webhook_events where provider = $1 and event_id = $2', ['stripe', event.id])
    if (seen.rows.length) return NextResponse.json({ received: true, duplicate: true })

    const orderFor = async (piId: unknown, meta: unknown) => {
      const byMeta = (meta as Record<string, string> | undefined)?.order_id
      return (byMeta && (await orders.byId(db, byMeta))) || (typeof piId === 'string' ? await orders.byPaymentIntent(db, piId) : null)
    }

    // Ours if it names one of our order numbers; otherwise only if it matches one of our orders.
    const ours = (meta: unknown) => OUR_ORDER_NUMBER.test(String((meta as Record<string, unknown> | undefined)?.order_number ?? ''))
    const needsPerson = async (orderId: string | undefined, reason: string, amountMinor: number) => {
      log.error('stripe.payment_needs_attention', { type: event.type, eventId: event.id, orderId, reason, amountMinor, paymentIntentId: String(obj.id ?? obj.payment_intent ?? '') })
      if (orderId) await orders.event(db, orderId, 'payment.attention', 'stripe.webhook', { eventId: event.id, type: event.type, reason, amountMinor })
      return `attention:${reason}`
    }

    let outcome = 'ignored'
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      const o = await orderFor(obj.id, obj.metadata)
      const piId = String(obj.id)
      if (!o) outcome = !ours(obj.metadata) ? 'unrelated' : event.type === 'payment_intent.succeeded' ? await needsPerson(undefined, 'order_not_found', Number(obj.amount_received ?? obj.amount)) : 'order_not_found'
      else if (event.type === 'payment_intent.succeeded') {
        const pm = typeof obj.payment_method === 'string' ? obj.payment_method : null
        const amountMinor = Number(obj.amount_received ?? obj.amount)
        const r = await confirmPayment(o.id, 'stripe.webhook', { amountMinor, currency: String(obj.currency), paymentIntentId: piId, paymentMethodId: pm })
        outcome = r.changed
          ? r.order?.status === 'cancelled' ? await needsPerson(o.id, 'paid_after_cancel', amountMinor) : 'paid'
          : SETTLED.has(r.reason ?? '') ? r.reason! : await needsPerson(o.id, r.reason ?? 'unchanged', amountMinor)
      } else if (event.type === 'payment_intent.payment_failed') {
        const err = obj.last_payment_error as { code?: string; decline_code?: string } | undefined
        const r = await recordPaymentFailure(o.id, 'stripe.webhook', err?.decline_code ?? err?.code ?? 'failed', piId)
        outcome = r.changed ? 'failed' : (r.reason ?? 'unchanged')
      } else {
        const r = await recordPaymentCancelled(o.id, 'stripe.webhook', piId)
        outcome = r.changed ? 'cancelled' : (r.reason ?? 'unchanged')
      }
      log.info('stripe.webhook', { type: event.type, eventId: event.id, orderId: o?.id, orderNumber: o?.orderNumber, outcome })
    } else if (event.type === 'charge.refunded') {
      const o = await orderFor(obj.payment_intent, obj.metadata)
      if (o) {
        const r = await recordRefund(o.id, 'stripe.webhook', Number(obj.amount_refunded))
        outcome = r.changed ? 'refunded' : SETTLED.has(r.reason ?? '') ? r.reason! : await needsPerson(o.id, r.reason ?? 'unchanged', Number(obj.amount_refunded))
      } else outcome = ours(obj.metadata) ? await needsPerson(undefined, 'order_not_found', Number(obj.amount_refunded)) : 'unrelated'
      log.info('stripe.webhook', { type: event.type, eventId: event.id, orderId: o?.id, orderNumber: o?.orderNumber, outcome })
    }

    await db.query('insert into webhook_events (provider, event_id, type, outcome) values ($1,$2,$3,$4) on conflict do nothing', ['stripe', event.id, event.type, outcome])
    kickJobs()
    return NextResponse.json({ received: true, outcome })
  } catch (e) {
    log.error('stripe.webhook_error', { type: event.type, eventId: event.id, error: errText(e) })
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
}
