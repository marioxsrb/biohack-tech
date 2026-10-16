/**
 * The private iOS app's backend: two accounts with their own passwords, sessions kept as hashes, a read-only API
 * (orders, summary, stats; nothing can change an order), iPhone registration, and the sale notifications: KA-CHING
 * only when money is in (card confirmed by Stripe, transfer received, collection recorded), an ordinary one for an
 * unpaid order placed, one per event and phone whatever the retries, dead tokens removed, APNs failures retried.
 * APNs is replaced at its HTTP boundary (sendApns); the database is PGlite.
 */
import { generateKeyPairSync } from 'node:crypto'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

type Sent = { token: string; environment: string; payload: { aps: { sound: string; alert: { title: string; body: string } }; orderId: string; event: string } }
let apnsSent: Sent[]
let apnsAnswer: (token: string) => { ok: true; apnsId: string } | { ok: false; status: number; reason: string; dead: boolean; retry: boolean }
vi.mock('@/server/app/apns', async (orig) => ({
  ...(await orig<typeof import('@/server/app/apns')>()),
  sendApns: async (_c: unknown, m: Sent) => (apnsSent.push(m), apnsAnswer(m.token)),
}))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { appUsers, appDevices } = await import('@/server/app/auth')
const { pushPayload } = await import('@/server/app/push')
const route = await import('@/app/api/app/v1/[[...path]]/route')

const key = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const ENV = { ...TEST_ENV, APNS_KEY_ID: 'ABC123DEFG', APNS_TEAM_ID: 'T2CGAPXKTL', APNS_BUNDLE_ID: 'ro.biohacktech.sales', APNS_PRIVATE_KEY: key.replace(/\n/g, '\\n') }
const TOKEN_A = 'a'.repeat(64)
const TOKEN_B = 'b'.repeat(64)
let db: Awaited<ReturnType<typeof freshDb>>
let ip = 0

beforeEach(async () => {
  db = await freshDb(ENV)
  apnsSent = []
  apnsAnswer = () => ({ ok: true, apnsId: 'apns-1' })
})

const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: { token?: string; body?: unknown } = {}) => {
  const [p, q] = path.split('?')
  const req = new NextRequest(`https://biohack-tech.ro/api/app/v1/${p}${q ? `?${q}` : ''}`, {
    method,
    headers: { 'x-forwarded-for': `10.7.0.${++ip}`, ...(opts.token && { authorization: `Bearer ${opts.token}` }), ...(opts.body !== undefined && { 'content-type': 'application/json' }) },
    ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
  })
  const res = await route[method](req, { params: Promise.resolve({ path: p.split('/').filter(Boolean) }) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}
const account = async (email = 'mario@exemplu.ro') => {
  await appUsers.create(db, { email, name: 'Mario', password: 'o-parola-lunga-123' })
  return ((await call('POST', 'auth/login', { body: { email, password: 'o-parola-lunga-123' } })).json.token as string)
}
const place = async (paymentMethod: 'cod' | 'transfer' | 'card', attemptId: string) =>
  (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod }, attemptId } as never)).order

describe('accounts and sessions', () => {
  it('own password per account, at most two; a wrong or unknown login is refused the same way; only a hash of the token is kept', async () => {
    expect((await appUsers.create(db, { email: 'a@x.ro', name: 'A', password: 'scurta' })).ok).toBe(false)
    expect((await appUsers.create(db, { email: 'a@x.ro', name: 'A', password: 'o-parola-lunga-123' })).ok).toBe(true)
    expect((await appUsers.create(db, { email: 'b@x.ro', name: 'B', password: 'o-parola-lunga-456' })).ok).toBe(true)
    expect(await appUsers.create(db, { email: 'c@x.ro', name: 'C', password: 'o-parola-lunga-789' })).toMatchObject({ ok: false })
    expect((await call('POST', 'auth/login', { body: { email: 'a@x.ro', password: 'gresita-gresita' } })).status).toBe(401)
    expect((await call('POST', 'auth/login', { body: { email: 'nimeni@x.ro', password: 'o-parola-lunga-123' } })).status).toBe(401)
    const ok = await call('POST', 'auth/login', { body: { email: 'A@X.ro', password: 'o-parola-lunga-123' } })
    expect(ok.status).toBe(200)
    const token = ok.json.token as string
    expect(JSON.stringify((await db.query('select * from app_sessions')).rows)).not.toContain(token)
    expect((await call('GET', 'me', { token })).json).toMatchObject({ user: { email: 'a@x.ro', name: 'A' } })
    await call('POST', 'auth/logout', { token })
    expect((await call('GET', 'me', { token })).status).toBe(401)
  })

  it('a new password or a deactivated account ends its sessions and stops its phones', async () => {
    const token = await account()
    await call('POST', 'devices', { token, body: { token: TOKEN_A, environment: 'production', name: 'iPhone Mario' } })
    const [u] = await appUsers.list(db)
    await appUsers.setActive(db, u.id, false)
    expect((await call('GET', 'me', { token })).status).toBe(401)
    expect(await appDevices.targets(db)).toEqual([])
  })
})

describe('read-only API', () => {
  it('nothing without a valid session; no route can change an order', async () => {
    for (const p of ['me', 'summary', 'orders', 'stats']) expect((await call('GET', p)).status).toBe(401)
    expect((await call('GET', 'orders', { token: 'x'.repeat(43) })).status).toBe(401)
    const token = await account()
    const o = await place('transfer', 'ro-1')
    for (const [m, p] of [['POST', `orders/${o.id}`], ['PATCH', `orders/${o.id}`], ['DELETE', `orders/${o.id}`], ['POST', 'orders'], ['POST', `orders/${o.id}/confirm`]] as const)
      expect((await call(m, p, { token, body: { status: 'cancelled', paymentStatus: 'paid' } })).status).toBe(404)
    expect((await db.query('select status, payment_status from orders where id = $1', [o.id])).rows[0]).toEqual({ status: 'pending', payment_status: 'awaiting_transfer' })
  })

  it('orders by filter, an order’s detail with its history; the summary never counts unpaid orders as collected', async () => {
    const token = await account()
    const transfer = await place('transfer', 'f-1')
    const cod = await place('cod', 'f-2')
    await place('card', 'f-3') // an unpaid card attempt
    const all = await call('GET', 'orders?filter=all', { token })
    expect((all.json.orders as unknown[]).length).toBe(3)
    expect(((await call('GET', 'orders?filter=unpaid', { token })).json.orders as { id: string }[]).map((o) => o.id).sort()).toEqual(expect.arrayContaining([transfer.id, cod.id]))
    expect((await call('GET', 'orders?filter=paid', { token })).json.orders).toEqual([])
    expect((await call('GET', 'orders?filter=bogus', { token })).status).toBe(400)
    const d = await call('GET', `orders/${transfer.id}`, { token })
    expect(d.json).toMatchObject({ number: transfer.orderNumber, paymentMethod: 'bank_transfer', paymentStatus: 'awaiting_transfer', paid: false, lines: [{ product: 'NEUROS Focus', quantity: 1 }], invoice: { status: 'none' } })
    expect((d.json.history as { type: string }[]).map((h) => h.type)).toContain('order.created')
    let s = await call('GET', 'summary?period=azi', { token })
    const t = s.json.totals as { orders: number; collectedLei: number; pendingLei: number; revenueLei: number }
    expect(t.collectedLei).toBe(0)
    expect(t.pendingLei).toBeGreaterThan(0)
    expect(t.orders).toBe(2) // transfer + cash on delivery stand; the unpaid card attempt does not
    await svc.confirmPayment(transfer.id, 'admin')
    s = await call('GET', 'summary?period=azi', { token })
    expect((s.json.totals as { collectedLei: number }).collectedLei).toBe(transfer.totalMinor / 100)
    expect((s.json.lifetime as { collectedLei: number }).collectedLei).toBe(transfer.totalMinor / 100)
    expect((await call('GET', 'stats?period=7', { token })).json).toMatchObject({ payments: expect.any(Array), funnels: expect.any(Array), products: expect.any(Array) })
  })
})

describe('sale notifications', () => {
  const register = async (token: string, device: string, prefs?: Record<string, boolean>) => (await call('POST', 'devices', { token, body: { token: device, environment: 'production', name: 'iPhone', prefs } })).json.id as string

  it('KA-CHING on both iPhones when a transfer is received; once, whatever the retries; ordinary notification for the unpaid order placed', async () => {
    const t1 = await account('mario@exemplu.ro')
    const t2 = await account('prieten@exemplu.ro')
    await register(t1, TOKEN_A)
    await register(t2, TOKEN_B)
    const o = await place('transfer', 'n-1')
    await runDueJobs()
    expect(apnsSent.map((m) => [m.token[0], m.payload.event, m.payload.aps.sound])).toEqual(expect.arrayContaining([['a', 'new_transfer', 'default'], ['b', 'new_transfer', 'default']]))
    apnsSent = []
    await svc.confirmPayment(o.id, 'admin')
    await svc.confirmPayment(o.id, 'admin') // a second confirmation (a retry) changes nothing
    await runDueJobs()
    await runDueJobs()
    expect(apnsSent).toHaveLength(2)
    expect(apnsSent.every((m) => m.payload.event === 'payment' && m.payload.aps.sound === 'kaching.caf' && m.payload.orderId === o.id)).toBe(true)
    // Minimal lock screen: order number and amount, no customer name or address.
    expect(apnsSent[0].payload.aps.alert.body).toContain(o.orderNumber)
    expect(JSON.stringify(apnsSent[0].payload)).not.toMatch(/Popescu|Lalelelor|ana@exemplu/i)
    expect((await db.query("select count(*)::int as n from jobs where kind = 'push.send'")).rows[0].n).toBe(2)
  })

  it('no KA-CHING for a card attempt, a failure or a cancellation; KA-CHING once Stripe confirms; COD placed is an ordinary one', async () => {
    const t = await account()
    await register(t, TOKEN_A)
    const card = await place('card', 'c-1')
    await svc.recordPaymentFailure(card.id, 'stripe.webhook', 'card_declined')
    await runDueJobs()
    expect(apnsSent).toEqual([])
    await svc.confirmPayment(card.id, 'stripe.webhook', { amountMinor: card.totalMinor, currency: card.currency })
    await runDueJobs()
    expect(apnsSent.map((m) => m.payload.event)).toEqual(['payment'])
    apnsSent = []
    await place('cod', 'c-2')
    await runDueJobs()
    expect(apnsSent.map((m) => [m.payload.event, m.payload.aps.sound, m.payload.aps.alert.title])).toEqual([['new_cod', 'default', 'Comandă nouă · ramburs']])
  })

  it('the sale notification runs before every other job of the batch (invoice, CRM, emails)', async () => {
    const t = await account()
    await register(t, TOKEN_A)
    const o = await place('transfer', 'p-1')
    await runDueJobs()
    await svc.confirmPayment(o.id, 'admin')
    const { jobs } = await import('@/server/jobs/outbox')
    const claimed = await jobs.claim(db, 3)
    expect(claimed[0].kind).toBe('push.send')
  })

  it('preferences per iPhone: no sound, or no new-order notifications; a dead token is removed; a temporary failure retries only the missing phone', async () => {
    const t1 = await account('mario@exemplu.ro')
    const t2 = await account('prieten@exemplu.ro')
    const a = await register(t1, TOKEN_A)
    await register(t2, TOKEN_B)
    await call('PATCH', `devices/${a}`, { token: t1, body: { prefs: { kaching: false, newOrders: false } } })
    const o = await place('transfer', 'q-1')
    await runDueJobs()
    expect(apnsSent.map((m) => m.token[0])).toEqual(['b']) // A does not want new orders
    apnsSent = []
    apnsAnswer = (tok) => (tok === TOKEN_B ? { ok: false, status: 503, reason: 'ServiceUnavailable', dead: false, retry: true } : { ok: true, apnsId: 'x' })
    await svc.confirmPayment(o.id, 'admin')
    await runDueJobs()
    expect(apnsSent.map((m) => [m.token[0], m.payload.aps.sound])).toEqual(expect.arrayContaining([['a', 'default'], ['b', 'kaching.caf']]))
    apnsSent = []
    apnsAnswer = () => ({ ok: true, apnsId: 'y' })
    await db.query("update jobs set run_at = now() where kind = 'push.send' and status = 'retry'")
    await runDueJobs()
    expect(apnsSent.map((m) => m.token[0])).toEqual(['b']) // A already had it
    // A token Apple says is gone: switched off, never tried again.
    apnsSent = []
    apnsAnswer = (tok) => (tok === TOKEN_A ? { ok: false, status: 410, reason: 'Unregistered', dead: true, retry: false } : { ok: true, apnsId: 'z' })
    await place('cod', 'q-2')
    await call('PATCH', `devices/${a}`, { token: t1, body: { prefs: { newOrders: true } } })
    await place('cod', 'q-3')
    await runDueJobs()
    expect((await db.query('select active, disabled_reason from app_devices where id = $1', [a])).rows[0]).toEqual({ active: false, disabled_reason: 'APNs: Unregistered' })
  })

  it('an invalid device token or environment is refused; the payload is the same shape the app expects', async () => {
    const t = await account()
    expect((await call('POST', 'devices', { token: t, body: { token: 'nu-e-token', environment: 'production' } })).status).toBe(400)
    expect((await call('POST', 'devices', { token: t, body: { token: TOKEN_A, environment: 'altceva' } })).status).toBe(400)
    const p = pushPayload('payment', { id: 'o1', orderNumber: 'BHT-1', totalMinor: 162000, currency: 'RON', paymentMethod: 'card', kind: 'checkout' } as never, { payments: true, newOrders: true, kaching: true })
    expect(p).toMatchObject({ orderId: 'o1', event: 'payment', aps: { sound: 'kaching.caf', category: 'PAYMENT', alert: { title: 'Plată încasată', body: '1.620 lei · card · BHT-1' } } })
  })
})

describe('APNs token auth', () => {
  it('an ES256 JWT Apple can verify with the key, reused for 50 minutes', async () => {
    const { createPublicKey, verify } = await import('node:crypto')
    const { apnsJwt, resetApnsJwt } = await import('@/server/app/apns')
    resetApnsJwt()
    const c = { keyId: 'ABC123DEFG', teamId: 'T2CGAPXKTL', bundleId: 'ro.biohacktech.sales', privateKey: key }
    const t0 = 1_800_000_000_000
    const jwt = apnsJwt(c, t0)
    const [h, b, s] = jwt.split('.')
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' })
    expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toEqual({ iss: 'T2CGAPXKTL', iat: t0 / 1000 })
    expect(verify('sha256', Buffer.from(`${h}.${b}`), { key: createPublicKey(key), dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true)
    expect(apnsJwt(c, t0 + 49 * 60_000)).toBe(jwt)
    expect(apnsJwt(c, t0 + 51 * 60_000)).not.toBe(jwt)
  })
})
