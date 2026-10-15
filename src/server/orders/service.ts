/**
 * Order operations. Each one runs in a transaction that locks the order, checks the
 * state machine, writes the change plus an audit event, and queues its side effects
 * in the outbox. Calling the same operation twice is harmless: the second call finds
 * the order already moved and does nothing.
 */
import 'server-only'
import { convertUnit, rateFor, rates, ruleIn, type Currency } from '@/lib/currency'
import { consentVersionFor } from '@/lib/consent/marketing'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getConfig } from '@/server/config'
import { getDb, type Queryable } from '@/server/db'
import { jobs, type NewJob } from '@/server/jobs/outbox'
import { log } from '@/server/log'
import { marketing } from '@/server/marketing/consent'
import { callConsent } from '@/server/calling/consent'
import { romanianE164 } from '@/lib/consent/calling'
import { canSendAbandonedCheckoutEmail, newRecoveryToken, recoveryExpiry } from '@/server/marketing/recovery'
import type { Attribution } from '@/lib/attribution'
import { lineRef } from '@/content/catalog'
import type { OrderForm } from '@/lib/checkout'
import { priceLines, type PromoCodeRule } from '@/lib/promotions'
import { normalizeCode, promoCodes, ruleOf, type PromoProblem } from '@/server/promo'
import { upsellsFor } from '@/lib/upsell'
import { UPSELL_WINDOW_MINUTES } from '@/config/upsell'
import type { OrderLine } from '@/lib/orders/resolve'
import { awaitsCollection, canCancel, canFulfil, canMoveOrder, canMovePayment, isPaid, isPurchased } from './state'
import { formatOrderNumber, orderDay } from './number'
import type { Address, Order, OrderSite, OrderStatus, PaymentMethod } from './model'
import { orders } from './repository'
import { ensureOrderLead, markLeadsPurchased } from '@/server/leads'

export type Source = 'checkout' | 'stripe.webhook' | 'stripe.reconcile' | 'upsell' | 'admin' | 'system' | 'assistant'

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
  /** A promo code typed in the checkout (checked again here, inside the order's transaction). */
  promoCode?: string
  /** What the customer pays in (default lei): the lines' lei prices are converted here, per unit (lib/currency). */
  currency?: Currency
  /** The checkout's language and site (emails and pages follow them). */
  locale?: 'ro' | 'en'
  site?: OrderSite
}

/** The promo code cannot be used for this order (the checkout shows why, next to the code field). */
export class PromoError extends Error {
  constructor(
    public problem: PromoProblem | 'invalid' | 'min_order' | 'no_products' | 'not_better',
    public rule?: PromoCodeRule,
  ) {
    super(`promo code: ${problem}`)
  }
}

/** Same attempt + same content = same order. A changed cart or form is a new order. */
export function idempotencyKey(input: PlaceInput) {
  const canonical = JSON.stringify({ a: input.attemptId, l: input.lines.map((l) => [l.key, l.quantity]), f: input.form, ...(input.promoCode && { c: normalizeCode(input.promoCode) }), ...(input.currency && input.currency !== 'RON' && { cur: input.currency }) })
  return createHash('sha256').update(canonical).digest('hex')
}

const addressOf = (f: OrderForm, ship: boolean): Address =>
  ship && !f.sameAddress
    ? { address: f.shipAddress, city: f.shipCity, county: f.shipCounty, postalCode: f.shipPostalCode, country: f.shipCountry || 'RO' }
    : { address: f.address, city: f.city, county: f.county, postalCode: f.postalCode, country: f.country || 'RO' }

export async function placeOrder(input: PlaceInput): Promise<{ order: Order; created: boolean }> {
  const db = await getDb()
  const key = idempotencyKey(input)
  const existing = await orders.byIdempotencyKey(db, key)
  if (existing) return { order: existing, created: false }

  const f = input.form
  const currency: Currency = input.currency ?? 'RON'
  const fxRate = rateFor(currency)
  // Unit prices in the order's currency (whole euro or dollar per unit); promotions are computed on them.
  const lines = input.lines.map((l) => ({ ...l, unitAmount: convertUnit(l.unitAmount, currency) }))
  const method: PaymentMethod = f.paymentMethod === 'transfer' ? 'bank_transfer' : f.paymentMethod === 'cod' ? 'cash_on_delivery' : 'card'
  const cod = method === 'cash_on_delivery'
  const shipping = shippingFor()

  try {
    const order = await db.tx(async (t) => {
      // Promotions are recomputed here from the catalog-priced lines, whatever the caller passed; a promo code
      // is checked with its row locked, so a limited code's last use goes to one order only.
      let rule: PromoCodeRule | undefined
      if (input.promoCode) {
        const checked = await promoCodes.check(t, input.promoCode, { email: f.email, lock: true })
        if (!checked.ok) throw new PromoError(checked.problem)
        rule = ruleIn(ruleOf(checked.code), currency)
      }
      const pricing = priceLines(lines, undefined, rule)
      if (pricing.code?.problem) throw new PromoError(pricing.code.problem, rule)
      const subtotal = pricing.subtotalMinor
      const discount = pricing.discountMinor
      const now = new Date()
      const id = randomUUID()
      const orderNumber = formatOrderNumber(await orders.nextSeq(t, orderDay(now).iso), now)
      await orders.insert(
        t,
        {
          id,
          orderNumber,
          publicToken: randomBytes(24).toString('base64url'),
          // Cash on delivery: accepted at once and prepared before any money exists; the courier collects.
          status: cod ? 'confirmed' : 'pending',
          paymentStatus: method === 'card' ? 'pending' : cod ? 'awaiting_collection' : 'awaiting_transfer',
          paymentMethod: method,
          invoiceStatus: 'none',
          currency,
          fxRate,
          locale: input.locale ?? 'ro',
          site: input.site ?? 'ro',
          subtotalMinor: subtotal,
          discountMinor: discount,
          promotions: pricing.promotions,
          promoCode: rule?.code ?? null,
          kind: 'checkout',
          parentOrderId: null,
          shippingMinor: shipping,
          totalMinor: subtotal - discount + shipping,
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
          items: lines.map((l, i) => ({
            position: i + 1,
            productId: l.productId,
            variantId: l.variantId ?? null,
            productName: l.name,
            variantName: l.description ?? null,
            sku: lineRef(l.productId, l.variantId),
            quantity: l.quantity,
            unitPriceMinor: l.unitAmount,
            lineTotalMinor: l.unitAmount * l.quantity,
            discountMinor: pricing.lineDiscounts[l.key] ?? 0,
            promotionId: pricing.linePromotion[l.key] ?? null,
            codeDiscountMinor: pricing.lineCodeDiscounts[l.key] ?? 0,
          })),
        },
        key,
        now,
      )
      // What the courier has to collect, kept on the order for the parcel (fulfillment/courier.ts).
      if (cod) await orders.update(t, id, { cod_amount_minor: subtotal - discount + shipping })
      await orders.event(t, id, 'order.created', 'checkout', {
        method,
        total: subtotal - discount + shipping,
        ...(cod && { codAmount: subtotal - discount + shipping }),
        ...(discount && { discount, promotions: pricing.promotions.map((p) => p.id) }),
        marketingConsent: f.marketingConsent,
        ...(input.attribution && { attribution: input.attribution }),
      })
      if (rule && pricing.code?.amountMinor) await promoCodes.redeem(t, { orderId: id, code: rule.code, email: f.email, discountMinor: pricing.code.amountMinor })
      // Proof of the ticked box: exact wording, version, time, order. An unticked box records nothing.
      if (f.marketingConsent) await marketing.grant(t, { email: f.email, source: 'checkout', orderId: id, page: '/checkout', version: consentVersionFor(input.site ?? 'ro', input.locale ?? 'ro') })
      // The same box names the AI calls: their consent is recorded separately, by phone number (no call follows
      // a purchase; it is kept as the person's choice). The CRM tag follows on marketing.sync.
      // The international site's box names email only: no call consent from it.
      const phone = f.marketingConsent && input.site !== 'net' ? romanianE164(f.phone) : null
      if (phone && !(await callConsent.state(t, phone))?.granted) {
        const callId = await callConsent.grant(t, { phone, email: f.email, source: 'checkout', page: '/checkout' })
        if (getConfig().ghl) await jobs.enqueue(t, { kind: 'marketing.sync', dedupeKey: `marketing.sync:call:${callId}`, payload: { email: f.email.trim().toLowerCase() }, runAt: new Date(Date.now() + 60_000) })
      }
      const created = (await orders.byId(t, id))!
      // A cash-on-delivery order is a commitment, like a payment: earlier unpaid card attempts are closed.
      if (cod) await closeAbandonedAttempts(t, created)
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

export async function setStripeCustomer(orderId: string, customerId: string) {
  const db = await getDb()
  await db.query('update orders set stripe_customer_id = $2, updated_at = now() where id = $1 and stripe_customer_id is null', [orderId, customerId])
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
    // The leads behind a paid order are purchases: their recovery stops in the same transaction.
    if (r.event === 'payment.confirmed') await markLeadsPurchased(t, orderId)
    // An unpaid card order: its recovery runs through the lead system (application-owned email).
    if (r.event === 'order.abandoned') await ensureOrderLead(t, (await orders.byId(t, orderId))!)
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
 * with the amount it reports; for bank transfer, a person in /admin after seeing the statement;
 * for cash on delivery, a person in /admin with the courier's settlement: the exact amount and its
 * reference (borderou or payment order), both kept in the audit trail. Delivery alone never pays an order.
 */
export function confirmPayment(
  orderId: string,
  source: Source,
  reported?: { amountMinor: number; currency: string; paymentIntentId?: string; paymentMethodId?: string | null; reference?: string },
) {
  return transition(orderId, source, async (o, t) => {
    if (isPaid(o.paymentStatus) || o.paymentStatus === 'refunded') return { skip: 'already_paid' }
    // Card money is confirmed only by Stripe (webhook or reconciliation); a person confirms only transfers and collections.
    if (source === 'admin' && o.paymentMethod === 'card') return { skip: 'card_payment_confirmed_by_stripe_only' }
    if (o.paymentMethod === 'cash_on_delivery') {
      if (source !== 'admin') return { skip: 'collection_confirmed_by_admin_only' }
      if (o.status !== 'shipped' && o.status !== 'delivered') return { skip: `collection_before_delivery_${o.status}` }
      if (!reported?.reference || reported.reference.trim().length < 3) return { skip: 'collection_reference_required' }
    }
    if (!canMovePayment(o.paymentStatus, 'paid')) return { skip: `payment_${o.paymentStatus}` }
    if (reported) {
      if (reported.currency.toUpperCase() !== o.currency || reported.amountMinor !== o.totalMinor) {
        log.error('order.amount_mismatch', { orderId: o.id, orderNumber: o.orderNumber, expected: o.totalMinor, got: reported.amountMinor, currency: reported.currency })
        return { skip: 'amount_mismatch' }
      }
      if (reported.paymentIntentId && o.stripePaymentIntentId && reported.paymentIntentId !== o.stripePaymentIntentId) return { skip: 'intent_mismatch' }
    }
    // Paid after the order was cancelled (an older card attempt completing late): record the money, but
    // send no "order confirmed" email and issue no invoice. /admin lists it for a refund.
    if (o.status === 'cancelled') {
      log.error('order.paid_after_cancel', { orderId: o.id, orderNumber: o.orderNumber, amount: o.totalMinor, source })
      return { patch: { payment_status: 'paid', paid_at: new Date() }, event: 'payment.after_cancel', data: { amount: o.totalMinor } }
    }
    const status: OrderStatus = canMoveOrder(o.status, 'confirmed') ? 'confirmed' : o.status
    await closeAbandonedAttempts(t, o)
    const c = getConfig()
    const cod = o.paymentMethod === 'cash_on_delivery'
    // Cash on delivery: the invoice was issued at shipment (default) or is issued now (on_collection).
    const invoiceDue = cod ? c.fgo?.codInvoice === 'on_collection' : o.paymentMethod === 'card' || c.fgo?.transferInvoice !== 'manual'
    const invoice = cod && o.invoiceStatus !== 'none' ? {} : { invoice_status: c.fgo && invoiceDue ? 'pending' : 'manual' }
    // A paid card checkout order with a card Stripe kept for on-session use gets the optional
    // post-purchase offer for a limited time. Only ids are stored, never card data.
    const offer =
      // (Romanian, lei orders only: the offer's page and prices are in Romanian lei.)
      o.kind === 'checkout' && o.paymentMethod === 'card' && o.currency === 'RON' && o.locale === 'ro' && o.stripeCustomerId && reported?.paymentMethodId && upsellsFor(o.items.map((i) => i.productId)).length
        ? { stripe_payment_method_id: reported.paymentMethodId, upsell_status: 'offered', upsell_expires_at: new Date(Date.now() + UPSELL_WINDOW_MINUTES * 60_000) }
        : {}
    return {
      patch: { payment_status: 'paid', status, paid_at: new Date(), ...invoice, ...(cod && { cod_reference: reported!.reference!.trim().slice(0, 120) }), ...offer },
      event: 'payment.confirmed',
      data: { amount: o.totalMinor, ...(cod && { collection: true, reference: reported!.reference!.trim().slice(0, 120) }), ...('upsell_status' in offer && { upsellOffered: true }) },
    }
  })
}

/**
 * The customer accepted the post-purchase offer: a separate order, linked to the paid parent, with the
 * same buyer, addresses and card customer, priced from the catalog (and the normal promotion rules)
 * like any order. At most one per parent (unique index); a second call returns the first.
 */
export async function placeUpsellOrder(parent: Order, line: OrderLine): Promise<{ order: Order; created: boolean }> {
  const db = await getDb()
  const existing = await orders.childOf(db, parent.id)
  if (existing) return { order: existing, created: false }
  // In the parent's currency, at the parent's rate.
  const at = parent.currency === 'RON' ? rates() : { ...rates(), [parent.currency]: parent.fxRate }
  line = { ...line, unitAmount: convertUnit(line.unitAmount, parent.currency, at) }
  const pricing = priceLines([line])
  try {
    const order = await db.tx(async (t) => {
      const locked = (await orders.byId(t, parent.id, true))!
      const again = await orders.childOf(t, parent.id)
      if (again) return again
      if (locked.upsellStatus !== 'offered') throw new UpsellClosed(locked.upsellStatus ?? 'none')
      const now = new Date()
      const id = randomUUID()
      await orders.insert(
        t,
        {
          id,
          orderNumber: formatOrderNumber(await orders.nextSeq(t, orderDay(now).iso), now),
          publicToken: randomBytes(24).toString('base64url'),
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'card',
          invoiceStatus: 'none',
          currency: parent.currency,
          fxRate: parent.fxRate,
          locale: parent.locale,
          site: parent.site,
          subtotalMinor: pricing.subtotalMinor,
          discountMinor: pricing.discountMinor,
          promotions: pricing.promotions,
          // The post-purchase offer is priced on its own: the checkout's promo code does not apply to it.
          promoCode: null,
          shippingMinor: 0,
          totalMinor: pricing.totalMinor,
          kind: 'upsell',
          parentOrderId: parent.id,
          email: parent.email,
          phone: parent.phone,
          customer: parent.customer,
          billingAddress: parent.billingAddress,
          shippingAddress: parent.shippingAddress,
          notes: `Adăugată după plata comenzii ${parent.orderNumber}. Se poate expedia împreună cu ea.`,
          marketingConsent: false,
          attribution: parent.attribution,
          items: [
            {
              position: 1,
              productId: line.productId,
              variantId: line.variantId ?? null,
              productName: line.name,
              variantName: line.description ?? null,
              sku: lineRef(line.productId, line.variantId),
              quantity: line.quantity,
              unitPriceMinor: line.unitAmount,
              lineTotalMinor: line.unitAmount * line.quantity,
              discountMinor: pricing.lineDiscounts[line.key] ?? 0,
              promotionId: pricing.linePromotion[line.key] ?? null,
              codeDiscountMinor: 0,
            },
          ],
        },
        `upsell:${parent.id}`,
        now,
      )
      await orders.update(t, id, { stripe_customer_id: parent.stripeCustomerId })
      await orders.update(t, parent.id, { upsell_status: 'accepted' })
      await orders.event(t, id, 'order.created', 'upsell', { method: 'card', total: pricing.totalMinor, parentOrder: parent.orderNumber })
      await orders.event(t, parent.id, 'upsell.accepted', 'upsell', { child: id, product: lineRef(line.productId, line.variantId) })
      const created = (await orders.byId(t, id))!
      await enqueueAll(t, jobsFor('created', created))
      return created
    })
    log.info('upsell.created', { parentId: parent.id, orderId: order.id, orderNumber: order.orderNumber, totalMinor: order.totalMinor })
    return { order, created: true }
  } catch (e) {
    const raced = await orders.childOf(db, parent.id)
    if (raced) return { order: raced, created: false }
    throw e
  }
}

export class UpsellClosed extends Error {}

/** The customer said no: nothing is charged, nothing is created, the kept card is released. */
export function declineUpsell(parentId: string) {
  return transition(parentId, 'upsell', async (o) => {
    if (o.upsellStatus !== 'offered') return { skip: `upsell_${o.upsellStatus ?? 'none'}` }
    return { patch: { upsell_status: 'declined' }, event: 'upsell.declined' }
  })
}

/**
 * The post-purchase payment did not go through (declined, authentication failed or abandoned). The
 * extra order is closed; the parent order is not touched. It was never confirmed to the customer,
 * so no email and no CRM record.
 */
export function failUpsell(orderId: string, reason: string) {
  return transition(orderId, 'upsell', async (o) => {
    if (o.kind !== 'upsell' || isPaid(o.paymentStatus) || o.status === 'cancelled') return { skip: `status_${o.status}` }
    return {
      patch: { payment_status: 'failed', status: 'cancelled', cancelled_at: new Date(), cancel_reason: `plata ofertei nu a reușit (${reason.slice(0, 80)})` },
      event: 'upsell.failed',
      data: { reason },
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
      "select 1 from orders where email = $1 and id <> $2 and created_at >= $3 and payment_status in ('paid','partially_refunded','awaiting_transfer','awaiting_collection') limit 1",
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
    if (!canFulfil(o) || !canMoveOrder(o.status, 'processing')) return { skip: `status_${o.status}` }
    return { patch: { status: 'processing' }, event: 'order.processing' }
  })
}

export function markShipped(orderId: string, source: Source, s: { courier: string; trackingNumber: string; trackingUrl?: string }) {
  return transition(orderId, source, async (o) => {
    if (!canFulfil(o) || !canMoveOrder(o.status, 'shipped')) return { skip: `status_${o.status}` }
    // Cash on delivery: by default the invoice is issued now, so it travels with the parcel. It stays unpaid.
    const fgo = getConfig().fgo
    const codInvoice = awaitsCollection(o) && o.invoiceStatus === 'none' ? { invoice_status: fgo ? (fgo.codInvoice === 'on_shipment' ? 'pending' : fgo.codInvoice === 'manual' ? 'manual' : 'none') : 'manual' } : {}
    return {
      patch: { status: 'shipped', courier: s.courier, tracking_number: s.trackingNumber, tracking_url: s.trackingUrl || null, shipped_at: new Date(), ...codInvoice },
      event: 'order.shipped',
      data: { courier: s.courier, trackingNumber: s.trackingNumber, ...(awaitsCollection(o) && { codAmount: o.codAmountMinor ?? o.totalMinor }) },
    }
  })
}

export function markDelivered(orderId: string, source: Source) {
  return transition(orderId, source, async (o) => {
    if (!canMoveOrder(o.status, 'delivered')) return { skip: `status_${o.status}` }
    return { patch: { status: 'delivered', delivered_at: new Date() }, event: 'order.delivered' }
  })
}

/**
 * Cancels an order that has not shipped, or a cash-on-delivery parcel refused at the door (nothing was
 * collected). A paid order must be refunded in Stripe or the bank separately.
 */
export function cancelOrder(orderId: string, source: Source, reason: string) {
  return transition(orderId, source, async (o) => {
    if (!canCancel(o)) return { skip: `status_${o.status}` }
    return { patch: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason.slice(0, 300) }, event: 'order.cancelled', data: { wasPaid: isPaid(o.paymentStatus), reason: reason.slice(0, 300) } }
  })
}

/**
 * The customer withdrew from a paid order (online form, email or phone): a return is expected.
 * Idempotent; the order's own state (shipped, delivered, ...) does not change.
 */
export function markReturnRequested(orderId: string, source: Source, via = 'formular') {
  return transition(orderId, source, async (o) => {
    if (o.returnStatus) return { skip: `return_${o.returnStatus}` }
    if (!isPurchased(o)) return { skip: `payment_${o.paymentStatus}` }
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
    if (!isPurchased(o) && o.paymentStatus !== 'refunded') return { skip: `payment_${o.paymentStatus}` }
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
  const email = (template: string, runAt?: Date): NewJob[] =>
    c.email.transport === 'none' ? [] : [{ kind: 'email.send', orderId: o.id, dedupeKey: `email:${template}:${o.id}`, payload: { template }, ...(runAt && { runAt }) }]
  // Our own mailbox (or files in development). The messages added with it (reminders, follow-up, team notes)
  // never go through GoHighLevel, which would send them with the NEUROS sender.
  const ownMail = c.email.transport === 'smtp' || c.email.transport === 'file'
  const later = (template: string, runAt: Date) => (ownMail ? email(template, runAt) : [])
  // The team's notifications (orders@), one per event and order; the delayed ones are rechecked before sending.
  const notifyOn = ownMail && !!c.email.notifyTo
  const notify = (event: string, runAt?: Date): NewJob[] =>
    notifyOn ? [{ kind: 'notify.send', orderId: o.id, dedupeKey: `notify:${event}:${o.id}`, payload: { event }, ...(runAt && { runAt }) }] : []
  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000)
  const prepOverdue = () => notify('prep_overdue', inDays(2))
  // An invoice already issued for money that is going back needs a credit note; without FGO_AUTO_STORNO a person does it.
  const stornoByHand = () => (o.fgoInvoiceNumber && !o.fgoStornoNumber && !c.fgo?.autoStorno ? notify('storno_needed') : [])

  // The card kept for the post-purchase offer is released as soon as the offer is settled.
  const release = (parentId: string, at?: Date): NewJob[] =>
    c.stripe ? [{ kind: 'upsell.release', orderId: parentId, dedupeKey: `upsell.release:${parentId}:${at ? 'expiry' : event}`, ...(at && { runAt: at }) }] : []

  switch (event) {
    case 'created':
      // A post-purchase order is paid on the spot or not at all: only the safety-net reconcile, never
      // an abandonment (a declined or failed offer is not an abandoned checkout).
      if (o.kind === 'upsell') return [{ kind: 'stripe.reconcile', orderId: o.id, dedupeKey: `reconcile:${o.id}`, runAt: new Date(Date.now() + 10 * 60_000) }]
      // Cash on delivery: confirmed at once. The confirmation email says what to pay the courier.
      if (o.paymentMethod === 'cash_on_delivery') return [...crm(), ...email('cod_confirmed'), ...notify('new_cod'), ...prepOverdue()]
      return o.paymentMethod === 'bank_transfer'
        ? [
            ...crm(),
            ...email('transfer_instructions'),
            ...notify('new_transfer'),
            // Reminder to the customer after 2 days and a note to the team after 5, both only if still unpaid.
            ...later('transfer_reminder', inDays(2)),
            ...notify('transfer_overdue', inDays(5)),
            ...(c.transferExpiryDays
              ? [{ kind: 'order.transfer_expiry' as const, orderId: o.id, dedupeKey: `transfer_expiry:${o.id}`, runAt: new Date(Date.now() + c.transferExpiryDays * 86_400_000) }]
              : []),
          ]
        : [
            // Safety net if Stripe's webhook never arrives; the webhook normally confirms within seconds.
            { kind: 'stripe.reconcile', orderId: o.id, dedupeKey: `reconcile:${o.id}`, runAt: new Date(Date.now() + 10 * 60_000) },
            { kind: 'order.abandon_check', orderId: o.id, dedupeKey: `abandon:${o.id}`, runAt: new Date(Date.now() + c.abandonAfterMinutes * 60_000) },
          ]
    case 'upsell.declined':
      return release(o.id)
    case 'upsell.failed':
      return o.parentOrderId ? release(o.parentOrderId) : []
    case 'payment.confirmed':
      return [
        ...(o.upsellStatus === 'offered' && o.upsellExpiresAt ? release(o.id, o.upsellExpiresAt) : []),
        ...(o.kind === 'upsell' && o.parentOrderId ? release(o.parentOrderId) : []),
        ...crm(),
        // The customer paid the courier in person: no "payment received" email for a collection.
        ...(o.paymentMethod === 'cash_on_delivery' ? [] : email(o.paymentMethod === 'card' ? 'order_confirmed' : 'payment_received')),
        ...(o.invoiceStatus === 'pending' ? [{ kind: 'fgo.invoice' as const, orderId: o.id, dedupeKey: `fgo.invoice:${o.id}` }] : []),
        // A collection (cash on delivery) is the end of the order, not news for the warehouse.
        ...(o.paymentMethod === 'cash_on_delivery'
          ? []
          : [...notify(o.kind === 'upsell' ? 'upsell_paid' : o.paymentMethod === 'card' ? 'new_card_paid' : 'transfer_paid'), ...prepOverdue()]),
      ]
    case 'payment.after_cancel':
      return [...crm(), ...notify('refund_after_cancel')]
    case 'order.abandoned':
    case 'order.processing':
      return crm()
    case 'order.delivered':
      // The service email the day after delivery (W6 P1), once per purchase: an added product shares its parent's parcel.
      return [
        ...crm(),
        ...(c.email.deliveryFollowup && o.kind === 'checkout' ? later('delivery_followup', inDays(1)) : []),
        // Cash on delivery: a note if the courier's settlement is still not recorded 10 days later. Nothing automatic.
        ...(o.paymentMethod === 'cash_on_delivery' ? notify('cod_uncollected', inDays(10)) : []),
      ]
    case 'order.shipped':
      return [
        ...crm(),
        ...email('order_shipped'),
        ...(o.invoiceStatus === 'pending' ? [{ kind: 'fgo.invoice' as const, orderId: o.id, dedupeKey: `fgo.invoice:${o.id}` }] : []),
        ...notify('delivery_overdue', inDays(5)),
      ]
    case 'return.requested':
      return crm()
    case 'return.received':
      return [...crm(), ...email('return_received'), ...notify('refund_after_return')]
    case 'payment.cancelled':
      // Never confirmed to the customer: only keep an existing CRM record in step.
      return o.ghlOpportunityId ? crm() : []
    case 'order.cancelled': {
      // An unpaid card attempt was never confirmed to the customer: no email, and no CRM record unless one exists.
      const known = o.paymentMethod !== 'card' || !!data.wasPaid
      // An invoice already issued (a refused cash-on-delivery parcel, a cancelled paid order) needs a credit
      // note: automatic with FGO_AUTO_STORNO=true, as for refunds; otherwise /admin lists it for the accountant.
      const storno = c.fgo?.autoStorno && o.fgoInvoiceNumber && !o.fgoStornoNumber ? [{ kind: 'fgo.storno' as const, orderId: o.id, dedupeKey: `fgo.storno:${o.id}` }] : []
      return [
        ...(known || o.ghlOpportunityId ? crm() : []),
        ...(known ? email('order_cancelled') : []),
        ...storno,
        ...(data.wasPaid ? notify('refund_after_cancel') : []),
        ...stornoByHand(),
      ]
    }
    case 'payment.refunded':
      return [
        ...crm(),
        ...email(data.full ? 'refund_full' : `refund_partial_${o.refundedMinor}`).map((j) => ({ ...j, payload: { template: 'refund_issued' } })),
        ...(data.full && c.fgo?.autoStorno && o.fgoInvoiceNumber ? [{ kind: 'fgo.storno' as const, orderId: o.id, dedupeKey: `fgo.storno:${o.id}` }] : []),
        ...(data.full ? stornoByHand() : []),
      ]
    default:
      return []
  }
}
