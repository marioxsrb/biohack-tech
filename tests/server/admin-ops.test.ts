/**
 * /admin as the operational control centre: the work queues, the confirmation required for money and
 * cancellations, repeated clicks, and an unreachable GoHighLevel. The real Server Actions run against an
 * embedded PostgreSQL (PGlite); every external API answers 503 at the HTTP boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
const auth = { header: '' }
vi.mock('next/headers', () => ({ headers: async () => new Headers({ authorization: auth.header }) }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
type Queue = keyof typeof import('@/server/orders/repository').QUEUES
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const actions = await import('@/app/[lang]/(site)/admin/actions')

let db: Awaited<ReturnType<typeof freshDb>>
let seq = 0
const ENV = { ...TEST_ENV, ADMIN_USER: 'ops', ADMIN_PASSWORD: 'a-long-test-password' }

beforeEach(async () => {
  db = await freshDb(ENV)
  auth.header = `Basic ${btoa('ops:a-long-test-password')}`
  // GoHighLevel, FGO and email all down: the canonical order must still change, once.
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ message: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } }))
})
afterEach(() => vi.unstubAllGlobals())

const place = async (method: 'card' | 'transfer' | 'cod') =>
  (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: method }, attemptId: `admin-${++seq}` })).order
const form = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
const reload = async (id: string) => (await orders.byId(db, id))!
const eventsOf = async (id: string) => (await db.query<{ type: string; data: Record<string, unknown> }>('select type, data from order_events where order_id = $1 order by id', [id])).rows

describe('work queues', () => {
  it('put every order where the next person needs it, and count them', async () => {
    const transfer = await place('transfer')
    const cod = await place('cod')
    const shippedCod = await place('cod')
    await svc.markShipped(shippedCod.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB1' })
    const cancelled = await place('transfer')
    await svc.cancelOrder(cancelled.id, 'admin', 'clientul a renunțat')
    const unpaidCard = await place('card')
    await svc.markAbandonedIfUnpaid(unpaidCard.id)

    const ids = async (queue: Queue) => (await orders.list(db, { queue })).map((o) => o.id).sort()
    expect(await ids('transfer')).toEqual([transfer.id])
    // Paid orders and cash-on-delivery orders are prepared from separate queues.
    expect(await ids('pregatire')).toEqual([])
    expect(await ids('ramburs')).toEqual([cod.id])
    expect(await ids('noi')).toEqual([cod.id, shippedCod.id, transfer.id].sort())
    expect(await ids('expediate')).toEqual([shippedCod.id])
    expect(await ids('incasare')).toEqual([shippedCod.id])
    expect(await ids('anulate')).toEqual([cancelled.id])
    expect(await ids('nefinalizate')).toEqual([unpaidCard.id])
    // Nothing failed yet; once the jobs run with GoHighLevel down, those orders need attention.
    expect(await ids('atentie')).toEqual([])
    expect(await ids('joburi')).toEqual([])
    await runDueJobs()
    expect((await ids('atentie')).length).toBeGreaterThan(0)
    expect((await ids('joburi')).length).toBeGreaterThan(0)

    const counts = await orders.queueCounts(db)
    expect(counts).toMatchObject({ transfer: 1, pregatire: 0, ramburs: 1, expediate: 1, incasare: 1, anulate: 1, nefinalizate: 1, livrate: 0, retururi: 0, rambursari: 0, facturi: 0 })
    // A search inside a queue keeps both filters.
    expect((await orders.list(db, { queue: 'transfer', search: transfer.orderNumber.toLowerCase() })).map((o) => o.id)).toEqual([transfer.id])
    expect(await orders.list(db, { queue: 'transfer', search: cod.orderNumber.toLowerCase() })).toEqual([])
  })

  it('"atenție" lists a cancelled order that was paid and still needs its refund', async () => {
    const o = await place('transfer')
    await svc.confirmPayment(o.id, 'admin')
    await svc.cancelOrder(o.id, 'admin', 'stoc epuizat')
    await db.query("update jobs set status = 'done'") // no sync problems: only the money is left
    expect((await orders.list(db, { queue: 'atentie' })).map((x) => x.id)).toEqual([o.id])
  })
})

describe('single actions from /admin', () => {
  it('confirming a bank transfer needs the ticked box; a double click changes the order once', async () => {
    const o = await place('transfer')
    await actions.markPaidAction(form({ id: o.id }))
    expect((await reload(o.id)).paymentStatus).toBe('awaiting_transfer')

    await Promise.all([actions.markPaidAction(form({ id: o.id, confirm: 'da' })), actions.markPaidAction(form({ id: o.id, confirm: 'da' }))])
    const paid = await reload(o.id)
    expect([paid.paymentStatus, paid.status]).toEqual(['paid', 'confirmed'])
    expect((await eventsOf(o.id)).filter((e) => e.type === 'payment.confirmed')).toHaveLength(1)
    // One invoice, one CRM sync and one email queued for this change, even with every API down.
    const kinds = (await jobs.forOrder(db, o.id)).map((j) => `${j.kind}:${String(j.payload.template ?? '')}`)
    expect(kinds.filter((k) => k.startsWith('fgo.invoice'))).toHaveLength(1)
    expect(kinds.filter((k) => k === 'email.send:payment_received')).toHaveLength(1)
  })

  it('a card order can never be marked paid from /admin, even confirmed', async () => {
    const o = await place('card')
    await actions.markPaidAction(form({ id: o.id, confirm: 'da' }))
    expect((await reload(o.id)).paymentStatus).toBe('pending')
  })

  it('cancelling needs the ticked box, and the reason is kept in the order history', async () => {
    const o = await place('transfer')
    const before = (await reload(o.id)).status
    await actions.cancelAction(form({ id: o.id, reason: 'clientul a sunat' }))
    expect((await reload(o.id)).status).toBe(before)
    await actions.cancelAction(form({ id: o.id, reason: 'clientul a sunat', confirm: 'da' }))
    expect((await reload(o.id)).status).toBe('cancelled')
    expect((await eventsOf(o.id)).find((e) => e.type === 'order.cancelled')!.data).toMatchObject({ reason: 'clientul a sunat', wasPaid: false })
  })

  it('a cash-on-delivery collection needs the box, the exact amount and a reference', async () => {
    const o = await place('cod')
    await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB2' })
    await actions.codCollectedAction(form({ id: o.id, amount: '790', reference: 'BORD-1' }))
    expect((await reload(o.id)).paymentStatus).toBe('awaiting_collection')
    await actions.codCollectedAction(form({ id: o.id, amount: '700', reference: 'BORD-1', confirm: 'da' }))
    expect((await reload(o.id)).paymentStatus).toBe('awaiting_collection')
    await actions.codCollectedAction(form({ id: o.id, amount: '790', reference: 'BORD-1', confirm: 'da' }))
    expect((await reload(o.id))).toMatchObject({ paymentStatus: 'paid', codReference: 'BORD-1' })
  })

  it('shipping and delivery are single clicks; repeating them changes nothing, and the AWB is in the history', async () => {
    const o = await place('cod')
    const ship = form({ id: o.id, courier: 'Fan Courier', tracking: 'AWB3' })
    await Promise.all([actions.shipAction(ship), actions.shipAction(ship)])
    await actions.deliveredAction(form({ id: o.id }))
    await actions.deliveredAction(form({ id: o.id }))
    const e = await eventsOf(o.id)
    expect(e.filter((x) => x.type === 'order.shipped')).toHaveLength(1)
    expect(e.filter((x) => x.type === 'order.delivered')).toHaveLength(1)
    expect(e.find((x) => x.type === 'order.shipped')!.data).toMatchObject({ courier: 'Fan Courier', trackingNumber: 'AWB3' })
    expect(await reload(o.id)).toMatchObject({ status: 'delivered', courier: 'Fan Courier', trackingNumber: 'AWB3' })
  })

  it('without valid credentials nothing happens, confirmed or not', async () => {
    const o = await place('transfer')
    auth.header = `Basic ${btoa('ops:wrong-password-123')}`
    await expect(actions.markPaidAction(form({ id: o.id, confirm: 'da' }))).rejects.toThrow('unauthorized')
    await expect(actions.cancelAction(form({ id: o.id, confirm: 'da' }))).rejects.toThrow('unauthorized')
    expect((await reload(o.id))).toMatchObject({ paymentStatus: 'awaiting_transfer', status: o.status })
  })
})
