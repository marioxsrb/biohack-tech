/**
 * AI calling: separate consent, eligibility (purchase, refusal, unsubscribe, hours, limits, one call per
 * person), dry run, the ElevenLabs call and its results (webhook, late webhook, read-back), retries, the
 * CRM copy and the agent's generated knowledge. ElevenLabs, GoHighLevel and SMTP are mocked; the database
 * is an embedded PostgreSQL (PGlite). No real call is ever placed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
const { leads } = await import('@/server/leads')
const { calls, callDecision, inCallingWindow, nextCallingWindow } = await import('@/server/calling/calls')
const { callConsent } = await import('@/server/calling/consent')
const { retryCall, disableCalling, cancelScheduledCalls } = await import('@/server/calling/admin')
const { marketing } = await import('@/server/marketing/consent')
const { signWebhook, verifyWebhookSignature } = await import('@/server/integrations/elevenlabs')
const { romanianE164, CALL_CONSENT_VERSION } = await import('@/lib/consent/calling')
const { agentDefinition, agentKnowledge, agentTools } = await import('@/server/calling/agent')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { getConfig } = await import('@/server/config')
const { POST: lead } = await import('@/app/api/lead/route')
const { POST: webhook } = await import('@/app/api/webhooks/elevenlabs/route')

const SECRET = 'whsec_el_test_secret'
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
  AI_CALLING_ENABLED: 'true',
  AI_CALLING_DRY_RUN: 'false',
  // Every hour of every day, so the tests do not depend on when they run (the window has its own tests).
  AI_CALLING_HOURS: '0-24',
  AI_CALLING_DAYS: '1-7',
  ELEVENLABS_API_KEY: 'el-test-key',
  ELEVENLABS_AGENT_ID: 'agent_test',
  ELEVENLABS_PHONE_NUMBER_ID: 'phnum_test',
  ELEVENLABS_WEBHOOK_SECRET: SECRET,
  ELEVENLABS_API_BASE: 'https://el.test',
}
const GATED = 'acces.biohack-tech.ro'

let db: Awaited<ReturnType<typeof freshDb>>
let el: { url: string; method: string; json: Record<string, unknown> | null }[]
let ghl: { url: string; json: Record<string, unknown> | null }[]
let mode: { dial: 'ok' | 'timeout' | 'error500' | 'invalid'; ghl: 'ok' | 'down'; conversation: Record<string, unknown> | null }
let ip = 0

function fakeApis() {
  el = []
  ghl = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.startsWith('https://el.test')) {
      el.push({ url, method: init.method ?? 'GET', json: init.body ? JSON.parse(String(init.body)) : null })
      if (url.endsWith('/v1/convai/twilio/outbound-call')) {
        if (mode.dial === 'timeout') throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
        if (mode.dial === 'error500') return json({ detail: 'upstream' }, 500)
        if (mode.dial === 'invalid') return json({ detail: 'Invalid phone number' }, 422)
        return json({ success: true, message: 'ok', conversation_id: `conv_${el.length}`, callSid: `CA${el.length}` })
      }
      if (url.includes('/v1/convai/conversations/')) return mode.conversation ? json(mode.conversation) : json({ detail: 'not found' }, 404)
    }
    if (url.includes('leadconnectorhq.com')) {
      if (mode.ghl === 'down') return json({ message: 'down' }, 503)
      ghl.push({ url, json: init.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      return json({})
    }
    return json({ message: 'not mocked' }, 404)
  })
}

async function setup(env: Record<string, string> = ENV) {
  db = await freshDb(env)
  sent = []
  mode = { dial: 'ok', ghl: 'ok', conversation: null }
  fakeApis()
}
beforeEach(() => setup())
afterEach(() => vi.unstubAllGlobals())

const ana = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456' }
const PHONE = '+40722123456'

function post(path: string, host: string, body: unknown, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return new NextRequest(`https://${host}${path}`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.7.0.${++ip}`, ...(cookie && { cookie }) }, body: JSON.stringify(body) })
}
async function reveal(extra: Record<string, unknown> = {}) {
  const res = await lead(post('/api/lead', GATED, { action: 'reveal', ...ana, productId: 'balance-wave', ...extra }))
  return (await res.json()) as { leadId: string }
}
/** Lets a background run finish, makes every waiting job due, runs the queue (twice: results queue more). */
async function later() {
  await runDueJobs()
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
  await db.query("update jobs set run_at = now() where status in ('pending','retry') and kind <> 'call.attempt'")
  await runDueJobs()
}
const quiet = (minutes = 90) => db.query(`update leads set last_activity_at = now() - ($1 || ' minutes')::interval`, [String(minutes)])
const dials = () => el.filter((c) => c.url.endsWith('/outbound-call'))
const callsOf = async (leadId: string) => (await calls.forLeads(db, [leadId])).sort((a, b) => a.attempt - b.attempt)

function hook(type: string, data: Record<string, unknown>, opts: { secret?: string; t?: number } = {}) {
  const body = JSON.stringify({ type, event_timestamp: Math.floor(Date.now() / 1000), data: { agent_id: 'agent_test', ...data } })
  return webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', headers: { 'elevenlabs-signature': signWebhook(body, opts.secret ?? SECRET, opts.t) }, body }))
}
const transcription = (conversationId: string, results: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  hook('post_call_transcription', {
    conversation_id: conversationId,
    status: 'done',
    transcript: [{ role: 'user', message: 'text that must never be stored' }],
    metadata: { start_time_unix_secs: Math.floor(Date.now() / 1000) - 120, call_duration_secs: 95 },
    analysis: { call_successful: 'success', data_collection_results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { value: v }])) },
    ...extra,
  })

describe('consent', () => {
  it('the calling box is separate and optional: no box, no consent, no call (lead capture unchanged)', async () => {
    const { leadId } = await reveal({ marketingConsent: true })
    expect(await callConsent.state(db, PHONE)).toBeNull()
    expect((await leads.byId(db, leadId))!.callConsent).toBe(false)
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt'`)).rows[0].n).toBe(0)
  })

  it('ticked: recorded by phone with its text version and source; the first call is planned after the quiet time', async () => {
    const { leadId } = await reveal({ callConsent: true })
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: true, version: CALL_CONSENT_VERSION, source: 'lead_form' })
    const job = (await db.query<{ run_at: string }>(`select run_at from jobs where kind = 'call.attempt' and payload->>'leadId' = $1`, [leadId])).rows
    expect(job).toHaveLength(1)
    expect(Math.round((new Date(job[0].run_at).getTime() - Date.now()) / 60_000)).toBe(30) // price form: 30 minutes
    // Email marketing consent is not implied either way.
    expect(await marketing.state(db, ana.email)).toBeNull()
  })

  it('a non-Romanian or invalid number: no consent recorded, nothing planned', async () => {
    await reveal({ callConsent: true, phone: '+44 20 7946 0000' })
    expect((await db.query('select count(*)::int as n from call_consent_events')).rows[0].n).toBe(0)
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt'`)).rows[0].n).toBe(0)
  })

  it('AI_CALLING_ENABLED off: consent is still recorded (it is the person’s choice), no call is planned or placed', async () => {
    await setup({ ...ENV, AI_CALLING_ENABLED: 'false' })
    await reveal({ callConsent: true })
    expect((await callConsent.state(db, PHONE))?.granted).toBe(true)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt'`)).rows[0].n).toBe(0)
  })

  it('Romanian numbers in any common format', () => {
    expect(['0722 123 456', '+40 722 123 456', '0040722123456', '(0722) 123-456', '0212345678'].map(romanianE164)).toEqual(['+40722123456', '+40722123456', '+40722123456', '+40722123456', '+40212345678'])
    expect(['+4420794600', '0722 123', '07221234567', 'abc', '', null].map(romanianE164)).toEqual([null, null, null, null, null, null])
  })
})

describe('placing calls', () => {
  it('dry run (the default): everything is recorded, ElevenLabs is never called', async () => {
    await setup({ ...ENV, AI_CALLING_DRY_RUN: 'true' })
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await callsOf(leadId)).map((c) => c.status)).toEqual(['dry_run'])
    expect((await leads.byId(db, leadId))!).toMatchObject({ callStatus: 'dry_run', callAttempts: 1 })
  })

  it('a successful conversation: dialed once with first name, product and the server-made offer only; the result is stored once; CRM tags; the code by email on request', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await runDueJobs()
    await later()
    expect(dials()).toEqual([]) // still within the quiet time
    await quiet()
    await later()
    expect(dials()).toHaveLength(1)
    const req = dials()[0].json!
    expect(req).toMatchObject({ agent_id: 'agent_test', agent_phone_number_id: 'phnum_test', to_number: PHONE, call_recording_enabled: false })
    const vars = (req.conversation_initiation_client_data as { dynamic_variables: Record<string, string> }).dynamic_variables
    expect(vars).toMatchObject({
      customer_first_name: 'Ana',
      funnel_type: 'gated_price',
      abandonment_type: 'oferta_solicitata',
      product_names: 'NEUROS Calm',
      product_quantities: '',
      cart_total: '',
      recovery_discount_percent: 10,
      recovery_code: expect.stringMatching(/^BT[A-Z2-9]{6}$/),
      recovery_email_sent: 'nu', // no email marketing consent: nothing was sent before the call
    })
    expect(vars.opening_line).toBe('Bună ziua, Ana! Sunt asistentul virtual Biohack Tech, un asistent AI. Ați solicitat recent oferta pentru NEUROS Calm și voiam să vă întreb dacă vă pot ajuta cu vreo informație. Aveți un minut?')
    expect(vars.checkout_recovery_url).toMatch(/^https:\/\/acces\.biohack-tech\.ro\/api\/lead\/resume\?t=[\w-]+&cod=BT/)
    expect(JSON.stringify(vars)).not.toMatch(/@|0722|Popescu/)
    expect(sent).toEqual([])
    const [call] = await callsOf(leadId)
    expect(call).toMatchObject({ status: 'dialing', attempt: 1, phone: PHONE, productId: 'balance-wave', funnel: 'gated_price', scenario: 'price_reveal', productInterest: 'NEUROS Calm', discountCode: vars.recovery_code, emailStatus: 'no_consent' })

    const res = await transcription(call.providerCallId!, { outcome: 'more_info', follow_up_required: false, opted_out: false, wants_link: true })
    expect(await res.json()).toMatchObject({ ok: true, applied: true })
    await later()
    const done = (await callsOf(leadId))[0]
    expect(done).toMatchObject({ status: 'completed', outcome: 'more_info', wantsLink: true, durationSecs: 95, optedOut: false })
    expect(JSON.stringify(await db.query('select * from calls'))).not.toMatch(/must never be stored/)
    expect((await leads.byId(db, leadId))!).toMatchObject({ callStatus: 'completed', callOutcome: 'more_info' })
    expect(ghl.filter((c) => c.url.endsWith('/tags')).flatMap((c) => c.json?.tags as string[])).toEqual(expect.arrayContaining(['bt-apel-ai', 'bt-apel-ai-more-info', 'bt-interes-calm']))
    expect(ghl.some((c) => c.url.includes('/opportunities'))).toBe(false)
    // Asked for during the call: the code and the link, once (a requested message, not marketing).
    const link = sent.find((m) => m.subject === 'Codul tău de 10% pentru NEUROS Calm')!
    expect(link.to).toBe('ana@exemplu.ro')
    expect(link.text).toContain(vars.recovery_code)
    expect(link.text).toMatch(/https:\/\/acces\.biohack-tech\.ro\/api\/lead\/resume\?t=[\w-]+&cod=BT/)
    expect((await callsOf(leadId))[0].emailStatus).toBe('sent_on_request')
    // The same webhook again (ElevenLabs retries): nothing changes, nothing is sent twice.
    expect(await (await transcription(call.providerCallId!, { outcome: 'not_interested' })).json()).toMatchObject({ duplicate: true })
    await later()
    expect((await callsOf(leadId))[0].outcome).toBe('more_info')
    expect(sent.filter((m) => m.subject === 'Codul tău de 10% pentru NEUROS Calm')).toHaveLength(1)
    expect(dials()).toHaveLength(1)
  })

  it('a refusal during the call withdraws the number’s consent and stops every further attempt', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    const [call] = await callsOf(leadId)
    await transcription(call.providerCallId!, { outcome: 'opted_out', opted_out: true })
    await later()
    expect(await callConsent.state(db, PHONE)).toMatchObject({ granted: false, source: 'call' })
    expect((await leads.byId(db, leadId))!.callStatus).toBe('stopped')
    expect(ghl.flatMap((c) => (c.json?.tags as string[]) ?? [])).toContain('bt-apel-ai-refuz')
    // Not even an admin can queue another attempt after a refusal.
    expect(await retryCall(db, getConfig(), leadId)).toBe('nothing to retry (stopped, opted_out)')
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt' and status = 'pending'`)).rows[0].n).toBe(0)
  })

  it('busy, then no answer: a second attempt later, then stop (maximum two)', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    const first = (await callsOf(leadId))[0]
    await hook('call_initiation_failure', { conversation_id: first.providerCallId, failure_reason: 'busy', metadata: { type: 'twilio', body: {} } })
    const retry = (await db.query<{ run_at: string }>(`select run_at from jobs where dedupe_key = $1`, [`call.attempt:${leadId}:2`])).rows[0]
    expect(Math.round((new Date(retry.run_at).getTime() - Date.now()) / 3_600_000)).toBe(24)
    await db.query("update jobs set run_at = now() where dedupe_key like 'call.attempt:%:2'")
    await runDueJobs()
    await runDueJobs()
    const second = (await callsOf(leadId))[1]
    expect(second).toMatchObject({ attempt: 2, status: 'dialing' })
    await hook('call_initiation_failure', { conversation_id: second.providerCallId, failure_reason: 'no-answer', metadata: { type: 'twilio', body: {} } })
    await later()
    expect((await callsOf(leadId)).map((c) => [c.attempt, c.status, c.outcome])).toEqual([
      [1, 'failed', 'busy'],
      [2, 'failed', 'no_answer'],
    ])
    expect((await leads.byId(db, leadId))!.callStatus).toBe('stopped')
    expect(dials()).toHaveLength(2)
  })

  it('a provider timeout may have dialed: marked for review, never redialed on its own', async () => {
    const { leadId } = await reveal({ callConsent: true })
    mode.dial = 'timeout'
    await quiet()
    await later()
    await later()
    expect(dials()).toHaveLength(1)
    expect((await callsOf(leadId))[0]).toMatchObject({ status: 'unknown' })
    expect((await db.query(`select count(*)::int as n from jobs where kind = 'call.attempt' and status in ('pending','retry')`)).rows[0].n).toBe(0)
    // An admin may retry it deliberately (within the limit).
    mode.dial = 'ok'
    expect(await retryCall(db, getConfig(), leadId)).toBe('attempt 2 queued')
    await runDueJobs()
    expect(dials()).toHaveLength(2)
  })

  it('a provider error (5xx) is also left for review; an invalid number stops the lead', async () => {
    const a = await reveal({ callConsent: true })
    mode.dial = 'error500'
    await quiet()
    await later()
    expect((await callsOf(a.leadId))[0].status).toBe('unknown')
    await setup()
    mode.dial = 'invalid'
    const b = await reveal({ callConsent: true })
    await quiet()
    await later()
    expect((await callsOf(b.leadId))[0]).toMatchObject({ status: 'failed', outcome: 'invalid_number' })
    expect((await leads.byId(db, b.leadId))!.callStatus).toBe('stopped')
  })

  it('the webhook may arrive before the dial response: found by our call id; a late webhook is read back by the check job', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    const [call] = await callsOf(leadId)
    // Webhook for a conversation id we never stored, carrying our call id.
    await db.query('update calls set provider_call_id = null where id = $1', [call.id])
    await transcription('conv_other', { outcome: 'interested' }, { conversation_initiation_client_data: { dynamic_variables: { call_id: call.id } } })
    expect((await callsOf(leadId))[0]).toMatchObject({ status: 'completed', outcome: 'interested', providerCallId: 'conv_other' })

    await setup()
    const b = await reveal({ callConsent: true })
    await quiet()
    await later()
    mode.conversation = { conversation_id: 'x', status: 'done', metadata: { start_time_unix_secs: 1, call_duration_secs: 60 }, analysis: { data_collection_results: { outcome: { value: 'human_follow_up' }, follow_up_required: { value: true } } } }
    await db.query("update jobs set run_at = now() where kind = 'call.check'")
    await runDueJobs()
    expect((await callsOf(b.leadId))[0]).toMatchObject({ status: 'completed', outcome: 'human_follow_up', followUp: true })
  })

  it('GoHighLevel down: the result is kept, the CRM copy retries on its own', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    mode.ghl = 'down'
    const [call] = await callsOf(leadId)
    await transcription(call.providerCallId!, { outcome: 'interested' })
    await later()
    expect((await callsOf(leadId))[0].outcome).toBe('interested')
    const job = (await db.query<{ status: string }>(`select status from jobs where dedupe_key = $1`, [`ghl.call:${call.id}`])).rows[0]
    expect(job.status).toBe('retry')
    mode.ghl = 'ok'
    await db.query(`update jobs set run_at = now() where dedupe_key = $1`, [`ghl.call:${call.id}`])
    await runDueJobs()
    expect((await db.query<{ status: string }>(`select status from jobs where dedupe_key = $1`, [`ghl.call:${call.id}`])).rows[0].status).toBe('done')
  })

  it('refuses unsigned, wrongly signed or stale webhooks', async () => {
    const body = JSON.stringify({ type: 'post_call_transcription', data: { conversation_id: 'c1' } })
    expect((await webhook(new NextRequest('https://biohack-tech.ro/api/webhooks/elevenlabs', { method: 'POST', body }))).status).toBe(401)
    expect((await hook('post_call_transcription', { conversation_id: 'c1' }, { secret: 'other' })).status).toBe(401)
    expect((await hook('post_call_transcription', { conversation_id: 'c1' }, { t: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(401)
    expect(verifyWebhookSignature('x', `t=${Math.floor(Date.now() / 1000)},v0=deadbeef,${signWebhook('x', SECRET).split(',')[1]}`, SECRET)).toBe(true)
  })
})

describe('who is never called', () => {
  it('after a purchase (any device, same email)', async () => {
    const { leadId } = await reveal({ callConsent: true })
    await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: { ...person, email: ana.email, paymentMethod: 'cod' }, attemptId: 'other-device' })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callStatus).toBe('stopped')
  })

  it('after an email unsubscribe, or a withdrawn call consent', async () => {
    const a = await reveal({ callConsent: true })
    await marketing.grant(db, { email: ana.email, source: 'checkout' })
    await marketing.withdraw(db, { email: ana.email, source: 'unsubscribe_link' })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, a.leadId))!.callStatus).toBe('stopped')
    await setup()
    const b = await reveal({ callConsent: true })
    await callConsent.withdraw(db, { phone: PHONE, source: 'admin' })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, b.leadId))!.callStatus).toBe('stopped')
  })

  it('twice for the same person: a second lead with consent (another product) gets no call of its own', async () => {
    const first = await reveal({ callConsent: true })
    await lead(post('/api/lead', 'biohack-tech.ro', { action: 'checkout', ...ana, callConsent: true, cart: [{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }] }))
    await quiet()
    await later()
    await later()
    expect(dials()).toHaveLength(1)
    expect((await db.query('select count(*)::int as n from calls')).rows[0].n).toBe(1)
    expect((await leads.byId(db, first.leadId))!.callAttempts + (await db.query<{ n: number }>(`select count(*)::int as n from leads where product_id = 'cart' and call_attempts > 0`)).rows[0].n).toBe(1)
  })

  it('admin: disabling stops calls for the lead; cancelling removes the waiting attempt', async () => {
    const a = await reveal({ callConsent: true })
    expect(await cancelScheduledCalls(db, a.leadId)).toBe(1)
    await quiet()
    await later()
    expect(dials()).toEqual([])
    await setup()
    const b = await reveal({ callConsent: true })
    await disableCalling(db, b.leadId)
    expect(await retryCall(db, getConfig(), b.leadId)).toBe('calling disabled for this lead')
    await quiet()
    await later()
    expect(dials()).toEqual([])
  })

  it('test mode: only the listed numbers are dialed', async () => {
    await setup({ ...ENV, AI_CALLING_TEST_NUMBERS: '+40700000000' })
    const { leadId } = await reveal({ callConsent: true })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    expect((await leads.byId(db, leadId))!.callStatus).toBe('disabled')
  })
})

describe('calling window and decision', () => {
  const cfg = { hours: { start: 10, end: 19 }, days: [1, 2, 3, 4, 5], timezone: 'Europe/Bucharest' }

  it('local time in Bucharest, weekdays only', () => {
    // 2026-10-14 is a Wednesday; Bucharest is UTC+3 in October.
    expect(inCallingWindow(new Date('2026-10-14T07:00:00Z'), cfg)).toBe(true) // 10:00
    expect(inCallingWindow(new Date('2026-10-14T06:59:00Z'), cfg)).toBe(false) // 09:59
    expect(inCallingWindow(new Date('2026-10-14T16:00:00Z'), cfg)).toBe(false) // 19:00
    expect(inCallingWindow(new Date('2026-10-17T09:00:00Z'), cfg)).toBe(false) // Saturday
    expect(nextCallingWindow(new Date('2026-10-14T17:30:00Z'), cfg).toISOString()).toBe('2026-10-15T07:00:00.000Z') // Wed 20:30 → Thu 10:00
    expect(nextCallingWindow(new Date('2026-10-16T18:00:00Z'), cfg).toISOString()).toBe('2026-10-19T07:00:00.000Z') // Fri 21:00 → Mon 10:00
  })

  it('outside the window the attempt waits for the next one (it is not lost)', async () => {
    await setup({ ...ENV, AI_CALLING_HOURS: '10-19', AI_CALLING_DAYS: '1-5', AI_CALLING_TIMEZONE: 'Pacific/Kiritimati' })
    const c = getConfig().calling
    const now = new Date()
    if (inCallingWindow(now, c)) return // the window is open right now: covered by the pure test above
    await reveal({ callConsent: true })
    await quiet()
    await later()
    expect(dials()).toEqual([])
    const waiting = (await db.query<{ run_at: string }>(`select run_at from jobs where kind = 'call.attempt' and status = 'pending'`)).rows
    expect(waiting).toHaveLength(1)
    expect(inCallingWindow(new Date(waiting[0].run_at), c)).toBe(true)
  })

  it('the decision, in order', () => {
    const lead = { stage: 'lead', callDisabled: false, orderId: null, callAttempts: 0, productId: 'balance-wave', cart: null, lastActivityAt: new Date(Date.now() - 3 * 3_600_000) } as never
    const calling = { ...getConfig().calling, enabled: true, hours: { start: 0, end: 24 }, days: [1, 2, 3, 4, 5, 6, 7], testNumbers: null }
    const ok = { attempt: 1, now: new Date(), calling, phone: PHONE, consentGranted: true, unsubscribed: false, converted: false, superseded: false, otherCall: false, talkedBefore: false }
    expect(callDecision(lead, ok)).toEqual({ call: true, phone: PHONE })
    expect(callDecision(lead, { ...ok, calling: { ...calling, enabled: false } })).toMatchObject({ call: false, reason: 'calling off' })
    expect(callDecision(lead, { ...ok, consentGranted: null })).toMatchObject({ call: false, reason: 'no call consent', status: 'stopped' })
    expect(callDecision(lead, { ...ok, consentGranted: false })).toMatchObject({ call: false, status: 'stopped' })
    expect(callDecision(lead, { ...ok, phone: null })).toMatchObject({ call: false, status: 'stopped' })
    expect(callDecision(lead, { ...ok, converted: true })).toMatchObject({ call: false, reason: 'converted' })
    expect(callDecision(lead, { ...ok, attempt: 3 })).toMatchObject({ call: false, reason: 'maximum attempts reached' })
    expect(callDecision(lead, { ...ok, otherCall: true })).toMatchObject({ call: false, reason: 'another call for this person' })
    expect(callDecision(lead, { ...ok, talkedBefore: true })).toMatchObject({ call: false, reason: 'already talked to the agent', status: 'stopped' })
    expect(callDecision({ ...(lead as object), lastActivityAt: new Date() } as never, ok)).toMatchObject({ call: false, reason: 'still active', later: expect.any(Date) })
  })
})

describe('agent', () => {
  it('knowledge comes from the catalog and approved content: real prices and promotions, no Flow for sale', () => {
    const k = agentKnowledge('https://biohack-tech.ro')
    expect(k).toContain('## NEUROS Calm')
    expect(k).toContain('6.380 lei')
    expect(k).toContain('790 lei')
    expect(k).toContain('315 lei')
    expect(k).toMatch(/2\+1|una este gratuită|gratis/i)
    expect(k).toContain('10% reducere')
    expect(k).toContain('https://biohack-tech.ro/products/calm')
    expect(k).toContain('NEUROS Flow nu se mai vinde')
    expect(k).not.toMatch(/## NEUROS Flow/)
    expect(k).toMatch(/ramburs/)
  })

  it('docs/ai-calling/{agent,tools,knowledge} are in sync with the code (UPDATE_AGENT_JSON=1 refreshes them)', () => {
    const sync = (file: string, content: string) => {
      if (process.env.UPDATE_AGENT_JSON === '1' || !existsSync(file)) writeFileSync(file, content)
      expect(readFileSync(file, 'utf8'), file).toBe(content)
    }
    const json = `${JSON.stringify(agentDefinition(), null, 2)}\n`
    const tools = `${JSON.stringify(agentTools('https://biohack-tech.ro'), null, 2)}\n`
    sync('docs/ai-calling/agent.json', json)
    sync('docs/ai-calling/tools.json', tools)
    sync('docs/ai-calling/knowledge.md', `${agentKnowledge('https://biohack-tech.ro')}\n`)
    const def = JSON.parse(json)
    expect(def.name).toBe('BiohackTech — AI Recovery Agent')
    expect(def.conversation_config.tts.voice_id).toBe('k1tFw6wFoibtJrwu6GTz')
    expect(def.conversation_config.agent.language).toBe('ro')
    expect(def.conversation_config.agent.first_message).toBe('{{opening_line}}')
    expect(def.conversation_config.conversation.max_duration_seconds).toBe(240)
    expect(def.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders.opening_line).toMatch(/asistent AI/)
    expect(Object.keys(def.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders)).toEqual(
      expect.arrayContaining(['customer_first_name', 'funnel_type', 'product_names', 'product_quantities', 'cart_total', 'existing_discounts', 'recovery_discount_percent', 'recovery_code', 'recovery_expiration', 'recovery_email_sent', 'checkout_recovery_url']),
    )
    expect(def.platform_settings.privacy.record_voice).toBe(false)
    expect(def.platform_settings.data_collection.outcome.description).toMatch(/discount_accepted.*needs_information.*human_followup.*no_time.*technical_failure/s)
    // Every variable the prompt uses is passed on each call.
    const used = [...new Set([...def.conversation_config.agent.prompt.prompt.matchAll(/\{\{(\w+)\}\}/g)].map((m: RegExpMatchArray) => m[1]))]
    for (const v of used) expect(def.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders, v).toHaveProperty(v)
    expect(tools).not.toMatch(/secret_id|x-biohack-tool-secret/)
    expect(JSON.parse(tools).map((t: { name: string }) => t.name)).toEqual(['get_recovery_context', 'check_discount', 'recovery_email_status', 'record_outcome', 'request_human_follow_up', 'record_opt_out'])
  })
})
