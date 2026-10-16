/**
 * The private iOS app's backend: one sign-in, user "admin" with the web admin's password (ADMIN_PASSWORD, checked on
 * the server, never stored), app-only sessions kept as hashes that end when that password changes, a read-only API
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
const { appSessions, appDevices } = await import('@/server/app/auth')
const { checkAdminSession } = await import('@/lib/admin-auth')
const { resetConfig } = await import('@/server/config')
const adminApi = await import('@/app/api/admin/v1/[[...path]]/route')
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
/** A phone signing in: "admin" + the web admin's password (TEST_ENV.ADMIN_PASSWORD). */
const account = async () => (await call('POST', 'auth/login', { body: { username: 'admin', password: ENV.ADMIN_PASSWORD } })).json.token as string
const place = async (paymentMethod: 'cod' | 'transfer' | 'card', attemptId: string) =>
  (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod }, attemptId } as never)).order

describe('sign-in with the admin password', () => {
  it('"admin" + ADMIN_PASSWORD opens an app session; any other user name or password is refused the same way; the password is never stored', async () => {
    for (const body of [
      { username: 'admin', password: 'gresita-gresita' },
      { username: 'mario@exemplu.ro', password: ENV.ADMIN_PASSWORD },
      { username: 'administrator', password: ENV.ADMIN_PASSWORD },
      { email: 'admin', password: ENV.ADMIN_PASSWORD }, // the old body shape
    ]) {
      const r = await call('POST', 'auth/login', { body })
      expect(r.status).toBeGreaterThanOrEqual(400)
      expect(r.json.token).toBeUndefined()
    }
    expect((await call('POST', 'auth/login', { body: { username: 'admin', password: 'gresita-gresita' } })).json).toEqual({ error: 'invalid credentials' })
    const ok = await call('POST', 'auth/login', { body: { username: ' Admin ', password: ENV.ADMIN_PASSWORD } })
    expect(ok.status).toBe(200)
    const token = ok.json.token as string
    expect(ok.json.user).toMatchObject({ name: 'Admin', email: 'admin' })
    expect(JSON.stringify(ok.json)).not.toContain(ENV.ADMIN_PASSWORD)
    const stored = JSON.stringify([(await db.query('select * from app_sessions')).rows, (await db.query('select * from app_users')).rows])
    expect(stored).not.toContain(token)
    expect(stored).not.toContain(ENV.ADMIN_PASSWORD)
    expect((await call('GET', 'me', { token })).json).toMatchObject({ user: { name: 'Admin' } })
    expect(JSON.stringify((await call('GET', 'me', { token })).json)).not.toContain(ENV.ADMIN_PASSWORD)
    await call('POST', 'auth/logout', { token })
    expect((await call('GET', 'me', { token })).status).toBe(401)
  })

  it('a new ADMIN_PASSWORD ends every app session (and the old password no longer signs in); the new one does', async () => {
    const token = await account()
    expect((await call('GET', 'me', { token })).status).toBe(200)
    vi.stubEnv('ADMIN_PASSWORD', 'o-alta-parola-de-admin')
    resetConfig()
    try {
      expect((await call('GET', 'me', { token })).status).toBe(401)
      expect((await call('POST', 'auth/login', { body: { username: 'admin', password: ENV.ADMIN_PASSWORD } })).status).toBe(401)
      const fresh = (await call('POST', 'auth/login', { body: { username: 'admin', password: 'o-alta-parola-de-admin' } })).json.token as string
      expect((await call('GET', 'me', { token: fresh })).status).toBe(200)
    } finally {
      vi.stubEnv('ADMIN_PASSWORD', ENV.ADMIN_PASSWORD)
      resetConfig()
    }
    // Back to the old password: the revoked session stays ended.
    expect((await call('GET', 'me', { token })).status).toBe(401)
  })

  it('an expired session is refused; signing every phone out from /admin ends sessions and stops notifications', async () => {
    const token = await account()
    await call('POST', 'devices', { token, body: { token: TOKEN_A, environment: 'production', name: 'iPhone Mario' } })
    expect(await appDevices.targets(db)).toHaveLength(1)
    await db.query("update app_sessions set expires_at = now() - interval '1 minute'")
    expect((await call('GET', 'summary', { token })).status).toBe(401)
    const t2 = await account()
    await appSessions.revokeAll(db)
    expect((await call('GET', 'me', { token: t2 })).status).toBe(401)
    expect(await appDevices.targets(db)).toEqual([])
    expect(await appSessions.active(db)).toBe(0)
  })

  it('the app session is never an admin session: refused by /api/admin and as the admin cookie', async () => {
    const token = await account()
    const req = (headers: Record<string, string>) => new NextRequest('https://biohack-tech.ro/api/admin/v1/orders', { headers })
    const ctx = { params: Promise.resolve({ path: ['orders'] }) }
    expect((await adminApi.GET(req({ authorization: `Bearer ${token}` }), ctx)).status).toBe(401)
    expect((await adminApi.GET(req({ cookie: `bt_admin=${token}` }), ctx)).status).toBe(401)
    expect(await checkAdminSession(token)).not.toBe('ok')
  })

  it('repeated wrong passwords from one address are stopped (429), even with the right one after', async () => {
    const headers = { 'x-forwarded-for': '10.9.9.9', 'content-type': 'application/json' }
    const tryLogin = async (password: string) =>
      (await route.POST(new NextRequest('https://biohack-tech.ro/api/app/v1/auth/login', { method: 'POST', headers, body: JSON.stringify({ username: 'admin', password }) }), { params: Promise.resolve({ path: ['auth', 'login'] }) })).status
    for (let i = 0; i < 10; i++) expect(await tryLogin(`gresita-${i}-gresita`)).toBe(401)
    expect(await tryLogin(ENV.ADMIN_PASSWORD)).toBe(429)
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

  it('KA-CHING on both signed-in iPhones when a transfer is received; once, whatever the retries; ordinary notification for the unpaid order placed', async () => {
    const t1 = await account()
    const t2 = await account()
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
    const t1 = await account()
    const t2 = await account()
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

// Last in the file: it uses up the account-wide budget of wrong passwords (the limiter lives for the whole file).
describe('sign-in limit for the one account', () => {
  it('wrong passwords spread over many addresses still stop at 30 an hour, then even the right password waits', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) statuses.push((await call('POST', 'auth/login', { body: { username: 'admin', password: `ghicit-${i}-ghicit` } })).status)
    expect(statuses).toContain(429)
    expect(statuses.filter((s) => s !== 401 && s !== 429)).toEqual([])
    expect((await call('POST', 'auth/login', { body: { username: 'admin', password: ENV.ADMIN_PASSWORD } })).status).toBe(429)
  })
})
