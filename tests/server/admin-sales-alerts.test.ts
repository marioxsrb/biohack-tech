/**
 * KA-CHING in /admin: the live feed announces an order once, when it is PLACED (card once Stripe confirms it, bank
 * transfer and cash on delivery as soon as they are created), never checkout attempts, failures, later payments,
 * status changes or repeated webhooks; the first connection gets no history; only a signed-in admin may read it.
 * The browser side (one ring and one card per order across refreshes and tabs) is tested on its storage claims.
 * The database is PGlite; no real order, payment or email.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { salesFeed } = await import('@/server/admin/sales-feed')
const { GET } = await import('@/app/api/admin/live/route')
const { createAdminSession, ADMIN_COOKIE } = await import('@/lib/admin-auth')
const alerts = await import('@/lib/sales-alerts')

let db: Awaited<ReturnType<typeof freshDb>>
let ip = 0
beforeEach(async () => {
  db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
})

const place = async (paymentMethod: 'cod' | 'transfer' | 'card', attemptId: string, productId = 'brainlink-pro') =>
  (await svc.placeOrder({ lines: lines([{ productId, quantity: 1 }]), form: { ...person, paymentMethod }, attemptId } as never)).order
const live = async (headers: Record<string, string>, after?: number) => {
  const res = await GET(new NextRequest(`https://biohack-tech.ro/api/admin/live${after === undefined ? '' : `?after=${after}`}`, { headers: { 'x-forwarded-for': `10.8.0.${++ip}`, ...headers } }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, cache: res.headers.get('cache-control') }
}

describe('the live sales feed', () => {
  it('first connection: the cursor only, never the orders already there', async () => {
    await place('cod', 'h-1')
    await place('transfer', 'h-2')
    const first = await salesFeed(db, null)
    expect(first.sales).toEqual([])
    expect(first.cursor).toBeGreaterThan(0)
    expect((await salesFeed(db, first.cursor)).sales).toEqual([])
  })

  it('cash on delivery and bank transfer ring when placed; a card only once Stripe confirms; each order once', async () => {
    const { cursor } = await salesFeed(db, null)
    const cod = await place('cod', 'n-1')
    const transfer = await place('transfer', 'n-2')
    const card = await place('card', 'n-3', 'balance-wave')
    let f = await salesFeed(db, cursor)
    expect(f.sales.map((s) => [s.number, s.paymentMethod])).toEqual([
      [cod.orderNumber, 'cash_on_delivery'],
      [transfer.orderNumber, 'bank_transfer'],
    ]) // the card is still an attempt
    expect(f.sales[0]).toMatchObject({ orderId: cod.id, total: cod.totalMinor / 100, currency: 'RON', kind: 'checkout', href: `/admin/orders/${cod.id}`, items: expect.stringContaining('1 × ') })
    // Stripe confirms the card, twice (a repeated webhook); the transfer is paid; the COD order ships.
    await svc.confirmPayment(card.id, 'stripe.webhook', { amountMinor: card.totalMinor, currency: card.currency })
    await svc.confirmPayment(card.id, 'stripe.webhook', { amountMinor: card.totalMinor, currency: card.currency })
    await svc.confirmPayment(transfer.id, 'admin')
    await svc.markShipped(cod.id, 'admin', { courier: 'FAN Courier', trackingNumber: 'AWB1' })
    f = await salesFeed(db, f.cursor)
    expect(f.sales.map((s) => [s.number, s.paymentMethod])).toEqual([[card.orderNumber, 'card']])
    // Nothing more, however often it is asked.
    expect((await salesFeed(db, f.cursor)).sales).toEqual([])
  })

  it('no ring for a failed or abandoned card attempt, a cancellation, or an order changed later', async () => {
    const { cursor } = await salesFeed(db, null)
    const failed = await place('card', 'x-1')
    await svc.recordPaymentFailure(failed.id, 'stripe.webhook', 'card_declined')
    const left = await place('card', 'x-2', 'balance-wave')
    await svc.markAbandonedIfUnpaid(left.id)
    let f = await salesFeed(db, cursor)
    expect(f.sales).toEqual([])
    const cod = await place('cod', 'x-3')
    f = await salesFeed(db, f.cursor)
    expect(f.sales).toHaveLength(1)
    await svc.cancelOrder(cod.id, 'admin', 'test')
    expect((await salesFeed(db, f.cursor)).sales).toEqual([])
  })

  it('pages through a burst without losing or repeating an order', async () => {
    const { cursor } = await salesFeed(db, null)
    const placed = []
    for (let i = 0; i < 5; i++) placed.push((await place('cod', `b-${i}`)).orderNumber)
    const seen: string[] = []
    let c = cursor
    for (let i = 0; i < 4; i++) {
      const f = await salesFeed(db, c, 2)
      seen.push(...f.sales.map((s) => s.number))
      c = f.cursor
    }
    expect(seen).toEqual(placed)
  })
})

describe('GET /api/admin/live', () => {
  it('only a signed-in admin; never cached', async () => {
    expect((await live({})).status).toBe(401)
    expect((await live({ cookie: `${ADMIN_COOKIE}=forged.123.abc` })).status).toBe(401)
    expect((await live({ authorization: 'Bearer something' })).status).toBe(401)
    const cookie = `${ADMIN_COOKIE}=${await createAdminSession('admin')}`
    const first = await live({ cookie })
    expect(first.status).toBe(200)
    expect(first.cache).toBe('no-store')
    expect(first.json.sales).toEqual([])
    const cod = await place('cod', 'r-1')
    const next = await live({ cookie }, first.json.cursor as number)
    expect((next.json.sales as { orderId: string }[]).map((s) => s.orderId)).toEqual([cod.id])
    expect(JSON.stringify(next.json)).not.toMatch(/ana@exemplu|Lalelelor|0722/i) // no address, email or phone
  })
})

describe('browser claims (one ring, one card per order)', () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  }

  it('each key is won once, by one tab, across refreshes (the same storage)', () => {
    const s = memory()
    expect(alerts.claimNow(s, 'seen:o1')).toBe(true)
    expect(alerts.claimNow(s, 'seen:o1')).toBe(false) // refresh, reconnection, another tab
    expect(alerts.claimNow(s, 'sound:o1')).toBe(true)
    expect(alerts.claimNow(s, 'sound:o1')).toBe(false)
    expect(alerts.claimNow(s, 'seen:o2')).toBe(true)
  })

  it('claims inside a shared lock: two tabs asking at once, one wins', async () => {
    const s = memory()
    let queue = Promise.resolve(true)
    const locks = { request: (_n: string, cb: () => Promise<boolean>) => (queue = queue.then(cb, cb)) }
    const [a, b] = await Promise.all([alerts.claim(s, 'toast:o9', locks), alerts.claim(s, 'toast:o9', locks)])
    expect([a, b].sort()).toEqual([false, true])
  })

  it('old orders (placed while the admin was closed) are not announced; the cursor only moves forward', () => {
    const now = '2026-10-16T20:00:00.000Z'
    expect(alerts.isFresh('2026-10-16T19:59:50.000Z', now)).toBe(true)
    expect(alerts.isFresh('2026-10-16T19:40:00.000Z', now)).toBe(false)
    const s = memory()
    alerts.saveCursor(s, 10)
    alerts.saveCursor(s, 7)
    expect(alerts.readCursor(s)).toBe(10)
  })

  it('the sound preference is remembered; a blocked storage never throws', () => {
    const s = memory()
    expect(alerts.soundPref(s)).toBeNull()
    alerts.setSoundPref(s, 'on')
    expect(alerts.soundPref(s)).toBe('on')
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => {} }
    expect(alerts.soundPref(broken)).toBeNull()
    expect(alerts.claimNow(broken, 'x')).toBe(false)
    expect(() => alerts.setSoundPref(broken, 'off')).not.toThrow()
  })

  it('formats the card like the rest of the store', () => {
    expect(alerts.money(1620, 'RON')).toBe('1.620 lei')
    expect(alerts.methodLabel('cash_on_delivery')).toBe('ramburs')
    expect(alerts.SOUND_URL).toBe('/sounds/kaching-register.mp3')
  })
})
