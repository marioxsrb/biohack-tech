/**
 * The consent section (14.10.2026): Terms required only in the checkout, one optional communications box that
 * names email and AI calls. Every combination on both funnels and in the checkout: what is recorded (two
 * separate consents, with the box's text version), what is never inferred (from the terms, from an older
 * email-only consent), what withdrawal stops, and what the CRM learns. GoHighLevel is mocked; PGlite database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const { leads } = await import('@/server/leads')
const { callConsent } = await import('@/server/calling/consent')
const { marketing } = await import('@/server/marketing/consent')
const { withdrawMarketing } = await import('@/server/marketing/unsubscribe')
const { runDueJobs } = await import('@/server/jobs/runner')
const { COMMUNICATIONS_CONSENT_VERSION, COMMUNICATIONS_CONSENT_TEXT } = await import('@/lib/consent/communications')
const { MARKETING_CONSENT_TEXTS } = await import('@/lib/consent/marketing')
const { CALL_CONSENT_TEXTS } = await import('@/lib/consent/calling')
const { TAGS, STAGES } = await import('@/server/integrations/ghl')
const { POST: lead } = await import('@/app/api/lead/route')
const { POST: checkout } = await import('@/app/api/checkout/route')

const ENV = { ...TEST_ENV, NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro', PRICE_GATE_ENABLED: 'true', ABANDONED_CHECKOUT_ENABLED: 'true', RECOVERY_EMAIL_ENABLED: 'true' }
const GATED = 'acces.biohack-tech.ro'
const MAIN = 'biohack-tech.ro'
const ana = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456' }
const PHONE = '+40722123456'

let db: Awaited<ReturnType<typeof freshDb>>
let ghl: { url: string; method: string; json: Record<string, unknown> | null }[]
let ip = 0

beforeEach(async () => {
  db = await freshDb(ENV)
  ghl = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.includes('leadconnectorhq.com')) {
      ghl.push({ url, method: init.method ?? 'GET', json: init.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
      return json({ contact: { id: 'contact-1' }, opportunities: [], opportunity: { id: 'opp-1' }, messageId: 'm1' })
    }
    return new Response('{}', { status: 404 })
  })
})
afterEach(() => vi.unstubAllGlobals())

function post(path: string, host: string, body: unknown) {
  return new NextRequest(`https://${host}${path}`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}` }, body: JSON.stringify(body) })
}
/** The price form as the page sends it: one box drives both fields. */
const reveal = (box: boolean) => lead(post('/api/lead', GATED, { action: 'reveal', ...ana, productId: 'balance-wave', marketingConsent: box, callConsent: box, page: '/products/calm' }))
/** The checkout: the order itself, and the checkout lead the contact step saves (same box, both fields). */
const order = (host: string, box: boolean, acceptedTerms = true) =>
  checkout(post('/api/checkout', host, { lines: [{ productId: 'balance-wave', quantity: 1 }], order: { ...person, marketingConsent: box, paymentMethod: 'cod' }, acceptedTerms, attemptId: `a-${Math.random()}` }))
const checkoutLead = (host: string, box: boolean) =>
  lead(post('/api/lead', host, { action: 'checkout', ...ana, marketingConsent: box, callConsent: box, cart: [{ productId: 'balance-wave', quantity: 1 }] }))

async function flush() {
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
}
const tagCalls = (method: 'POST' | 'DELETE') => ghl.filter((c) => c.method === method && c.url.endsWith('/tags') && (c.json?.tags as string[] | undefined)?.includes(TAGS.callConsent))
const count = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n

describe('the texts', () => {
  it('one wording, naming both channels, recorded under the same version for email and calls', () => {
    expect(COMMUNICATIONS_CONSENT_TEXT).toMatch(/email/)
    expect(COMMUNICATIONS_CONSENT_TEXT).toMatch(/apeluri de la asistentul AI/)
    expect(MARKETING_CONSENT_TEXTS[COMMUNICATIONS_CONSENT_VERSION]).toBe(COMMUNICATIONS_CONSENT_TEXT)
    expect(CALL_CONSENT_TEXTS[COMMUNICATIONS_CONSENT_VERSION]).toBe(COMMUNICATIONS_CONSENT_TEXT)
    // Older versions stay, so past consents keep their own proof.
    expect(MARKETING_CONSENT_TEXTS['mkt-2026-09-29']).toBeTruthy()
    expect(CALL_CONSENT_TEXTS['call-2026-10-14']).toBeTruthy()
  })
})

describe('price form (acces)', () => {
  it('box unticked: the price unlocks, nothing is consented, no recovery, no call', async () => {
    const res = await reveal(false)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/bt_gate2=/)
    const { leadId } = await res.json()
    const l = (await leads.byId(db, leadId))!
    expect(l).toMatchObject({ marketingConsent: false, callConsent: false })
    expect(await marketing.state(db, ana.email)).toBeNull()
    expect(await callConsent.state(db, PHONE)).toBeNull()
    expect(await count(`select count(*)::int as n from jobs where kind in ('marketing.sync','call.attempt')`)).toBe(0)
    await flush()
    expect(await count(`select count(*)::int as n from jobs where kind = 'lead.recovery' and status = 'done'`)).toBe(0)
  })

  it('box ticked: two separate consents with the box version; the CRM gets the call tag; calling off means no call', async () => {
    const { leadId } = await (await reveal(true)).json()
    expect(await marketing.state(db, ana.email)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION, source: 'lead_form' })
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION, source: 'lead_form' })
    expect((await leads.byId(db, leadId))!).toMatchObject({ marketingConsent: true, callConsent: true })
    // AI calling stays disabled: the consent is kept, no attempt is ever planned.
    expect(await count(`select count(*)::int as n from jobs where kind = 'call.attempt'`)).toBe(0)
    await flush()
    expect(tagCalls('POST')).toHaveLength(1)
    expect(await count(`select count(*)::int as n from jobs where kind = 'call.attempt'`)).toBe(0)
  })

  it('an earlier email-only consent is not turned into a call consent', async () => {
    // A consent given before 14.10.2026 under the email-only wording (as stored then).
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    await db.query(`update marketing_consent_events set text_version = 'mkt-2026-09-29', consent_text = $2 where email = $1`, [ana.email, MARKETING_CONSENT_TEXTS['mkt-2026-09-29']])
    await reveal(false)
    expect(await marketing.state(db, ana.email)).toMatchObject({ granted: true, version: 'mkt-2026-09-29' })
    expect(await callConsent.state(db, PHONE)).toBeNull()
    await flush()
    expect(tagCalls('POST')).toHaveLength(0)
  })
})

describe('checkout (both funnels)', () => {
  for (const host of [MAIN, GATED])
    it(`${host}: the terms are required; accepting them consents to nothing`, async () => {
      const refused = await order(host, false, false)
      expect(refused.status).toBe(422)
      expect((await refused.json()).fields.acceptedTerms).toBeTruthy()
      expect(await count('select count(*)::int as n from orders')).toBe(0)

      const ok = await order(host, false, true)
      expect(ok.status).toBe(200)
      expect(await count('select count(*)::int as n from orders')).toBe(1)
      expect(await marketing.state(db, person.email)).toBeNull()
      expect(await callConsent.state(db, PHONE)).toBeNull()
    })

  for (const host of [MAIN, GATED])
    it(`${host}: terms + communications box: the order records both consents, separately`, async () => {
      expect((await order(host, true)).status).toBe(200)
      expect(await marketing.state(db, person.email)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION, source: 'checkout' })
      expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION, source: 'checkout' })
    })

  it('an order with the box reaches the CRM with the call tag; one without it never does', async () => {
    await order(MAIN, false)
    await flush()
    await flush()
    expect(tagCalls('POST')).toHaveLength(0)
    await order(MAIN, true)
    await flush()
    await flush()
    expect(tagCalls('POST').length).toBeGreaterThanOrEqual(1)
  })

  it('the checkout lead follows the same box: unticked records nothing, ticked records both', async () => {
    await checkoutLead(MAIN, false)
    expect(await marketing.state(db, ana.email)).toBeNull()
    expect(await callConsent.state(db, PHONE)).toBeNull()
    await checkoutLead(MAIN, true)
    expect(await marketing.state(db, ana.email)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION })
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: true, version: COMMUNICATIONS_CONSENT_VERSION, source: 'checkout' })
  })
})

describe('withdrawal', () => {
  it('the email unsubscribe withdraws both; the CRM loses the call tag; recovery and calls stop', async () => {
    await reveal(true)
    await flush()
    expect(await withdrawMarketing(ana.email, 'unsubscribe_link')).toBe(true)
    expect(await marketing.state(db, ana.email)).toMatchObject({ granted: false })
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: false, source: 'unsubscribe_link' })
    await flush()
    expect(tagCalls('DELETE').length).toBeGreaterThanOrEqual(1)
    expect(await count(`select count(*)::int as n from jobs where kind = 'lead.recovery' and status = 'done'`)).toBe(0)
    // A second unsubscribe changes nothing.
    expect(await withdrawMarketing(ana.email, 'unsubscribe_link')).toBe(false)
  })

  it('a later form without the box does not withdraw, and does not re-grant after a withdrawal', async () => {
    await reveal(true)
    await reveal(false)
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: true })
    await withdrawMarketing(ana.email, 'unsubscribe_link')
    await reveal(false)
    expect(await marketing.state(db, ana.email)).toMatchObject({ granted: false })
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: false })
  })
})
