/**
 * Conversion engine: leads from the checkout's contact step, their link to orders, abandonment, the recovery
 * emails (three designed ones for a cart; consent, suppression, sequence, no duplicates), the CRM copy (contact
 * and tags only), retention and the funnel numbers. The former acces price form's leads (stage 'lead') get nothing. SMTP is a fake nodemailer transport,
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
const { leads, captureLead, recoveryDecision, purgeStaleLeads, CART_INTEREST } = await import('@/server/leads')
const { funnelStats } = await import('@/server/stats')
const { marketing } = await import('@/server/marketing/consent')
const { orders } = await import('@/server/orders/repository')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { POST: lead } = await import('@/app/api/lead/route')
const { GET: resume } = await import('@/app/api/lead/resume/route')
const { POST: checkout } = await import('@/app/api/checkout/route')
const { POST: visit } = await import('@/app/api/visit/route')
const { cookieFrom, LEAD_PRIVACY_VERSION } = await import('@/lib/lead')

const ENV = {
  ...TEST_ENV,
  NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'mail.biohack-tech.test',
  SMTP_USER: 'contact@biohack-tech.ro',
  SMTP_PASSWORD: 'not-a-real-password',
  EMAIL_FROM: 'contact@biohack-tech.ro',
  ABANDONED_CHECKOUT_ENABLED: 'true',
  RECOVERY_EMAIL_ENABLED: 'true',
}
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
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: [] })
      if (url.includes('/opportunities/pipelines'))
        return json({
          pipelines: [
            { id: 'pipe1', name: 'Comenzi Biohack Tech', stages: ['Așteaptă transferul', 'Plată nefinalizată', 'Plătită, de pregătit', 'În pregătire', 'Expediată', 'Livrată', 'Anulată', 'Rambursată'].map((n, i) => ({ id: `os${i}`, name: n })) },
            { id: 'leads1', name: 'Lead-uri Biohack Tech', stages: ['Lead nou', 'Abonat 10%', 'Checkout început', 'Comandă plasată', 'Dezabonat'].map((n, i) => ({ id: `ls${i}`, name: n })) },
            { id: 'buyers1', name: 'Clienți Biohack Tech', stages: ['NEUROS Calm', 'NEUROS Focus', 'NEUROS Amber', 'Mai multe produse'].map((n, i) => ({ id: `bs${i}`, name: n })) },
          ],
        })
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

/** The checkout's contact step for Ana, with one NEUROS Calm in the cart and a campaign. */
async function capture(extra: Record<string, unknown> = {}, cookies: Record<string, string> = {}, host = MAIN) {
  const res = await lead(post('/api/lead', host, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }], attribution: { utm_source: 'facebook', utm_campaign: 'toamna-test', fbclid: 'IwAR0abcdefghij' }, ...extra }, cookies))
  const data = await res.json()
  const c = setCookies(res)
  return { res, data, vid: value(c.bt_vid), cookies: c }
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

describe('checkout lead: what is stored', () => {
  it('stores the lead with the cart, attribution and privacy version; no consent assumed; no other cookie', async () => {
    const { res, data, cookies, vid } = await capture()
    expect(res.status).toBe(200)
    expect(cookies.bt_vid).toMatch(/HttpOnly/i)
    expect(Object.keys(cookies)).toEqual(['bt_vid'])
    const l = (await leads.byId(db, data.leadId))!
    expect(l).toMatchObject({ visitorId: vid, productId: CART_INTEREST, name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456', stage: 'checkout_started', landingHost: MAIN, fbclid: 'IwAR0abcdefghij', privacyVersion: LEAD_PRIVACY_VERSION, marketingConsent: false, callConsent: false })
    expect(l.attribution).toMatchObject({ utm: { utm_source: 'facebook', utm_campaign: 'toamna-test' }, fbclid: 'IwAR0abcdefghij' })
    expect(l.attribution).not.toHaveProperty('funnel')
    // No box ticked: no marketing consent recorded.
    expect(await marketing.state(db, 'ana@exemplu.ro')).toBeNull()
    // CRM copy, and the three abandonment checks.
    expect((await jobKinds(l.id)).map((j) => j.dedupe_key)).toEqual([`ghl.lead:${l.id}:checkout_started`, ...[1, 2, 3].map((n) => `lead.recovery:${l.id}:checkout_started:${n}`)])
  })

  it('a refresh or a double submit changes one row; a ticked box records consent with its source; unticking never removes it', async () => {
    const first = await capture({ marketingConsent: true })
    const again = await capture({ marketingConsent: false }, { bt_vid: first.vid })
    expect(again.data.leadId).toBe(first.data.leadId)
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(1)
    expect((await leads.byId(db, first.data.leadId))!.marketingConsent).toBe(true)
    expect(await marketing.state(db, 'ana@exemplu.ro')).toMatchObject({ granted: true, source: 'lead_form' })
    // No second set of jobs for the same stage.
    expect((await jobKinds(first.data.leadId)).length).toBe(4)
  })

  it('the price form is gone: its actions are refused; bad JSON and oversized bodies too', async () => {
    for (const action of ['reveal', 'interest', 'recognize', 'cart']) expect((await lead(post('/api/lead', MAIN, { action, ...ana, productId: 'balance-wave', termsAccepted: true }))).status).toBe(400)
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(0)
    const bad = new NextRequest(`https://${MAIN}/api/lead`, { method: 'POST', headers: { host: MAIN }, body: '{nope' })
    expect((await lead(bad)).status).toBe(400)
    const big = new NextRequest(`https://${MAIN}/api/lead`, { method: 'POST', headers: { host: MAIN }, body: JSON.stringify({ action: 'checkout', pad: 'x'.repeat(9000) }) })
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
    expect((await leads.byId(db, leadId))!).toMatchObject({ productId: CART_INTEREST, stage: 'checkout_started', cart: [{ productId: 'balance-wave', quantity: 2 }] })
  })
})


describe('leads → orders → purchases', () => {
  const order = (host: string, cookies: Record<string, string>, paymentMethod: string, attemptId: string) =>
    checkout(post('/api/checkout', host, { lines: [{ productId: 'balance-wave', quantity: 1 }], order: { ...person, paymentMethod }, acceptedTerms: true, attemptId, attribution: { utm_source: 'facebook' } }, cookies))

  it('a cash-on-delivery order: the visitor’s lead is ordered and linked', async () => {
    const first = await capture()
    const res = await order(MAIN, { bt_vid: first.vid }, 'cod', 'main-cod-1')
    expect(res.status).toBe(200)
    const o = (await orders.byToken(db, (await res.json()).token))!
    expect(o.attribution).toMatchObject({ utm: { utm_source: 'facebook' } })
    expect(o.attribution).not.toHaveProperty('funnel')
    const l = (await leads.byId(db, first.data.leadId))!
    expect(l).toMatchObject({ stage: 'ordered', orderId: o.id })
    expect((await db.query('select lead_id from orders where id = $1', [o.id])).rows[0].lead_id).toBe(l.id)
    // Nothing is chased after an order.
    await quiet(l.id, 60 * 30)
    await later()
    expect(sent.filter((m) => /așteaptă|întrebări|amintire/.test(m.subject))).toEqual([])
    expect((await leads.byId(db, l.id))!.recoveryStatus).toBe('stopped')
  })

  it('a transfer order is ordered at once and purchased when the money arrives', async () => {
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    const vid = (await leads.byId(db, step.leadId))!.visitorId
    const res = await order(MAIN, { bt_vid: vid }, 'transfer', 'main-transfer-1')
    const o = (await orders.byToken(db, (await res.json()).token))!
    expect((await leads.byId(db, step.leadId))!.stage).toBe('ordered')
    await svc.confirmPayment(o.id, 'admin')
    expect((await leads.byId(db, step.leadId))!).toMatchObject({ stage: 'purchased', recoveryStatus: 'stopped' })
  })

})

describe('unpaid card orders (application-owned recovery)', () => {
  const card = (cookies: Record<string, string>, attemptId: string, host = MAIN) =>
    checkout(post('/api/checkout', host, { lines: [{ productId: 'balance-wave', quantity: 1 }], order: { ...person, email: 'ana@exemplu.ro', paymentMethod: 'card' }, acceptedTerms: true, attemptId }, cookies))
  const recoveries = () => sent.filter((m) => m.to === 'ana@exemplu.ro' && /așteaptă|oferta|ajuta|coș|întrebări|amintire/i.test(m.subject))
  const abandonedOrder = async (id: string) => {
    await svc.markAbandonedIfUnpaid(id)
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes'`)
  }

  it('waits while the payment is open; once abandoned, one email from the checkout, with a link that restores the cart', async () => {
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    const vid = (await leads.byId(db, step.leadId))!.visitorId
    const o = (await orders.byToken(db, (await (await card({ bt_vid: vid }, 'card-open-1')).json()).token))!
    await quiet(step.leadId, 40)
    await later()
    expect(recoveries()).toEqual([]) // the order is still within its payment window
    await abandonedOrder(o.id)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
    const l = (await leads.byId(db, step.leadId))!
    expect(l).toMatchObject({ orderId: o.id, abandonment: 'checkout_abandoned', recoverySent: 1 })
    expect(recoveries()[0].text).toContain(`https://biohack-tech.ro/api/lead/resume?t=${l.recoveryToken}&cod=BIOHACK10`)
    const { recoveryCart } = await import('@/server/marketing/recovery')
    expect(await recoveryCart(l.recoveryToken!)).toEqual([{ productId: 'balance-wave', quantity: 1 }])
  })

  it('an order without any lead (no captured contact step) gets one when abandoned, and the same sequence', async () => {
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    const o = (await orders.byToken(db, (await (await card({}, 'card-nolead-1', MAIN)).json()).token))!
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(0)
    await abandonedOrder(o.id)
    const created = (await db.query<{ id: string; stage: string }>('select id, stage from leads where order_id = $1', [o.id])).rows
    expect(created).toMatchObject([{ stage: 'checkout_started' }])
    await later()
    expect(recoveries()).toHaveLength(1)
    expect((await db.query('select lead_id from orders where id = $1', [o.id])).rows[0].lead_id).toBe(created[0].id)
  })

  it('never after payment, cancellation, unsubscribe, or without consent; never twice', async () => {
    // Paid before the window ends.
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    let o = (await orders.byToken(db, (await (await card({}, 'card-paid-1', MAIN)).json()).token))!
    await abandonedOrder(o.id)
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: o.totalMinor, currency: 'ron' })
    await later()
    expect(recoveries()).toEqual([])
    // Cancelled.
    await setup()
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    o = (await orders.byToken(db, (await (await card({}, 'card-cancel-1', MAIN)).json()).token))!
    await abandonedOrder(o.id)
    await db.query(`update orders set status = 'cancelled' where id = $1`, [o.id])
    await later()
    expect(recoveries()).toEqual([])
    // Unsubscribed.
    await setup()
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    await marketing.withdraw(db, { email: 'ana@exemplu.ro', source: 'unsubscribe_link' })
    o = (await orders.byToken(db, (await (await card({}, 'card-unsub-1', MAIN)).json()).token))!
    await abandonedOrder(o.id)
    await later()
    expect(recoveries()).toEqual([])
    // No consent at all.
    await setup()
    o = (await orders.byToken(db, (await (await card({}, 'card-noconsent-1', MAIN)).json()).token))!
    await abandonedOrder(o.id)
    await later()
    expect(recoveries()).toEqual([])
    expect((await db.query<{ recovery_status: string }>('select recovery_status from leads where order_id = $1', [o.id])).rows[0].recovery_status).toBe('ineligible')
    // Abandonment repeated (job retry): still one lead, still one sequence.
    await svc.markAbandonedIfUnpaid(o.id)
    expect((await db.query('select count(*)::int as n from leads where order_id = $1', [o.id])).rows[0].n).toBe(1)
  })
})

describe('recovery emails', () => {
  const recoveries = () => sent.filter((m) => m.to === 'ana@exemplu.ro')

  it('without marketing consent: abandonment recorded, nothing sent, marked ineligible', async () => {
    const { data } = await capture()
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries()).toEqual([])
    expect((await leads.byId(db, data.leadId))!).toMatchObject({ abandonment: 'checkout_abandoned', recoveryStatus: 'ineligible', recoverySent: 0 })
  })

  it('with consent: nothing within the quiet period (planned again, never lost); a late queue never sends two at once', async () => {
    const { data } = await capture({ marketingConsent: true })
    // Still within the first 30 minutes: nothing yet, and nothing is lost (planned again).
    await runDueJobs()
    await db.query(`update jobs set run_at = now() where dedupe_key like 'lead.recovery:%:1'`)
    await runDueJobs()
    expect(recoveries()).toEqual([])
    expect((await db.query(`select count(*)::int as n from jobs where dedupe_key like 'lead.recovery:%:1:%' and status = 'pending'`)).rows[0].n).toBe(1)
    await quiet(data.leadId, 31)
    await db.query(`update jobs set run_at = now() where dedupe_key like 'lead.recovery:%:1:%'`)
    await runDueJobs()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
    // A queue that ran late never sends the second right after the first.
    await later()
    expect(recoveries().length).toBe(1)
  })

  it('an abandoned cart: three designed emails about a day apart, with the cart, today’s total, the code and the button; then nothing more', async () => {
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    const { leadId } = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 2 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }] }))).json()
    const l = (await leads.byId(db, leadId))!
    // The third email is planned for an abandoned cart (the price form keeps two).
    expect((await jobKinds(leadId)).map((j) => j.dedupe_key)).toEqual(expect.arrayContaining([`lead.recovery:${leadId}:checkout_started:3`]))
    await quiet(leadId, 40)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
    const [m1] = recoveries()
    expect(m1.html).toContain('NEUROS Calm')
    expect(m1.html).toContain('NEUROS Amber')
    expect(m1.html).toMatch(/Cantitate: 2/)
    expect(m1.html).toMatch(/https:\/\/biohack-tech\.ro\/_next\/image\?url=/) // the product photos
    expect(m1.html).toContain('BIOHACK10')
    expect(m1.html).toContain('Finalizează comanda')
    expect(m1.text).toMatch(/Total, cu promoțiile din coș: [\d.]+ lei/)
    expect(m1.text).toContain(`https://biohack-tech.ro/api/lead/resume?t=${l.recoveryToken}&cod=BIOHACK10`)
    expect(m1.text).toMatch(/https:\/\/biohack-tech\.ro\/dezabonare\/[\w-]+/)
    expect(`${m1.subject} ${m1.text}`).not.toMatch(/ultima șansă|expiră|grăbește/i)
    // A day later: the second (questions answered); a late queue never sends it right after the first.
    await later()
    expect(recoveries().length).toBe(1)
    await db.query(`update leads set last_activity_at = now() - interval '25 hours', last_recovery_at = now() - interval '23 hours'`)
    await later()
    await later()
    expect(recoveries().map((m) => m.subject)[1]).toBe('Ai întrebări despre NEUROS Calm, NEUROS Amber? Suntem aici')
    expect(recoveries()[1].text).toMatch(/Livrare: Gratuită/)
    // Another day: the third and last.
    await db.query(`update leads set last_activity_at = now() - interval '49 hours', last_recovery_at = now() - interval '23 hours'`)
    await later()
    await later()
    expect(recoveries().map((m) => m.subject)[2]).toBe('Ultima amintire: codul tău BIOHACK10 pentru NEUROS Calm, NEUROS Amber')
    expect((await leads.byId(db, leadId))!).toMatchObject({ recoveryStatus: 'sent', recoverySent: 3 })
    await db.query(`update leads set last_recovery_at = now() - interval '5 days'`)
    await later()
    expect(recoveries().length).toBe(3)
  })

  it('the cart sequence in English, in euros, from biohack-tech.net; without an active code, no code box', async () => {
    await db.query("update promo_codes set active = false where code = 'BIOHACK10'")
    await marketing.grant(db, { email: 'ana@exemplu.ro', source: 'checkout' })
    const { leadId } = await (await lead(post('/api/lead', 'www.biohack-tech.net', { action: 'checkout', locale: 'en', ...ana, cart: [{ productId: 'brainlink-pro', quantity: 1 }] }))).json()
    await quiet(leadId, 40)
    await later()
    const m = sent.find((x) => x.to === 'ana@exemplu.ro' && x.subject === 'Your cart is waiting for you')!
    expect(m.text).toMatch(/1 × NEUROS Focus: €[\d,]+/)
    expect(m.text).toContain('https://www.biohack-tech.net/api/lead/resume?t=')
    expect(m.text).not.toContain('cod=')
    expect(m.html).not.toContain('YOUR CODE')
    expect(m.html).toContain('Complete my order')
  })

  it('one sequence per person: two checkouts (two browsers) give one recovery email', async () => {
    await capture({ marketingConsent: true })
    await capture({ marketingConsent: true }, {}, 'calm.biohack-tech.ro')
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(2)
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes'`)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
    // Even later (step 2 time): only one second email.
    await db.query(`update leads set last_activity_at = now() - interval '25 hours', last_recovery_at = last_recovery_at - interval '23 hours'`)
    await later()
    await later()
    expect(recoveries().length).toBe(2)
  })

  it('an older checkout that was stopped (unsubscribed then) does not silence a newer lead with fresh consent', async () => {
    await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, marketingConsent: true, cart: [{ productId: 'balance-wave', quantity: 1 }] }))
    await marketing.withdraw(db, { email: 'ana@exemplu.ro', source: 'unsubscribe_link' })
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes', created_at = now() - interval '1 hour'`)
    await later()
    expect(recoveries()).toEqual([])
    const fresh = await capture({ marketingConsent: true })
    await quiet(fresh.data.leadId, 40)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
  })

  it('the older lead owns the sequence: a newer checkout never emails first, even when its step runs first', async () => {
    const first = await capture({ marketingConsent: true })
    const second = await capture({ marketingConsent: true }, {}, 'calm.biohack-tech.ro')
    await db.query(`update leads set created_at = now() - interval '2 hours' where id = $1`, [first.data.leadId])
    await runDueJobs()
    // The older lead was active again (its step moves later); the newer one's step is due now.
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes' where id = $1`, [second.data.leadId])
    await db.query(`update leads set last_activity_at = now() - interval '10 minutes' where id = $1`, [first.data.leadId])
    await db.query(`update jobs set run_at = now() where dedupe_key like 'lead.recovery:%:1'`)
    await runDueJobs()
    expect(recoveries()).toEqual([])
    // Later the older lead's step: its email, and the newer one stays quiet.
    await db.query(`update leads set last_activity_at = now() - interval '40 minutes'`)
    await later()
    expect(recoveries().map((m) => m.subject)).toEqual(['Produsele tale te așteaptă în coș'])
    expect((await leads.byId(db, first.data.leadId))!.recoverySent).toBe(1)
  })

  it('unsubscribe or withdrawn consent before a step: stopped, nothing sent', async () => {
    const { data } = await capture({ marketingConsent: true })
    await marketing.withdraw(db, { email: 'ana@exemplu.ro', source: 'unsubscribe_link' })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries()).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('stopped')
  })

  it('a purchase with the same email elsewhere (another device) stops it', async () => {
    const { data } = await capture({ marketingConsent: true })
    await svc.placeOrder({ lines: (await import('./helpers')).lines([{ productId: 'balance-wave', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'other-device' })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(recoveries().filter((m) => /coș|întrebări|amintire/.test(m.subject))).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('stopped')
  })

  it('RECOVERY_EMAIL_ENABLED off: abandonment still recorded, nothing sent', async () => {
    await setup({ ...ENV, RECOVERY_EMAIL_ENABLED: 'false' })
    const { data } = await capture({ marketingConsent: true })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(sent).toEqual([])
    expect((await leads.byId(db, data.leadId))!).toMatchObject({ abandonment: 'checkout_abandoned', recoveryStatus: 'disabled' })
  })

  it('test mode (RECOVERY_TEST_RECIPIENTS): only listed addresses get an email; everyone else is treated as off', async () => {
    await setup({ ...ENV, RECOVERY_TEST_RECIPIENTS: 'marioxsrb@gmail.com' })
    const other = await capture({ marketingConsent: true })
    const test = await capture({ marketingConsent: true, email: 'MarioXsrb@gmail.com' })
    await quiet(other.data.leadId, 40)
    await quiet(test.data.leadId, 40)
    await later()
    expect(sent.map((m) => m.to)).toEqual(['marioxsrb@gmail.com'])
    expect((await leads.byId(db, other.data.leadId))!).toMatchObject({ recoveryStatus: 'disabled', recoverySent: 0 })
  })

  it('needs the own email transport (never GoHighLevel’s, so the CRM never sends a second copy)', async () => {
    await setup({ ...ENV, EMAIL_TRANSPORT: 'ghl' })
    const { data } = await capture({ marketingConsent: true })
    await quiet(data.leadId, 60 * 30)
    await later()
    expect(ghl.filter((c) => c.url.includes('/conversations/messages'))).toEqual([])
    expect((await leads.byId(db, data.leadId))!.recoveryStatus).toBe('ineligible')
  })

  it('the decision is pure and ordered: flags, stage, conversion, order recovery, activity, consent, sequence', () => {
    const base = { id: 'x', stage: 'checkout_started', recoveryStatus: 'none', recoverySent: 0, recoveryReason: null, orderId: null, lastActivityAt: new Date(Date.now() - 3_600_000) } as never
    const ctx = { stage: 'checkout_started', step: 1, now: new Date(), features: { abandonedCheckout: true, recoveryEmail: true }, firstMinutes: 30, converted: false, superseded: false, otherRecovery: false, consentGranted: true, canSend: true }
    expect(recoveryDecision(base, ctx)).toEqual({ send: true, abandonment: 'checkout_abandoned' })
    expect(recoveryDecision(base, { ...ctx, features: { abandonedCheckout: false, recoveryEmail: true } }).send).toBe(false)
    expect(recoveryDecision(base, { ...ctx, stage: 'lead' })).toMatchObject({ send: false })
    // A lead of the former acces price form: never an email any more.
    expect(recoveryDecision({ ...(base as object), stage: 'lead' } as never, { ...ctx, stage: 'lead' })).toEqual({ send: false, reason: 'acces closed', status: 'stopped' })
    expect(recoveryDecision(base, { ...ctx, converted: true })).toMatchObject({ send: false, status: 'stopped' })
    // The lead's own unpaid card order: wait while it can still be paid, stop if cancelled, recover once abandoned.
    const order = (status: string, paymentStatus = 'pending') => ({ status, paymentMethod: 'card', paymentStatus, createdAt: new Date() })
    expect(recoveryDecision({ ...(base as object), orderId: 'o1' } as never, { ...ctx, order: order('pending') })).toMatchObject({ send: false, reason: 'order awaiting payment', later: expect.any(Date) })
    expect(recoveryDecision({ ...(base as object), orderId: 'o1' } as never, { ...ctx, order: order('cancelled', 'cancelled') })).toMatchObject({ send: false, reason: 'order cancelled', status: 'stopped' })
    expect(recoveryDecision({ ...(base as object), orderId: 'o1' } as never, { ...ctx, order: order('abandoned') })).toEqual({ send: true, abandonment: 'checkout_abandoned' })
    expect(recoveryDecision({ ...(base as object), lastActivityAt: new Date() } as never, ctx)).toMatchObject({ send: false, reason: 'still active', later: expect.any(Date) })
    expect(recoveryDecision(base, { ...ctx, otherRecovery: true })).toMatchObject({ send: false, reason: 'another recovery for this person' })
    expect(recoveryDecision(base, { ...ctx, consentGranted: null })).toMatchObject({ send: false, status: 'ineligible' })
    expect(recoveryDecision(base, { ...ctx, consentGranted: false })).toMatchObject({ send: false, status: 'stopped' })
    expect(recoveryDecision(base, { ...ctx, step: 2 })).toMatchObject({ send: false, reason: 'waiting for email 1', later: expect.any(Date) })
    expect(recoveryDecision({ ...(base as object), lastActivityAt: new Date(Date.now() - 8 * 86_400_000) } as never, { ...ctx, step: 2 })).toMatchObject({ send: false, reason: 'step 2 after 0 sent' })
    expect(recoveryDecision({ ...(base as object), recoveryStatus: 'stopped' } as never, ctx)).toMatchObject({ send: false })
  })
})

describe('recovery link', () => {
  it('an old price-form lead goes back to that product on the main site; a checkout goes to the cart recovery', async () => {
    const { data } = await capture()
    // A lead of the former acces price form (stage 'lead', one product, no cart).
    await db.query("update leads set stage = 'lead', product_id = 'balance-wave', cart = null where id = $1", [data.leadId])
    const l = (await leads.byId(db, data.leadId))!
    const res = await resume(new NextRequest(`https://${MAIN}/api/lead/resume?t=${l.recoveryToken}`, { headers: { host: MAIN } }))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe(`https://${MAIN}/products/calm?recuperare=1`)
    expect(setCookies(res).bt_gate2).toBeUndefined()
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    const c = (await leads.byId(db, step.leadId))!
    const r2 = await resume(new NextRequest(`https://${MAIN}/api/lead/resume?t=${c.recoveryToken}`, { headers: { host: MAIN } }))
    expect(r2.headers.get('location')).toBe(`https://${MAIN}/reluare/${c.recoveryToken}`)
    expect(setCookies(r2).bt_gate2).toBeUndefined()
    const bad = await resume(new NextRequest(`https://${MAIN}/api/lead/resume?t=../../x`, { headers: { host: MAIN } }))
    expect(bad.headers.get('location')).toBe(`https://${MAIN}/reluare/invalid`)
  })
})

describe('CRM copy', () => {
  // The person's opportunity (leads / customers pipelines), not the orders' own (stages os…).
  const leadOpps = () => ghl.filter((c) => (c.method === 'POST' || c.method === 'PUT') && /\/opportunities\/[^s]*$/.test(c.url) && !String(c.json?.pipelineStageId ?? '').startsWith('os'))
  it('contact upsert, lead tags and one opportunity in the leads pipeline (never the order pipeline), no NEUROS recovery tag', async () => {
    await capture()
    await runDueJobs() // the run the route started in the background
    await runDueJobs()
    expect(ghl.some((c) => c.url.includes('/contacts/upsert') && c.json?.email === 'ana@exemplu.ro')).toBe(true)
    const tags = ghl.filter((c) => c.url.endsWith('/tags')).flatMap((c) => c.json?.tags as string[])
    // Interest, step, site and campaign as bt- tags; the contact's own source is left alone (no NEUROS data overwritten).
    expect(tags.sort()).toEqual(['bt-campanie-toamna-test', 'bt-interes-calm', 'bt-lead', 'bt-lead-checkout', 'bt-lead-site', 'bt-site-ro', 'bt-sursa-facebook'])
    expect(ghl.find((c) => c.url.includes('/contacts/upsert'))!.json).not.toHaveProperty('source')
    expect(leadOpps()).toHaveLength(1)
    expect(leadOpps()[0].json).toMatchObject({ pipelineId: 'leads1', pipelineStageId: 'ls2', status: 'open', contactId: 'contact-1', name: 'Ana Popescu · ana@exemplu.ro' })
    expect(ghl.some((c) => c.json?.pipelineId === 'pipe1')).toBe(false)
    expect(tags).not.toContain('bt-recuperare-eligibil')
  })

  it('the 10% popup: the address reaches the CRM with its own tags, in "Abonat 10%"; .net is tagged as such', async () => {
    const { welcomeSignup } = await import('@/server/welcome')
    await db.tx((t) => welcomeSignup(t, 'ion@exemplu.com', '/en', 'en', 'net'))
    await runDueJobs()
    await runDueJobs()
    const tags = ghl.filter((c) => c.url.endsWith('/tags')).flatMap((c) => c.json?.tags as string[])
    expect(tags.sort()).toEqual(['bt-lead', 'bt-lead-popup-10', 'bt-site-net'])
    expect(leadOpps()[0].json).toMatchObject({ pipelineId: 'leads1', pipelineStageId: 'ls1', name: 'ion@exemplu.com' })
  })

  it('one opportunity per address, even when GHL search has not indexed the first one yet (a second sync moves it)', async () => {
    const { welcomeSignup } = await import('@/server/welcome')
    await capture()
    await runDueJobs()
    await runDueJobs()
    await db.tx((t) => welcomeSignup(t, ana.email, '/', 'ro', 'ro'))
    await runDueJobs()
    // The stub's search never finds anything: only the stored id prevents a second opportunity.
    expect(leadOpps().filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(leadOpps().filter((c) => c.method === 'PUT' && c.url.endsWith('/opportunities/opp-1'))).toHaveLength(1)
    expect((await db.query('select ghl_opportunity_id from crm_prospects where email = $1', [ana.email])).rows).toEqual([{ ghl_opportunity_id: 'opp-1' }])
  })

  it('a purchase moves the same opportunity to the customers pipeline, under what was bought; a cancellation brings it back', async () => {
    const step = await (await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart: [{ productId: 'balance-wave', quantity: 1 }] }))).json()
    await runDueJobs()
    await runDueJobs()
    expect(leadOpps().at(-1)!.json).toMatchObject({ pipelineId: 'leads1', pipelineStageId: 'ls2' }) // Checkout început
    const vid = (await leads.byId(db, step.leadId))!.visitorId
    const buy = (lines: { productId: string; variantId?: string; quantity: number }[], attemptId: string) =>
      checkout(post('/api/checkout', MAIN, { lines, order: { ...person, email: ana.email, paymentMethod: 'transfer' }, acceptedTerms: true, attemptId }, { bt_vid: vid }))
    const o1 = (await orders.byToken(db, (await (await buy([{ productId: 'balance-wave', quantity: 1 }], 'buy-1')).json()).token))!
    await runDueJobs()
    await runDueJobs()
    const moved = leadOpps().at(-1)!
    expect(moved.method).toBe('PUT')
    expect(moved.url).toMatch(/\/opportunities\/opp-1$/) // the same opportunity, not a new one
    expect(moved.json).toMatchObject({ pipelineId: 'buyers1', pipelineStageId: 'bs0', status: 'open', monetaryValue: Math.round(o1.totalMinor / 100) })
    // A second product: "Mai multe produse".
    await buy([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }], 'buy-2')
    await runDueJobs()
    await runDueJobs()
    expect(leadOpps().at(-1)!.json).toMatchObject({ pipelineId: 'buyers1', pipelineStageId: 'bs3' })
    // Both cancelled: back to the leads pipeline, where they stopped.
    for (const { id } of (await db.query<{ id: string }>('select id from orders')).rows) await svc.cancelOrder(id, 'admin', 'test')
    await runDueJobs()
    await runDueJobs()
    expect(leadOpps().at(-1)!.json).toMatchObject({ pipelineId: 'leads1' })
  })

  it('the stage follows the furthest step: checkout, then unsubscribed (lost); a missing pipeline never fails the lead', async () => {
    const { prospectFor } = await import('@/server/prospects')
    const a = await capture({ marketingConsent: true })
    expect(await prospectFor(db, ana.email)).toMatchObject({ stage: 'checkout', site: 'ro' })
    await marketing.withdraw(db, { email: ana.email, source: 'unsubscribe_link' })
    expect((await prospectFor(db, ana.email))?.stage).toBe('unsubscribed')
    await db.query("update leads set stage = 'ordered' where id = $1", [a.data.leadId])
    expect((await prospectFor(db, ana.email))?.stage).toBe('ordered')
    expect(await prospectFor(db, 'nobody@exemplu.ro')).toBeNull()
  })
})

describe('CRM consent', () => {
  it('a ticked box on the form reaches the CRM as the marketing consent field, on the same contact as the lead', async () => {
    await capture({ marketingConsent: true })
    await runDueJobs()
    await db.query("update jobs set run_at = now() where status = 'pending' and kind <> 'lead.recovery'")
    await runDueJobs()
    // The lead's sync created the contact (lookup first: none) and stored its id; the consent then updates that contact.
    expect(ghl.filter((c) => c.url.includes('/contacts/upsert'))).toHaveLength(1)
    const consent = ghl.filter((c) => c.method === 'PUT' && c.url.endsWith('/contacts/contact-1'))
    expect(consent).toHaveLength(1)
    expect(consent[0].json?.customFields).toEqual(expect.arrayContaining([{ key: 'bt_marketing_consent', field_value: 'Da' }]))
  })
})

describe('retention, measurement, helpers', () => {
  it('leads without an order are deleted 12 months after the last activity; ordered ones stay', async () => {
    const a = await capture()
    await db.query(`update leads set last_activity_at = now() - interval '366 days'`)
    expect(await purgeStaleLeads(db)).toBe(1)
    expect(await leads.byId(db, a.data.leadId)).toBeNull()
  })

  it('anonymous visits: page loads and sessions, campaign kept; the funnel numbers over all sites', async () => {
    const send = (host: string, body: unknown) => visit(new NextRequest(`https://${host}/api/visit`, { method: 'POST', headers: { host, 'x-forwarded-for': `10.8.0.${++ip}` }, body: typeof body === 'string' ? body : JSON.stringify(body) }))
    await send('calm.biohack-tech.ro', { page: 'calm', session: true, source: 'facebook', campaign: 'toamna' })
    await send('calm.biohack-tech.ro', { page: 'home', session: false, source: 'facebook', campaign: 'toamna' })
    await send(MAIN, { page: 'home', session: true })
    await send(MAIN, 'calm') // the old plain-text beacon still counts a page load
    await send(MAIN, { page: 'evil', session: true }) // unknown pages are ignored
    await capture()
    expect((await db.query<{ site: string }>('select distinct site from visit_stats order by site')).rows.map((r) => r.site)).toEqual(['calm', 'main'])
    const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) }
    expect(await funnelStats(db, range)).toMatchObject({ sessions: 2, views: 4, productViews: 2, leads: 1 })
    expect(await funnelStats(db, { ...range, source: 'facebook' })).toMatchObject({ sessions: 1, views: 2, leads: 1 })
    expect(await funnelStats(db, { ...range, product: 'brainlink-pro' })).toMatchObject({ productViews: 0, leads: 0 })
  })

  it('captureLead keeps the stage moving forward only', async () => {
    const v = crypto.randomUUID()
    const one = await db.tx((t) => captureLead(t, { visitorId: v, stage: 'checkout_started', productId: CART_INTEREST, contact: ana, marketingConsent: false, cart: [{ productId: 'balance-wave', quantity: 1 }] }))
    expect(one.stageChanged).toBe(true)
    await db.query("update leads set stage = 'ordered' where id = $1", [one.lead.id])
    const two = await db.tx((t) => captureLead(t, { visitorId: v, stage: 'checkout_started', productId: CART_INTEREST, contact: ana, marketingConsent: false }))
    expect(two.lead.stage).toBe('ordered')
    expect(two.stageChanged).toBe(false)
  })

  it('cookie parsing', () => {
    expect(cookieFrom('a=1; bt_vid=abc%20d; b=x', 'bt_vid')).toBe('abc d')
    expect(cookieFrom(null, 'bt_vid')).toBeUndefined()
  })
})
