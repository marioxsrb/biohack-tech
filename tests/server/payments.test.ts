/**
 * Card payment lifecycle through the real webhook route, on an embedded PostgreSQL (PGlite).
 * Signatures are real HMACs (signPayload); Stripe's API is stubbed only for the reconciliation job
 * and the checkout's PaymentIntent reuse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { signPayload } = await import('@/server/integrations/stripe')
const { reconcileCardPayment } = await import('@/server/orders/reconcile')
const { getConfig, resetConfig } = await import('@/server/config')
const { POST: webhook } = await import('@/app/api/webhooks/stripe/route')
const { POST: checkout } = await import('@/app/api/checkout/route')

type Db = Awaited<ReturnType<typeof freshDb>>
let db: Db
let seq = 0
beforeEach(async () => {
  db = await freshDb()
})
afterEach(() => vi.unstubAllGlobals())

const cardOrder = async (piId = `pi_${++seq}`) => {
  const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: person, attemptId: `attempt-${++seq}` })
  await svc.attachPaymentIntent(order.id, piId)
  return { order: (await orders.byId(db, order.id))!, piId }
}
const event = (type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ id: `evt_${++seq}`, type, livemode: false, data: { object }, ...extra })
const intent = (o: { id: string; totalMinor: number }, piId: string, extra: Record<string, unknown> = {}) => ({
  id: piId, amount: o.totalMinor, amount_received: o.totalMinor, currency: 'ron', metadata: { order_id: o.id, order_number: 'x' }, ...extra,
})
const deliver = async (body: string, signature: string | null = signPayload(body, TEST_ENV.STRIPE_WEBHOOK_SECRET)) => {
  const res = await webhook(new Request('https://test/api/webhooks/stripe', { method: 'POST', body, headers: signature ? { 'stripe-signature': signature } : {} }) as NextRequest)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const eventTypes = async (orderId: string) => (await db.query<{ type: string }>('select type from order_events where order_id = $1 order by id', [orderId])).rows.map((r) => r.type)

describe('Stripe webhook route', () => {
  it('rejects missing, forged and tampered signatures and changes nothing', async () => {
    const { order, piId } = await cardOrder()
    const body = event('payment_intent.succeeded', intent(order, piId))
    expect((await deliver(body, null)).status).toBe(400)
    expect((await deliver(body, signPayload(body, 'whsec_forged'))).status).toBe(400)
    expect((await deliver(body.replace('"ron"', '"eur"'), signPayload(body, TEST_ENV.STRIPE_WEBHOOK_SECRET))).status).toBe(400)
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('pending')
  })

  it('BROWSER DISAPPEARS: the webhook alone makes the order paid and confirmed', async () => {
    // The customer paid and closed the tab: /comanda/<token> is never requested. Only Stripe calls us.
    const { order, piId } = await cardOrder()
    const res = await deliver(event('payment_intent.succeeded', intent(order, piId)))
    expect(res).toEqual({ status: 200, body: { received: true, outcome: 'paid' } })
    const o = (await orders.byId(db, order.id))!
    expect(o.paymentStatus).toBe('paid')
    expect(o.status).toBe('confirmed')
    expect(o.paidAt).toBeTruthy()
    // Downstream work was queued by the transaction, not by a page view.
    const kinds = (await db.query<{ kind: string }>('select kind from jobs where order_id = $1', [order.id])).rows.map((r) => r.kind)
    expect(kinds).toEqual(expect.arrayContaining(['fgo.invoice', 'email.send', 'ghl.sync']))
  })

  it('processes a redelivered event once and stores its outcome', async () => {
    const { order, piId } = await cardOrder()
    const body = event('payment_intent.succeeded', intent(order, piId))
    expect((await deliver(body)).body.outcome).toBe('paid')
    expect((await deliver(body)).body).toEqual({ received: true, duplicate: true })
    expect((await eventTypes(order.id)).filter((t) => t === 'payment.confirmed')).toHaveLength(1)
    const stored = (await db.query<{ outcome: string }>('select outcome from webhook_events')).rows
    expect(stored).toEqual([{ outcome: 'paid' }])
  })

  it('a declined card is recoverable: failed, then paid on retry', async () => {
    const { order, piId } = await cardOrder()
    const failed = await deliver(event('payment_intent.payment_failed', intent(order, piId, { amount_received: 0, last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' } })))
    expect(failed.body.outcome).toBe('failed')
    expect((await orders.byId(db, order.id))!).toMatchObject({ paymentStatus: 'failed', status: 'pending' })
    expect((await deliver(event('payment_intent.succeeded', intent(order, piId)))).body.outcome).toBe('paid')
    expect((await orders.byId(db, order.id))!).toMatchObject({ paymentStatus: 'paid', status: 'confirmed' })
  })

  it('payment_intent.canceled closes an unpaid order and never touches a paid one', async () => {
    const a = await cardOrder()
    expect((await deliver(event('payment_intent.canceled', intent(a.order, a.piId, { amount_received: 0 })))).body.outcome).toBe('cancelled')
    expect((await orders.byId(db, a.order.id))!).toMatchObject({ paymentStatus: 'cancelled', status: 'cancelled' })
    expect(await eventTypes(a.order.id)).toContain('payment.cancelled')

    const b = await cardOrder()
    await deliver(event('payment_intent.succeeded', intent(b.order, b.piId)))
    expect((await deliver(event('payment_intent.canceled', intent(b.order, b.piId)))).body.outcome).toBe('payment_paid')
    expect((await orders.byId(db, b.order.id))!).toMatchObject({ paymentStatus: 'paid', status: 'confirmed' })
  })

  it('refuses events for another PaymentIntent, another amount or currency', async () => {
    const { order, piId } = await cardOrder()
    expect((await deliver(event('payment_intent.succeeded', intent(order, 'pi_other')))).body.outcome).toBe('intent_mismatch')
    expect((await deliver(event('payment_intent.payment_failed', intent(order, 'pi_other')))).body.outcome).toBe('intent_mismatch')
    expect((await deliver(event('payment_intent.succeeded', intent(order, piId, { amount_received: 100 })))).body.outcome).toBe('amount_mismatch')
    expect((await deliver(event('payment_intent.succeeded', intent(order, piId, { currency: 'eur' })))).body.outcome).toBe('amount_mismatch')
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('pending')
  })

  it('ignores events from the other Stripe mode and events for unknown orders', async () => {
    const { order, piId } = await cardOrder()
    expect((await deliver(event('payment_intent.succeeded', intent(order, piId), { livemode: true }))).body).toEqual({ ignored: 'mode mismatch' })
    expect((await deliver(event('payment_intent.succeeded', { id: 'pi_nobody', amount_received: 1, currency: 'ron', metadata: {} }))).body.outcome).toBe('order_not_found')
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('pending')
  })
})

describe('Stripe reconciliation job (lost webhook safety net)', () => {
  const stubStripe = (pi: Record<string, unknown>) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(pi), { status: 200, headers: { 'content-type': 'application/json' } })))

  it('confirms a payment Stripe reports as succeeded, once', async () => {
    const { order, piId } = await cardOrder()
    stubStripe({ ...intent(order, piId), status: 'succeeded', client_secret: 'cs' })
    expect(await reconcileCardPayment(order.id)).toBe('paid')
    expect(await reconcileCardPayment(order.id)).toBe('already paid')
    expect((await orders.byId(db, order.id))!).toMatchObject({ paymentStatus: 'paid', status: 'confirmed' })
    expect(await eventTypes(order.id)).toContain('payment.confirmed')
  })

  it('closes an order whose PaymentIntent was cancelled, and leaves an open one alone', async () => {
    const a = await cardOrder()
    stubStripe({ ...intent(a.order, a.piId), status: 'canceled', client_secret: 'cs' })
    expect(await reconcileCardPayment(a.order.id)).toBe('cancelled')
    const b = await cardOrder()
    stubStripe({ ...intent(b.order, b.piId), status: 'requires_payment_method', client_secret: 'cs' })
    expect(await reconcileCardPayment(b.order.id)).toBe('stripe requires_payment_method')
    expect((await orders.byId(db, b.order.id))!.paymentStatus).toBe('pending')
  })

  it('never confirms a wrong amount', async () => {
    const { order, piId } = await cardOrder()
    stubStripe({ ...intent(order, piId, { amount_received: 1 }), status: 'succeeded', client_secret: 'cs' })
    expect(await reconcileCardPayment(order.id)).toBe('amount_mismatch')
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('pending')
  })
})

describe('checkout: PaymentIntent reuse', () => {
  const place = async (attemptId: string) => {
    const res = await checkout(new Request('https://test/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++seq}` },
      body: JSON.stringify({ lines: [{ productId: 'balance-wave', quantity: 1 }], order: person, acceptedTerms: true, attemptId }),
    }) as NextRequest)
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }
  /** A tiny Stripe: POST creates the PaymentIntent (echoing our metadata), GET returns its current state. */
  const fakeStripe = () => {
    const state = { pi: null as Record<string, unknown> | null, creates: 0 }
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      // The card order's Stripe customer (for the post-purchase offer).
      if (String(url).endsWith('/v1/customers')) return new Response(JSON.stringify({ id: 'cus_reuse' }), { status: 200 })
      if (init?.method === 'POST') {
        const form = new URLSearchParams(String(init.body))
        state.creates++
        state.pi ??= { id: 'pi_reuse', status: 'requires_payment_method', amount: Number(form.get('amount')), amount_received: 0, currency: form.get('currency'), client_secret: 'cs_1', metadata: { order_id: form.get('metadata[order_id]') }, payment_method_types: form.getAll('payment_method_types[0]'), customer: form.get('customer'), setup_future_usage: form.get('setup_future_usage') }
      }
      return new Response(JSON.stringify(state.pi), { status: 200 })
    }))
    return state
  }

  it('creates a card-only PaymentIntent for the order total and reuses it for the same attempt', async () => {
    const stripe = fakeStripe()
    const first = await place('attempt-reuse')
    expect(first.body).toMatchObject({ method: 'card', clientSecret: 'cs_1' })
    expect(stripe.pi).toMatchObject({ amount: 638000, currency: 'ron', payment_method_types: ['card'], customer: 'cus_reuse', setup_future_usage: 'on_session' })
    const again = await place('attempt-reuse')
    expect(again.body).toMatchObject({ method: 'card', clientSecret: 'cs_1', orderNumber: first.body.orderNumber })
    expect(stripe.creates).toBe(1)
  })

  it('does not offer a second payment once Stripe has taken it, and refuses a cancelled one', async () => {
    const stripe = fakeStripe()
    await place('attempt-paid')
    stripe.pi = { ...stripe.pi, status: 'succeeded', amount_received: 638000 }
    expect((await place('attempt-paid')).body).toMatchObject({ method: 'card', submitted: true })
    stripe.pi = { ...stripe.pi, status: 'processing' }
    expect((await place('attempt-paid')).body).toMatchObject({ submitted: true })
    stripe.pi = { ...stripe.pi, status: 'canceled' }
    expect((await place('attempt-paid')).status).toBe(409)
  })

  it('refuses a PaymentIntent that does not belong to the order', async () => {
    const stripe = fakeStripe()
    await place('attempt-foreign')
    stripe.pi = { ...stripe.pi, metadata: { order_id: 'someone-else' } }
    const res = await place('attempt-foreign')
    expect(res.status).toBe(502)
    expect(res.body).not.toHaveProperty('clientSecret')
  })
})

describe('order numbers under concurrency', () => {
  it('are unique and gap-free within a day', async () => {
    const placed = await Promise.all(
      Array.from({ length: 25 }, (_, i) => svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: `concurrent-${i}` })),
    )
    const numbers = placed.map((p) => p.order.orderNumber)
    expect(new Set(numbers).size).toBe(25)
    const suffixes = numbers.map((n) => Number(n.split('-')[2])).sort((a, b) => a - b)
    expect(suffixes).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
  })
})

describe('configuration', () => {
  it('accepts the publishable key under NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', () => {
    vi.stubEnv('STRIPE_PUBLISHABLE_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_alias')
    resetConfig()
    expect(getConfig().stripe?.publishableKey).toBe('pk_test_alias')
  })
})
