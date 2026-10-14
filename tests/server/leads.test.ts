/**
 * Conversion engine: leads from the price-gated funnel (acces.<domain>) and the checkout's contact step, their
 * link to orders, abandonment, the two recovery emails (consent, suppression, sequence, no duplicates), the
 * CRM copy (contact and tags only), retention and the funnel comparison. SMTP is a fake nodemailer transport,
 * GoHighLevel and Stripe are stubbed at the HTTP boundary, the database is an embedded PostgreSQL (PGlite).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

// The in-memory limiter is shared by every test in this file: on only where a test is about it.
let limiter = false
vi.mock('@/server/rate-limit', async (orig) => {
  const real = await orig<typeof import('@/server/rate-limit')>()
  return { ...real, rateLimit: (...a: Parameters<typeof real.rateLimit>) => (limiter ? real.rateLimit(...a) : true) }
})

type Sent = { to: string; subject: string; text: string; html: string }
let sent: Sent[]
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: Sent & { messageId: string }) => {
        sent.push(m)
        return { messageId: m.messageId, response: '250 OK', accepted: [m.to], rejected: [] }
      },
    }),
  },
}))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const { leads, captureLead, recoveryDecision, purgeStaleLeads, funnelStats, CART_INTEREST } = await import('@/server/leads')
const { marketing } = await import('@/server/marketing/consent')
const { orders } = await import('@/server/orders/repository')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { POST: lead } = await import('@/app/api/lead/route')
const { GET: resume } = await import('@/app/api/lead/resume/route')
const { POST: checkout } = await import('@/app/api/checkout/route')
const { POST: visit } = await import('@/app/api/visit/route')
const { cookieFrom, mentionsOffer } = await import('@/lib/lead')
const { routeGated } = await import('@/lib/landing-hosts')

const ENV = {
  ...TEST_ENV,
  NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'mail.biohack-tech.test',
  SMTP_USER: 'contact@biohack-tech.ro',
  SMTP_PASSWORD: 'not-a-real-password',
  EMAIL_FROM: 'contact@biohack-tech.ro',
  PRICE_GATE_ENABLED: 'true',
  ABANDONED_CHECKOUT_ENABLED: 'true',
  RECOVERY_EMAIL_ENABLED: 'true',
}
const GATED = 'acces.biohack-tech.ro'
const MAIN = 'biohack-tech.ro'

let db: Awaited<ReturnType<typeof freshDb>>
let ghl: { url: string; method: string; json: Record<string, unknown> | null }[]
let ip = 0

function fakeApis() {
  ghl = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('leadconnectorhq.com')) {
      ghl.push({ url, method: init.method ?? 'GET', json: init.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: [] })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: [] }] })
      if (url.includes('/opportunities/search')) return json({ opportunities: [] })
      if (url.includes('/opportunities/')) return json({ opportunity: { id: 'opp-1' } }, 201)
      return json({})
    }
    if (url.includes('/v1/customers')) return json({ id: 'cus_1' })
    if (url.endsWith('/v1/payment_intents') && init.method === 'POST') {
      const f = new URLSearchParams(String(init.body))
      return json({ id: `pi_${++ip}`, status: 'requires_payment_method', client_secret: 'pi_secret', amount: Number(f.get('amount')), currency: 'ron', metadata: { order_id: f.get('metadata[order_id]') } })
    }
    if (url.includes('/factura/')) return json({ Success: true, Factura: { Serie: 'BT', Numar: '1', Link: 'https://fgo/f.pdf' } })
    return json({ message: 'not mocked' }, 404)
  })
}

async function setup(env: Record<string, string> = ENV) {
  limiter = false
  db = await freshDb(env)
  sent = []
  fakeApis()
}
beforeEach(() => setup())
afterEach(() => vi.unstubAllGlobals())

const ana = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456' }

function post(path: string, host: string, body: unknown, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return new NextRequest(`https://${host}${path}`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}`, ...(cookie && { cookie }) }, body: JSON.stringify(body) })
}
const setCookies = (res: Response) => Object.fromEntries(res.headers.getSetCookie().map((c) => [c.split('=')[0], c]))
const value = (setCookie: string | undefined) => setCookie?.split(';')[0].split('=')[1] ?? ''

async function reveal(extra: Record<string, unknown> = {}, cookies: Record<string, string> = {}, host = GATED) {
  const res = await lead(post('/api/lead', host, { action: 'reveal', ...ana, productId: 'balance-wave', page: '/calm', attribution: { utm_source: 'facebook', utm_campaign: 'acces-test', fbclid: 'IwAR0abcdefghij' }, ...extra }, cookies))
  const data = await res.json()
  const c = setCookies(res)
  return { res, data, vid: value(c.bt_vid), gate: value(c.bt_gate), cookies: c }
}

/** Time passes: every waiting job is due now. (First lets a run the routes started in the background finish.) */
async function later() {
  await runDueJobs()
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
}
/** The lead went quiet `minutes` ago (so a recovery step finds it abandoned). */
const quiet = (id: string, minutes: number) => db.query(`update leads set last_activity_at = now() - ($2 || ' minutes')::interval where id = $1`, [id, String(minutes)])
const jobKinds = async (leadId: string) => (await db.query<{ dedupe_key: string; status: string }>(`select dedupe_key, status from jobs where payload->>'leadId' = $1 order by dedupe_key`, [leadId])).rows

describe('price-gated funnel: the form', () => {
  it('only on acces.<domain> and only with PRICE_GATE_ENABLED', async () => {
    expect((await reveal({}, {}, MAIN)).res.status).toBe(404)
    await setup({ ...ENV, PRICE_GATE_ENABLED: 'false' })
    expect((await reveal()).res.status).toBe(404)
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(0)
  })

  it('validates name, email and phone server-side and stores nothing invalid', async () => {
    const { res, data } = await reveal({ name: 'A', email: 'ana@', phone: '12' })
    expect(res.status).toBe(422)
    expect(Object.keys(data.fields).sort()).toEqual(['email', 'name', 'phone'])
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(0)
  })

  it('stores the lead with funnel, interest, attribution and privacy version; unlocks this device; no consent assumed', async () => {
    const { res, data, cookies, vid, gate } = await reveal()
    expect(res.status).toBe(200)
    expect(cookies.bt_vid).toMatch(/HttpOnly/i)
    expect(cookies.bt_gate).not.toMatch(/HttpOnly/i)
    expect(gate).toBe(data.leadId)
    const l = (await leads.byId(db, data.leadId))!
    expect(l).toMatchObject({ visitorId: vid, funnel: 'gated_price', productId: 'balance-wave', name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456', stage: 'lead', landingHost: GATED, fbclid: 'IwAR0abcdefghij', privacyVersion: 'lead-2026-10-14', marketingConsent: false, callConsent: false })
    expect(l.attribution).toMatchObject({ utm: { utm_source: 'facebook', utm_campaign: 'acces-test' }, fbclid: 'IwAR0abcdefghij' })
    expect(l.priceRevealedAt).toBeInstanceOf(Date)
    // No box ticked: no marketing consent recorded.
    expect(await marketing.state(db, 'ana@exemplu.ro')).toBeNull()
    // CRM copy, and the two abandonment checks.
    expect((await jobKinds(l.id)).map((j) => j.dedupe_key)).toEqual([`ghl.lead:${l.id}:lead`, `lead.recovery:${l.id}:lead:1`, `lead.recovery:${l.id}:lead:2`])
  })

  it('a refresh or a double submit changes one row; a ticked box records consent with its source; unticking never removes it', async () => {
    const first = await reveal({ marketingConsent: true })
    const again = await reveal({ marketingConsent: false }, { bt_vid: first.vid })
    expect(again.data.leadId).toBe(first.data.leadId)
    expect(again.data.created).toBe(false)
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(1)
    expect((await leads.byId(db, first.data.leadId))!.marketingConsent).toBe(true)
    expect(await marketing.state(db, 'ana@exemplu.ro')).toMatchObject({ granted: true, source: 'lead_form' })
    // No second set of jobs for the same stage.
    expect((await jobKinds(first.data.leadId)).length).toBe(3)
  })

  it('another product opened on an unlocked device: a separate lead with the same contact, without sending it again', async () => {
    const first = await reveal()
    const res = await lead(post('/api/lead', GATED, { action: 'interest', productId: 'ochelari-biohack' }, { bt_vid: first.vid, bt_gate: first.gate }))
    expect(res.status).toBe(200)
    const rows = await leads.forVisitor(db, first.vid)
    expect(rows.map((r) => r.productId).sort()).toEqual(['balance-wave', 'ochelari-biohack'])
    expect(rows.find((r) => r.productId === 'ochelari-biohack')).toMatchObject({ email: 'ana@exemplu.ro', name: 'Ana Popescu', marketingConsent: false })
    // Without the unlocked state of this same browser: refused.
    expect((await lead(post('/api/lead', GATED, { action: 'interest', productId: 'brainlink-pro' }, { bt_vid: first.vid }))).status).toBe(403)
    expect((await lead(post('/api/lead', GATED, { action: 'interest', productId: 'brainlink-pro' }, { bt_vid: crypto.randomUUID(), bt_gate: first.gate }))).status).toBe(403)
  })

  it('rate limited per address: the 11th form in an hour for the same email is refused', async () => {
    limiter = true
    const email = `limit-${Date.now()}@exemplu.ro`
    const codes = []
    for (let i = 0; i < 11; i++) codes.push((await reveal({ email })).res.status)
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes[10]).toBe(429)
  })

  it('rejects unknown products, bad JSON and oversized bodies', async () => {
    expect((await reveal({ productId: 'brain-flow' })).res.status).toBe(400)
    const bad = new NextRequest(`https://${GATED}/api/lead`, { method: 'POST', headers: { host: GATED }, body: '{nope' })
    expect((await lead(bad)).status).toBe(400)
    const big = new NextRequest(`https://${GATED}/api/lead`, { method: 'POST', headers: { host: GATED }, body: JSON.stringify({ action: 'reveal', pad: 'x'.repeat(9000) }) })
    expect((await lead(big)).status).toBe(413)
  })
})

describe('checkout contact step (progressive capture)', () => {
  const cart = [{ productId: 'balance-wave', quantity: 2 }, { productId: 'nope', quantity: 1 }]
  const step = (body: Record<string, unknown>, cookies: Record<string, string> = {}, host = MAIN) => lead(post('/api/lead', host, { action: 'checkout', cart, ...body }, cookies))

  it('off unless ABANDONED_CHECKOUT_ENABLED', async () => {
    await setup({ ...ENV, ABANDONED_CHECKOUT_ENABLED: 'false' })
    expect(await (await step(ana)).json()).toEqual({ ok: true, skipped: 'off' })
  })

  it('partial typing is not a lead; a valid email with a name or phone is, with the cart (only what is sold)', async () => {
    expect((await (await step({ email: 'ana@exem' })).json()).skipped).toBe('incomplete')
    expect((await (await step({ email: 'ana@exemplu.ro' })).json()).skipped).toBe('incomplete')
    expect((await (await step({ ...ana, cart: [] })).json()).skipped).toBe('empty cart')
    const res = await step({ name: 'Ana', email: 'ana@exemplu.ro' })
    const { leadId } = await res.json()
    expect((await leads.byId(db, leadId))!).toMatchObject({ funnel: 'visible_price', productId: CART_INTEREST, stage: 'checkout_started', cart: [{ productId: 'balance-wave', quantity: 2 }] })
  })

  it('on acces, after the form: the same visitor gets a checkout lead next to the interest; the interest is superseded, not chased', async () => {
    const first = await reveal()
    const { leadId } = await (await step(ana, { bt_vid: first.vid, bt_gate: first.gate }, GATED)).json()
    expect((await leads.byId(db, leadId))!.funnel).toBe('gated_price')
    await quiet(first.data.leadId, 60)
    await quiet(leadId, 60)
    await later()
    // The checkout lead is the one followed up (no consent here, so only recorded); the interest is not.
    expect((await leads.byId(db, first.data.leadId))!.abandonment).toBeNull()
    expect((await leads.byId(db, leadId))!.abandonment).toBe('checkout_abandoned')
  })
})

describe('leads → orders → purchases', () => {
  const order = (host: string, cookies: Record<string, string>, paymentMethod: string, attemptId: string) =>
    checkout(post('/api/checkout', host, { lines: [{ productId: 'balance-wave', quantity: 1 }], order: { ...person, paymentMethod }, acceptedTerms: true, attemptId, attribution: { utm_source: 'facebook' } }, cookies))

  it('a cash-on-delivery order from acces: the order says gated_price, the visitor’s leads are ordered and linked', async () => {
    const first = await reveal()
    const res = await order(GATED, { bt_vid: first.vid, bt_gate: first.gate }, 'cod', 'gated-cod-1')
    expect(res.status).toBe(200)
    const o = (await orders.byToken(db, (await res.json()).token))!
    expect(o.attribution).toMatchObject({ funnel: 'gated_price', utm: { utm_source: 'facebook' } })
    const l = (await leads.byId(db, first.data.leadId))!
    expect(l).toMatchObject({ stage: 'ordered', orderId: o.id })
    expect((await db.query('select lead_id from orders where id = $1', [o.id])).rows[0].lead_id).toBe(l.id)
    // Nothing is chased after an order.
    await quiet(l.id, 60 * 30)
    await later()
    expect(sent.filter((m) => /așteaptă|oferta|ajuta/.test(m.subject))).toEqual([])
    expect((await leads.byId(db, l.id))!.recoveryStatus).toBe('stopped')
  })

  it('a transfer order is ordered at once and purchased when the money arrives; the main site’s order says visible_price', async () => {
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    const vid = (await leads.byId(db, step.leadId))!.visitorId
    const res = await order(MAIN, { bt_vid: vid }, 'transfer', 'main-transfer-1')
    const o = (await orders.byToken(db, (await res.json()).token))!
    expect(o.attribution?.funnel).toBe('visible_price')
    expect((await leads.byId(db, step.leadId))!.stage).toBe('ordered')
    await svc.confirmPayment(o.id, 'admin')
    expect((await leads.byId(db, step.leadId))!).toMatchObject({ stage: 'purchased', recoveryStatus: 'stopped' })
  })

  it('an unpaid card order: the lead waits for the order’s own recovery, never a second email from the lead', async () => {
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    const first = await reveal()
    const res = await order(GATED, { bt_vid: first.vid, bt_gate: first.gate }, 'card', 'gated-card-1')
    expect(res.status).toBe(200)
    const l = (await leads.byId(db, first.data.leadId))!
    expect(l.stage).toBe('lead')
    expect(l.orderId).not.toBeNull()
    await quiet(l.id, 60 * 30)
    await later()
    expect(sent.filter((m) => m.to === 'ana@exemplu.ro' && /oferta|ajuta/.test(m.subject))).toEqual([])
    expect((await leads.byId(db, l.id))!).toMatchObject({ recoveryStatus: 'stopped', recoveryReason: 'order recovery' })
  })
})

describe('recovery emails', () => {
  const recoveries = () => sent.filter((m) => m.to === 'ana@exemplu.ro')

  it('without marketing consent: abandonment recorded, nothing sent, marked ineligible', async () => {
    const { data } = await reveal()
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries()).toEqual([])
    expect((await leads.byId(db, data.leadId))!).toMatchObject({ abandonment: 'lead_abandoned', recoveryStatus: 'ineligible', recoverySent: 0 })
  })

  it('with consent: step 1 after the quiet period, step 2 later, once each; right link, no price, an unsubscribe link', async () => {
    const { data } = await reveal({ marketingConsent: true })
    const l0 = (await leads.byId(db, data.leadId))!
    // Still within the first 30 minutes: nothing yet, and nothing is lost (planned again).
    await runDueJobs()
    await db.query(`update jobs set run_at = now() where dedupe_key like 'lead.recovery:%:1'`)
    await runDueJobs()
    expect(recoveries()).toEqual([])
    expect((await db.query(`select count(*)::int as n from jobs where dedupe_key like 'lead.recovery:%:1:%' and status = 'pending'`)).rows[0].n).toBe(1)
    expect(recoveries()).toEqual([])
    await quiet(data.leadId, 31)
    await db.query(`update jobs set run_at = now() where dedupe_key like 'lead.recovery:%:1:%'`)
    await runDueJobs()
    expect(recoveries().map((m) => m.subject)).toEqual(['NEUROS Calm: oferta pe care ai văzut-o'])
    const [m] = recoveries()
    expect(m.text).toContain(`https://acces.biohack-tech.ro/api/lead/resume?t=${l0.recoveryToken}`)
    expect(m.text).toMatch(/https:\/\/biohack-tech\.ro\/dezabonare\/[\w-]+/)
    // No amounts, no invented discount, no false urgency (the HTML's layout widths aside).
    expect(`${m.subject} ${m.text}`).not.toMatch(/\blei\b|\d+\s*%|reducere|ultima șansă|expiră/i)
    expect(m.html).not.toMatch(/\blei\b|reducere|ultima șansă|expiră/i)
    // A queue that ran late never sends the second right after the first.
    await later()
    expect(recoveries().length).toBe(1)
    await quiet(data.leadId, 60 * 25)
    await db.query(`update leads set last_recovery_at = now() - interval '23 hours'`)
    await later()
    await later()
    expect(recoveries().length).toBe(2)
    expect((await leads.byId(db, data.leadId))!).toMatchObject({ recoveryStatus: 'sent', recoverySent: 2 })
  })

  it('one sequence per person: three products and a checkout give one recovery email, for the checkout', async () => {
    const first = await reveal({ marketingConsent: true })
    for (const productId of ['brainlink-pro', 'ochelari-biohack'])
      await lead(post('/api/lead', GATED, { action: 'interest', productId }, { bt_vid: first.vid, bt_gate: first.gate }))
    await lead(post('/api/lead', GATED, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }, { bt_vid: first.vid, bt_gate: first.gate }))
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes'`)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Comanda ta NEUROS Calm te așteaptă'])
    // Even later (step 2 time): only the checkout's second email, nothing for the product interests.
    await db.query(`update leads set last_activity_at = now() - interval '25 hours', last_recovery_at = last_recovery_at - interval '23 hours'`)
    await later()
    await later()
    expect(recoveries().length).toBe(2)
  })

  it('unsubscribe or withdrawn consent before a step: stopped, nothing sent', async () => {
    const { data } = await reveal({ marketingConsent: true })
    await marketing.withdraw(db, { email: 'ana@exemplu.ro', source: 'unsubscribe_link' })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries()).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('stopped')
  })

  it('a purchase with the same email elsewhere (another device) stops it', async () => {
    const { data } = await reveal({ marketingConsent: true })
    await svc.placeOrder({ lines: (await import('./helpers')).lines([{ productId: 'balance-wave', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'other-device' })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries().filter((m) => /oferta|ajuta/.test(m.subject))).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('stopped')
  })

  it('RECOVERY_EMAIL_ENABLED off: abandonment still recorded, nothing sent', async () => {
    await setup({ ...ENV, RECOVERY_EMAIL_ENABLED: 'false' })
    const { data } = await reveal({ marketingConsent: true })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(sent).toEqual([])
    expect((await leads.byId(db, data.leadId))!).toMatchObject({ abandonment: 'lead_abandoned', recoveryStatus: 'disabled' })
  })

  it('needs the own email transport (never GoHighLevel’s, so the CRM never sends a second copy)', async () => {
    await setup({ ...ENV, EMAIL_TRANSPORT: 'ghl' })
    const { data } = await reveal({ marketingConsent: true })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(ghl.filter((c) => c.url.includes('/conversations/messages'))).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('ineligible')
  })

  it('the decision is pure and ordered: flags, stage, conversion, order recovery, activity, consent, sequence', () => {
    const base = { id: 'x', stage: 'lead', recoveryStatus: 'none', recoverySent: 0, recoveryReason: null, orderId: null, lastActivityAt: new Date(Date.now() - 3_600_000) } as never
    const ctx = { stage: 'lead', step: 1, now: new Date(), features: { abandonedCheckout: true, recoveryEmail: true }, firstMinutes: 30, converted: false, superseded: false, otherRecovery: false, consentGranted: true, canSend: true }
    expect(recoveryDecision(base, ctx)).toEqual({ send: true, abandonment: 'lead_abandoned' })
    expect(recoveryDecision(base, { ...ctx, features: { abandonedCheckout: false, recoveryEmail: true } }).send).toBe(false)
    expect(recoveryDecision(base, { ...ctx, stage: 'checkout_started' })).toMatchObject({ send: false })
    expect(recoveryDecision(base, { ...ctx, converted: true })).toMatchObject({ send: false, status: 'stopped' })
    expect(recoveryDecision({ ...(base as object), orderId: 'o1' } as never, ctx)).toMatchObject({ send: false, reason: 'order recovery' })
    expect(recoveryDecision({ ...(base as object), lastActivityAt: new Date() } as never, ctx)).toMatchObject({ send: false, reason: 'still active', later: expect.any(Date) })
    expect(recoveryDecision(base, { ...ctx, otherRecovery: true })).toMatchObject({ send: false, reason: 'another recovery for this person' })
    expect(recoveryDecision(base, { ...ctx, consentGranted: null })).toMatchObject({ send: false, status: 'ineligible' })
    expect(recoveryDecision(base, { ...ctx, consentGranted: false })).toMatchObject({ send: false, status: 'stopped' })
    expect(recoveryDecision(base, { ...ctx, step: 2 })).toMatchObject({ send: false, reason: 'step 2 after 0 sent' })
    expect(recoveryDecision({ ...(base as object), recoveryStatus: 'stopped' } as never, ctx)).toMatchObject({ send: false })
  })
})

describe('recovery link', () => {
  it('a lead that stopped at the price goes back to that product on acces, unlocked; a checkout goes to the cart recovery', async () => {
    const { data } = await reveal()
    const l = (await leads.byId(db, data.leadId))!
    const res = await resume(new NextRequest(`https://${GATED}/api/lead/resume?t=${l.recoveryToken}`, { headers: { host: GATED } }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`https://${GATED}/calm?recuperare=1`)
    expect(value(setCookies(res).bt_gate)).toBe(l.id)
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    const c = (await leads.byId(db, step.leadId))!
    const r2 = await resume(new NextRequest(`https://${MAIN}/api/lead/resume?t=${c.recoveryToken}`, { headers: { host: MAIN } }))
    expect(r2.headers.get('location')).toBe(`https://${MAIN}/reluare/${c.recoveryToken}`)
    expect(setCookies(r2).bt_gate).toBeUndefined()
    const bad = await resume(new NextRequest(`https://${MAIN}/api/lead/resume?t=../../x`, { headers: { host: MAIN } }))
    expect(bad.headers.get('location')).toBe(`https://${MAIN}/reluare/invalid`)
  })
})

describe('CRM copy', () => {
  it('contact upsert and lead tags only: no opportunity for a lead, no NEUROS recovery tag', async () => {
    await reveal()
    await runDueJobs()
    expect(ghl.some((c) => c.url.includes('/contacts/upsert') && c.json?.email === 'ana@exemplu.ro')).toBe(true)
    const tags = ghl.filter((c) => c.url.endsWith('/tags')).flatMap((c) => c.json?.tags as string[])
    expect(tags.sort()).toEqual(['bt-interes-calm', 'bt-lead', 'bt-lead-acces'])
    expect(ghl.filter((c) => c.url.includes('/opportunities'))).toEqual([])
    expect(tags).not.toContain('bt-recuperare-eligibil')
  })
})

describe('retention, measurement, helpers', () => {
  it('leads without an order are deleted 12 months after the last activity; ordered ones stay', async () => {
    const a = await reveal()
    await db.query(`update leads set last_activity_at = now() - interval '366 days'`)
    expect(await purgeStaleLeads(db)).toBe(1)
    expect(await leads.byId(db, a.data.leadId)).toBeNull()
  })

  it('anonymous page counts per funnel and the comparison table', async () => {
    for (const [host, page] of [[GATED, 'calm'], [GATED, 'calm'], [MAIN, 'home'], [MAIN, 'evil']] as const)
      await visit(new NextRequest(`https://${host}/api/visit`, { method: 'POST', headers: { host, 'x-forwarded-for': `10.8.0.${++ip}` }, body: page }))
    await reveal()
    const stats = await funnelStats(db, new Date(Date.now() - 86_400_000))
    expect(stats.find((s) => s.funnel === 'gated_price')).toMatchObject({ visits: 2, leads: 1, reveals: 1 })
    expect(stats.find((s) => s.funnel === 'visible_price')).toMatchObject({ visits: 1, leads: 0 })
  })

  it('captureLead keeps the stage moving forward only', async () => {
    const v = crypto.randomUUID()
    const one = await db.tx((t) => captureLead(t, { visitorId: v, funnel: 'visible_price', stage: 'checkout_started', productId: CART_INTEREST, contact: ana, marketingConsent: false, cart: [{ productId: 'balance-wave', quantity: 1 }] }))
    expect(one.stageChanged).toBe(true)
    const two = await db.tx((t) => captureLead(t, { visitorId: v, funnel: 'visible_price', stage: 'lead', productId: CART_INTEREST, contact: ana, marketingConsent: false }))
    expect(two.lead.stage).toBe('checkout_started')
    expect(two.stageChanged).toBe(false)
  })

  it('cookie parsing and offer copy detection', () => {
    expect(cookieFrom('a=1; bt_vid=abc%20d; bt_gate=x', 'bt_vid')).toBe('abc d')
    expect(cookieFrom(null, 'bt_vid')).toBeUndefined()
    expect(mentionsOffer('Cum funcționează 2+1 gratis?')).toBe(true)
    expect(mentionsOffer('Costă 315 lei')).toBe(true)
    expect(mentionsOffer('10% la două bucăți')).toBe(true)
    expect(mentionsOffer('Cât durează o sesiune?')).toBe(false)
  })
})

describe('gated hostname routing', () => {
  it.each([
    ['/', true, false, { action: 'rewrite', path: '/acces' }],
    ['/calm', true, false, { action: 'rewrite', path: '/acces/calm' }],
    ['/products/calm', true, false, { action: 'redirect', path: '/calm' }],
    ['/acces/focus', true, false, { action: 'redirect', path: '/focus' }],
    ['/checkout', true, false, { action: 'redirect', path: '/' }],
    ['/checkout', true, true, { action: 'next' }],
    ['/cart', true, true, { action: 'next' }],
    ['/comanda/abc', true, false, { action: 'next' }],
    ['/reluare/abc', false, false, { action: 'next' }],
    ['/privacy-policy', true, false, { action: 'next' }],
    ['/admin', true, true, { action: 'main', path: '/admin' }],
    ['/brain-flow', true, false, { action: 'main', path: '/brain-flow' }],
    ['/', false, false, { action: 'main', path: '/' }],
    ['/calm', false, true, { action: 'main', path: '/products/calm' }],
    ['/checkout', false, true, { action: 'main', path: '/checkout' }],
  ])('%s (enabled %s, unlocked %s)', (path, enabled, unlocked, expected) => {
    expect(routeGated(path, enabled, unlocked)).toEqual(expected)
  })
})
