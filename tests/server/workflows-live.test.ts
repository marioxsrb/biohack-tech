/**
 * Live sending through GoHighLevel (server/workflows/live.ts), on the real order flow (PGlite, GHL and Stripe stubbed):
 *   - every switch is needed (mode, workflow listed, allowlisted address while the list is set, GHL location);
 *   - a live "send" writes the email's values on the contact, then adds the bt-wf-<template> tag, once;
 *   - an address outside the test list stays a dry run; a step whose values cannot all be filled is skipped;
 *   - abandoned-cart-04 issues its voucher only for a one-product-type cart; post-purchase-03 waits for video storage;
 *   - consent withdrawn before the job runs: nothing goes; the legacy recovery email and delivery follow-up step aside.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const wf = await import('@/server/workflows/engine')
const live = await import('@/server/workflows/live')
const { runDueJobs } = await import('@/server/jobs/runner')
const { marketing } = await import('@/server/marketing/consent')

const ENV = { ...TEST_ENV, EMAIL_TRANSPORT: 'smtp', WORKFLOWS_MODE: 'live', WORKFLOWS_LIVE: 'abandoned-cart,post-purchase', WORKFLOWS_TEST_RECIPIENTS: person.email, GHL_WF_LOCATION_ID: 'loc1' }
let db: Awaited<ReturnType<typeof freshDb>>
let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let seq = 0

function fakeApis() {
  calls = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('leadconnectorhq.com')) {
      calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null })
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: [] })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [] })
      if (url.includes('/opportunities/search')) return json({ opportunities: [] })
      return json({ contact: { id: 'contact-1' } })
    }
    if (url.includes('/v1/customers')) return json({ id: 'cus_1' })
    if (url.endsWith('/v1/payment_intents') && init.method === 'POST') return json({ id: `pi_${++seq}`, status: 'requires_payment_method', client_secret: 'pi_secret', amount: 1, currency: 'ron' })
    if (url.includes('/factura/')) return json({ Success: true, Factura: { Serie: 'BT', Numar: '1', Link: 'https://fgo/f.pdf' } })
    return json({}, 200)
  })
}

beforeEach(async () => {
  db = await freshDb(ENV)
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

type Raw = { productId: string; variantId?: string; quantity: number }
const CALM: Raw = { productId: 'balance-wave', quantity: 1 }
const AMBER: Raw = { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }
const place = async (raw: Raw[], method: 'card' | 'cod' = 'card', extra: Partial<typeof person> = {}) =>
  (await svc.placeOrder({ lines: lines(raw), form: { ...person, ...extra, paymentMethod: method }, attemptId: `live-${++seq}` })).order
const abandoned = async (raw: Raw[], extra: Partial<typeof person> = {}) => {
  await marketing.grant(db, { email: extra.email ?? person.email, source: 'checkout' })
  const o = await place(raw, 'card', extra)
  await svc.markAbandonedIfUnpaid(o.id)
  return o
}
const sends = async () => (await db.query('select email, template, status, reason from email_sends order by id')).rows
const tagged = () => calls.filter((c) => c.url.endsWith('/tags') && c.method === 'POST').flatMap((c) => c.body?.tags as string[]).filter((t) => t.startsWith('bt-wf-'))
const fieldsSet = () => calls.filter((c) => c.method === 'PUT' && Array.isArray(c.body?.customFields) && (c.body?.customFields as { key: string }[]).some((f) => f.key === 'bt_unsubscribe_url')).map((c) => Object.fromEntries((c.body?.customFields as { key: string; field_value: string }[]).map((f) => [f.key, f.field_value])))
const at = (t0: number, hours: number) => ({ now: new Date(t0 + hours * 3_600_000 + 60_000) })

describe('switches', () => {
  it('every one is needed', () => {
    expect(live.sendsLive('abandoned-cart', person.email, ENV)).toBe(true)
    expect(live.sendsLive('abandoned-cart', person.email.toUpperCase(), ENV)).toBe(true)
    expect(live.sendsLive('abandoned-cart', 'altcineva@example.com', ENV)).toBe(false)
    expect(live.sendsLive('welcome', person.email, ENV)).toBe(false)
    expect(live.sendsLive('abandoned-cart', person.email, { ...ENV, WORKFLOWS_MODE: 'dry_run' })).toBe(false)
    expect(live.sendsLive('abandoned-cart', person.email, { ...ENV, GHL_WF_LOCATION_ID: 'other-location' })).toBe(false)
    expect(live.sendsLive('abandoned-cart', person.email, { ...ENV, GHL_WF_LOCATION_ID: '' })).toBe(false)
    expect(live.sendsLive('abandoned-cart', 'oricine@example.com', { ...ENV, WORKFLOWS_TEST_RECIPIENTS: '' })).toBe(true)
    expect(live.workflowsGhl({ GHL_WF_LOCATION_ID: 'x', GHL_WF_TOKEN: 'pit-x' })).toMatchObject({ locationId: 'x', token: 'pit-x' })
  })
})

describe('Abandoned Cart, live', () => {
  it('the 1-hour email: values on the contact, then its tag, once', async () => {
    const o = await abandoned([CALM])
    const t0 = Date.now()
    await wf.workflowTick(db, at(t0, 1))
    expect(await sends()).toEqual([{ email: person.email, template: 'abandoned-cart-01', status: 'queued', reason: null }])
    await runDueJobs(50)
    await runDueJobs(50)
    expect(tagged()).toEqual(['bt-wf-abandoned-cart-01'])
    const f = fieldsSet()[0]
    const token = (await orders.byId(db, o.id))!.recoveryToken
    expect(f.bt_checkout_url).toBe(`https://test.biohack-tech.ro/reluare/${token}`)
    expect(f.bt_cart_items).toBeTruthy()
    expect(f.bt_unsubscribe_url).toMatch(/^https:\/\/test\.biohack-tech\.ro\/dezabonare\//)
    expect(await sends()).toEqual([{ email: person.email, template: 'abandoned-cart-01', status: 'sent', reason: null }])
    await wf.workflowTick(db, at(t0, 1))
    await runDueJobs(50)
    expect(tagged()).toHaveLength(1)
  })

  it('an address outside the test list stays a dry run: nothing reaches GHL', async () => {
    await abandoned([CALM], { email: 'client.real@example.com' })
    await wf.workflowTick(db, at(Date.now(), 1))
    await runDueJobs(50)
    expect((await sends()).map((s) => s.status)).toEqual(['dry_run'])
    expect(tagged()).toEqual([])
  })

  it('consent withdrawn before the job runs: skipped, nothing sent', async () => {
    await abandoned([CALM])
    await wf.workflowTick(db, at(Date.now(), 1))
    await marketing.withdraw(db, { email: person.email, source: 'unsubscribe_link' })
    await runDueJobs(50)
    expect(tagged()).toEqual([])
    expect((await sends())[0]).toMatchObject({ status: 'skipped' })
  })

  it('step 04: the voucher is issued only for a one-product-type cart', async () => {
    await abandoned([CALM])
    const t0 = Date.now()
    for (const h of [1, 20, 72, 144]) await wf.workflowTick(db, at(t0, h))
    await runDueJobs(50)
    await runDueJobs(50)
    expect((await sends()).map((s) => [s.template, s.status])).toEqual([
      ['abandoned-cart-01', 'sent'],
      ['abandoned-cart-02', 'sent'],
      ['abandoned-cart-03', 'sent'],
      ['abandoned-cart-04', 'sent'],
    ])
    const v = (await db.query('select product_id, source from vouchers')).rows
    expect(v).toEqual([{ product_id: 'balance-wave', source: 'abandoned-cart' }])
    expect(fieldsSet()[3]).toMatchObject({ bt_product_name: expect.any(String), bt_voucher_amount: expect.any(String), bt_voucher_expiry: expect.any(String) })
  })

  it('step 04 with two product types: skipped (that email is not approved), no voucher', async () => {
    await abandoned([CALM, AMBER])
    const t0 = Date.now()
    for (const h of [1, 20, 72, 144]) await wf.workflowTick(db, at(t0, h))
    expect((await sends()).at(-1)).toMatchObject({ template: 'abandoned-cart-04', status: 'skipped', reason: 'voucher_variant_not_approved' })
    expect((await db.query('select count(*)::int n from vouchers')).rows[0].n).toBe(0)
  })

  it('the legacy recovery email steps aside for a live address', () => {
    expect(live.sendsLive('abandoned-cart', person.email)).toBe(true)
  })
})

describe('Post-Purchase, live', () => {
  const delivered = async () => {
    const o = await place([CALM], 'cod')
    await svc.markShipped(o.id, 'admin', { courier: 'Sameday', trackingNumber: `AWB${seq}` })
    await svc.markDelivered(o.id, 'admin')
    return o
  }

  it('the guide goes with its values; the review email waits for the video storage; no legacy follow-up', async () => {
    await delivered()
    const t0 = Date.now()
    for (const days of [0, 3, 7]) await wf.workflowTick(db, at(t0, days * 24))
    await runDueJobs(50)
    await runDueJobs(50)
    expect((await sends()).map((s) => [s.template, s.status, s.reason])).toEqual([
      ['post-purchase-01', 'sent', null],
      ['post-purchase-02', 'sent', null],
      ['post-purchase-03', 'skipped', 'review_upload_off'],
    ])
    expect(fieldsSet()[0].bt_product_first_steps).toBeTruthy()
    expect(tagged()).toEqual(['bt-wf-post-purchase-01', 'bt-wf-post-purchase-02'])
    const followups = (await db.query(`select count(*)::int n from jobs where kind like '%delivery_followup%' or payload::text like '%deliveryFollowup%'`)).rows[0].n
    expect(followups).toBe(0)
  })
})

describe('values', () => {
  it('a missing value keeps the email from going; the unsubscribe link exists without marketing consent', async () => {
    const e = { id: 'e1', email: person.email, workflow: 'post-purchase' as const, ref: 'none', step: 1, data: { products: [] } }
    const { values, missing } = await live.workflowValues(db, e, 'post-purchase-02', 'https://test.biohack-tech.ro', null)
    expect(missing).toEqual(['product_name', 'product_usage_tips'])
    expect(values.unsubscribeUrl).toMatch(/\/dezabonare\//)
    expect(await marketing.state(db, person.email)).toBeNull()
  })
})
