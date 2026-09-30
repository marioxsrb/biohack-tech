/**
 * The post-purchase offer, server side. After a card payment that Stripe confirmed, the customer may choose
 * ONE of the offered products and add it with the same card, as a separate linked order (own PaymentIntent,
 * own invoice). Nothing here can change the parent order: it is already paid, and its payment is never touched.
 *
 * Safety:
 *   - only for a paid card checkout order, while the offer is open (upsell_status 'offered', not expired);
 *   - only one of the products the site offers for that order (anything else the browser sends is refused);
 *   - an explicit accept request is required; viewing or refreshing the page never charges;
 *   - one linked order per parent (unique index) and one PaymentIntent per linked order (idempotency key),
 *     so double clicks and retries cannot charge twice;
 *   - Stripe decides on authentication; when the bank asks for it, the browser shows Stripe's step.
 */
import 'server-only'
import { UPSELL_WINDOW_MINUTES } from '@/config/upsell'
import { getProduct, getVariant, unitPrice, variantLabel } from '@/content/catalog'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { upsellsFor } from '@/lib/upsell'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { StripeError, stripe } from '@/server/integrations/stripe'
import { errText, log } from '@/server/log'
import type { Order } from './model'
import { orders } from './repository'
import { confirmPayment, failUpsell, placeUpsellOrder, UpsellClosed } from './service'
import { isPaid } from './state'

export type UpsellOffer = {
  productId: string
  name: string
  reason: string
  variants: { id: string; label: string; priceMinor: number }[]
  priceMinor: number
  expiresAt: Date
}

/**
 * The offers for a parent order (at most two; the customer chooses one), or an empty list when none may
 * be shown. Pure apart from the clock.
 */
export function offersFor(o: Order, now = new Date()): UpsellOffer[] {
  if (o.kind !== 'checkout' || o.paymentMethod !== 'card' || !isPaid(o.paymentStatus) || o.status === 'cancelled') return []
  if (o.upsellStatus !== 'offered' || !o.upsellExpiresAt || o.upsellExpiresAt.getTime() <= now.getTime()) return []
  if (!o.stripeCustomerId || !o.stripePaymentMethodId) return []
  const expiresAt = o.upsellExpiresAt
  return upsellsFor(o.items.map((i) => i.productId)).flatMap((pick) => {
    const p = getProduct(pick.productId)
    if (!p || p.price === null) return []
    const variants = (p.variants ?? []).flatMap((v) => {
      const price = unitPrice(p, v)
      return price === null ? [] : [{ id: v.id, label: variantLabel(p, v), priceMinor: price }]
    })
    return [{ productId: p.id, name: p.name, reason: pick.reason, variants, priceMinor: p.price, expiresAt }]
  })
}

export type UpsellResult =
  | { state: 'paid'; orderNumber: string }
  | { state: 'action'; clientSecret: string }
  | { state: 'processing' }
  | { state: 'failed'; message: string }
  | { state: 'declined' }
  | { state: 'closed'; message: string }

const CLOSED = 'Oferta nu mai este disponibilă. Comanda ta este confirmată și nu s-a mai plătit nimic.'
const FAILED = 'Plata pentru produsul adăugat nu a reușit și nu ți s-a retras nimic pentru el. Comanda ta inițială rămâne confirmată.'

/** Maps the linked order's current state to what the page shows. */
async function stateOf(child: Order): Promise<UpsellResult> {
  if (isPaid(child.paymentStatus)) return { state: 'paid', orderNumber: child.orderNumber }
  if (child.status === 'cancelled' || child.paymentStatus === 'failed') return { state: 'failed', message: FAILED }
  return { state: 'processing' }
}

/** Applies a PaymentIntent's status to the linked order. Idempotent (the webhook may do the same). */
async function settle(child: Order, pi: { id: string; status: string; amount_received: number; currency: string; client_secret: string; last_payment_error?: { code?: string; decline_code?: string } | null }): Promise<UpsellResult> {
  if (pi.status === 'succeeded') {
    await confirmPayment(child.id, 'upsell', { amountMinor: pi.amount_received, currency: pi.currency, paymentIntentId: pi.id })
    return stateOf((await orders.byId(await getDb(), child.id))!)
  }
  if (pi.status === 'requires_action') return { state: 'action', clientSecret: pi.client_secret }
  if (pi.status === 'processing') return { state: 'processing' }
  // requires_payment_method (declined / authentication failed) or canceled: close it for good.
  const c = getConfig()
  if (pi.status !== 'canceled' && c.stripe) await stripe.cancelPaymentIntent(c.stripe, pi.id).catch((e) => log.warn('upsell.cancel_failed', { error: errText(e) }))
  await failUpsell(child.id, pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? pi.status)
  return { state: 'failed', message: FAILED }
}

export async function acceptUpsell(token: string, productId: unknown, variantId: unknown): Promise<UpsellResult> {
  const c = getConfig()
  const db = await getDb()
  const parent = await orders.byToken(db, token)
  if (!parent || !c.stripe) return { state: 'closed', message: CLOSED }

  // A repeated accept (double click, refresh, retry) only reports the existing linked order.
  const existing = await orders.childOf(db, parent.id)
  if (existing) return continueUpsell(existing)

  // Only one of the products offered for this order; accepting one closes the offer (one linked order).
  const offer = offersFor(parent).find((x) => x.productId === productId)
  if (!offer) return { state: 'closed', message: CLOSED }
  const v = typeof variantId === 'string' && variantId ? variantId : undefined
  const product = getProduct(offer.productId)!
  if (product.variants?.length ? !getVariant(product, v) : v) return { state: 'closed', message: CLOSED }

  const resolved = resolveOrderLines([{ productId: offer.productId, variantId: v, quantity: 1 }])
  if (!resolved.ok) return { state: 'closed', message: CLOSED }

  let child: Order
  try {
    ;({ order: child } = await placeUpsellOrder(parent, resolved.lines[0]))
  } catch (e) {
    if (e instanceof UpsellClosed) return { state: 'closed', message: CLOSED }
    throw e
  }
  return continueUpsell(child, parent)
}

/** Creates (once) and confirms the linked order's PaymentIntent, or reports where it stands. */
async function continueUpsell(child: Order, parent?: Order): Promise<UpsellResult> {
  const c = getConfig()
  if (isPaid(child.paymentStatus) || child.status === 'cancelled') return stateOf(child)
  const db = await getDb()
  const p = parent ?? (await orders.byId(db, child.parentOrderId!))!
  try {
    // The row lock makes concurrent requests (double click, two tabs) wait for the first one, which
    // creates the PaymentIntent; the others then only read it. Stripe's idempotency key is the second guard.
    const pi = await db.tx(async (t) => {
      const locked = (await orders.byId(t, child.id, true))!
      if (locked.stripePaymentIntentId) return stripe.retrievePaymentIntent(c.stripe!, locked.stripePaymentIntentId)
      try {
        const created = await stripe.createUpsellPaymentIntent(c.stripe!, { id: child.id, orderNumber: child.orderNumber, totalMinor: child.totalMinor, parentId: p.id }, p.stripeCustomerId!, p.stripePaymentMethodId!)
        await orders.update(t, child.id, { stripe_payment_intent_id: created.id })
        return created
      } catch (e) {
        // Declined on confirmation: Stripe still created the PaymentIntent. Keep its id (committed), then read it.
        if (!(e instanceof StripeError && e.paymentIntentId)) throw e
        await orders.update(t, child.id, { stripe_payment_intent_id: e.paymentIntentId })
        return stripe.retrievePaymentIntent(c.stripe!, e.paymentIntentId)
      }
    })
    if (pi.amount !== child.totalMinor || pi.currency !== 'ron' || pi.metadata?.order_id !== child.id) throw new Error('upsell payment intent does not match the order')
    return await settle(child, pi)
  } catch (e) {
    // A declined card comes back from Stripe as an error on the confirming request.
    if (e instanceof StripeError && e.status === 402) {
      const fresh = (await orders.byId(db, child.id))!
      if (fresh.stripePaymentIntentId) {
        const pi = await stripe.retrievePaymentIntent(c.stripe!, fresh.stripePaymentIntentId).catch(() => null)
        if (pi) return settle(fresh, pi)
      }
      await failUpsell(child.id, e.code ?? 'declined')
      return { state: 'failed', message: FAILED }
    }
    log.error('upsell.payment_error', { orderId: child.id, error: errText(e) })
    return { state: 'failed', message: FAILED }
  }
}

/**
 * After the customer finished (or closed) Stripe's authentication step: read the result from Stripe,
 * never from the browser. `abandoned` (the browser says the step was closed or failed) only lets us
 * close a payment Stripe still reports as waiting for that step; it can never mark anything paid.
 */
export async function upsellStatus(token: string, abandoned = false): Promise<UpsellResult | null> {
  const db = await getDb()
  const parent = await orders.byToken(db, token)
  if (!parent) return null
  const child = await orders.childOf(db, parent.id)
  if (!child) return parent.upsellStatus === 'declined' ? { state: 'declined' } : null
  const r = await continueUpsell(child, parent)
  if (r.state === 'action' && abandoned) {
    const fresh = (await orders.byId(db, child.id))!
    const c = getConfig()
    if (fresh.stripePaymentIntentId && c.stripe) {
      const pi = await stripe.cancelPaymentIntent(c.stripe, fresh.stripePaymentIntentId).catch(() => null)
      if (pi?.status === 'succeeded') return settle(fresh, pi)
    }
    await failUpsell(child.id, 'authentication_not_completed')
    return { state: 'failed', message: FAILED }
  }
  return r
}

/**
 * Ends the offer: marks it expired if nobody answered, and detaches the card from the Stripe customer so
 * it can no longer be charged by us. Waits while a linked payment is still in progress.
 */
export async function releaseUpsellCard(parentId: string): Promise<string> {
  const c = getConfig()
  const db = await getDb()
  const parent = await orders.byId(db, parentId)
  if (!parent || !parent.stripePaymentMethodId) return 'nothing to release'
  const child = await orders.childOf(db, parent.id)
  if (child && !isPaid(child.paymentStatus) && child.status !== 'cancelled') {
    if (Date.now() - child.createdAt.getTime() < 2 * UPSELL_WINDOW_MINUTES * 60_000) throw new Error('linked payment still in progress')
    await failUpsell(child.id, 'abandoned')
  }
  if (c.stripe) {
    await stripe.detachPaymentMethod(c.stripe, parent.stripePaymentMethodId).catch((e) => {
      if (!(e instanceof StripeError && e.status === 400)) throw e // 400: already detached
    })
  }
  await orders.update(db, parent.id, { stripe_payment_method_id: null, ...(parent.upsellStatus === 'offered' ? { upsell_status: 'expired' } : {}) })
  await orders.event(db, parent.id, 'upsell.card_released', 'system', { upsell: parent.upsellStatus })
  return 'released'
}
