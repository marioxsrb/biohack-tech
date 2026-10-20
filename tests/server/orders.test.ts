import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))

const { freshDb, person, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')

let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb()
})

const cart = () => lines([{ productId: 'balance-wave', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 2 }])
const jobKeys = async (orderId: string) => (await jobs.forOrder(db, orderId)).map((j) => j.dedupeKey.split(':').slice(0, 2).join(':')).sort()

describe('placing orders', () => {
  it('stores a snapshot with server-side totals and a readable number', async () => {
    const { order, created } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    expect(created).toBe(true)
    expect(order.orderNumber).toMatch(/^BHT-\d{8}-0001$/)
    expect(order.totalMinor).toBe(638000 + 2 * 19950)
    expect(order.shippingMinor).toBe(0)
    expect(order.items.map((i) => [i.productName, i.variantName, i.quantity, i.unitPriceMinor])).toEqual([
      ['NEUROS Calm', null, 1, 638000],
      ['NEUROS Amber', 'Cat eye · Bej · Galbene', 2, 19950],
    ])
    expect(order.status).toBe('pending')
    expect(order.paymentStatus).toBe('pending')
    expect(order.publicToken.length).toBeGreaterThanOrEqual(30)
  })

  it('returns the same order for the same attempt (double click, retry)', async () => {
    const a = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    const [b, c] = await Promise.all([
      svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' }),
      svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' }),
    ])
    expect(b.order.id).toBe(a.order.id)
    expect(c.order.id).toBe(a.order.id)
    expect(b.created || c.created).toBe(false)
    expect((await db.query('select count(*)::int as n from orders')).rows[0].n).toBe(1)
  })

  it('creates a new order when the cart or form changed', async () => {
    const a = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    const b = await svc.placeOrder({ lines: cart(), form: { ...person, phone: '0733000000' }, attemptId: 'attempt-1' })
    expect(b.order.id).not.toBe(a.order.id)
    expect(b.order.orderNumber).toMatch(/-0002$/)
  })

  it('queues the transfer email and CRM sync for a bank transfer, and only a Stripe reconciliation and an abandonment check for a card', async () => {
    const t = await svc.placeOrder({ lines: cart(), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'attempt-t' })
    expect(t.order.paymentStatus).toBe('awaiting_transfer')
    expect(await jobKeys(t.order.id)).toEqual(['email:transfer_instructions', 'ghl.sync:' + t.order.id])
    const c = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-c' })
    expect((await jobKeys(c.order.id)).sort()).toEqual(['abandon:' + c.order.id, 'reconcile:' + c.order.id])
  })
})

describe('payment', () => {
  it('confirms once, whatever replays happen (webhook + reconciliation job + retry)', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    const reported = { amountMinor: order.totalMinor, currency: 'ron', paymentIntentId: undefined }
    const results = await Promise.all([svc.confirmPayment(order.id, 'stripe.webhook', reported), svc.confirmPayment(order.id, 'stripe.reconcile', reported)])
    const again = await svc.confirmPayment(order.id, 'stripe.webhook', reported)
    expect(results.filter((r) => r.changed)).toHaveLength(1)
    expect(again.changed).toBe(false)
    const o = (await orders.byId(db, order.id))!
    expect([o.status, o.paymentStatus, o.invoiceStatus]).toEqual(['confirmed', 'paid', 'pending'])
    const events = (await orders.events(db, order.id)).filter((e) => e.type === 'payment.confirmed')
    expect(events).toHaveLength(1)
    const keys = await jobKeys(order.id)
    expect(keys.filter((k) => k.startsWith('fgo.invoice'))).toHaveLength(1)
    expect(keys.filter((k) => k === 'email:order_confirmed')).toHaveLength(1)
  })

  it('refuses a payment whose amount or currency differs from the order', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    expect((await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: 100, currency: 'ron' })).reason).toBe('amount_mismatch')
    expect((await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: order.totalMinor, currency: 'eur' })).reason).toBe('amount_mismatch')
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('pending')
  })

  it('lets a failed card payment be retried and then paid', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    expect((await svc.recordPaymentFailure(order.id, 'stripe.webhook', 'card_declined')).changed).toBe(true)
    expect((await svc.confirmPayment(order.id, 'stripe.webhook')).changed).toBe(true)
    // No invoice or email was queued by the failure itself.
    expect((await jobKeys(order.id)).filter((k) => k.startsWith('fgo')).length).toBe(1)
  })

  it('marks an unpaid card order abandoned, and still accepts a late payment', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    expect((await svc.markAbandonedIfUnpaid(order.id)).changed).toBe(true)
    expect((await svc.confirmPayment(order.id, 'stripe.webhook')).order!.status).toBe('confirmed')
  })

  it('never marks a bank transfer as abandoned or paid on its own', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'attempt-1' })
    expect((await svc.markAbandonedIfUnpaid(order.id)).changed).toBe(false)
    expect((await svc.recordPaymentFailure(order.id, 'system', 'x')).changed).toBe(false)
    expect((await orders.byId(db, order.id))!.paymentStatus).toBe('awaiting_transfer')
  })

  it('records partial then full refunds from cumulative amounts, once each', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-1' })
    await svc.confirmPayment(order.id, 'stripe.webhook')
    expect((await svc.recordRefund(order.id, 'stripe.webhook', 19950)).order!.paymentStatus).toBe('partially_refunded')
    expect((await svc.recordRefund(order.id, 'stripe.webhook', 19950)).changed).toBe(false)
    const full = await svc.recordRefund(order.id, 'stripe.webhook', order.totalMinor)
    expect(full.order!.paymentStatus).toBe('refunded')
    expect(full.order!.refundedMinor).toBe(order.totalMinor)
  })
})

describe('fulfilment', () => {
  it('ships only paid orders, then delivers', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'attempt-1' })
    expect((await svc.markShipped(order.id, 'admin', { courier: 'Curier', trackingNumber: 'AWB1' })).changed).toBe(false)
    await svc.confirmPayment(order.id, 'admin')
    const shipped = await svc.markShipped(order.id, 'admin', { courier: 'Curier', trackingNumber: 'AWB1', trackingUrl: 'https://x/AWB1' })
    expect(shipped.order).toMatchObject({ status: 'shipped', courier: 'Curier', trackingNumber: 'AWB1' })
    expect((await svc.cancelOrder(order.id, 'admin', 'x')).changed).toBe(false)
    expect((await svc.markDelivered(order.id, 'admin')).order!.status).toBe('delivered')
    expect(await jobKeys(order.id)).toContain('email:order_shipped')
  })

  it('cancels an unpaid transfer with an email, and an abandoned card attempt without one', async () => {
    const t = await svc.placeOrder({ lines: cart(), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'attempt-t' })
    await svc.cancelOrder(t.order.id, 'admin', 'client')
    expect(await jobKeys(t.order.id)).toContain('email:order_cancelled')
    const c = await svc.placeOrder({ lines: cart(), form: person, attemptId: 'attempt-c' })
    await svc.cancelOrder(c.order.id, 'admin', 'test')
    expect(await jobKeys(c.order.id)).not.toContain('email:order_cancelled')
  })
})

describe('outbox', () => {
  it('claims due jobs once, retries with backoff and gives up after the last attempt', async () => {
    const { order } = await svc.placeOrder({ lines: cart(), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'attempt-1' })
    const first = await jobs.claim(db, 10)
    expect(first.map((j) => j.kind).sort()).toEqual(['email.send', 'ghl.sync'])
    expect(await jobs.claim(db, 10)).toHaveLength(0)
    const job = first[0]
    expect(await jobs.fail(db, job, 'timeout')).toBe(false)
    expect(await jobs.claim(db, 10)).toHaveLength(0) // scheduled in the future
    expect(await jobs.fail(db, { ...job, attempts: 8 }, 'still down')).toBe(true)
    expect((await jobs.problems(db)).map((j) => j.id)).toContain(job.id)
    await jobs.retry(db, { orderId: order.id })
    expect((await jobs.claim(db, 10)).map((j) => j.id)).toContain(job.id)
  })
})
