/**
 * Email marketing consent, checkout recovery eligibility, unsubscribe and the withdrawal function, from
 * the canonical database to GoHighLevel. External APIs are stubbed at the HTTP boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', async (orig) => ({ ...(await orig<object>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES, TAGS } = await import('@/server/integrations/ghl')
const { marketing } = await import('@/server/marketing/consent')
const { canSendAbandonedCheckoutEmail, recoveryCart } = await import('@/server/marketing/recovery')
const { withdrawMarketing } = await import('@/server/marketing/unsubscribe')
const { recordWithdrawal, validateWithdrawal, normalizeWithdrawal } = await import('@/server/orders/withdrawal')
const { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION } = await import('@/lib/consent/marketing')

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
let stripePi: string
let db: Awaited<ReturnType<typeof freshDb>>

function fakeApis() {
  calls = []
  const opps = new Map<string, string>()
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const raw = init.body ? String(init.body) : null
    const body = raw && raw.startsWith('{') ? JSON.parse(raw) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/payment_intents/')) {
      const id = url.split('/payment_intents/')[1]
      const o = (await db.query<{ id: string; total_minor: number }>('select id, total_minor from orders where stripe_payment_intent_id = $1', [id])).rows[0]
      return json({ id, status: stripePi, amount: o?.total_minor, amount_received: 0, currency: 'ron', metadata: { order_id: o?.id } })
    }
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: '1', Link: 'https://fgo/f.pdf' } })
    if (url.includes('/conversations/messages')) return json({ messageId: 'm1', emailMessageId: `e${calls.length}` })
    if (url.includes('/contacts/search')) return json({ contacts: [] })
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
    if (url.includes('/opportunities/')) return json({ opportunity: {} })
    return json({ message: 'not mocked' }, 404)
  })
}

async function runNow() {
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
}
const tagCalls = (method: 'POST' | 'DELETE') => calls.filter((c) => c.url.includes('/tags') && c.method === method).map((c) => c.body!.tags as string[])
const lastUpsertFields = () => {
  const up = calls.filter((c) => c.url.includes('/contacts/upsert')).at(-1)!
  return Object.fromEntries((up.body!.customFields as { key: string; field_value: string }[]).map((f) => [f.key, f.field_value]))
}
const emails = () => calls.filter((c) => c.url.includes('/conversations/messages')).map((c) => String(c.body!.subject))

async function cardOrder(attemptId: string, consent: boolean, email = person.email) {
  const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: { ...person, email, marketingConsent: consent }, attemptId })
  await svc.attachPaymentIntent(order.id, `pi_${attemptId}`)
  return order
}
async function abandon(orderId: string) {
  await db.query("update jobs set run_at = now() where order_id = $1 and kind = 'order.abandon_check'", [orderId])
  await runDueJobs()
  await runNow()
  return (await orders.byId(db, orderId))!
}

beforeEach(async () => {
  db = await freshDb()
  stripePi = 'requires_payment_method'
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

describe('marketing consent at checkout', () => {
  it('unticked: the order is placed normally and nothing is recorded as consent', async () => {
    const o = await cardOrder('m1', false)
    expect(o.status).toBe('pending')
    expect(await marketing.state(db, person.email)).toBeNull()
    expect(await marketing.history(db, person.email)).toEqual([])
  })

  it('ticked: the exact wording, its version, the time, the page and the order are stored', async () => {
    const before = Date.now()
    const o = await cardOrder('m2', true)
    const [e] = await marketing.history(db, person.email)
    expect(e).toMatchObject({ granted: true, source: 'checkout', text_version: MARKETING_CONSENT_VERSION, order_id: o.id, page: '/checkout' })
    expect(new Date(e.created_at).getTime()).toBeGreaterThanOrEqual(before - 1000)
    const text = (await db.query<{ consent_text: string }>('select consent_text from marketing_consent_events')).rows[0].consent_text
    expect(text).toBe(MARKETING_CONSENT_TEXT)
    expect(await marketing.state(db, person.email)).toMatchObject({ granted: true })
  })

  it('a double submit of the same attempt records the consent once', async () => {
    await cardOrder('m3', true)
    await cardOrder('m3', true)
    expect(await marketing.history(db, person.email)).toHaveLength(1)
  })

  it('an unticked box on a later order does not undo an earlier consent; a withdrawal does, until a new consent', async () => {
    await cardOrder('m4', true)
    await cardOrder('m5', false)
    expect((await marketing.state(db, person.email))!.granted).toBe(true)
    expect(await withdrawMarketing(person.email, 'unsubscribe_link')).toBe(true)
    expect(await withdrawMarketing(person.email, 'unsubscribe_link')).toBe(false)
    expect((await marketing.state(db, person.email))!.granted).toBe(false)
    await cardOrder('m6', true)
    expect((await marketing.state(db, person.email))!.granted).toBe(true)
  })
})

describe('checkout recovery eligibility', () => {
  const base = { paymentMethod: 'card' as const, paymentStatus: 'pending' as const, status: 'abandoned' as const, recoveryToken: 'x'.repeat(32), recoveryExpiresAt: new Date(Date.now() + 86_400_000) }
  const yes = { granted: true, at: new Date(), version: MARKETING_CONSENT_VERSION, source: 'checkout' as const }

  it('decides from consent and state, never from the mere existence of an email address', () => {
    expect(canSendAbandonedCheckoutEmail(base, null)).toEqual({ eligible: false, reason: 'no_marketing_consent' })
    expect(canSendAbandonedCheckoutEmail(base, { ...yes, granted: false })).toEqual({ eligible: false, reason: 'consent_withdrawn' })
    expect(canSendAbandonedCheckoutEmail(base, yes)).toEqual({ eligible: true, reason: 'marketing_consent' })
    expect(canSendAbandonedCheckoutEmail({ ...base, status: 'confirmed', paymentStatus: 'paid' }, yes).reason).toBe('paid')
    expect(canSendAbandonedCheckoutEmail({ ...base, status: 'cancelled' }, yes).reason).toBe('not_abandoned')
    expect(canSendAbandonedCheckoutEmail({ ...base, paymentMethod: 'bank_transfer' }, yes).reason).toBe('not_card')
    expect(canSendAbandonedCheckoutEmail({ ...base, recoveryExpiresAt: new Date(Date.now() - 1) }, yes).reason).toBe('link_expired')
  })

  it('without consent: the order becomes abandoned and visible in the CRM, but no recovery tag, link or email', async () => {
    const o = await abandon((await cardOrder('r1', false)).id)
    expect(o).toMatchObject({ status: 'abandoned', recoveryStatus: 'ineligible', recoveryReason: 'no_marketing_consent', recoveryToken: null })
    expect(calls.some((c) => c.url.endsWith('/opportunities/') && c.method === 'POST')).toBe(true)
    expect(tagCalls('POST').flat()).not.toContain(TAGS.recovery)
    expect(lastUpsertFields()).toMatchObject({ 'bt_marketing_consent': 'Nu', 'bt_recovery_url': '', 'bt_unsubscribe_url': '' })
    expect(emails()).toEqual([])
    const events = await orders.events(db, o.id)
    expect(events.find((e) => e.type === 'order.abandoned')!.data).toEqual({ recovery: 'ineligible', reason: 'no_marketing_consent' })
  })

  it('with consent: an opaque, expiring link that only restores the products; no GHL recovery tag (the app owns the email)', async () => {
    const o = await abandon((await cardOrder('r2', true)).id)
    expect(o).toMatchObject({ status: 'abandoned', recoveryStatus: 'eligible', recoveryReason: 'marketing_consent' })
    expect(o.recoveryToken).toMatch(/^[\w-]{32}$/)
    expect(o.recoveryToken).not.toContain(o.id)
    expect(o.recoveryExpiresAt!.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000)
    // W2's tag is never set any more: the recovery email is the application's (lead system), never GoHighLevel's.
    expect(tagCalls('POST').flat()).not.toContain(TAGS.recovery)
    const f = lastUpsertFields()
    expect(f['bt_recovery_url']).toBe(`${TEST_ENV.NEXT_PUBLIC_SITE_URL}/reluare/${o.recoveryToken}`)
    expect(f['bt_unsubscribe_url']).toMatch(new RegExp(`^${TEST_ENV.NEXT_PUBLIC_SITE_URL}/dezabonare/[\\w-]{32}$`))
    expect(f['bt_marketing_consent']).toBe('Da')
    expect(await recoveryCart(o.recoveryToken!)).toEqual([{ productId: 'balance-wave', variantId: undefined, quantity: 1 }])
    expect(await recoveryCart('x'.repeat(32))).toBeNull()
    expect(await recoveryCart(o.recoveryToken!, new Date(Date.now() + 8 * 86_400_000))).toBeNull()
    // No recovery email from the order itself (ABANDONED_CHECKOUT_ENABLED is off here; with it, the lead sequence sends it).
    expect(emails()).toEqual([])
  })

  it('paid later: the recovery stops (tag removed, link dead)', async () => {
    const o = await abandon((await cardOrder('r3', true)).id)
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    expect(tagCalls('DELETE').flat()).toContain(TAGS.recovery)
    expect(lastUpsertFields()['bt_recovery_url']).toBe('')
    expect(await recoveryCart(o.recoveryToken!)).toBeNull()
  })

  it('a new paid order closes the earlier abandoned attempts in the same step, so nothing recovers a purchase already made', async () => {
    const first = await abandon((await cardOrder('r4', true)).id)
    const second = await cardOrder('r5', false)
    await svc.confirmPayment(second.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    expect((await orders.byId(db, first.id))!).toMatchObject({ status: 'cancelled', cancelReason: 'înlocuită de o comandă plătită' })
    await runNow()
    expect(tagCalls('DELETE').flat()).toContain(TAGS.recovery)
    expect(lastUpsertFields()['bt_recovery_url']).toBe('')
    // The earlier attempt's opportunity is moved to "Anulată", and no customer email is sent about it.
    expect(emails().filter((s) => s.includes(first.orderNumber))).toEqual([])
  })

  it('duplicate payment events close the attempts and sync once', async () => {
    const first = await abandon((await cardOrder('r6', true)).id)
    const second = await cardOrder('r7', true)
    for (let i = 0; i < 3; i++) await svc.confirmPayment(second.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    const superseded = (await orders.events(db, first.id)).filter((e) => e.type === 'order.superseded')
    expect(superseded).toHaveLength(1)
    expect((await jobs.forOrder(db, first.id)).filter((j) => j.dedupeKey.endsWith(':order.superseded'))).toHaveLength(1)
  })
})

describe('unsubscribe', () => {
  it('withdrawal: future recovery is blocked, GHL gets consent=Nu and loses the recovery tag, once', async () => {
    const o = await abandon((await cardOrder('u1', true)).id)
    // The order's own consent syncs (email and AI calls) run first; only the unsubscribe's is counted.
    await runNow()
    calls.length = 0
    expect(await withdrawMarketing(person.email, 'unsubscribe_link', '/dezabonare')).toBe(true)
    expect(await withdrawMarketing(person.email, 'ghl')).toBe(false)
    await runNow()
    const syncs = calls.filter((c) => c.url.includes('/contacts/upsert'))
    expect(syncs).toHaveLength(1)
    expect(lastUpsertFields()).toMatchObject({ 'bt_marketing_consent': 'Nu', 'bt_recovery_url': '' })
    expect(tagCalls('DELETE').flat()).toContain(TAGS.recovery)
    const state = await marketing.state(db, person.email)
    expect(canSendAbandonedCheckoutEmail((await orders.byId(db, o.id))!, state)).toEqual({ eligible: false, reason: 'consent_withdrawn' })
  })

  it('an unsubscribed address is not eligible when a later checkout is abandoned', async () => {
    await cardOrder('u2', true)
    await withdrawMarketing(person.email, 'unsubscribe_link')
    const o = await abandon((await cardOrder('u3', false)).id)
    expect(o).toMatchObject({ status: 'abandoned', recoveryStatus: 'ineligible', recoveryReason: 'consent_withdrawn' })
  })

  it('order emails still go out after unsubscribing: they are not marketing', async () => {
    const o = await cardOrder('u4', true)
    await withdrawMarketing(person.email, 'unsubscribe_link')
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    await runNow()
    expect(emails()).toEqual([`Comanda ta Biohack Tech #${o.orderNumber}`, `Factura pentru comanda #${o.orderNumber}`])
  })

  it('the unsubscribe token is opaque and maps to one address', async () => {
    await cardOrder('u5', true)
    const token = (await marketing.unsubscribeToken(db, person.email))!
    expect(token).toMatch(/^[\w-]{32}$/)
    expect(await marketing.emailForToken(db, token)).toBe(person.email)
    expect(await marketing.emailForToken(db, 'nope')).toBeNull()
  })
})

describe('GHL → site unsubscribe webhook', () => {
  const post = async (body: unknown, secret?: string) => {
    const { POST } = await import('@/app/api/ghl/unsubscribe/route')
    const { NextRequest } = await import('next/server')
    return POST(new NextRequest('https://test/api/ghl/unsubscribe', { method: 'POST', body: JSON.stringify(body), headers: secret ? { 'x-bt-webhook-secret': secret } : {} }))
  }

  it('is absent without a secret, refuses a wrong one, records a valid one', async () => {
    expect((await post({ email: person.email })).status).toBe(404)
    vi.stubEnv('GHL_WEBHOOK_SECRET', 'a-long-shared-secret')
    await cardOrder('w0', true)
    expect((await post({ email: person.email }, 'wrong')).status).toBe(401)
    expect((await post({ email: 'not-an-email' }, 'a-long-shared-secret')).status).toBe(400)
    expect((await post({ email: person.email.toUpperCase() }, 'a-long-shared-secret')).status).toBe(200)
    expect(await marketing.state(db, person.email)).toMatchObject({ granted: false, source: 'ghl' })
  })
})

describe('cookie consent log', () => {
  const post = async (body: unknown) => {
    const { POST } = await import('@/app/api/consent/route')
    const { NextRequest } = await import('next/server')
    return POST(new NextRequest('https://test/api/consent', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '10.1.2.3' } }))
  }
  it('stores the choice under the random id only (no IP), and rejects malformed or outdated records', async () => {
    const { COOKIE_POLICY_VERSION } = await import('@/lib/consent/cookies')
    const id = crypto.randomUUID()
    expect((await post({ id, version: COOKIE_POLICY_VERSION, analytics: true, marketing: false, action: 'custom', page: '/products?x=1' })).status).toBe(200)
    expect((await post({ id, version: 'old', analytics: true, marketing: false, action: 'custom' })).status).toBe(400)
    expect((await post({ id: 'abc', version: COOKIE_POLICY_VERSION, analytics: true, marketing: false, action: 'custom' })).status).toBe(400)
    const rows = (await db.query('select * from cookie_consents')).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ consent_id: id, analytics: true, marketing: false, action: 'custom', page: '/products' })
    expect(JSON.stringify(rows[0])).not.toContain('10.1.2.3')
  })
})

describe('online withdrawal (OUG 34/2014 art. 11^1)', () => {
  it('a matching statement is stored with its content and time and acknowledged by email; the order shows it', async () => {
    const o = await cardOrder('x1', false)
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runNow()
    await runNow()
    calls.length = 0
    const input = normalizeWithdrawal({ name: 'Ana Popescu', email: 'ANA@exemplu.ro', orderNumber: `#${o.orderNumber.toLowerCase()}`, items: '', message: 'Nu mi se potrivește.' })
    expect(validateWithdrawal(input)).toEqual({})
    const { withdrawal, matched } = await recordWithdrawal(input)
    expect(matched).toBe(true)
    expect(withdrawal).toMatchObject({ orderId: o.id, orderNumber: o.orderNumber, items: 'Toate produsele din comandă' })
    expect(withdrawal.reference).toMatch(/^RET-[0-9A-F]{12}$/)
    await runNow()
    const mail = calls.find((c) => c.url.includes('/conversations/messages'))!.body!
    expect(mail.subject).toBe(`Am primit cererea de retragere pentru comanda #${o.orderNumber}`)
    for (const s of [withdrawal.reference, 'Ana Popescu', 'Toate produsele din comandă', 'Nu mi se potrivește.', 'Primită la']) expect(String(mail.message)).toContain(s)
    expect((await orders.events(db, o.id)).map((e) => e.type)).toContain('withdrawal.requested')
  })

  it('an unmatched statement is still stored for the team, without emailing an unverified address', async () => {
    const { matched, withdrawal } = await recordWithdrawal(normalizeWithdrawal({ name: 'Ion Ionescu', email: 'ion@exemplu.ro', orderNumber: 'BHT-20260101-0001' }))
    expect([matched, withdrawal.orderId]).toEqual([false, null])
    await runNow()
    expect(emails()).toEqual([])
  })

  it('asks for the fields it needs', () => {
    expect(Object.keys(validateWithdrawal(normalizeWithdrawal({})))).toEqual(['name', 'email', 'orderNumber'])
  })
})
