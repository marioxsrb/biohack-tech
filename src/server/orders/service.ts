/**
 * Order operations. Each one runs in a transaction that locks the order, checks the
 * state machine, writes the change plus an audit event, and queues its side effects
 * in the outbox. Calling the same operation twice is harmless: the second call finds
 * the order already moved and does nothing.
 */
import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getConfig } from '@/server/config'
import { getDb, type Queryable } from '@/server/db'
import { jobs, type NewJob } from '@/server/jobs/outbox'
import { log } from '@/server/log'
import { marketing } from '@/server/marketing/consent'
import { canSendAbandonedCheckoutEmail, newRecoveryToken, recoveryExpiry } from '@/server/marketing/recovery'
import type { Attribution } from '@/lib/attribution'
import { lineRef } from '@/content/catalog'
import type { OrderForm } from '@/lib/checkout'
import type { OrderLine } from '@/lib/orders/resolve'
import { canMoveOrder, canMovePayment, isPaid } from './state'
import { formatOrderNumber, orderDay } from './number'
import type { Address, Order, OrderStatus, PaymentMethod } from './model'
import { orders } from './repository'

export type Source = 'checkout' | 'stripe.webhook' | 'stripe.reconcile' | 'admin' | 'system'

/**
 * Shipping cost in bani. Current rule: free delivery in Romania (stated on the current
 * biohack-tech.ro). A fixed fee or a free-shipping threshold would be decided here.
 */
export const shippingFor = (): number => 0

type PlaceInput = {
  lines: OrderLine[]
  form: OrderForm
  attemptId: string
  /** Validated by sanitizeAttribution(); not part of the idempotency key. */
  attribution?: Attribution | null
}

/** Same attempt + same content = same order. A changed cart or form is a new order. */
export function idempotencyKey(input: PlaceInput) {
  const canonical = JSON.stringify({ a: input.attemptId, l: input.lines.map((l) => [l.key, l.quantity]), f: input.form })
  return createHash('sha256').update(canonical).digest('hex')
}

const addressOf = (f: OrderForm, ship: boolean): Address =>
  ship && !f.sameAddress
    ? { address: f.shipAddress, city: f.shipCity, county: f.shipCounty, postalCode: f.shipPostalCode, country: 'RO' }
    : { address: f.address, city: f.city, county: f.county, postalCode: f.postalCode, country: 'RO' }

export async function placeOrder(input: PlaceInput): Promise<{ order: Order; created: boolean }> {
  const db = await getDb()
  const key = idempotencyKey(input)
  const existing = await orders.byIdempotencyKey(db, key)
  if (existing) return { order: existing, created: false }

  const f = input.form
  const method: PaymentMethod = f.paymentMethod === 'transfer' ? 'bank_transfer' : 'card'
  const subtotal = input.lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)
  const shipping = shippingFor()

  try {
    const order = await db.tx(async (t) => {
      const now = new Date()
      const id = randomUUID()
      const orderNumber = formatOrderNumber(await orders.nextSeq(t, orderDay(now).iso), now)
      await orders.insert(
        t,
        {
          id,
          orderNumber,
          publicToken: randomBytes(24).toString('base64url'),
          status: 'pending',
          paymentStatus: method === 'card' ? 'pending' : 'awaiting_transfer',
          paymentMethod: method,
          invoiceStatus: 'none',
          currency: 'RON',
          subtotalMinor: subtotal,
          shippingMinor: shipping,
          totalMinor: subtotal + shipping,
          email: f.email,
          phone: f.phone,
          customer:
            f.buyerType === 'pj'
              ? { buyerType: 'pj', firstName: f.firstName, lastName: f.lastName, company: f.company, cui: f.cui, regCom: f.regCom || undefined }
              : { buyerType: 'pf', firstName: f.firstName, lastName: f.lastName },
          billingAddress: addressOf(f, false),
          shippingAddress: addressOf(f, true),
          notes: f.notes,
          marketingConsent: f.marketingConsent,
          attribution: input.attribution ?? null,
          items: input.lines.map((l, i) => ({
            position: i + 1,
            productId: l.productId,
            variantId: l.variantId ?? null,
            productName: l.name,
            variantName: l.description ?? null,
            sku: lineRef(l.productId, l.variantId),
            quantity: l.quantity,
            unitPriceMinor: l.unitAmount,
            lineTotalMinor: l.unitAmount * l.quantity,
          })),
        },
        key,
        now,
      )
      await orders.event(t, id, 'order.created', 'checkout', {
        method,
        total: subtotal + shipping,
        marketingConsent: f.marketingConsent,
        ...(input.attribution && { attribution: input.attribution }),
      })
      // Proof of the ticked box: exact wording, version, time, order. An unticked box records nothing.
      if (f.marketingConsent) await marketing.grant(t, { email: f.email, source: 'checkout', orderId: id, page: '/checkout' })
      const created = (await orders.byId(t, id))!
      await enqueueAll(t, jobsFor('created', created))
      return created
    })
    log.info('order.created', { orderId: order.id, orderNumber: order.orderNumber, method, totalMinor: order.totalMinor })
    return { order, created: true }
  } catch (e) {
    // Two identical submissions racing: the loser reads the winner's order.
    const raced = await orders.byIdempotencyKey(db, key)
    if (raced) return { order: raced, created: false }
    throw e
  }
}

export async function attachPaymentIntent(orderId: string, paymentIntentId: string) {
  const db = await getDb()
  await db.tx(async (t) => {
    const o = await orders.byId(t, orderId, true)
    if (!o || o.stripePaymentIntentId === paymentIntentId) return
    if (o.stripePaymentIntentId) throw new Error('order already has a different payment intent')
    await orders.update(t, orderId, { stripe_payment_intent_id: paymentIntentId })
  })
}

type Change = { changed: boolean; order: Order | null; reason?: string }

/** Loads and locks an order, lets `apply` decide, and commits the result with its side effects. */
async function transition(
  orderId: string,
  source: Source,
  apply: (o: Order, t: Queryable) => Promise<{ patch: Record<string, unknown>; event: string; data?: Record<string, unknown> } | { skip: string }>,
): Promise<Change> {
  const db = await getDb()
  const result = await db.tx(async (t) => {
    const o = await orders.byId(t, orderId, true)
    if (!o) return { changed: false, order: null, reason: 'not_found' }
    const r = await apply(o, t)
    if ('skip' in r) return { changed: false, order: o, reason: r.skip }
    await orders.update(t, orderId, r.patch)
    await orders.event(t, orderId, r.event, source, r.data ?? {})
    const next = (await orders.byId(t, orderId))!
    await enqueueAll(t, jobsFor(r.event, next, r.data))
    return { changed: true, order: next }
  })
  log.info(result.changed ? 'order.transition' : 'order.transition_skipped', {
    orderId,
    orderNumber: result.order?.orderNumber,
    source,
    reason: result.reason,
    status: result.order?.status,
    paymentStatus: result.order?.paymentStatus,
  })
  return result
}

/**
 * Money received. For cards, only Stripe (webhook or a server-side retrieve) calls this,
 * with the amount it reports; for bank transfer, a person in /admin after seeing the statement.
 */
export function confirmPayment(orderId: string, source: Source, reported?: { amountMinor: number; currency: string; paymentIntentId?: string }) {
  return transition(orderId, source, async (o, t) => {
    if (isPaid(o.paymentStatus) || o.paymentStatus === 'refunded') return { skip: 'already_paid' }
    // Card money is confirmed only by Stripe (webhook or reconciliation); a person confirms only transfers.
    if (source === 'admin' && o.paymentMethod !== 'bank_transfer') return { skip: 'card_payment_confirmed_by_stripe_only' }
    if (!canMovePayment(o.paymentStatus, 'paid')) return { skip: `payment_${o.paymentStatus}` }
    if (reported) {
      if (reported.currency.toUpperCase() !== 'RON' || reported.amountMinor !== o.totalMinor) {
        log.error('order.amount_mismatch', { orderId: o.id, orderNumber: o.orderNumber, expected: o.totalMinor, got: reported.amountMinor, currency: reported.currency })
        return { skip: 'amount_mismatch' }
      }
      if (reported.paymentIntentId && o.stripePaymentIntentId && reported.paymentIntentId !== o.stripePaymentIntentId) return { skip: 'intent_mismatch' }
    }
    const status: OrderStatus = canMoveOrder(o.status, 'confirmed') ? 'confirmed' : o.status
    await closeAbandonedAttempts(t, o)
    const c = getConfig()
    const invoiceDue = o.paymentMethod === 'card' || c.fgo?.transferInvoice !== 'manual'
    return {
      patch: { payment_status: 'paid', status, paid_at: new Date(), invoice_status: c.fgo && invoiceDue ? 'pending' : 'manual' },
      event: 'payment.confirmed',
      data: { amount: o.totalMinor },
    }
  })
}

/** Reject a provider event that refers to a different PaymentIntent than the one on the order. */
const intentMismatch = (o: Order, paymentIntentId?: string) => !!paymentIntentId && !!o.stripePaymentIntentId && paymentIntentId !== o.stripePaymentIntentId

export function recordPaymentFailure(orderId: string, source: Source, reason: string, paymentIntentId?: string) {
  return transition(orderId, source, async (o) => {
    if (intentMismatch(o, paymentIntentId)) return { skip: 'intent_mismatch' }
    if (!canMovePayment(o.paymentStatus, 'failed')) return { skip: `payment_${o.paymentStatus}` }
    return { patch: { payment_status: 'failed' }, event: 'payment.failed', data: { reason: reason.slice(0, 200) } }
  })
}

/**
 * The PaymentIntent was cancelled in Stripe (by us, by an operator, or by Stripe) before any money moved.
 * The attempt can no longer be paid, so an unpaid order is closed. History stays; nothing is deleted.
 */
export function recordPaymentCancelled(orderId: string, source: Source, paymentIntentId?: string) {
  return transition(orderId, source, async (o) => {
    if (intentMismatch(o, paymentIntentId)) return { skip: 'intent_mismatch' }
    if (!canMovePayment(o.paymentStatus, 'cancelled')) return { skip: `payment_${o.paymentStatus}` }
    const close = canMoveOrder(o.status, 'cancelled')
    return {
      patch: { payment_status: 'cancelled', ...(close ? { status: 'cancelled', cancelled_at: new Date(), cancel_reason: 'plata cu cardul a fost anulată în Stripe' } : {}) },
      event: 'payment.cancelled',
      data: { closedOrder: close },
    }
  })
}

/**
 * A card order that nobody paid for. Kept for follow-up (it can still be paid later), unless
 * the same customer has since paid another order: then the attempt is simply closed.
 */
export function markAbandonedIfUnpaid(orderId: string) {
  return transition(orderId, 'system', async (o, t) => {
    if (o.paymentMethod !== 'card' || isPaid(o.paymentStatus) || !canMoveOrder(o.status, 'abandoned')) return { skip: 'not_abandoned' }
    const later = await t.query(
      "select 1 from orders where email = $1 and id <> $2 and created_at >= $3 and payment_status in ('paid','partially_refunded','awaiting_transfer') limit 1",
      [o.email, o.id, o.createdAt],
    )
    if (later.rows.length) return { patch: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: 'înlocuită de o comandă ulterioară' }, event: 'order.superseded' }
    // Abandoned is a state; whether the customer may be emailed about it is decided separately.
    const decision = canSendAbandonedCheckoutEmail({ ...o, status: 'abandoned' }, await marketing.state(t, o.email), new Date(), false)
    const link = decision.eligible ? { recovery_token: newRecoveryToken(), recovery_expires_at: recoveryExpiry() } : {}
    return {
      patch: { status: 'abandoned', recovery_status: decision.eligible ? 'eligible' : 'ineligible', recovery_reason: decision.reason, ...link },
      event: 'order.abandoned',
      data: { recovery: decision.eligible ? 'eligible' : 'ineligible', reason: decision.reason },
    }
  })
}

/**
 * The customer paid: earlier unpaid card attempts of the same address are closed, in the same
 * transaction, so no recovery message can go out about a purchase that is already done.
 */
async function closeAbandonedAttempts(t: Queryable, paid: Order) {
  const { rows } = await t.query<{ id: string; ghl_opportunity_id: string | null }>(
    "select id, ghl_opportunity_id from orders where email = $1 and id <> $2 and status = 'abandoned' for update",
    [paid.email, paid.id],
  )
  for (const r of rows) {
    await orders.update(t, r.id, { status: 'cancelled', cancelled_at: new Date(), cancel_reason: 'înlocuită de o comandă plătită' })
    await orders.event(t, r.id, 'order.superseded', 'system', { by: paid.orderNumber })
    if (getConfig().ghl && r.ghl_opportunity_id) await jobs.enqueue(t, { kind: 'ghl.sync', orderId: r.id, dedupeKey: `ghl.sync:${r.id}:order.superseded` })
  }
}

/**
 * A bank-transfer order whose money never arrived within TRANSFER_EXPIRY_DAYS. Cancelled like any
 * cancellation (customer email, CRM stage), never deleted. A transfer confirmed in time is untouched.
 */
export function expireUnpaidTransfer(orderId: string) {
  const days = getConfig().transferExpiryDays
  return transition(orderId, 'system', async (o) => {
    if (o.paymentMethod !== 'bank_transfer' || o.paymentStatus !== 'awaiting_transfer' || !canMoveOrder(o.status, 'cancelled')) return { skip: 'not_expired' }
    return {
      patch: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: `transferul nu a ajuns în ${days ?? '?'} zile` },
      event: 'order.cancelled',
      data: { wasPaid: false, reason: 'transfer_expired' },
    }
  })
}

export function markProcessing(orderId: string, source: Source) {
  return transition(orderId, source, async (o) => {
    if (!isPaid(o.paymentStatus) || !canMoveOrder(o.status, 'processing')) return { skip: `status_${o.status}` }
    return { patch: { status: 'processing' }, event: 'order.processing' }
  })
}

export function markShipped(orderId: string, source: Source, s: { courier: string; trackingNumber: string; trackingUrl?: string }) {
  return transition(orderId, source, async (o) => {
    if (!isPaid(o.paymentStatus) || !canMoveOrder(o.status, 'shipped')) return { skip: `status_${o.status}` }
    return {
      patch: { status: 'shipped', courier: s.courier, tracking_number: s.trackingNumber, tracking_url: s.trackingUrl || null, shipped_at: new Date() },
      event: 'order.shipped',
      data: { courier: s.courier, trackingNumber: s.trackingNumber },
    }
  })
}

export function markDelivered(orderId: string, source: Source) {
  return transition(orderId, source, async (o) => {
    if (!canMoveOrder(o.status, 'delivered')) return { skip: `status_${o.status}` }
    return { patch: { status: 'delivered', delivered_at: new Date() }, event: 'order.delivered' }
  })
}

/** Cancels an order that has not shipped. A paid order must be refunded in Stripe separately. */
export function cancelOrder(orderId: string, source: Source, reason: string) {
  return transition(orderId, source, async (o) => {
    if (!canMoveOrder(o.status, 'cancelled')) return { skip: `status_${o.status}` }
    return { patch: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason.slice(0, 300) }, event: 'order.cancelled', data: { wasPaid: isPaid(o.paymentStatus) } }
  })
}

/**
 * The customer withdrew from a paid order (online form, email or phone): a return is expected.
 * Idempotent; the order's own state (shipped, delivered, ...) does not change.
 */
export function markReturnRequested(orderId: string, source: Source, via = 'formular') {
  return transition(orderId, source, async (o) => {
    if (o.returnStatus) return { skip: `return_${o.returnStatus}` }
    if (!isPaid(o.paymentStatus)) return { skip: `payment_${o.paymentStatus}` }
    return { patch: { return_status: 'requested', return_requested_at: new Date() }, event: 'return.requested', data: { via } }
  })
}

/**
 * The returned product arrived and was checked. The refund is a separate step (Stripe, or recorded here
 * for a transfer), so the customer gets one message for the parcel and one for the money.
 */
export function markReturnReceived(orderId: string, source: Source) {
  return transition(orderId, source, async (o, t) => {
    if (o.returnStatus === 'received') return { skip: 'return_received' }
    if (!isPaid(o.paymentStatus) && o.paymentStatus !== 'refunded') return { skip: `payment_${o.paymentStatus}` }
    await t.query("update withdrawal_requests set status = 'received' where order_id = $1 and status <> 'received'", [o.id])
    return {
      patch: { return_status: 'received', return_received_at: new Date(), ...(o.returnRequestedAt ? {} : { return_requested_at: new Date() }) },
      event: 'return.received',
    }
  })
}

/** Stripe reports the cumulative refunded amount; repeated reports of the same amount change nothing. */
export function recordRefund(orderId: string, source: Source, refundedMinor: number) {
  return transition(orderId, source, async (o) => {
    if (refundedMinor <= o.refundedMinor) return { skip: 'refund_already_recorded' }
    const to = refundedMinor >= o.totalMinor ? 'refunded' : 'partially_refunded'
    if (!canMovePayment(o.paymentStatus, to)) return { skip: `payment_${o.paymentStatus}` }
    return {
      patch: { payment_status: to, refunded_minor: Math.min(refundedMinor, o.totalMinor), refunded_at: new Date() },
      event: 'payment.refunded',
      data: { refundedMinor, full: to === 'refunded' },
    }
  })
}

async function enqueueAll(t: Queryable, list: NewJob[]) {
  for (const j of list) await jobs.enqueue(t, j)
}

/** The side effects of each event. Dedupe keys make each effect happen at most once. */
export function jobsFor(event: string, o: Order, data: Record<string, unknown> = {}): NewJob[] {
  const c = getConfig()
  const crm = (): NewJob[] => (c.ghl ? [{ kind: 'ghl.sync', orderId: o.id, dedupeKey: `ghl.sync:${o.id}:${event}${event === 'payment.refunded' ? `:${o.refundedMinor}` : ''}` }] : [])
  const email = (template: string): NewJob[] =>
    c.email.transport === 'none' ? [] : [{ kind: 'email.send', orderId: o.id, dedupeKey: `email:${template}:${o.id}`, payload: { template } }]

  switch (event) {
    case 'created':
      return o.paymentMethod === 'bank_transfer'
        ? [
            ...crm(),
            ...email('transfer_instructions'),
            ...(c.transferExpiryDays
              ? [{ kind: 'order.transfer_expiry' as const, orderId: o.id, dedupeKey: `transfer_expiry:${o.id}`, runAt: new Date(Date.now() + c.transferExpiryDays * 86_400_000) }]
              : []),
          ]
        : [
            // Safety net if Stripe's webhook never arrives; the webhook normally confirms within seconds.
            { kind: 'stripe.reconcile', orderId: o.id, dedupeKey: `reconcile:${o.id}`, runAt: new Date(Date.now() + 10 * 60_000) },
            { kind: 'order.abandon_check', orderId: o.id, dedupeKey: `abandon:${o.id}`, runAt: new Date(Date.now() + c.abandonAfterMinutes * 60_000) },
          ]
    case 'payment.confirmed':
      return [
        ...crm(),
        ...email(o.paymentMethod === 'card' ? 'order_confirmed' : 'payment_received'),
        ...(o.invoiceStatus === 'pending' ? [{ kind: 'fgo.invoice' as const, orderId: o.id, dedupeKey: `fgo.invoice:${o.id}` }] : []),
      ]
    case 'order.abandoned':
    case 'order.processing':
    case 'order.delivered':
      return crm()
    case 'order.shipped':
      return [...crm(), ...email('order_shipped')]
    case 'return.requested':
      return crm()
    case 'return.received':
      return [...crm(), ...email('return_received')]
    case 'payment.cancelled':
      // Never confirmed to the customer: only keep an existing CRM record in step.
      return o.ghlOpportunityId ? crm() : []
    case 'order.cancelled': {
      // An unpaid card attempt was never confirmed to the customer: no email, and no CRM record unless one exists.
      const known = o.paymentMethod === 'bank_transfer' || !!data.wasPaid
      return [...(known || o.ghlOpportunityId ? crm() : []), ...(known ? email('order_cancelled') : [])]
    }
    case 'payment.refunded':
      return [
        ...crm(),
        ...email(data.full ? 'refund_full' : `refund_partial_${o.refundedMinor}`).map((j) => ({ ...j, payload: { template: 'refund_issued' } })),
        ...(data.full && c.fgo?.autoStorno && o.fgoInvoiceNumber ? [{ kind: 'fgo.storno' as const, orderId: o.id, dedupeKey: `fgo.storno:${o.id}` }] : []),
      ]
    default:
      return []
  }
}
