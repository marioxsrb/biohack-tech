/** The business report (dashboard and the AI report API): periods in Bucharest days, totals, access. PGlite. */
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { buildReport, period, reportMarkdown, dayStart } = await import('@/server/report')
const { countVisit } = await import('@/server/leads')
const { GET } = await import('@/app/api/admin/report/route')
const { createAdminSession, ADMIN_COOKIE } = await import('@/lib/admin-auth')

const TOKEN = 'report-token-for-tests-0123456789abcdef'

describe('report', () => {
  it('Bucharest days: midnight is 21:00 UTC in summer (UTC+3) and 22:00 in winter', () => {
    expect(dayStart('2026-10-15').toISOString()).toBe('2026-10-14T21:00:00.000Z')
    expect(dayStart('2026-12-01').toISOString()).toBe('2026-11-30T22:00:00.000Z')
    const now = new Date('2026-10-15T12:00:00Z')
    expect(period('ieri', now)).toMatchObject({ firstDay: '2026-10-14', lastDay: '2026-10-14', days: 1 })
    expect(period('7', now)).toMatchObject({ firstDay: '2026-10-09', lastDay: '2026-10-15', days: 7 })
    expect(period('2030-01-01', now).firstDay).toBe('2026-10-14') // the future is not a period: yesterday
  })

  it('counts traffic, standing orders, products, payments and lists the orders (first name and city only)', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    for (let i = 0; i < 3; i++) await countVisit(db, 'visible_price', '/products/calm', { session: true, source: 'facebook', campaign: 'toamna' })
    await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 2 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'r1' })
    await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'card' }, attemptId: 'r2' }) // unpaid card: not a sale
    const r = await buildReport(db, period('azi'))
    expect(r.totals).toMatchObject({ sessions: 3, orders: 1 })
    expect(r.totals.revenueLei).toBeGreaterThan(0)
    expect(r.unpaidCard).toBe(1)
    expect(r.products).toEqual([expect.objectContaining({ units: 2 })])
    expect(r.payments).toEqual([expect.objectContaining({ method: 'cash_on_delivery', orders: 1 })])
    expect(r.sources[0]).toMatchObject({ source: 'facebook', campaign: 'toamna', sessions: 3 })
    expect(r.orders).toHaveLength(2)
    expect(r.orders[0]).toMatchObject({ firstName: 'Ana', city: 'Cluj-Napoca' })
    expect(JSON.stringify(r)).not.toMatch(/ana@exemplu|0722123456|Lalelelor/)
    const md = reportMarkdown(r)
    expect(md).toMatch(/# Raport Biohack Tech · Azi/)
    expect(md).toMatch(/Comenzi valide: 1/)
  })

  it('the API: a bearer token or an admin session, nothing else; JSON or text', async () => {
    await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none', ADMIN_API_TOKEN: TOKEN })
    const call = (headers: Record<string, string>, q = '') => GET(new NextRequest(`https://biohack-tech.ro/api/admin/report${q}`, { headers }))
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401)
    const ok = await call({ authorization: `Bearer ${TOKEN}` })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toHaveProperty('totals')
    const md = await call({ authorization: `Bearer ${TOKEN}` }, '?perioada=7&format=md')
    expect(md.headers.get('content-type')).toMatch(/text\/markdown/)
    expect(await md.text()).toMatch(/Ultimele 7 zile/)
    expect((await call({}, `?token=${TOKEN}`)).status).toBe(200)
    expect((await call({}, '?token=wrong')).status).toBe(401)
    const session = await createAdminSession(TEST_ENV.ADMIN_PASSWORD ? 'admin' : 'admin')
    expect((await call({ cookie: `${ADMIN_COOKIE}=${session}` })).status).toBe(200)
  })
})
