/** Admin stats: orders, confirmed revenue and recovery of the store's funnel, with filters (PGlite, real queries). */
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
const { freshDb, person, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { funnelStats, dailyTrend, campaignOptions } = await import('@/server/stats')

let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb()
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }))
})

const place = (attemptId: string, paymentMethod: 'cod' | 'transfer' | 'card', items: { productId: string; variantId?: string; quantity: number }[], utm?: Record<string, string>) =>
  svc.placeOrder({ lines: lines(items), form: { ...person, email: `${attemptId}@exemplu.ro`, paymentMethod }, attemptId, attribution: utm ? { utm } : null }).then((r) => r.order)
const range = () => ({ from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) })

it('orders count when committed (card only when paid), revenue only when paid, recovered orders separately', async () => {
  await place('cod', 'cod', [{ productId: 'balance-wave', quantity: 1 }], { utm_source: 'facebook', utm_campaign: 'toamna' })
  const transfer = await place('tr', 'transfer', [{ productId: 'brainlink-pro', quantity: 2 }])
  await svc.confirmPayment(transfer.id, 'admin')
  await place('card', 'card', [{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]) // unpaid card: not an order yet
  // An order placed after a recovery email of its lead.
  const recovered = await place('rec', 'cod', [{ productId: 'brainlink-pro', quantity: 1 }])
  await db.query(
    `insert into leads (id, visitor_id, funnel, product_id, email, stage, recovery_sent, last_recovery_at, created_at, last_activity_at) values (gen_random_uuid(), 'v1', 'visible_price', 'cart', 'rec@exemplu.ro', 'ordered', 1, now() - interval '1 hour', now() - interval '2 hours', now())`,
  )
  await db.query(`update orders set lead_id = (select id from leads where email = 'rec@exemplu.ro') where id = $1`, [recovered.id])

  expect(await funnelStats(db, range())).toMatchObject({ orders: 3, paidOrders: 1, revenueMinor: transfer.totalMinor, recoveredOrders: 1, recoveryEmails: 1, recoveryLeads: 1 })
  // Filters: campaign, product.
  expect(await funnelStats(db, { ...range(), campaign: 'toamna' })).toMatchObject({ orders: 1 })
  expect(await funnelStats(db, { ...range(), product: 'balance-wave' })).toMatchObject({ orders: 1, recoveredOrders: 0 })
  // Trend: one row per day; campaign options from orders.
  const trend = await dailyTrend(db, range())
  expect(trend.reduce((n, t) => n + t.orders, 0)).toBe(3)
  expect(await campaignOptions(db, range().from, range().to)).toEqual({ sources: ['facebook'], campaigns: ['toamna'] })
})

it('visits are counted on Bucharest days: a range ending tonight (Bucharest) includes today', async () => {
  const { countVisit } = await import('@/server/leads')
  await countVisit(db, 'calm', { session: true, source: 'facebook', campaign: 'toamna', site: 'calm' })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date())
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Bucharest', timeZoneName: 'longOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '') || '+00:00'
  const from = new Date(`${today}T00:00:00${offset}`)
  const to = new Date(from.getTime() + 86_400_000)
  expect(await funnelStats(db, { from, to })).toMatchObject({ sessions: 1, views: 1, productViews: 1 })
  expect((await dailyTrend(db, { from, to })).find((t) => t.day === today)).toMatchObject({ sessions: 1 })
  expect(await campaignOptions(db, from, to)).toEqual({ sources: ['facebook'], campaigns: ['toamna'] })
})
