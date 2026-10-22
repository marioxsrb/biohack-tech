/**
 * Phase 3/4 end to end on the real catalog (no price mocks): NEUROS Amber frames across both
 * payment methods, landing attribution from the checkout request to the CRM, the fulfillment and
 * return lifecycle, and checkout recovery with a variant. External APIs are stubbed at the HTTP boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES } = await import('@/server/integrations/ghl')
const { recordWithdrawal } = await import('@/server/orders/withdrawal')
const { recoveryCart } = await import('@/server/marketing/recovery')
const { POST: checkout } = await import('@/app/api/checkout/route')

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
let db: Awaited<ReturnType<typeof freshDb>>

function fakeApis() {
  calls = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const raw = init.body ? String(init.body) : null
    const body = raw && raw.startsWith('{') ? JSON.parse(raw) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: '1', Link: 'https://fgo/f.pdf' } })
    if (url.includes('/conversations/messages')) return json({ messageId: 'm1', emailMessageId: 'e1' })
    if (url.includes('/contacts/search')) return json({ contacts: [] })
    if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
    if (url.includes('/tags')) return json({ tags: body?.tags })
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
    if (url.includes('/opportunities/search')) return json({ opportunities: [] })
    if (url.includes('/opportunities/')) return json({ opportunity: { id: 'opp-1' } }, init.method === 'POST' ? 201 : 200)
    return json({ message: 'not mocked' }, 404)
  })
}

const upserts = () => calls.filter((c) => c.url.includes('/contacts/upsert')).map((c) => c.body as { customFields: { key: string; field_value: string }[] })
const field = (key: string) => upserts().at(-1)?.customFields.find((f) => f.key === key)?.field_value
const tagCalls = () => calls.filter((c) => c.url.includes('/tags') && c.method === 'POST').flatMap((c) => (c.body?.tags as string[]) ?? [])
const templates = async (orderId: string) => (await jobs.forOrder(db, orderId)).filter((j) => j.kind === 'email.send').map((j) => String(j.payload.template))

beforeEach(async () => {
  db = await freshDb()
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

describe('payment matrix: NEUROS Amber frame × payment method', () => {
  const cases = [
    ['cat-eye-negru', 31500],
    ['cat-eye-bej', 31500],
    ['patrat-maro', 31500],
  ] as const
  for (const [variantId, amount] of cases) {
    for (const method of ['card', 'transfer'] as const) {
      it(`${variantId} by ${method}: canonical total, right initial state and follow-ups`, async () => {
        const { order } = await svc.placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId, quantity: 1 }]), form: { ...person, paymentMethod: method }, attemptId: `m-${variantId}-${method}` })
        expect(order.totalMinor).toBe(amount)
        expect(order.items[0]).toMatchObject({ variantId, unitPriceMinor: amount, sku: `ochelari-biohack/${variantId}` })
        const kinds = (await jobs.forOrder(db, order.id)).map((j) => j.kind).sort()
        if (method === 'card') {
          expect(order.paymentStatus).toBe('pending')
          expect(kinds).toEqual(['order.abandon_check', 'stripe.reconcile'])
        } else {
          expect(order.paymentStatus).toBe('awaiting_transfer')
          expect(kinds).toEqual(['email.send', 'ghl.sync'])
          expect(await templates(order.id)).toEqual(['transfer_instructions'])
        }
      })
    }
  }
})

describe('landing attribution: checkout request → order → CRM', () => {
  const req = (body: object) =>
    new Request('https://biohack-tech.ro/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.9' }, body: JSON.stringify(body) }) as never

  it('keeps the validated landing and UTM, reprices a tampered line, and syncs the source to GHL', async () => {
    const res = await checkout(
      req({
        lines: [{ productId: 'balance-wave', quantity: 1, unitAmount: 1, price: 1 }],
        order: { ...person, paymentMethod: 'transfer' },
        acceptedTerms: true,
        attemptId: 'lp-attempt-1',
        attribution: { lp: 'calm', lp_host: 'calm.biohack-tech.ro', utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'lansare', gclid: 'x', total: 1 },
      }),
    )
    expect(res.status).toBe(200)
    const { token } = await res.json()
    const order = (await orders.byToken(db, token))!
    expect(order.totalMinor).toBe(638000)
    // The cookie banner's marketing choice is kept too (none sent here: no Meta signal kept, no Purchase to Meta).
    expect(order.attribution).toEqual({
      cookieMarketing: false,
      landing: 'calm',
      landingHost: 'calm.biohack-tech.ro',
      landingPath: '/',
      utm: { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'lansare' },
    })
    await runDueJobs()
    expect(field('bt_last_order_source')).toBe('landing calm · facebook / paid / lansare')
  })

  it('an order through the main site is recorded as "site"; garbage attribution is dropped', async () => {
    const res = await checkout(req({ lines: [{ productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 }], order: { ...person, paymentMethod: 'transfer' }, acceptedTerms: true, attemptId: 'site-1', attribution: { lp: '../admin', lp_host: 'evil' } }))
    const order = (await orders.byToken(db, (await res.json()).token))!
    // Nothing remains: the landing fields were invalid.
    expect(order.attribution ?? {}).toEqual({ cookieMarketing: false })
    await runDueJobs()
    expect(field('bt_last_order_source')).toBe('site')
  })
})

describe('fulfillment and returns', () => {
  async function paidOrder(id = 'f-1') {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: id })
    await svc.confirmPayment(order.id, 'admin')
    return order
  }

  it('manual fulfillment: prepared, shipped with courier and AWB (email), delivered; nothing moves backwards or twice', async () => {
    const o = await paidOrder()
    expect((await svc.markDelivered(o.id, 'admin')).changed).toBe(false)
    expect((await svc.markProcessing(o.id, 'admin')).changed).toBe(true)
    expect((await svc.markShipped(o.id, 'admin', { courier: 'Curier ales de echipă', trackingNumber: 'AWB1' })).changed).toBe(true)
    expect((await svc.markShipped(o.id, 'admin', { courier: 'X', trackingNumber: 'AWB2' })).changed).toBe(false)
    expect((await svc.markDelivered(o.id, 'admin')).changed).toBe(true)
    expect((await svc.cancelOrder(o.id, 'admin', 'x')).changed).toBe(false)
    const after = (await orders.byId(db, o.id))!
    expect([after.status, after.trackingNumber, after.trackingUrl]).toEqual(['delivered', 'AWB1', null])
    expect(await templates(o.id)).toEqual(expect.arrayContaining(['payment_received', 'order_shipped']))
  })

  it('shipping an unpaid order is refused', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'f-unpaid' })
    expect((await svc.markShipped(order.id, 'admin', { courier: 'X', trackingNumber: '1' })).changed).toBe(false)
    expect((await svc.markReturnRequested(order.id, 'admin')).changed).toBe(false)
  })

  it('withdrawal form → return requested (CRM tag), then received (email + tag); each step once', async () => {
    const o = await paidOrder('f-2')
    await svc.markShipped(o.id, 'admin', { courier: 'X', trackingNumber: 'AWB9' })
    await svc.markDelivered(o.id, 'admin')
    const { matched } = await recordWithdrawal({ name: 'Ana Popescu', email: person.email, orderNumber: o.orderNumber, items: 'NEUROS Focus', message: '' })
    expect(matched).toBe(true)
    let now = (await orders.byId(db, o.id))!
    expect(now.returnStatus).toBe('requested')
    expect((await svc.markReturnRequested(o.id, 'admin')).changed).toBe(false)
    await runDueJobs()
    expect(tagCalls()).toContain('bt-retur-solicitat')

    expect((await svc.markReturnReceived(o.id, 'admin')).changed).toBe(true)
    expect((await svc.markReturnReceived(o.id, 'admin')).changed).toBe(false)
    now = (await orders.byId(db, o.id))!
    expect(now.returnStatus).toBe('received')
    expect(now.status).toBe('delivered')
    const w = (await db.query<{ status: string }>('select status from withdrawal_requests where order_id = $1', [o.id])).rows
    expect(w.map((r) => r.status)).toEqual(['received'])
    expect((await templates(o.id)).filter((t) => t === 'return_received')).toHaveLength(1)
    await runDueJobs()
    expect(tagCalls()).toContain('bt-retur-primit')

    // The refund is its own step and reaches W7 through the Rambursată stage.
    expect((await svc.recordRefund(o.id, 'admin', o.totalMinor)).changed).toBe(true)
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('refunded')
  })
})

describe('abandoned checkout regression with a variant', () => {
  it('a NEUROS Amber card attempt with consent is recoverable and the link restores the same frame', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 1 }]), form: { ...person, marketingConsent: true }, attemptId: 'ab-1' })
    await svc.markAbandonedIfUnpaid(order.id)
    const o = (await orders.byId(db, order.id))!
    expect([o.status, o.recoveryStatus]).toEqual(['abandoned', 'eligible'])
    expect(await recoveryCart(o.recoveryToken!)).toEqual([{ productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 1 }])
  })
})
