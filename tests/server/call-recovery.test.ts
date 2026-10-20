/**
 * AI call recovery: an unfinished checkout (the main site or a product landing) called 20 minutes after the
 * cart's last change, test mode (2 minutes, listed numbers only), the personal 10% code (one use, own address, 24 hours, never
 * after a purchase, added to the automatic promotions like every code), its email before the call (only with consent,
 * never twice), and the agent's server tools. ElevenLabs, GoHighLevel and SMTP are mocked; PGlite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

type Sent = { to: string; subject: string; text: string }
let sent: Sent[]
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: async (m: Sent & { messageId: string }) => (sent.push(m), { messageId: m.messageId, response: '250 OK', accepted: [m.to], rejected: [] }) }) },
}))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const { leads, CART_INTEREST } = await import('@/server/leads')
const { calls } = await import('@/server/calling/calls')
const { callConsent } = await import('@/server/calling/consent')
const { recoveryCode } = await import('@/server/calling/offer')
const { marketing } = await import('@/server/marketing/consent')
const { promoCodes, ruleOf } = await import('@/server/promo')
const { priceLines } = await import('@/lib/promotions')
const { signWebhook } = await import('@/server/integrations/elevenlabs')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { POST: lead } = await import('@/app/api/lead/route')
const { POST: webhook } = await import('@/app/api/webhooks/elevenlabs/route')
const { POST: tool } = await import('@/app/api/calling/tools/[tool]/route')
const { POST: welcome } = await import('@/app/api/welcome/route')
const { callBlocklist } = await import('@/server/calling/blocklist')
const { placeTestCall, testCalls } = await import('@/server/calling/test-call')
const { getConfig } = await import('@/server/config')

const SECRET = 'whsec_el_test_secret'
const TOOL_SECRET = 'tool-secret-for-tests-0123456789'
const ENV = {
  ...TEST_ENV,
  NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro',
  EMAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'mail.biohack-tech.test',
  SMTP_USER: 'contact@biohack-tech.ro',
  SMTP_PASSWORD: 'not-a-real-password',
  EMAIL_FROM: 'contact@biohack-tech.ro',
  NOTIFY_EMAIL: 'orders@biohack-tech.ro',
  ABANDONED_CHECKOUT_ENABLED: 'true',
  RECOVERY_EMAIL_ENABLED: 'true',
  AI_CALLING_ENABLED: 'true',
  AI_CALLING_DRY_RUN: 'false',
  AI_CALLING_HOURS: '0-24',
  AI_CALLING_DAYS: '1-7',
  ELEVENLABS_API_KEY: 'el-test-key',
  ELEVENLABS_AGENT_ID: 'agent_test',
  ELEVENLABS_PHONE_NUMBER_ID: 'phnum_test',
  ELEVENLABS_WEBHOOK_SECRET: SECRET,
  ELEVENLABS_TOOL_SECRET: TOOL_SECRET,
  ELEVENLABS_API_BASE: 'https://el.test',
}
const MAIN = 'biohack-tech.ro'
const ana = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456' }
const PHONE = '+40722123456'

let db: Awaited<ReturnType<typeof freshDb>>
let el: { url: string; json: Record<string, unknown> | null }[]
let ip = 0

async function setup(env: Record<string, string> = ENV) {
  db = await freshDb(env)
  sent = []
  el = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.startsWith('https://el.test')) {
      el.push({ url, json: init.body ? JSON.parse(String(init.body)) : null })
      if (url.endsWith('/outbound-call')) return json({ success: true, message: 'ok', conversation_id: `conv_${el.length}`, callSid: `CA${el.length}`, sip_call_id: `SIP${el.length}` })
      return json({ detail: 'not found' }, 404)
    }
    if (url.includes('leadconnectorhq.com')) {
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      return json({})
    }
    return json({ message: 'not mocked' }, 404)
  })
}
beforeEach(() => setup())
afterEach(() => vi.unstubAllGlobals())

function post(path: string, host: string, body: unknown) {
  return new NextRequest(`https://${host}${path}`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.8.0.${++ip}` }, body: JSON.stringify(body) })
}
const checkout = async (cart: unknown[], extra: Record<string, unknown> = {}, host = MAIN) => {
  await lead(post('/api/lead', host, { action: 'checkout', ...ana, cart, callConsent: true, marketingConsent: true, ...extra }))
  return (await db.query<{ id: string }>(`select id from leads where product_id = '${CART_INTEREST}' order by created_at desc limit 1`)).rows[0].id
}
async function later() {
  await runDueJobs()
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
  await db.query("update jobs set run_at = now() where status in ('pending','retry') and kind <> 'call.attempt'")
  await runDueJobs()
}
const quiet = (minutes = 90) => db.query(`update leads set last_activity_at = now() - ($1 || ' minutes')::interval`, [String(minutes)])
const dials = () => el.filter((c) => c.url.endsWith('/outbound-call'))
const varsOf = (i = 0) => (dials()[i].json!.conversation_initiation_client_data as { dynamic_variables: Record<string, string | number> }).dynamic_variables
const firstCallIn = async (leadId: string) => {
  const r = (await db.query<{ run_at: string }>(`select run_at from jobs where kind = 'call.attempt' and payload->>'leadId' = $1 order by id limit 1`, [leadId])).rows[0]
  return r ? Math.round((new Date(r.run_at).getTime() - Date.now()) / 60_000) : null
}
const useTool = (name: string, body: Record<string, unknown>, secret: string | null = TOOL_SECRET) =>
  tool(new NextRequest(`https://biohack-tech.ro/api/calling/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret && { 'x-biohack-tool-secret': secret }) }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ tool: name }),
  })

describe('an unfinished checkout', () => {
  it('called 20 minutes after the last cart activity, about the real cart; the code email goes out before the call, once', async () => {
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 2 }])
    expect(await firstCallIn(leadId)).toBe(20)
    await quiet(25)
    await later()
    expect(dials()).toHaveLength(1)
    const vars = varsOf()
    expect(vars).not.toHaveProperty('funnel_type')
    expect(vars).not.toHaveProperty('abandonment_type')
    expect(vars).toMatchObject({
      product_names: 'NEUROS Calm',
      product_quantities: '2 × NEUROS Calm',
      cart_total: '11.484 lei', // 2 × 6.380 lei with the 10% for two
      recovery_discount_percent: 10,
      recovery_code: 'BIOHACK10',
      recovery_email_sent: 'da',
    })
    expect(vars).not.toHaveProperty('recovery_expiration')
    expect(vars.opening_line).toMatch(/^Bună (ziua|seara)(, (doamna|domnule) [^!]+)?! Numele meu este Maria și vă sun din partea magazinului Baiohec Tec\. Sunt un asistent automat, iar apelul este înregistrat\. Am văzut că ați adăugat în coș două bucăți de NEUROS Calm\. Aveți un minut\?$/)
    // One email in total: the code email (it replaces the regular first recovery email).
    expect(sent.map((m) => m.subject)).toEqual(['Codul tău de 10% pentru NEUROS Calm'])
    expect(sent[0].text).toContain(String(vars.recovery_code))
    expect(sent[0].text).toContain('2 × NEUROS Calm')
    expect(sent[0].text).toMatch(/20% \+ 10% = 30%/)
    expect(sent[0].text).toMatch(/dezabonare/)
    const [call] = await calls.forLeads(db, [leadId])
    expect(call).toMatchObject({ scenario: 'cart', productInterest: '2 × NEUROS Calm', emailStatus: 'sent', discountCode: vars.recovery_code })
    await later()
    expect(sent).toHaveLength(1)
    expect(dials()).toHaveLength(1)
  })

  it('a cart left on a product landing (calm.) is the same call; its link goes to the main site', async () => {
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }], {}, 'calm.biohack-tech.ro')
    expect((await leads.byId(db, leadId))!.landingHost).toBe('calm.biohack-tech.ro')
    expect(await firstCallIn(leadId)).toBe(20)
    await quiet(25)
    await later()
    expect(dials()).toHaveLength(1)
    expect(varsOf()).toMatchObject({ product_quantities: '1 × NEUROS Calm', cart_total: '6.380 lei' })
    expect(String(varsOf().checkout_recovery_url)).toMatch(/^https:\/\/biohack-tech\.ro\/api\/lead\/resume\?t=[\w-]+&cod=BIOHACK10$/)
  })

  it('a cart without a phone, or without the calling box, is never called', async () => {
    await checkout([{ productId: 'brainlink-pro', quantity: 1 }], { phone: '', callConsent: true })
    await checkout([{ productId: 'brainlink-pro', quantity: 1 }], { email: 'altcineva@exemplu.ro', callConsent: false })
    await quiet()
    await later()
    expect(dials()).toEqual([])
  })

  it('no email marketing consent: no code email; the agent is told it was not sent', async () => {
    await checkout([{ productId: 'brainlink-pro', quantity: 1 }], { marketingConsent: false })
    await quiet()
    await later()
    expect(varsOf().recovery_email_sent).toBe('nu')
    expect(sent).toEqual([])
  })
})

describe('the caller’s code switched off', () => {
  it('BIOHACK10 inactive in /admin/coduri: no offer is made (empty code, 0%), no code email', async () => {
    await db.query("update promo_codes set active = false where code = 'BIOHACK10'")
    await checkout([{ productId: 'brainlink-pro', quantity: 1 }])
    await quiet()
    await later()
    expect(varsOf()).toMatchObject({ recovery_code: '', recovery_discount_percent: 0, recovery_email_sent: 'nu' })
    expect(sent.filter((m) => /Codul tău/.test(m.subject))).toEqual([]) // only the regular reminder, no code
  })
})

describe('test mode', () => {
  const TEST = { ...ENV, AI_CALLING_TEST_MODE: 'true', AI_CALLING_TEST_NUMBERS: PHONE }

  it('a listed number: 2 minutes', async () => {
    await setup(TEST)
    const cartId = await checkout([{ productId: 'brainlink-pro', quantity: 1 }])
    expect(await firstCallIn(cartId)).toBe(2)
  })

  it('any other number keeps the real delay and is never called', async () => {
    await setup(TEST)
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }], { phone: '0733 999 888', email: 'client@exemplu.ro' })
    expect(await firstCallIn(leadId)).toBe(20)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callStatus).toBe('disabled')
  })

  it('test mode without a list calls nobody', async () => {
    await setup({ ...ENV, AI_CALLING_TEST_MODE: 'true' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }])
    expect(await firstCallIn(leadId)).toBe(20)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callOutcome).toBe('test mode without test numbers')
  })

  it('a SIP trunk number dials through the SIP endpoint', async () => {
    await setup({ ...TEST, ELEVENLABS_PHONE_PROVIDER: 'sip_trunk' })
    await checkout([{ productId: 'balance-wave', quantity: 1 }])
    await quiet()
    await later()
    expect(dials().map((d) => d.url)).toEqual(['https://el.test/v1/convai/sip-trunk/outbound-call'])
  })
})

describe('the fixed codes: BIOHACK10 (caller) and LONGEVITY10 (website popup)', () => {
  const order = (code: string, raw: unknown[], email = ana.email) => svc.placeOrder({ lines: lines(raw), form: { ...person, email, paymentMethod: 'cod' }, attemptId: `o-${Math.random()}`, promoCode: code })

  it('both exist after the migrations: 10%, once per address, no time limit, listed in /admin/coduri', async () => {
    for (const code of ['BIOHACK10', 'LONGEVITY10'])
      expect(await promoCodes.get(db, code)).toMatchObject({ kind: 'percent', value: 10, oncePerEmail: true, endsAt: null, maxUses: null, active: true, exclusive: false })
    expect((await promoCodes.list(db)).map((c) => c.code).sort()).toEqual(['BIOHACK10', 'CADOU100', 'CADOU1233', 'LONGEVITY10'])
    expect((await recoveryCode(db))?.code).toBe('BIOHACK10')
  })

  it('once per address; anyone else can still use it', async () => {
    const { order: o } = await order('BIOHACK10', [{ productId: 'brainlink-pro', quantity: 1 }])
    expect(o.totalMinor).toBe(290250) // 3.225 lei − 322,50 lei
    await expect(order('BIOHACK10', [{ productId: 'brainlink-pro', quantity: 1 }])).rejects.toMatchObject({ problem: 'already_used' })
    expect((await order('BIOHACK10', [{ productId: 'brainlink-pro', quantity: 1 }], 'altcineva@exemplu.ro')).order.totalMinor).toBe(290250)
  })

  it('adds to the automatic promotions like every promo code: 10% of the full price on top (20% + 10% = 30%)', async () => {
    const rule = ruleOf((await promoCodes.get(db, 'BIOHACK10'))!)
    const price = (raw: { productId: string; quantity: number; unitAmount: number }[]) => priceLines(raw.map((l, i) => ({ key: String(i), ...l })), undefined, rule)
    expect(price([{ productId: 'balance-wave', quantity: 1, unitAmount: 638000 }])).toMatchObject({ discountMinor: 63800, totalMinor: 574200 })
    expect(price([{ productId: 'balance-wave', quantity: 2, unitAmount: 638000 }])).toMatchObject({ discountMinor: 255200, totalMinor: 1020800 }) // 10% + 10%
    expect(price([{ productId: 'balance-wave', quantity: 3, unitAmount: 638000 }])).toMatchObject({ discountMinor: 574200, totalMinor: 1339800 }) // 20% + 10%
    expect(price([{ productId: 'brainlink-pro', quantity: 3, unitAmount: 333700 }])).toMatchObject({ discountMinor: 300330, totalMinor: 700770 }) // 20% + 10%
    expect(price([{ productId: 'ochelari-biohack', quantity: 3, unitAmount: 31500 }])).toMatchObject({ discountMinor: 40950 }) // 2+1 + 10%
    const { order: o } = await order('LONGEVITY10', [{ productId: 'balance-wave', quantity: 3 }])
    expect(o.totalMinor).toBe(1339800)
  })
})

describe('the agent’s server tools', () => {
  async function liveCall() {
    await setup({ ...ENV, AI_CALLING_TEST_MODE: 'true', AI_CALLING_TEST_NUMBERS: PHONE })
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }])
    await quiet()
    await later()
    return { leadId, call: (await calls.forLeads(db, [leadId]))[0] }
  }

  it('no secret configured: the route does not exist; a wrong secret: 401', async () => {
    await setup({ ...ENV, ELEVENLABS_TOOL_SECRET: '' })
    expect((await useTool('get_recovery_context', { call_id: 'test' })).status).toBe(404)
    await setup()
    expect((await useTool('get_recovery_context', { call_id: 'test' }, 'wrong')).status).toBe(401)
    expect((await useTool('get_recovery_context', { call_id: 'test' }, null)).status).toBe(401)
    expect((await useTool('drop_tables', { call_id: 'test' })).status).toBe(404)
  })

  it('the dashboard test (call_id "test") gets sample data and writes nothing', async () => {
    const r = await useTool('record_opt_out', { call_id: 'test' })
    expect(await r.json()).toEqual({ ok: true, test: true })
    expect((await db.query('select count(*)::int as n from call_consent_events')).rows[0].n).toBe(0)
  })

  it('context, discount and email status of the call in progress; nothing for a finished or unknown call', async () => {
    const { call } = await liveCall()
    const ctx = await (await useTool('get_recovery_context', { call_id: call.id })).json()
    expect(ctx).toMatchObject({
      customer_first_name: 'Ana',
      product_quantities: '1 × NEUROS Calm',
      cart_total: '6.380 lei',
      discount: { eligible: true, percent: 10, code: call.discountCode, combinable_with_promotions: true },
      recovery_email: { sent: true, status: 'sent' },
    })
    expect(JSON.stringify(ctx)).not.toMatch(/@|0722|Popescu/)
    expect(await (await useTool('check_discount', { call_id: call.id })).json()).toMatchObject({ eligible: true })
    expect(await (await useTool('recovery_email_status', { call_id: call.id })).json()).toEqual({ sent: true, status: 'sent' })
    expect((await useTool('get_recovery_context', { call_id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
    await calls.update(db, call.id, { status: 'completed' })
    expect((await useTool('get_recovery_context', { call_id: call.id })).status).toBe(404)
  })

  it('a request for a person reaches orders@; the outcome the agent noted is kept when the report has none', async () => {
    const { leadId, call } = await liveCall()
    expect((await useTool('record_outcome', { call_id: call.id, outcome: 'cancel_order' })).status).toBe(422)
    await useTool('record_outcome', { call_id: call.id, outcome: 'interested' })
    await useTool('request_human_follow_up', { call_id: call.id, reason: 'întreabă de livrarea în weekend' })
    await later()
    const note = sent.find((m) => m.to === 'orders@biohack-tech.ro')!
    expect(note.subject).toBe('Apel AI: Ana Popescu așteaptă un coleg')
    expect(note.text).toContain('întreabă de livrarea în weekend')
    const body = JSON.stringify({ type: 'post_call_transcription', data: { agent_id: 'agent_test', conversation_id: call.providerCallId, status: 'done', metadata: { call_duration_secs: 80 }, analysis: { data_collection_results: {} } } })
    await webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', headers: { 'elevenlabs-signature': signWebhook(body, SECRET) }, body }))
    await later()
    expect((await calls.forLeads(db, [leadId]))[0]).toMatchObject({ status: 'completed', outcome: 'interested', followUp: true, followUpReason: 'întreabă de livrarea în weekend' })
    expect(sent.filter((m) => m.to === 'orders@biohack-tech.ro')).toHaveLength(1)
  })

  it('an opt-out during the call: no more calls and no marketing email, at once', async () => {
    const { leadId, call } = await liveCall()
    expect(await (await useTool('record_opt_out', { call_id: call.id })).json()).toMatchObject({ ok: true })
    expect((await callConsent.state(db, PHONE))!.granted).toBe(false)
    expect((await marketing.state(db, ana.email))!.granted).toBe(false)
    expect((await leads.byId(db, leadId))!).toMatchObject({ callStatus: 'stopped', recoveryStatus: 'stopped' })
    expect((await db.query(`select count(*)::int as n from jobs where payload->>'leadId' = $1 and kind in ('call.attempt','lead.recovery') and status = 'pending'`, [leadId])).rows[0].n).toBe(0)
    // A new checkout of the same person is never called again either.
    await checkout([{ productId: 'brainlink-pro', quantity: 1 }], { callConsent: false })
    await quiet()
    await later()
    expect(dials()).toHaveLength(1)
  })
})

describe('the website popup: 10% by email (LONGEVITY10)', () => {
  const join = (email: string, host = MAIN, extra: Record<string, unknown> = {}) =>
    welcome(new NextRequest(`https://${host}/api/welcome`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}` }, body: JSON.stringify({ email, page: '/products/calm', ...extra }) }))

  it('sends LONGEVITY10 once, records the popup consent (email only, never calls)', async () => {
    expect((await join('Nou@Exemplu.ro')).status).toBe(200)
    await later()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'nou@exemplu.ro', subject: 'Codul tău de 10%: LONGEVITY10' })
    expect(sent[0].text).toMatch(/dezabonare/)
    expect(await marketing.state(db, 'nou@exemplu.ro')).toMatchObject({ granted: true, source: 'popup', version: 'welcome-2026-10-15' })
    expect(await db.query('select count(*)::int as n from call_consent_events')).toMatchObject({ rows: [{ n: 0 }] })
    const again = await join('nou@exemplu.ro')
    expect(await again.json()).toEqual({ ok: true, already: true })
    await later()
    expect(sent).toHaveLength(1)
  })

  it('also from a product landing; a bad address is refused; a bot (hidden field) records nothing', async () => {
    expect((await join('landing@exemplu.ro', 'calm.biohack-tech.ro')).status).toBe(200)
    await later()
    expect(sent.map((m) => m.to)).toEqual(['landing@exemplu.ro'])
    sent = []
    expect((await join('nu-e-email')).status).toBe(422)
    expect((await join('bot@exemplu.ro', MAIN, { website: 'spam' })).status).toBe(200)
    await later()
    expect(sent).toEqual([])
  })
})

describe('the do-not-call list', () => {
  it('a listed number is never called, whatever the consent or test list; its waiting attempt is dropped', async () => {
    await setup({ ...ENV, AI_CALLING_TEST_MODE: 'true', AI_CALLING_TEST_NUMBERS: PHONE })
    const leadId = await checkout([{ productId: 'brainlink-pro', quantity: 1 }])
    expect(await callBlocklist.add(db, '0722-123-456', 'cerut de client', 'test')).toBe(PHONE)
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt' and status = 'pending' and payload->>'leadId' = $1`, [leadId])).rows[0].n).toBe(0)
    await db.query("update jobs set status = 'pending' where kind = 'call.attempt'") // even if one were still waiting
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callOutcome).toBe('number on the do-not-call list')
  })
})

describe('test calls from the admin', () => {
  const input = { phone: '0733 111 222', firstName: 'Mario', items: [{ productId: 'balance-wave', quantity: 3 }], emailSent: true }

  it('calls with the imaginary order (today’s prices and promotions); tools answer from it; the result lands on the test only', async () => {
    const r = await placeTestCall(db, getConfig(), input, 'admin:test')
    expect(r.ok).toBe(true)
    const vars = varsOf()
    expect(vars).toMatchObject({ customer_first_name: 'Mario', product_quantities: '3 × NEUROS Calm', cart_total: '15.312 lei', recovery_code: 'BIOHACK10', recovery_email_sent: 'da' })
    expect(String(vars.call_id)).toMatch(/^test-/)
    const ctx = await (await useTool('get_recovery_context', { call_id: vars.call_id })).json()
    expect(ctx).toMatchObject({ customer_first_name: 'Mario', cart_total: '15.312 lei' })
    await useTool('record_opt_out', { call_id: vars.call_id })
    expect(await db.query('select count(*)::int as n from call_consent_events')).toMatchObject({ rows: [{ n: 0 }] })
    const body = JSON.stringify({ type: 'post_call_transcription', data: { agent_id: 'agent_test', conversation_id: 'conv_x', status: 'done', conversation_initiation_client_data: { dynamic_variables: { call_id: vars.call_id } }, metadata: { call_duration_secs: 61 }, analysis: { data_collection_results: { outcome: { value: 'interested' } } } } })
    await webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', headers: { 'elevenlabs-signature': signWebhook(body, SECRET) }, body }))
    const [t] = await testCalls.recent(db)
    expect(t).toMatchObject({ status: 'completed', outcome: 'interested', agentOutcome: 'opted_out', durationSecs: 61 })
    expect((await db.query('select count(*)::int as n from leads')).rows[0].n).toBe(0)
    expect((await db.query('select count(*)::int as n from calls')).rows[0].n).toBe(0)
  })

  it('refused for a number on the do-not-call list or not Romanian', async () => {
    await callBlocklist.add(db, '0733111222', null, 'test')
    expect(await placeTestCall(db, getConfig(), input, 'admin:test')).toMatchObject({ ok: false, problem: 'blocked' })
    expect(await placeTestCall(db, getConfig(), { ...input, phone: '+44 20 7946 0000' }, 'admin:test')).toMatchObject({ ok: false, problem: 'no_phone' })
    expect(dials()).toEqual([])
  })
})

describe('the agent’s first sentence', () => {
  it('„Bună ziua” until 18:00 and „Bună seara” after, Bucharest time; Maria, with the AI disclosure', async () => {
    const { openingLine } = await import('@/server/calling/offer')
    expect(openingLine({ firstName: 'Ana', productNames: 'NEUROS Calm', items: [{ name: 'NEUROS Calm', quantity: 2 }, { name: 'NEUROS Amber', quantity: 1 }], at: new Date('2026-10-15T07:00:00Z') })).toBe(
      'Bună ziua, doamna Ana! Numele meu este Maria și vă sun din partea magazinului Baiohec Tec. Sunt un asistent automat, iar apelul este înregistrat. Am văzut că ați adăugat în coș două bucăți de NEUROS Calm și NEUROS Amber. Aveți un minut?',
    )
    // Without the items: the product names.
    expect(openingLine({ firstName: 'Ana', productNames: 'NEUROS Focus', at: new Date('2026-10-15T07:00:00Z') })).toBe(
      'Bună ziua, doamna Ana! Numele meu este Maria și vă sun din partea magazinului Baiohec Tec. Sunt un asistent automat, iar apelul este înregistrat. Am văzut că ați adăugat în coș NEUROS Focus. Aveți un minut?',
    )
    expect(openingLine({ firstName: 'Ana', productNames: 'NEUROS Calm', at: new Date('2026-10-15T18:00:00Z') })).toMatch(/^Bună seara, doamna Ana!/) // 21:00
    // The whole name with domnule/doamna when the given name is known; the name alone when it is not; none for junk.
    expect(openingLine({ firstName: 'Popescu', name: 'popescu ion', productNames: 'NEUROS Focus', at: new Date('2026-10-15T07:00:00Z') })).toMatch(/^Bună ziua, domnule Ion! /)
    expect(openingLine({ firstName: 'Alex', name: 'Alex Ionescu', productNames: 'NEUROS Focus', at: new Date('2026-10-15T07:00:00Z') })).toMatch(/^Bună ziua, Alex! /)
    expect(openingLine({ firstName: '', name: 'x1@y.ro', productNames: 'NEUROS Focus', at: new Date('2026-10-15T07:00:00Z') })).toMatch(/^Bună ziua! /)
  })

  it('domnule/doamna also for given names off the lists, by their Romanian ending; never a guess against a unisex name or a contradiction', async () => {
    const { addressee } = await import('@/server/calling/names')
    const say = (n: string) => addressee(n)
    expect(say('Iustina Calugaroiu')).toBe('doamna Iustina')
    expect(say('Luciana Manole')).toBe('doamna Luciana')
    expect(say('Mario')).toBe('domnule Mario')
    expect(say('Stan Iustina')).toBe('doamna Iustina')
    expect(say('Luca Pop')).toBe('domnule Luca')
    expect(say('Carmen Stan')).toBe('doamna Carmen')
    expect(say('Gabi Pop')).toBe('Gabi')
    expect(say('Andrea Rossi')).toBe('Andrea')
    expect(say('Popa Zorel')).not.toMatch(/^(domnule|doamna)/) // -a (Popa) and a consonant (Zorel) disagree: no title
  })
})

describe('one abandonment, one coordinated sequence (AI call, its code email, the three cart emails)', () => {
  const endCall = async (providerCallId: string | null, outcome: string) => {
    const body = JSON.stringify({ type: 'post_call_transcription', data: { agent_id: 'agent_test', conversation_id: providerCallId, status: 'done', metadata: { call_duration_secs: 70 }, analysis: { data_collection_results: { outcome: { value: outcome } } } } })
    await webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', headers: { 'elevenlabs-signature': signWebhook(body, SECRET) }, body }))
  }
  const toAna = () => sent.filter((m) => m.to === ana.email).map((m) => m.subject)
  const days = (d: number) => db.query(`update leads set last_activity_at = now() - ($1 || ' hours')::interval, last_recovery_at = now() - interval '23 hours'`, [String(d * 24 + 1)])

  it('the call’s code email replaces the first cart email; then the second and third, a day apart; never the same email twice', async () => {
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }])
    await quiet(40)
    await later()
    expect(dials()).toHaveLength(1)
    expect(toAna()).toEqual(['Codul tău de 10% pentru NEUROS Calm'])
    const call = (await calls.forLeads(db, [leadId]))[0]
    await endCall(call.providerCallId, 'more_info')
    await later()
    expect(toAna()).toEqual(['Codul tău de 10% pentru NEUROS Calm']) // no "cart" email on top of the code email
    await days(1)
    await later()
    await later()
    await days(2)
    await later()
    await later()
    expect(toAna()).toEqual(['Codul tău de 10% pentru NEUROS Calm', 'Ai întrebări despre NEUROS Calm? Suntem aici', 'Ultima amintire: codul tău BIOHACK10 pentru NEUROS Calm'])
    await days(5)
    await later()
    expect(toAna()).toHaveLength(3)
  })

  it('no email while the call is ringing or under way; the first cart email after it', async () => {
    await db.query("update promo_codes set active = false where code = 'BIOHACK10'") // no code email before the call
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }])
    await quiet(40)
    await later()
    expect(dials()).toHaveLength(1)
    expect((await calls.forLeads(db, [leadId]))[0].status).toBe('dialing')
    await later()
    expect(toAna()).toEqual([])
    await endCall((await calls.forLeads(db, [leadId]))[0].providerCallId, 'no_time')
    await db.query(`update jobs set run_at = now() where kind = 'lead.recovery'`)
    await later()
    expect(toAna()).toEqual(['Produsele tale te așteaptă în coș'])
  })

  it('"not interested" on the phone stops the reminder emails for this abandonment (consent itself unchanged)', async () => {
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }])
    await quiet(40)
    await later()
    await endCall((await calls.forLeads(db, [leadId]))[0].providerCallId, 'not_interested')
    await later()
    await days(1)
    await later()
    await days(2)
    await later()
    expect(toAna()).toEqual(['Codul tău de 10% pentru NEUROS Calm'])
    expect((await leads.byId(db, leadId))!).toMatchObject({ recoveryStatus: 'stopped', recoveryReason: 'not interested (AI call)' })
    expect((await marketing.state(db, ana.email))!.granted).toBe(true)
  })

  it('a purchase or an unsubscribe stops everything that is still planned', async () => {
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 1 }], { callConsent: false })
    await quiet(40)
    await later()
    expect(toAna()).toEqual(['Produsele tale te așteaptă în coș'])
    const { withdrawMarketing } = await import('@/server/marketing/unsubscribe')
    await withdrawMarketing(ana.email, 'unsubscribe_link', '/dezabonare')
    await days(1)
    await later()
    await days(2)
    await later()
    expect(toAna()).toHaveLength(1)
    expect((await leads.byId(db, leadId))!.recoveryStatus).toBe('stopped')
  })
})
