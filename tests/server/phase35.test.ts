/**
 * Phase 3.5 on the real catalog: discounted orders across Stripe / transfer / FGO / GHL / email, the
 * post-purchase offer (one-click, SCA, decline, failure, idempotency, access), and the contact form.
 * Stripe and GoHighLevel are stubbed at the HTTP boundary; our code runs unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { getConfig } = await import('@/server/config')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { contactPayload, STAGES } = await import('@/server/integrations/ghl')
const { renderEmail } = await import('@/server/integrations/email/templates')
const { offerFor } = await import('@/server/orders/upsell')
const { enquiries } = await import('@/server/enquiries')
const { signPayload } = await import('@/server/integrations/stripe')
const { POST: checkout } = await import('@/app/api/checkout/route')
const { POST: upsell } = await import('@/app/api/upsell/route')
const { POST: contact } = await import('@/app/api/contact/route')
const { POST: webhook } = await import('@/app/api/webhooks/stripe/route')

type Call = { url: string; method: string; form: URLSearchParams | null; json: Record<string, unknown> | null; idem: string | null }
let calls: Call[]
let db: Awaited<ReturnType<typeof freshDb>>
let upsellMode: 'succeeded' | 'requires_action' | 'declined'
let ghlDown: boolean
const pis = new Map<string, Record<string, unknown>>()
let ip = 0

function fakeApis() {
  calls = []
  pis.clear()
  upsellMode = 'succeeded'
  ghlDown = false
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const raw = init.body ? String(init.body) : null
    const headers = (init.headers ?? {}) as Record<string, string>
    const call: Call = { url, method: init.method ?? 'GET', form: raw && !raw.startsWith('{') ? new URLSearchParams(raw) : null, json: raw?.startsWith('{') ? JSON.parse(raw) : null, idem: headers['Idempotency-Key'] ?? null }
    calls.push(call)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/v1/customers')) return json({ id: 'cus_1' })
    if (url.includes('/v1/payment_methods/') && url.endsWith('/detach')) return json({ id: 'pm_1' })
    if (url.match(/\/v1\/payment_intents\/[^/]+\/cancel$/)) {
      const id = url.split('/payment_intents/')[1].split('/')[0]
      pis.set(id, { ...pis.get(id), status: 'canceled' })
      return json(pis.get(id))
    }
    if (url.endsWith('/v1/payment_intents') && call.method === 'POST') {
      const existing = [...pis.values()].find((p) => p.idem === call.idem)
      if (existing) return json(existing)
      const f = call.form!
      const id = `pi_${pis.size + 1}`
      const isUpsell = f.get('confirm') === 'true'
      if (isUpsell && upsellMode === 'declined') {
        pis.set(id, { id, idem: call.idem, status: 'requires_payment_method', amount: Number(f.get('amount')), amount_received: 0, currency: 'ron', client_secret: `${id}_secret`, metadata: { order_id: f.get('metadata[order_id]') } })
        return json({ error: { message: 'Your card was declined.', code: 'card_declined', decline_code: 'insufficient_funds', payment_intent: { id } } }, 402)
      }
      const status = isUpsell ? upsellMode : 'requires_payment_method'
      const pi = {
        id,
        idem: call.idem,
        status,
        amount: Number(f.get('amount')),
        amount_received: status === 'succeeded' ? Number(f.get('amount')) : 0,
        currency: 'ron',
        client_secret: `${id}_secret`,
        metadata: { order_id: f.get('metadata[order_id]') },
        payment_method: f.get('payment_method'),
        customer: f.get('customer'),
      }
      pis.set(id, pi)
      return json(pi)
    }
    if (url.includes('/v1/payment_intents/')) return json(pis.get(url.split('/payment_intents/')[1]))
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: '1', Link: 'https://fgo/f.pdf' } })
    if (url.includes('leadconnectorhq.com')) {
      if (ghlDown) return json({ message: 'down' }, 503)
      if (url.includes('/conversations/messages')) return json({ messageId: 'm1', emailMessageId: 'e1' })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: call.json?.tags })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
      if (url.includes('/opportunities/search')) return json({ opportunities: [] })
      if (url.includes('/opportunities/')) return json({ opportunity: { id: 'opp-1' } }, init.method === 'POST' ? 201 : 200)
    }
    return json({ message: 'not mocked' }, 404)
  })
}

beforeEach(async () => {
  db = await freshDb()
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

const post = (fn: (r: NextRequest) => Promise<Response>, url: string, body: unknown, rawBody?: string) =>
  fn(new Request(`https://biohack-tech.ro${url}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.1.0.${++ip}` }, body: rawBody ?? JSON.stringify(body) }) as NextRequest)

async function placeCard(l: { productId: string; variantId?: string; quantity: number }[], attemptId = `a-${Math.random()}`) {
  const res = await post(checkout, '/api/checkout', { lines: l, order: person, acceptedTerms: true, attemptId })
  const data = await res.json()
  return (await orders.byToken(db, data.token))!
}
async function payByWebhook(o: { id: string; totalMinor: number; stripePaymentIntentId: string | null }, pm = 'pm_1') {
  const body = JSON.stringify({ id: `evt_${Math.random()}`, type: 'payment_intent.succeeded', livemode: false, data: { object: { id: o.stripePaymentIntentId, amount: o.totalMinor, amount_received: o.totalMinor, currency: 'ron', payment_method: pm, metadata: { order_id: o.id } } } })
  const res = await webhook(new Request('https://t/api/webhooks/stripe', { method: 'POST', body, headers: { 'stripe-signature': signPayload(body, TEST_ENV.STRIPE_WEBHOOK_SECRET) } }) as NextRequest)
  return (await res.json()) as { outcome: string }
}
// The routes start a background run (kickJobs); the second call runs whatever that one did not see.
const drain = async () => {
  await runDueJobs()
  await runDueJobs()
}
const upsellCalls = () => calls.filter((c) => c.url.endsWith('/v1/payment_intents') && c.form?.get('confirm') === 'true')
const act = async (token: string, action: string, extra: Record<string, unknown> = {}) => (await post(upsell, '/api/upsell', { token, action, ...extra })).json()

describe('discounted orders agree everywhere', () => {
  it('3 Calm + 3 Amber by card: Stripe amount, FGO lines, GHL value and email all equal the canonical total', async () => {
    const o = await placeCard([{ productId: 'balance-wave', quantity: 3 }, { productId: 'ochelari-biohack', variantId: 'patrat-negru', quantity: 3 }])
    const expected = 3 * 638000 - 382800 + 2 * 31500
    expect([o.subtotalMinor, o.discountMinor, o.totalMinor]).toEqual([3 * 638000 + 3 * 31500, 382800 + 31500, expected])
    expect(o.promotions.map((p) => [p.id, p.amountMinor])).toEqual([['trei-produse-20', 382800], ['amber-2-plus-1', 31500]])
    const pi = calls.find((c) => c.url.endsWith('/v1/payment_intents'))!
    expect(Number(pi.form!.get('amount'))).toBe(expected)
    expect(pi.form!.get('customer')).toBe('cus_1')
    expect(pi.form!.get('setup_future_usage')).toBe('on_session')

    const c = getConfig()
    const lines = invoicePayload(c.fgo!, o).Continut
    expect(Math.round(lines.reduce((s, l) => s + l.PretTotal * 100, 0))).toBe(expected)
    expect(lines.map((l) => l.Denumire)).toEqual(['NEUROS Calm, 20% la 3 produse: -3828.00 lei', 'NEUROS Amber (Unisex pătrat · Negru), NEUROS Amber 2+1 gratis: -315.00 lei'])
    const f = contactPayload(c.ghl!, o, { orders: 1, valueMinor: o.totalMinor }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, c.siteUrl).customFields
    expect(f.find((x) => x.key === 'contact.bt_last_order_value')!.fieldValue).toBe((expected / 100).toFixed(2))
    const mail = renderEmail('order_confirmed', o, { siteUrl: c.siteUrl, bank: c.bank })
    for (const s of ['Subtotal: 20.085 lei', '20% la 3 produse: -3.828 lei', 'NEUROS Amber 2+1 gratis: -315 lei', 'Total: 15.942 lei']) expect(mail.text).toContain(s)
  })

  it('2 Calm + 1 Focus + 3 Amber by transfer: the transfer email asks for exactly the discounted total', async () => {
    const res = await post(checkout, '/api/checkout', {
      lines: [{ productId: 'balance-wave', quantity: 2 }, { productId: 'brainlink-pro', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 3 }],
      order: { ...person, paymentMethod: 'transfer' },
      acceptedTerms: true,
      attemptId: 'tr-1',
    })
    const o = (await orders.byToken(db, (await res.json()).token))!
    const eligible = 2 * 638000 + 249000
    const expected = eligible - 305000 + 2 * 31500
    expect(o.totalMinor).toBe(expected)
    const c = getConfig()
    expect(renderEmail('transfer_instructions', o, { siteUrl: c.siteUrl, bank: c.bank }).text).toContain('Suma: 12.830 lei')
    await svc.confirmPayment(o.id, 'admin')
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('paid')
    // A full refund is the discounted total, not the list price.
    expect((await svc.recordRefund(o.id, 'admin', expected)).order!.paymentStatus).toBe('refunded')
  })

  it('a tampered discount or price in the request changes nothing', async () => {
    const o = await placeCard([{ productId: 'balance-wave', quantity: 1, unitAmount: 1, discountMinor: 600000 } as never])
    expect([o.discountMinor, o.totalMinor]).toEqual([0, 638000])
  })
})

describe('post-purchase offer', () => {
  async function paidCard(productId = 'balance-wave', variantId?: string) {
    const o = await placeCard([{ productId, variantId, quantity: 1 }])
    expect((await payByWebhook(o)).outcome).toBe('paid')
    return (await orders.byId(db, o.id))!
  }

  it.each([
    ['balance-wave', undefined, 'ochelari-biohack'],
    ['brainlink-pro', undefined, 'ochelari-biohack'],
    ['ochelari-biohack', 'cat-eye-negru', 'balance-wave'],
    ['brain-flow', '13-zone', 'ochelari-biohack'],
  ])('paid %s (%s) → offers %s', async (productId, variantId, offered) => {
    const o = await paidCard(productId, variantId)
    expect(o.upsellStatus).toBe('offered')
    expect(o.stripePaymentMethodId).toBe('pm_1')
    expect(offerFor(o)?.productId).toBe(offered)
  })

  it('accept: exactly one extra payment, a linked paid order, its own invoice and CRM record; the parent is untouched', async () => {
    const parent = await paidCard()
    const [r1, r2] = await Promise.all([
      act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' }),
      act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' }),
    ])
    expect([r1.state, r2.state]).toEqual(['paid', 'paid'])
    expect(upsellCalls()).toHaveLength(1)
    const again = await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' })
    expect(again.state).toBe('paid')
    expect(upsellCalls()).toHaveLength(1)

    const child = (await orders.childOf(db, parent.id))!
    expect(child).toMatchObject({ kind: 'upsell', parentOrderId: parent.id, paymentStatus: 'paid', totalMinor: 31500, paymentMethod: 'card' })
    expect(child.items[0]).toMatchObject({ productId: 'ochelari-biohack', variantId: 'patrat-maro', unitPriceMinor: 31500 })
    const pi = upsellCalls()[0].form!
    expect([pi.get('amount'), pi.get('customer'), pi.get('payment_method'), pi.get('off_session')]).toEqual(['31500', 'cus_1', 'pm_1', null])
    const p = (await orders.byId(db, parent.id))!
    expect([p.paymentStatus, p.totalMinor, p.upsellStatus]).toEqual(['paid', 638000, 'accepted'])

    const kinds = (await jobs.forOrder(db, child.id)).map((j) => j.kind)
    expect(kinds).toEqual(expect.arrayContaining(['fgo.invoice', 'ghl.sync', 'email.send']))
    expect(kinds).not.toContain('order.abandon_check')
    await drain()
    expect(calls.some((c) => c.url.includes('/v1/payment_methods/pm_1/detach'))).toBe(true)
    expect((await orders.byId(db, parent.id))!.stripePaymentMethodId).toBeNull()
    // The webhook for the extra payment, delivered later, changes nothing.
    const w = await payByWebhook({ ...child, stripePaymentIntentId: child.stripePaymentIntentId })
    expect(w.outcome).toBe('already_paid')
  })

  it('refuses another product, a tampered price, a bank-transfer order, an unpaid or expired order, and an unknown token', async () => {
    const parent = await paidCard()
    expect((await act(parent.publicToken, 'accept', { productId: 'brain-flow', variantId: '4-zone' })).state).toBe('closed')
    expect((await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'nu-exista' })).state).toBe('closed')
    expect((await act('x'.repeat(32), 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' })).state).toBe('closed')
    const tampered = await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro', amount: 1, price: 1 })
    expect(tampered.state).toBe('paid')
    expect(Number(upsellCalls()[0].form!.get('amount'))).toBe(31500)

    const tr = await post(checkout, '/api/checkout', { lines: [{ productId: 'balance-wave', quantity: 1 }], order: { ...person, paymentMethod: 'transfer' }, acceptedTerms: true, attemptId: 'tr-up' })
    const trOrder = (await orders.byToken(db, (await tr.json()).token))!
    await svc.confirmPayment(trOrder.id, 'admin')
    expect(offerFor((await orders.byId(db, trOrder.id))!)).toBeNull()
    expect((await act(trOrder.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' })).state).toBe('closed')

    const unpaid = await placeCard([{ productId: 'brainlink-pro', quantity: 1 }])
    expect((await act(unpaid.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' })).state).toBe('closed')

    const late = await paidCard('brainlink-pro')
    await db.query("update orders set upsell_expires_at = now() - interval '1 minute' where id = $1", [late.id])
    expect((await act(late.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'patrat-maro' })).state).toBe('closed')
    expect(upsellCalls()).toHaveLength(1)
  })

  it('authentication required: Stripe step in the browser, then the server reads the result from Stripe', async () => {
    const parent = await paidCard()
    upsellMode = 'requires_action'
    const r = await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })
    expect(r.state).toBe('action')
    expect(r.clientSecret).toMatch(/_secret$/)
    // Before the customer authenticates: still processing, nothing confirmed.
    expect((await orders.childOf(db, parent.id))!.paymentStatus).toBe('pending')
    const child = (await orders.childOf(db, parent.id))!
    pis.set(child.stripePaymentIntentId!, { ...pis.get(child.stripePaymentIntentId!), status: 'succeeded', amount_received: 31500 })
    expect((await act(parent.publicToken, 'status')).state).toBe('paid')
    expect(upsellCalls()).toHaveLength(1)
  })

  it('authentication closed by the customer: the payment is cancelled in Stripe, nothing is charged', async () => {
    const parent = await paidCard()
    upsellMode = 'requires_action'
    expect((await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })).state).toBe('action')
    const r = await act(parent.publicToken, 'status', { abandoned: true })
    expect(r.state).toBe('failed')
    const child = (await orders.childOf(db, parent.id))!
    expect([child.status, pis.get(child.stripePaymentIntentId!)!.status]).toEqual(['cancelled', 'canceled'])
    expect((await orders.byId(db, parent.id))!.paymentStatus).toBe('paid')
  })

  it('declined card: the extra order is closed, nothing is emailed, the parent stays paid', async () => {
    const parent = await paidCard()
    upsellMode = 'declined'
    const r = await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })
    expect(r.state).toBe('failed')
    expect(r.message).toContain('Comanda ta inițială rămâne confirmată')
    const child = (await orders.childOf(db, parent.id))!
    expect([child.status, child.paymentStatus]).toEqual(['cancelled', 'failed'])
    // The refused PaymentIntent is known and cancelled in Stripe, so it can never be confirmed later.
    expect(child.stripePaymentIntentId).toBeTruthy()
    expect(pis.get(child.stripePaymentIntentId!)!.status).toBe('canceled')
    expect(await jobs.forOrder(db, child.id).then((j) => j.filter((x) => x.kind === 'email.send'))).toEqual([])
    expect((await orders.byId(db, parent.id))!.paymentStatus).toBe('paid')
    expect((await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })).state).toBe('failed')
    expect(upsellCalls()).toHaveLength(1)
  })

  it('decline: no charge, no order, not an abandoned checkout, card released', async () => {
    const parent = await paidCard()
    expect((await act(parent.publicToken, 'decline')).state).toBe('declined')
    expect(await orders.childOf(db, parent.id)).toBeNull()
    expect((await act(parent.publicToken, 'accept', { productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })).state).toBe('closed')
    expect(upsellCalls()).toHaveLength(0)
    await drain()
    const p = (await orders.byId(db, parent.id))!
    expect([p.upsellStatus, p.status, p.stripePaymentMethodId]).toEqual(['declined', 'confirmed', null])
  })

  it('an unanswered offer expires and releases the card', async () => {
    const parent = await paidCard()
    await db.query("update jobs set run_at = now() where kind = 'upsell.release'")
    await drain()
    const p = (await orders.byId(db, parent.id))!
    expect([p.upsellStatus, p.stripePaymentMethodId]).toEqual(['expired', null])
    expect(offerFor(p)).toBeNull()
  })
})

describe('contact form', () => {
  const valid = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '', topic: 'alegere', message: 'Ce produs mi se potrivește pentru seară?', website: '', startedAt: Date.now() - 10_000 }
  const send = async (b: Record<string, unknown>, raw?: string) => {
    const res = await post(contact, '/api/contact', b, raw)
    return { status: res.status, body: await res.json() }
  }

  it('stores a valid message once per attempt and queues the CRM copy', async () => {
    const a = await send({ ...valid, attemptId: 'msg-attempt-1', page: '/' })
    const b = await send({ ...valid, attemptId: 'msg-attempt-1', page: '/' })
    expect(a.status).toBe(200)
    expect(b.body.reference).toBe(a.body.reference)
    const list = await enquiries.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Ana Popescu', topic: 'alegere', status: 'new', sourcePage: '/' })
    await drain()
    const up = calls.find((c) => c.url.includes('/contacts/upsert'))!
    expect(Object.keys(up.json!).sort()).toEqual(['email', 'firstName', 'lastName', 'locationId', 'source'])
    expect(calls.find((c) => c.url.includes('/tags'))!.json).toEqual({ tags: ['bt-mesaj-contact'] })
    expect(calls.some((c) => c.url.includes('/opportunities'))).toBe(false)
  })

  it('rejects a bad email, an empty or oversized message; drops bots silently', async () => {
    expect((await send({ ...valid, email: 'ana@' })).body.fields.email).toBeTruthy()
    expect((await send({ ...valid, message: '  ' })).body.fields.message).toBeTruthy()
    expect((await send({ ...valid, message: 'x'.repeat(3001) })).status).toBe(422)
    expect((await send({}, 'x'.repeat(20_000))).status).toBe(413)
    expect((await send({ ...valid, website: 'http://spam' })).status).toBe(200)
    expect((await send({ ...valid, startedAt: Date.now() })).status).toBe(200)
    expect(await enquiries.list()).toHaveLength(0)
  })

  it('rate-limits one address', async () => {
    const same = (b: object) => contact(new Request('https://biohack-tech.ro/api/contact', { method: 'POST', headers: { 'x-forwarded-for': '10.9.9.9' }, body: JSON.stringify(b) }) as NextRequest)
    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await same({ ...valid, attemptId: `rl-${i}-attempt` })).status)
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('a CRM outage keeps the message; the operator can move it through statuses', async () => {
    ghlDown = true
    await send({ ...valid, attemptId: 'msg-down-1' })
    await drain()
    const [e] = await enquiries.list()
    expect(e.ghlContactId).toBeNull()
    const [job] = (await db.query<{ status: string; attempts: number }>("select status, attempts from jobs where kind = 'ghl.enquiry'")).rows
    expect([job.status, job.attempts]).toEqual(['retry', 1])
    expect(await enquiries.setStatus(e.id, 'in_progress')).toBe(true)
    expect(await enquiries.setStatus(e.id, 'in_progress')).toBe(false)
    expect(await enquiries.setStatus(e.id, 'nope' as never)).toBe(false)
    expect((await enquiries.counts()).in_progress).toBe(1)
  })
})
