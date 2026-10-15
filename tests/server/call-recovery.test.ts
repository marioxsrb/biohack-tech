/**
 * AI call recovery: the two scenarios (a cart on the main site after 20 minutes, the price form on acces after
 * 30), test mode (2 minutes, listed numbers only), the personal 10% code (one use, own address, 24 hours, never
 * after a purchase, never on top of the automatic promotions), its email before the call (only with consent,
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
const { leads, captureLead, CART_INTEREST } = await import('@/server/leads')
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
  PRICE_GATE_ENABLED: 'true',
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
const GATED = 'acces.biohack-tech.ro'
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
const checkout = async (cart: unknown[], extra: Record<string, unknown> = {}) => {
  await lead(post('/api/lead', MAIN, { action: 'checkout', ...ana, cart, callConsent: true, marketingConsent: true, ...extra }))
  return (await db.query<{ id: string }>(`select id from leads where product_id = '${CART_INTEREST}' order by created_at desc limit 1`)).rows[0].id
}
const reveal = async (extra: Record<string, unknown> = {}) => (await (await lead(post('/api/lead', GATED, { action: 'reveal', ...ana, productId: 'balance-wave', callConsent: true, ...extra }))).json()) as { leadId: string }
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

describe('scenario A: a cart on the main site', () => {
  it('called 20 minutes after the last cart activity, about the real cart; the code email goes out before the call, once', async () => {
    const leadId = await checkout([{ productId: 'balance-wave', quantity: 2 }])
    expect(await firstCallIn(leadId)).toBe(20)
    await quiet(25)
    await later()
    expect(dials()).toHaveLength(1)
    const vars = varsOf()
    expect(vars).toMatchObject({
      funnel_type: 'visible_price',
      abandonment_type: 'cos_nefinalizat',
      product_names: 'NEUROS Calm',
      product_quantities: '2 × NEUROS Calm',
      cart_total: '11.484 lei', // 2 × 6.380 lei with the 10% for two
      recovery_discount_percent: 10,
      recovery_email_sent: 'da',
    })
    expect(vars.opening_line).toBe('Bună ziua, Ana! Sunt asistentul virtual Biohack Tech, un asistent AI. Vă contactez în legătură cu o comandă începută pe site-ul nostru, care a rămas nefinalizată. Aveți un minut?')
    // One email in total: the code email (it replaces the regular first recovery email).
    expect(sent.map((m) => m.subject)).toEqual(['Codul tău de 10% pentru NEUROS Calm'])
    expect(sent[0].text).toContain(String(vars.recovery_code))
    expect(sent[0].text).toContain('2 × NEUROS Calm')
    expect(sent[0].text).toMatch(/nu se cumulează/)
    expect(sent[0].text).toMatch(/dezabonare/)
    const [call] = await calls.forLeads(db, [leadId])
    expect(call).toMatchObject({ scenario: 'cart', funnel: 'visible_price', productInterest: '2 × NEUROS Calm', emailStatus: 'sent', discountCode: vars.recovery_code })
    await later()
    expect(sent).toHaveLength(1)
    expect(dials()).toHaveLength(1)
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

describe('a later attempt', () => {
  it('after the code expired: no offer is made (empty code, 0%)', async () => {
    const leadId = await checkout([{ productId: 'brainlink-pro', quantity: 1 }])
    await quiet()
    await later()
    const [first] = await calls.forLeads(db, [leadId])
    await db.query("update promo_codes set ends_at = now() - interval '1 minute'")
    const body = JSON.stringify({ type: 'call_initiation_failure', data: { agent_id: 'agent_test', conversation_id: first.providerCallId, failure_reason: 'no-answer' } })
    await webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', headers: { 'elevenlabs-signature': signWebhook(body, SECRET) }, body }))
    await runDueJobs() // the webhook's own run
    await db.query("update jobs set run_at = now() where kind = 'call.attempt' and status = 'pending'")
    await runDueJobs()
    expect(dials()).toHaveLength(2)
    expect(varsOf(1)).toMatchObject({ recovery_code: '', recovery_discount_percent: 0, recovery_email_sent: 'nu' })
    expect(sent).toHaveLength(1) // the first code email only
  })
})

describe('scenario B: the price form on acces', () => {
  it('called 30 minutes after the form, about the product viewed (no cart, no total)', async () => {
    const { leadId } = await reveal()
    expect(await firstCallIn(leadId)).toBe(30)
    await quiet(35)
    await later()
    expect(varsOf()).toMatchObject({ abandonment_type: 'oferta_solicitata', product_names: 'NEUROS Calm', product_quantities: '', cart_total: '' })
  })
})

describe('test mode', () => {
  const TEST = { ...ENV, AI_CALLING_TEST_MODE: 'true', AI_CALLING_TEST_NUMBERS: PHONE }

  it('a listed number: 2 minutes for both scenarios', async () => {
    await setup(TEST)
    const { leadId } = await reveal()
    expect(await firstCallIn(leadId)).toBe(2)
    const cartId = await checkout([{ productId: 'brainlink-pro', quantity: 1 }])
    expect(await firstCallIn(cartId)).toBe(2)
  })

  it('any other number keeps the real delay and is never called', async () => {
    await setup(TEST)
    const { leadId } = await reveal({ phone: '0733 999 888', email: 'client@exemplu.ro' })
    expect(await firstCallIn(leadId)).toBe(30)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callStatus).toBe('disabled')
  })

  it('test mode without a list calls nobody', async () => {
    await setup({ ...ENV, AI_CALLING_TEST_MODE: 'true' })
    const { leadId } = await reveal()
    expect(await firstCallIn(leadId)).toBe(30)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callOutcome).toBe('test mode without test numbers')
  })

  it('a SIP trunk number dials through the SIP endpoint', async () => {
    await setup({ ...TEST, ELEVENLABS_PHONE_PROVIDER: 'sip_trunk' })
    await reveal()
    await quiet()
    await later()
    expect(dials().map((d) => d.url)).toEqual(['https://el.test/v1/convai/sip-trunk/outbound-call'])
  })
})

describe('the personal recovery code', () => {
  const codeFor = async (email = ana.email) => {
    const r = await captureLead(db, { visitorId: `v-${email}`, funnel: 'visible_price', stage: 'checkout_started', productId: CART_INTEREST, contact: { ...ana, email }, marketingConsent: false, cart: [{ productId: 'brainlink-pro', quantity: 1 }] })
    return recoveryCode(db, r.lead)
  }
  const order = (code: string, raw: unknown[], email = ana.email) => svc.placeOrder({ lines: lines(raw), form: { ...person, email, paymentMethod: 'cod' }, attemptId: `o-${Math.random()}`, promoCode: code })

  it('10% of the full price, once, for 24 hours, only for its own address', async () => {
    const code = await codeFor()
    expect(code).toMatchObject({ kind: 'percent', value: 10, maxUses: 1, exclusive: true, restrictedEmail: ana.email })
    expect(code.endsAt!.getTime() - code.createdAt.getTime()).toBe(24 * 3_600_000)
    expect((await recoveryCode(db, (await leads.byId(db, code.leadId!))!)).code).toBe(code.code) // one per lead
    expect(await promoCodes.check(db, code.code, { email: 'altcineva@exemplu.ro' })).toEqual({ ok: false, problem: 'other_email' })
    await expect(order(code.code, [{ productId: 'brainlink-pro', quantity: 1 }], 'altcineva@exemplu.ro')).rejects.toMatchObject({ problem: 'other_email' })
    const { order: o } = await order(code.code, [{ productId: 'brainlink-pro', quantity: 1 }])
    expect(o.totalMinor).toBe(71100) // 790 lei − 79 lei
    await expect(order(code.code, [{ productId: 'brainlink-pro', quantity: 1 }])).rejects.toBeInstanceOf(svc.PromoError)
  })

  it('expired after 24 hours; dead once the address bought without it', async () => {
    const a = await codeFor()
    await db.query("update promo_codes set ends_at = now() - interval '1 minute' where code = $1", [a.code])
    expect(await promoCodes.check(db, a.code, { email: ana.email })).toEqual({ ok: false, problem: 'expired' })
    const b = await codeFor('ion@exemplu.ro')
    await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, email: 'ion@exemplu.ro', paymentMethod: 'cod' }, attemptId: 'no-code' })
    expect(await promoCodes.check(db, b.code, { email: 'ion@exemplu.ro' })).toEqual({ ok: false, problem: 'inactive' })
  })

  it('never on top of the automatic promotions: the better of the two, and a code that saves no more is refused', async () => {
    const code = await codeFor()
    const rule = ruleOf(code)
    const price = (raw: { productId: string; quantity: number; unitAmount: number }[]) => priceLines(raw.map((l, i) => ({ key: String(i), ...l })), undefined, rule)
    expect(price([{ productId: 'balance-wave', quantity: 1, unitAmount: 638000 }])).toMatchObject({ discountMinor: 63800, code: { amountMinor: 63800 } })
    // Two of a product: 10% either way, the promotion stays; three: 20% beats the code; Amber 2+1 beats it too.
    expect(price([{ productId: 'balance-wave', quantity: 2, unitAmount: 638000 }])).toMatchObject({ discountMinor: 127600, code: { amountMinor: 0, problem: 'not_better' } })
    expect(price([{ productId: 'balance-wave', quantity: 3, unitAmount: 638000 }])).toMatchObject({ discountMinor: 382800, code: { problem: 'not_better' } })
    expect(price([{ productId: 'ochelari-biohack', quantity: 3, unitAmount: 31500 }])).toMatchObject({ discountMinor: 31500, code: { problem: 'not_better' } })
    // Calm alone (no promotion yet) and an Amber pair (2+1 needs three): the code wins, alone.
    const mixed = price([
      { productId: 'balance-wave', quantity: 1, unitAmount: 638000 },
      { productId: 'ochelari-biohack', quantity: 2, unitAmount: 31500 },
    ])
    expect(mixed).toMatchObject({ discountMinor: 70100, promotions: [{ id: `cod:${code.code}` }] })
    await expect(order(code.code, [{ productId: 'balance-wave', quantity: 2 }])).rejects.toMatchObject({ problem: 'not_better' })
    // The campaign codes keep adding up as before (business decision 14.10).
    expect(priceLines([{ key: '0', productId: 'balance-wave', quantity: 2, unitAmount: 638000 }], undefined, { ...rule, exclusive: false }).discountMinor).toBe(255200)
  })

  it('personal codes stay out of the campaign codes list in /admin/coduri', async () => {
    await codeFor()
    expect(await promoCodes.list(db)).toEqual([])
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
      abandonment_type: 'cos_nefinalizat',
      product_quantities: '1 × NEUROS Calm',
      cart_total: '6.380 lei',
      discount: { eligible: true, percent: 10, code: call.discountCode, combinable_with_promotions: false },
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
