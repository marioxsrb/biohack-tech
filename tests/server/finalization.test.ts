/**
 * Finalization (22.10.2026): the seller's identity kept on each order, the login limit shared across instances (in
 * the database), the AWB corrected after shipping with its history and audit. PGlite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))
const auth = { header: '' }
vi.mock('next/headers', () => ({ headers: async () => new Headers(auth.header ? { authorization: auth.header } : {}), cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`redirect:${u}`) } }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { sellerAt, sellerOf, SELLER_HISTORY } = await import('@/config/company')
const attempts = await import('@/server/auth-attempts')
const actions = await import('@/app/[lang]/(admin)/admin/actions')
const { POST: adminLogin } = await import('@/app/api/admin/login/route')
const { POST: portalLogin } = await import('@/app/api/fulfillment/login/route')

const ENV = { ...TEST_ENV, ADMIN_USER: 'ops', ADMIN_PASSWORD: 'a-long-test-password' }
let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb(ENV)
  auth.header = `Basic ${btoa('ops:a-long-test-password')}`
})
const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

describe('the seller on each order', () => {
  it('a new order keeps NEUROS EUROPE S.R.L. as placed; an older order without it gets the identity of its date', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'seller-1' })
    const o = (await orders.byId(db, order.id))!
    expect(o.seller).toEqual({ legalName: 'NEUROS EUROPE S.R.L.', cui: '50323873', regCom: 'J2024001256321', address: 'Str. N. D. Cocea, nr. 10, Sibiu, jud. Sibiu, România' })
    expect(sellerOf({ seller: null, createdAt: new Date('2026-10-01') }).legalName).toBe('NEUROS EUROPE S.R.L.')
    // A future change of operator (with its effective date) never rewrites the order stored before it.
    SELLER_HISTORY.push({ from: '2027-01-01T00:00:00+02:00', identity: { legalName: 'ALT OPERATOR S.R.L.', cui: '1', regCom: 'J1', address: 'X' } })
    try {
      expect(sellerAt(new Date('2027-02-01')).legalName).toBe('ALT OPERATOR S.R.L.')
      expect(sellerOf(o).legalName).toBe('NEUROS EUROPE S.R.L.')
      expect(sellerOf({ seller: null, createdAt: new Date('2026-12-31') }).legalName).toBe('NEUROS EUROPE S.R.L.')
    } finally {
      SELLER_HISTORY.pop()
    }
  })
})

describe('the login limit, shared in the database', () => {
  const login = (route: typeof adminLogin, url: string, password: string, ip: string) =>
    route(new NextRequest(url, { method: 'POST', body: new URLSearchParams({ user: 'ops', password }), headers: { 'x-forwarded-for': ip } }))
  it('10 wrong passwords on /admin also block the warehouse login from that address; another address is not affected', async () => {
    for (let i = 0; i < 10; i++) expect((await login(adminLogin, 'https://biohack-tech.ro/api/admin/login', 'wrong', '10.5.5.5')).headers.get('location')).toMatch(/e=invalid/)
    expect((await login(adminLogin, 'https://biohack-tech.ro/api/admin/login', 'a-long-test-password', '10.5.5.5')).headers.get('location')).toMatch(/e=limit/)
    expect((await login(portalLogin, 'https://biohack-tech.ro/api/fulfillment/login', 'a-long-test-password', '10.5.5.5')).headers.get('location')).toMatch(/e=limit/)
    expect((await login(adminLogin, 'https://biohack-tech.ro/api/admin/login', 'a-long-test-password', '10.6.6.6')).headers.get('location')).toMatch(/\/admin$/)
    expect(await attempts.loginBlocked(db, '10.5.5.5', new Date(Date.now() + attempts.LOGIN_WINDOW_MS + 1000))).toBe(false)
  })
})

describe('AWB correction after shipping', () => {
  it('needs the ticked box and a reason; keeps old and new in the history; audited; only once shipped', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'awb-1' })
    expect((await svc.correctAwb(order.id, 'admin', 'admin', { courier: 'Sameday', trackingNumber: 'X', reason: 'greșit' })).reason).toBe('status_confirmed')
    await svc.markShipped(order.id, 'admin', { courier: 'Sameday', trackingNumber: 'AWB-GRESIT' })
    await actions.correctAwbAction(form({ id: order.id, courier: 'Sameday', tracking: 'AWB-BUN', reason: 'cifre inversate' }))
    expect((await orders.byId(db, order.id))!.trackingNumber).toBe('AWB-GRESIT')
    await actions.correctAwbAction(form({ id: order.id, courier: 'Sameday', tracking: 'AWB-BUN', reason: 'cifre inversate', confirm: 'da' }))
    const o = (await orders.byId(db, order.id))!
    expect([o.status, o.trackingNumber]).toEqual(['shipped', 'AWB-BUN'])
    const ev = (await orders.events(db, order.id)).find((e) => e.type === 'fulfillment.awb_corrected')!
    expect(ev.data).toMatchObject({ reason: 'cifre inversate', from: { trackingNumber: 'AWB-GRESIT' }, to: { trackingNumber: 'AWB-BUN' } })
    expect((await db.query(`select action from admin_audit where details->>'orderId' = $1`, [order.id])).rows.map((r) => r.action)).toContain('order.awb_corrected')
  })
})
