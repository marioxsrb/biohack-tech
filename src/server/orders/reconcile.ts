/**
 * Safety net for card payments, run by the job runner (never by a page view): asks Stripe, with the
 * secret key, what happened to an order's PaymentIntent and applies the same idempotent transitions
 * as the webhook. Covers a webhook that was lost or misconfigured. Whichever arrives first wins once.
 */
import 'server-only'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { stripe } from '@/server/integrations/stripe'
import { orders } from './repository'
import { confirmPayment, recordPaymentCancelled } from './service'
import { isPaid } from './state'

export async function reconcileCardPayment(orderId: string): Promise<string> {
  const c = getConfig()
  if (!c.stripe) return 'stripe not configured'
  const o = await orders.byId(await getDb(), orderId)
  if (!o || o.paymentMethod !== 'card' || !o.stripePaymentIntentId) return 'no payment intent'
  if (isPaid(o.paymentStatus) || o.paymentStatus === 'refunded' || o.paymentStatus === 'cancelled') return `already ${o.paymentStatus}`
  const pi = await stripe.retrievePaymentIntent(c.stripe, o.stripePaymentIntentId)
  if (pi.status === 'succeeded') {
    const r = await confirmPayment(o.id, 'stripe.reconcile', { amountMinor: pi.amount_received, currency: pi.currency, paymentIntentId: pi.id, paymentMethodId: pi.payment_method ?? null })
    return r.changed ? 'paid' : (r.reason ?? 'unchanged')
  }
  if (pi.status === 'canceled') {
    const r = await recordPaymentCancelled(o.id, 'stripe.reconcile', pi.id)
    return r.changed ? 'cancelled' : (r.reason ?? 'unchanged')
  }
  return `stripe ${pi.status}`
}
