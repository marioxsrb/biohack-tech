/**
 * Operational lifecycle: canonical order/payment change → outbox → FGO / GoHighLevel / email,
 * with outages, retries, duplicates, abandonment and transfer expiry. External APIs are stubbed at
 * the HTTP boundary (same approach as runner.test.ts); our code runs unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES } = await import('@/server/integrations/ghl')

type Call = { url: string; method: string; body: Record<string, unknown> | null; failed?: boolean }
let calls: Call[]
let mode: { ghl: 'ok' | 'down' | 'reject'; email: 'ok' | 'down'; stripePi: string }
let db: Awaited<ReturnType<typeof freshDb>>

function fakeApis() {
  calls = []
  let invoiceNo = 100
  const opps = new Map<string, string>()
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const raw = init.body ? String(init.body) : null
    const body = raw && raw.startsWith('{') ? JSON.parse(raw) : null
    const call: Call = { url, method: init.method ?? 'GET', body }
    calls.push(call)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('api.stripe.com') || url.includes('/v1/payment_intents/')) {
      const id = url.split('/payment_intents/')[1]
      const o = (await db.query<{ id: string; total_minor: number }>('select id, total_minor from orders where stripe_payment_intent_id = $1', [id])).rows[0]
      return json({ id, status: mode.stripePi, amount: o?.total_minor, amount_received: mode.stripePi === 'succeeded' ? o?.total_minor : 0, currency: 'ron', client_secret: 'cs', metadata: { order_id: o?.id } })
    }
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo), Link: 'https://fgo/f.pdf' } })
    if (url.includes('leadconnectorhq.com')) {
      if (mode.ghl !== 'ok') call.failed = true
      if (mode.ghl === 'down') return json({ message: 'Service Unavailable' }, 503)
      if (mode.ghl === 'reject') return json({ message: ['customFields must be an array'] }, 422)
      if (url.includes('/conversations/messages')) {
        if (mode.email === 'down') {
          call.failed = true
          return json({ message: 'email provider unavailable' }, 502)
        }
        return json({ messageId: 'm1', emailMessageId: `e${calls.length}` })
      }
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: body?.tags })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
      if (url.includes('/opportunities/search')) {
        const q = new URL(url).searchParams.get('q')!
        return json({ opportunities: opps.has(q) ? [{ id: opps.get(q), name: `${q} · x` }] : [] })
      }
      if (url.endsWith('/opportunities/') && init.method === 'POST') {
        const id = `opp-${opps.size + 1}`
        opps.set(String(body!.name).split(' · ')[0], id)
        return json({ opportunity: { id } }, 201)
      }
      if (url.includes('/opportunities/') && init.method === 'PUT') return json({ opportunity: {} })
    }
    return json({ message: 'not mocked' }, 404)
  })
}

const count = (part: string, method?: string) => calls.filter((c) => c.url.includes(part) && (!method || c.method === method)).length
/** Subjects of emails actually delivered (failed attempts excluded). */
const emails = () => calls.filter((c) => c.url.includes('/conversations/messages') && c.body && !c.failed).map((c) => String(c.body!.subject))
const jobsOf = async (orderId: string) => (await jobs.forOrder(db, orderId)).map((j) => `${j.kind}${j.payload.template ? `:${j.payload.template}` : ''}=${j.status}`)
/** Make every pending/retry job due now and run the queue (a retry normally waits for its backoff). */
async function runNow() {
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
}
const card = async (attemptId: string) => {
  const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: person, attemptId })
  await svc.attachPaymentIntent(order.id, `pi_${attemptId}`)
  return order
}

beforeEach(async () => {
  db = await freshDb()
  mode = { ghl: 'ok', email: 'ok', stripePi: 'requires_payment_method' }
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

describe('card payment → operations', () => {
  it('paid: exactly one FGO invoice, one GHL opportunity, one confirmation email, even when the event repeats', async () => {
    const o = await card('c1')
    for (let i = 0; i < 3; i++) await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron', paymentIntentId: `pi_c1` })
    const queued = (await jobs.forOrder(db, o.id)).filter((j) => ['fgo.invoice', 'ghl.sync', 'email.send'].includes(j.kind))
    expect(queued.map((j) => `${j.kind}${j.payload.template ? `:${j.payload.template}` : ''}`).sort()).toEqual(['email.send:order_confirmed', 'fgo.invoice', 'ghl.sync'])
    await runNow()
    await runNow()
    expect(count('/factura/emitere')).toBe(1)
    expect(count('/opportunities/', 'POST')).toBe(1)
    expect(emails()).toEqual([`Comanda ta Biohack Tech #${o.orderNumber}`, `Factura pentru comanda #${o.orderNumber}`])
    expect((await orders.byId(db, o.id))!).toMatchObject({ paymentStatus: 'paid', status: 'confirmed', invoiceStatus: 'issued', ghlOpportunityId: 'opp-1' })
  })

  it('a failed card payment sends nothing and creates no CRM record until the abandonment policy says so', async () => {
    const o = await card('c2')
    await svc.recordPaymentFailure(o.id, 'stripe.webhook', 'card_declined', 'pi_c2')
    await svc.recordPaymentFailure(o.id, 'stripe.webhook', 'card_declined', 'pi_c2')
    await runDueJobs()
    expect(emails()).toEqual([])
    expect(count('leadconnectorhq.com')).toBe(0)
    expect((await orders.byId(db, o.id))!).toMatchObject({ paymentStatus: 'failed', status: 'pending' })
  })
})

describe('bank transfer → operations', () => {
  it('awaiting: instructions + CRM; confirmed by an operator: the same paid lifecycle as card, once', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 't1' })
    await runNow()
    expect(emails()).toEqual([`Comanda #${order.orderNumber}: datele pentru transfer`])
    expect(count('/factura/emitere')).toBe(0)
    const instructions = calls.find((c) => c.url.includes('/conversations/messages'))!.body!
    expect(String(instructions.message)).toContain(TEST_ENV.BANK_BENEFICIARY)
    expect(String(instructions.message)).toContain('RO49 AAAA 1B31 0075 9384 0000')
    expect(String(instructions.message)).toContain(`Comanda ${order.orderNumber}`)
    expect(String(instructions.message)).toContain('2.490 lei')

    const first = await svc.confirmPayment(order.id, 'admin')
    const again = await svc.confirmPayment(order.id, 'admin')
    expect([first.changed, again.changed, again.reason]).toEqual([true, false, 'already_paid'])
    await runNow()
    await runNow()
    expect(count('/factura/emitere')).toBe(1)
    expect(count('/opportunities/', 'POST')).toBe(1)
    expect(emails()).toEqual([`Comanda #${order.orderNumber}: datele pentru transfer`, `Am primit plata pentru comanda #${order.orderNumber}`, `Factura pentru comanda #${order.orderNumber}`])
    expect(calls.filter((c) => c.method === 'PUT').at(-1)!.body!.pipelineStageId).toBe('stage-2')
  })

  it('an operator cannot mark a card order paid: only Stripe confirms card money', async () => {
    const o = await card('c3')
    const r = await svc.confirmPayment(o.id, 'admin')
    expect([r.changed, r.reason]).toEqual([false, 'card_payment_confirmed_by_stripe_only'])
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('pending')
  })
})

describe('outages never undo a payment, and every task survives for a retry', () => {
  it('GoHighLevel down: order stays paid, CRM and email retry, then succeed without duplicates', async () => {
    const o = await card('g1')
    mode.ghl = 'down'
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('paid')
    const waiting = await jobs.forOrder(db, o.id)
    expect(waiting.filter((j) => j.kind === 'ghl.sync' || j.payload.template === 'order_confirmed').map((j) => j.status)).toEqual(['retry', 'retry'])
    expect(waiting.find((j) => j.kind === 'ghl.sync')!.lastError).toContain('503')
    mode.ghl = 'ok'
    await runNow()
    await runNow()
    expect(count('/opportunities/', 'POST')).toBe(1)
    expect(emails().filter((s) => s.startsWith('Comanda ta'))).toHaveLength(1)
  })

  it('email provider down: order stays paid, the email retries and is sent once', async () => {
    const o = await card('e1')
    mode.email = 'down'
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('paid')
    expect(await jobsOf(o.id)).toContain('email.send:order_confirmed=retry')
    mode.email = 'ok'
    await runNow()
    expect(await jobsOf(o.id)).toContain('email.send:order_confirmed=done')
    await runNow()
    expect(emails().filter((s) => s.startsWith('Comanda ta'))).toHaveLength(1)
  })

  it('a permanent CRM rejection stops for a person instead of retrying forever; a manual retry is safe', async () => {
    const o = await card('g2')
    mode.ghl = 'reject'
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    const crmJob = (await jobs.forOrder(db, o.id)).find((j) => j.kind === 'ghl.sync')!
    expect([crmJob.status, crmJob.attempts]).toEqual(['failed', 1])
    expect((await jobs.problems(db)).map((j) => j.id)).toContain(crmJob.id)
    await runNow()
    expect((await jobs.forOrder(db, o.id)).find((j) => j.id === crmJob.id)!.attempts).toBe(1)
    mode.ghl = 'ok'
    await jobs.retry(db, { id: crmJob.id })
    await runNow()
    await jobs.retry(db, { orderId: o.id })
    await runNow()
    expect(count('/opportunities/', 'POST')).toBe(1)
  })
})

describe('abandoned checkout', () => {
  const dueAbandon = (orderId: string) => db.query("update jobs set run_at = now() where order_id = $1 and kind = 'order.abandon_check'", [orderId])

  it('an unpaid card order is abandoned only after the timeout, moved in GHL, kept, and emailed by nobody on the site', async () => {
    const o = await card('a1')
    await runDueJobs() // nothing due yet: the policy waits ABANDON_AFTER_MINUTES (60 by default)
    expect((await orders.byId(db, o.id))!.status).toBe('pending')
    await dueAbandon(o.id)
    await runDueJobs()
    await runNow()
    const after = (await orders.byId(db, o.id))!
    expect(after.status).toBe('abandoned')
    expect(calls.find((c) => c.url.endsWith('/opportunities/'))!.body!).toMatchObject({ pipelineStageId: 'stage-1', status: 'abandoned' })
    expect(emails()).toEqual([])
    // A late payment still counts.
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    expect((await orders.byId(db, o.id))!).toMatchObject({ status: 'confirmed', paymentStatus: 'paid' })
  })

  it('an order paid before the timeout is never abandoned', async () => {
    const o = await card('a2')
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await dueAbandon(o.id)
    await runDueJobs()
    expect((await orders.byId(db, o.id))!.status).toBe('confirmed')
  })

  it('a payment whose webhook was lost is confirmed by the abandonment check, not abandoned', async () => {
    const o = await card('a3')
    mode.stripePi = 'succeeded'
    await dueAbandon(o.id)
    await runDueJobs()
    expect((await orders.byId(db, o.id))!).toMatchObject({ status: 'confirmed', paymentStatus: 'paid' })
  })

  it('if Stripe cannot be asked, the order is not abandoned yet: the check retries', async () => {
    const o = await card('a4')
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }))
    await dueAbandon(o.id)
    await runDueJobs()
    expect((await orders.byId(db, o.id))!.status).toBe('pending')
    expect(await jobsOf(o.id)).toContain('order.abandon_check=retry')
  })
})

describe('unpaid bank transfers (optional expiry)', () => {
  it('is off by default: no expiry job', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'x1' })
    expect((await jobs.forOrder(db, order.id)).map((j) => j.kind)).not.toContain('order.transfer_expiry')
  })

  it('with TRANSFER_EXPIRY_DAYS: cancels a transfer that never arrived (with a cancellation email), never a paid one', async () => {
    db = await freshDb({ ...TEST_ENV, TRANSFER_EXPIRY_DAYS: '5' })
    fakeApis()
    const place = (a: string) => svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: a })
    const unpaid = (await place('x2')).order
    const paid = (await place('x3')).order
    const expiry = (await jobs.forOrder(db, unpaid.id)).find((j) => j.kind === 'order.transfer_expiry')!
    expect(expiry.runAt.getTime() - unpaid.createdAt.getTime()).toBeGreaterThan(4.9 * 86_400_000)
    await svc.confirmPayment(paid.id, 'admin')
    await db.query("update jobs set run_at = now() where kind = 'order.transfer_expiry'")
    await runNow()
    await runNow()
    expect((await orders.byId(db, unpaid.id))!).toMatchObject({ status: 'cancelled', paymentStatus: 'awaiting_transfer' })
    expect((await orders.byId(db, paid.id))!).toMatchObject({ status: 'confirmed', paymentStatus: 'paid' })
    expect(emails()).toContain(`Comanda #${unpaid.orderNumber} a fost anulată`)
  })
})
