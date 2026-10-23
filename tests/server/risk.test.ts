/**
 * Checkout risk (server/risk.ts): several signals add up to a score; no single one blocks a customer. A flagged order
 * waits for a person ("Necesită verificare") before preparation, its recovery emails and AI calls wait too, and a
 * card is asked for 3D Secure. Payment and order status are never changed by the check. PGlite, Stripe stubbed: no
 * real payment, email or call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const risk = await import('@/server/risk')
const { migrations } = await import('@/server/db/migrations')
const { signPayload } = await import('@/server/integrations/stripe')
const { recoveryDecision, recoveryFacts, captureLead, leads } = await import('@/server/leads')
const { callDecision, callFacts } = await import('@/server/calling/calls')
const { getConfig } = await import('@/server/config')
const { POST: webhook } = await import('@/app/api/webhooks/stripe/route')
const { POST: checkout } = await import('@/app/api/checkout/route')

let db: Awaited<ReturnType<typeof freshDb>>
let seq = 0
beforeEach(async () => {
  db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'file', EMAIL_FILE_DIR: '/tmp/bt-risk-test' })
})
afterEach(() => vi.unstubAllGlobals())

const CALM = [{ productId: 'balance-wave', quantity: 1 }]
const AMBER = [{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]
type Who = Partial<typeof person>
const place = (method: 'card' | 'cod' | 'transfer', who: Who = {}, src: { ip?: string; visitor?: string } = {}, raw: unknown[] = CALM) =>
  svc.placeOrder({ lines: lines(raw), form: { ...person, ...who, paymentMethod: method }, attemptId: `risk-${++seq}`, source: { ip: src.ip ?? null, visitor: src.visitor ?? null } } as never)
/** A card order whose payment then failed at the bank (3D Secure). */
const failedCard = async (who: Who = {}, src: { ip?: string; visitor?: string } = {}) => {
  const { order } = await place('card', who, src)
  await svc.attachPaymentIntent(order.id, `pi_${order.id}`)
  expect((await svc.recordPaymentFailure(order.id, 'stripe.webhook', 'authentication failed', `pi_${order.id}`)).changed).toBe(true)
  return (await orders.byId(db, order.id))!
}
const temp = (n: number): Who => ({ email: `client${n}@example.org` })
const fresh = async (id: string) => (await orders.byId(db, id))!

describe('the score', () => {
  it('one signal alone never reaches the review line', () => {
    const none = { emailKind: null, failedCards: 0, failedRecent: 0, names: 1, emails: 1, burst: 0, known: false } as const
    expect(risk.scoreRisk(none)).toEqual({ score: 0, reasons: [], review: false })
    expect(risk.scoreRisk({ ...none, emailKind: 'disposable' }).review).toBe(false)
    expect(risk.scoreRisk({ ...none, failedCards: 1 }).review).toBe(false)
    expect(risk.scoreRisk({ ...none, failedCards: 2 }).review).toBe(false)
    expect(risk.scoreRisk({ ...none, emailKind: 'disposable', failedCards: 1 })).toMatchObject({ score: 40, review: true })
    // A known customer (a paid or cleared order) is not flagged for what is otherwise borderline.
    expect(risk.scoreRisk({ ...none, emailKind: 'disposable', failedCards: 1, known: true }).review).toBe(false)
  })

  it('recognises temporary and placeholder addresses, and phones in any format', () => {
    expect(risk.emailKind('apopescu66@MAILNOW.io')).toBe('disposable')
    expect(risk.emailKind('johndoe@example.com')).toBe('placeholder')
    expect(risk.emailKind('roxana@gmail.com')).toBeNull()
    expect(risk.phoneKey('0722 503 384')).toBe(risk.phoneKey('+40722503384'))
    expect(risk.phoneKey('40722503384')).toBe('722503384')
    expect(risk.ipKey('203.0.113.7')).toMatch(/^[0-9a-f]{32}$/)
    expect(risk.ipKey('203.0.113.7')).not.toContain('203')
    expect(risk.ipKey('unknown')).toBeNull()
  })
})

describe('placing orders', () => {
  it('a legitimate order: no flag, preparable, nothing changed', async () => {
    const { order } = await place('cod', { email: 'client@gmail.com' }, { ip: '198.51.100.1', visitor: crypto.randomUUID() }, AMBER)
    expect(order).toMatchObject({ riskReview: null, riskScore: 0, riskReasons: [], status: 'confirmed', paymentStatus: 'awaiting_collection' })
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(true)
  })

  it('a legitimate customer whose card failed once, then pays by cash on delivery: not flagged', async () => {
    await failedCard({ email: 'maria@yahoo.com' })
    const { order } = await place('cod', { email: 'maria@yahoo.com' })
    expect(order.riskReview).toBeNull()
    expect(order.riskReasons).toEqual(['O plată cu cardul eșuată în ultimele 24 h'])
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(true)
  })

  it('a legitimate customer whose card failed can try a card again, and is not flagged for it', async () => {
    await failedCard({ email: 'ioana@gmail.com', phone: '0745000111' })
    const { order } = await place('card', { email: 'ioana@gmail.com', phone: '0745000111' })
    expect(order).toMatchObject({ riskReview: null, status: 'pending', paymentStatus: 'pending' })
    await failedCard({ email: 'ioana@gmail.com', phone: '0745000111' })
    // A second failure still leaves the card open (the pause starts only after the third one).
    const { order: third } = await place('card', { email: 'ioana@gmail.com', phone: '0745000111' })
    expect(third.riskReview).toBeNull()
  })

  it('the network fingerprint and browser id are cleared after 90 days; the score and reasons stay', async () => {
    await failedCard(temp(20), { ip: '203.0.113.77', visitor: crypto.randomUUID() })
    const { order } = await place('cod', temp(20), { ip: '203.0.113.77' }, AMBER)
    await db.query(`update orders set created_at = now() - interval '91 days'`)
    expect(await risk.purgeRiskSignals(db)).toBe(2)
    const { rows } = await db.query<{ risk_ip: string | null; risk_visitor: string | null; risk_score: number }>('select risk_ip, risk_visitor, risk_score from orders where id = $1', [order.id])
    expect(rows[0]).toMatchObject({ risk_ip: null, risk_visitor: null })
    expect(rows[0].risk_score).toBeGreaterThan(0)
    expect(await risk.purgeRiskSignals(db)).toBe(0)
  })

  it('a temporary inbox (mailnow, yopmail, a subdomain of one): refused, in the form and on the server', async () => {
    await expect(place('card', { email: 'cineva@yopmail.com' })).rejects.toBeInstanceOf(svc.BlockedError)
    await expect(place('cod', { email: 'cineva@x.mailinator.com' })).rejects.toBeInstanceOf(svc.BlockedError)
    const { validateOrder } = await import('@/lib/checkout')
    const { validateContact } = await import('@/lib/lead')
    expect(validateOrder({ ...person, email: 'cineva@mailnow.io', paymentMethod: 'cod' } as never, true).email).toContain('adresa ta de email obișnuită')
    expect(validateContact({ name: 'Ana', email: 'cineva@mailnow.io', phone: '' }, ['email']).email).toContain('obișnuită')
    expect(validateContact({ name: 'Ana', email: 'ana@gmail.com', phone: '' }, ['email']).email).toBeUndefined()
  })

  it('three failed payments from one network (any browser, private window included): no more orders on any method, they call us', async () => {
    const src = { ip: '203.0.113.9' }
    await failedCard({ ...temp(2), firstName: 'Ingrid' }, src)
    const second = await failedCard({ ...temp(2), firstName: 'Izabela' }, src)
    expect(second.riskReview).toBe('pending')
    expect(second.riskScore).toBeGreaterThanOrEqual(risk.REVIEW_AT)
    expect(second.paymentStatus).toBe('failed')
    // A new browser (no cookie, other email and phone): the network is the same.
    await failedCard({ email: 'altul@gmail.com', phone: '0711222333' }, { ...src, visitor: crypto.randomUUID() })
    for (const method of ['card', 'cod', 'transfer'] as const)
      await expect(place(method, { email: 'incognito@gmail.com', phone: '0711222444' }, { ...src, visitor: crypto.randomUUID() })).rejects.toBeInstanceOf(svc.CardAttemptsError)
    // Someone else, elsewhere: unaffected.
    const { order } = await place('cod', { email: 'altcineva@gmail.com', phone: '0733000111' }, { ip: '198.51.100.8' })
    expect(order.riskReview).toBeNull()
  })

  it('two failures still leave the other methods open; a paid customer is never stopped', async () => {
    const src = { ip: '203.0.113.20' }
    await failedCard({ email: 'doi@gmail.com', phone: '0722000222' }, src)
    await failedCard({ email: 'doi@gmail.com', phone: '0722000222' }, src)
    const { order: cod } = await place('cod', { email: 'doi@gmail.com', phone: '0722000222' }, src, AMBER)
    expect(cod.status).toBe('confirmed')
  })

  it('the same browser behind different addresses (johndoe@example.com, then another made-up address)', async () => {
    const visitor = crypto.randomUUID()
    await place('card', { email: 'johndoe@example.com' }, { visitor })
    const { order } = await place('card', temp(4), { visitor })
    expect(order.riskReasons).toEqual(expect.arrayContaining(['Email fictiv (exemplu/test)', '2 adrese de email din același browser sau rețea (24 h)']))
    expect(order.riskReview).toBe('pending')
  })

  it('manual confirmation: clears once, lets the order into preparation, payment untouched, recorded', async () => {
    await failedCard(temp(5))
    const { order } = await place('cod', temp(5), {}, AMBER)
    expect(order.riskReview).toBe('pending')
    expect((await svc.holdRisk(order.id, 'admin', 'admin', 'nu răspunde')).changed).toBe(true)
    expect((await fresh(order.id)).riskReview).toBe('pending')
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(false)
    // Two clicks at once: one change.
    const [a, b] = await Promise.all([svc.clearRisk(order.id, 'admin', 'admin', 'sunat, e ok'), svc.clearRisk(order.id, 'admin', 'admin')])
    expect([a.changed, b.changed].filter(Boolean)).toHaveLength(1)
    const after = await fresh(order.id)
    expect(after).toMatchObject({ riskReview: 'cleared', riskReviewedBy: 'admin', status: 'confirmed', paymentStatus: 'awaiting_collection' })
    const types = (await orders.events(db, order.id)).map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(['risk.flagged', 'risk.held', 'risk.cleared']))
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(true)
    // Their next order is a known customer's.
    const { order: next } = await place('cod', temp(5), {}, AMBER)
    expect(next.riskReview).toBeNull()
  })

  it('a duplicated webhook counts a failure once', async () => {
    const { order } = await place('card', temp(6))
    await svc.attachPaymentIntent(order.id, 'pi_dup')
    const body = JSON.stringify({ id: 'evt_dup', type: 'payment_intent.payment_failed', livemode: false, data: { object: { id: 'pi_dup', amount: order.totalMinor, amount_received: 0, currency: 'ron', metadata: { order_id: order.id, order_number: order.orderNumber }, last_payment_error: { code: 'payment_intent_authentication_failure' } } } })
    const send = () => webhook(new Request('https://test/api/webhooks/stripe', { method: 'POST', body, headers: { 'stripe-signature': signPayload(body, TEST_ENV.STRIPE_WEBHOOK_SECRET) } }) as NextRequest)
    await Promise.all([send(), send()])
    await send()
    const s = await risk.riskSignals(db, { email: temp(6).email!, phone: person.phone, firstName: 'Ana', lastName: 'Popescu', ip: null, visitor: null })
    expect(s.failedCards).toBe(1)
  })
})

describe('the card testing attack of 20–23.10 (config/risk-blocklist.ts)', () => {
  it('its domain, phone or network: no order is written, on any payment method', async () => {
    await expect(place('cod', { email: 'altcineva@mailnow.io' })).rejects.toBeInstanceOf(svc.BlockedError)
    await expect(place('transfer', { email: 'nou@gmail.com', phone: '+40 724 541 662' })).rejects.toBeInstanceOf(svc.BlockedError)
    for (const phone of ['0373809013', '0373808442', '+40373803641']) await expect(place('cod', { email: 'nou@gmail.com', phone })).rejects.toBeInstanceOf(svc.BlockedError)
    await expect(place('cod', { email: 'APopescu66@mailnow.io' })).rejects.toBeInstanceOf(svc.BlockedError)
    expect(risk.blocked({ email: 'nou@gmail.com', phone: '0700000000', ip: '04c7541c20fc55cea8fa775a67b61a51' })).toBe(true)
    expect(risk.blocked({ email: 'nou@gmail.com', phone: '0700000000', ip: risk.ipKey('203.0.113.50') })).toBe(false)
    expect((await db.query('select count(*)::int as n from orders')).rows[0].n).toBe(0)
  })

  it('an address of the attack: written, waits for a person even once paid', async () => {
    const { order: byPhone } = await place('card', { email: 'a@gmail.com', phone: '0711111110', city: 'București', address: 'Str. Răsăritului nr. 27, Bl. D12' })
    expect(byPhone.riskReview).toBe('pending')
    expect(byPhone.riskReasons.join(' ')).toContain('card testing')
    const { order: byAddress } = await place('cod', { email: 'b@gmail.com', phone: '0711111111', city: 'Cluj Napoca', address: 'Str. Piata Unirii nr. 2' })
    expect(byAddress.riskReview).toBe('pending')
    expect(risk.held({ email: 'c@gmail.com', phone: '0711111112', ip: null, city: 'Giroc', address: 'Strada Mușețel, Nr. 97' })).toBe(true)
    // Similar but different: another number on the same street, another city.
    expect(risk.held({ email: 'c@gmail.com', phone: '0711111112', ip: null, city: 'Cluj-Napoca', address: 'Piața Unirii 25' })).toBe(false)
    expect(risk.held({ email: 'c@gmail.com', phone: '0711111112', ip: null, city: 'Oradea', address: 'Piața Unirii 2' })).toBe(false)
    // Paid by card: still not preparable until a person clears it.
    await svc.attachPaymentIntent(byPhone.id, `pi_${byPhone.id}`)
    expect((await svc.confirmPayment(byPhone.id, 'stripe.webhook', { amountMinor: byPhone.totalMinor, currency: 'RON', paymentIntentId: `pi_${byPhone.id}` })).changed).toBe(true)
    const after = await fresh(byPhone.id)
    expect(after.paymentStatus).toBe('paid')
    expect(after.riskReview).toBe('pending')
    expect((await svc.markProcessing(after.id, 'admin')).changed).toBe(false)
  })

  it('a legitimate customer is untouched', async () => {
    const { order } = await place('cod', { email: 'roxana@gmail.com', phone: '+40722503384', city: 'Suceava', address: 'Strada Ștefan Tomșa 21' })
    expect(order.riskReview).toBeNull()
  })
})

describe('automations wait while an order is in review', () => {
  const lead = (email: string, at = new Date(Date.now() - 3_600_000)) =>
    db.tx(async (t) => {
      const r = await captureLead(t, { visitorId: crypto.randomUUID(), stage: 'checkout_started', productId: 'cart', contact: { name: 'Ana Popescu', email, phone: '0722111222' }, marketingConsent: true, callConsent: true, cart: CALM, page: '/checkout' } as never)
      await t.query('update leads set last_activity_at = $2 where id = $1', [r.lead.id, at])
      return (await leads.byId(t, r.lead.id))!
    })

  it('no recovery email and no AI call (so no code) for a flagged person; both resume once cleared', async () => {
    await failedCard(temp(7))
    const { order } = await place('cod', temp(7), {}, AMBER)
    expect(order.riskReview).toBe('pending')
    const l = await lead(temp(7).email!)
    const facts = await recoveryFacts(db, l)
    expect(facts.riskHold).toBe(true)
    const c = getConfig()
    const ctx = { stage: 'checkout_started', step: 1, now: new Date(), features: { abandonedCheckout: true, recoveryEmail: true }, firstMinutes: 30, canSend: true, ...facts, converted: false }
    const d = recoveryDecision(l, ctx)
    expect(d).toMatchObject({ send: false, reason: 'risk review' })
    expect('later' in d && d.later).toBeTruthy()
    const call = callDecision(l, { attempt: 1, now: new Date(), calling: { ...c.calling, enabled: true, hours: { start: 0, end: 24 }, days: [1, 2, 3, 4, 5, 6, 7], testNumbers: null }, ...(await callFacts(db, l)), converted: false })
    expect(call).toMatchObject({ call: false, reason: 'risk review' })
    // Consent is untouched by the review.
    expect((await db.query('select count(*)::int as n from marketing_consent_events where email = $1 and granted = false', [temp(7).email])).rows[0].n).toBe(0)

    await svc.clearRisk(order.id, 'admin', 'admin')
    expect((await recoveryFacts(db, l)).riskHold).toBe(false)
    expect((await callFacts(db, l)).riskHold).toBe(false)
  })

  it('a review open for more than a week ends the sequence', async () => {
    const l = await lead('x@mailnow.io', new Date(Date.now() - 8 * 86_400_000))
    const ctx = { stage: 'checkout_started', step: 1, now: new Date(), features: { abandonedCheckout: true, recoveryEmail: true }, firstMinutes: 30, canSend: true, converted: false, superseded: false, otherRecovery: false, consentGranted: true, riskHold: true }
    expect(recoveryDecision(l, ctx)).toMatchObject({ send: false, reason: 'risk review', status: 'stopped' })
  })
})

describe('the checkout route', () => {
  const stripeStub = () => {
    const bodies: URLSearchParams[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/v1/customers')) return new Response(JSON.stringify({ id: `cus_${++seq}` }), { status: 200 })
      const form = new URLSearchParams(String(init?.body ?? ''))
      bodies.push(form)
      return new Response(JSON.stringify({ id: `pi_${++seq}`, status: 'requires_payment_method', amount: Number(form.get('amount')), currency: form.get('currency'), client_secret: 'cs', metadata: { order_id: form.get('metadata[order_id]') } }), { status: 200 })
    }))
    return bodies
  }
  const post = (order: Record<string, unknown>, ip: string, cookie?: string) =>
    checkout(new Request('https://test.biohack-tech.ro/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie && { cookie }) },
      body: JSON.stringify({ lines: CALM, order: { ...person, ...order }, acceptedTerms: true, attemptId: `route-${++seq}`, locale: 'ro' }),
    }) as NextRequest)

  it('3D Secure is requested only for a flagged card order', async () => {
    const bodies = stripeStub()
    const ok = await post({ paymentMethod: 'card', email: 'cineva@gmail.com' }, '192.0.2.10')
    expect(ok.status).toBe(200)
    expect(bodies.at(-1)!.get('payment_method_options[card][request_three_d_secure]')).toBeNull()
    await failedCard(temp(8))
    const flagged = await post({ paymentMethod: 'card', email: temp(8).email }, '192.0.2.11')
    expect(flagged.status).toBe(200)
    expect(bodies.at(-1)!.get('payment_method_options[card][request_three_d_secure]')).toBe('any')
  })

  it('after three failures the customer is asked to call; the session limit stops a burst', async () => {
    stripeStub()
    for (let i = 0; i < 3; i++) await failedCard(temp(9))
    const res = await post({ paymentMethod: 'card', email: temp(9).email }, '192.0.2.12')
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe('CARD_ATTEMPTS')
    expect(body.message).toContain('sună-ne')
    expect((await post({ paymentMethod: 'cod', email: temp(9).email }, '192.0.2.13')).status).toBe(429)
    // A temporary inbox is turned back at the form, before any order.
    const disposable = await post({ paymentMethod: 'cod', email: 'nou@mailnow.io' }, '192.0.2.14')
    expect(disposable.status).toBe(422)
    // The same browser (visitor cookie) placing order after order: stopped at 8 within 10 minutes.
    const cookie = `bt_vid=${crypto.randomUUID()}`
    const statuses: number[] = []
    for (let i = 0; i < 9; i++) statuses.push((await post({ paymentMethod: 'transfer', email: `burst${i}@gmail.com`, phone: `07330000${10 + i}` }, `192.0.2.${100 + i}`, cookie)).status)
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true)
    expect(statuses[8]).toBe(429)
  })
})

describe('a blocked network (proxy.ts)', () => {
  it('the proxy and the checkout hash the address the same way; a blocked network gets no API answer, the webhooks still pass', async () => {
    const { networkKey, isBlockedNetwork, OPEN_TO_BLOCKED } = await import('@/lib/blocked-network')
    for (const ip of ['203.0.113.77', '2001:db8::1']) expect(await networkKey(ip)).toBe(risk.ipKey(ip))
    expect(await networkKey('unknown')).toBeNull()
    expect(await isBlockedNetwork('203.0.113.77')).toBe(false)
    expect(OPEN_TO_BLOCKED.test('/api/webhooks/stripe')).toBe(true)
    expect(OPEN_TO_BLOCKED.test('/api/checkout')).toBe(false)
    expect(OPEN_TO_BLOCKED.test('/api/lead')).toBe(false)
  })
})

describe('migration 031', () => {
  it('flags only the four mailnow card attempts by number; a legitimate cash-on-delivery order between them is untouched', async () => {
    // Placed with another address, then given the attack's mailnow address (that domain is now refused at checkout).
    const mk = async (number: string, method: 'card' | 'cod', who: Who) => {
      const w = { phone: `07${String(++seq).padStart(8, '0')}`, ...who }
      const o = method === 'card' ? await failedCard(w) : (await place('cod', w, {}, AMBER)).order
      const email = who.email?.endsWith('@example.org') ? who.email.replace('@example.org', '@mailnow.io') : who.email
      await db.query('update orders set order_number = $2, email = $3, risk_review = null, risk_score = null, risk_reasons = null where id = $1', [o.id, number, email])
      return o.id
    }
    const ids = [await mk('BHT-20261020-0002', 'card', temp(10)), await mk('BHT-20261021-0001', 'card', temp(11)), await mk('BHT-20261021-0002', 'card', temp(14)), await mk('BHT-20261021-0004', 'card', temp(12))]
    const legit = await mk('BHT-20261021-0003', 'cod', { email: 'legit@gmail.com' })
    const other = await mk('BHT-20261021-0005', 'card', temp(13))
    await db.exec(migrations.find((m) => m.id === '031_risk_review')!.sql)
    await db.exec(migrations.find((m) => m.id === '031_risk_review')!.sql)
    for (const id of ids) expect((await fresh(id)).riskReview).toBe('pending')
    expect(await fresh(legit)).toMatchObject({ riskReview: null, status: 'confirmed', paymentStatus: 'awaiting_collection' })
    expect((await fresh(other)).riskReview).toBeNull()
    expect((await orders.events(db, ids[0])).filter((e) => e.type === 'risk.flagged')).toHaveLength(1)
    expect((await svc.markProcessing(legit, 'admin')).changed).toBe(true)
  })
})
