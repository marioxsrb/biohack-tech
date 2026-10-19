/**
 * The fulfillment portal: its access (a warehouse session never opens /admin; the admin's credentials open the
 * portal), its queues (from the canonical state; business orders awaiting the team never in a work queue) and its
 * marks (prepared, AWB noted, problem), which never change payment, prices or the status by themselves. PGlite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { portalOrders, queueOf } = await import('@/server/fulfillment/portal')
const auth = await import('@/lib/fulfillment-auth')
const { checkAdminSession, createAdminSession } = await import('@/lib/admin-auth')

const ENV = { ADMIN_USER: 'admin', ADMIN_PASSWORD: 'admin-password-123', FULFILLMENT_USER: 'depozit', FULFILLMENT_PASSWORD: 'depozit-password-123' }

describe('portal access', () => {
  it('warehouse account → staff; admin credentials → admin; anything else → nobody', () => {
    expect(auth.checkFulfilCredentials('depozit', 'depozit-password-123', ENV)).toBe('staff')
    expect(auth.checkFulfilCredentials('admin', 'admin-password-123', ENV)).toBe('admin')
    expect(auth.checkFulfilCredentials('depozit', 'admin-password-123', ENV)).toBeNull()
    expect(auth.checkFulfilCredentials('admin', 'gresit', ENV)).toBeNull()
    // Without a warehouse password configured, only the admin's credentials work.
    expect(auth.checkFulfilCredentials('depozit', 'depozit-password-123', { ...ENV, FULFILLMENT_PASSWORD: '' })).toBeNull()
  })

  it('a warehouse session opens the portal but never the admin; an admin session opens both', async () => {
    const staff = await auth.createFulfilSession('staff', 'depozit', ENV)
    expect(await auth.checkFulfilSession(staff, ENV)).toEqual({ role: 'staff', user: 'depozit' })
    expect(await checkAdminSession(staff, ENV)).toBe('denied')
    expect(await auth.fulfilAccess(staff, null, null, ENV)).toEqual({ role: 'staff', user: 'depozit' })
    const admin = await createAdminSession('admin', ENV)
    expect(await auth.fulfilAccess(null, admin, null, ENV)).toEqual({ role: 'admin', user: 'admin' })
    expect(await auth.fulfilAccess(null, null, null, ENV)).toBeNull()
  })

  it('forged, expired or re-keyed sessions are refused', async () => {
    const staff = await auth.createFulfilSession('staff', 'depozit', ENV)
    expect(await auth.checkFulfilSession(staff.replace('staff.', 'admin.'), ENV)).toBeNull()
    expect(await auth.checkFulfilSession(staff, { ...ENV, FULFILLMENT_PASSWORD: 'alta-parola-depozit' })).toBeNull()
    expect(await auth.checkFulfilSession(await auth.createFulfilSession('staff', 'depozit', ENV, Date.now() - 15 * 3_600_000), ENV)).toBeNull()
    expect(auth.actorName({ role: 'staff', user: 'depozit' })).toBe('depozit:depozit')
  })
})

describe('portal queues and marks', () => {
  let db: Awaited<ReturnType<typeof freshDb>>
  beforeEach(async () => {
    db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
  })
  const place = async (raw: unknown[], paymentMethod: 'cod' | 'transfer' | 'card', attemptId: string) =>
    (await svc.placeOrder({ lines: lines(raw), form: { ...person, paymentMethod }, attemptId } as never)).order

  it('cash on delivery walks noi → pregătire → pregătite → de expediat → expediate, without touching payment', async () => {
    const o = await place([{ productId: 'brainlink-pro', quantity: 1 }], 'cod', 'f-1')
    const at = async () => queueOf((await orders.byId(db, o.id))!)
    expect(await at()).toBe('noi')
    // Packed before preparation started: refused.
    expect((await svc.markPrepared(o.id, 'fulfillment', 'depozit:x')).changed).toBe(false)
    await svc.markProcessing(o.id, 'fulfillment')
    expect(await at()).toBe('pregatire')
    expect((await svc.markPrepared(o.id, 'fulfillment', 'depozit:x')).changed).toBe(true)
    expect((await svc.markPrepared(o.id, 'fulfillment', 'depozit:x')).changed).toBe(false) // idempotent
    expect(await at()).toBe('pregatite')
    expect((await svc.noteAwb(o.id, 'fulfillment', 'depozit:x', { courier: 'Fan Courier', trackingNumber: 'AWB1' })).changed).toBe(true)
    expect((await svc.noteAwb(o.id, 'fulfillment', 'depozit:x', { courier: 'Fan Courier', trackingNumber: 'AWB1' })).changed).toBe(false)
    expect(await at()).toBe('expediere')
    const before = (await orders.byId(db, o.id))!
    expect([before.status, before.paymentStatus]).toEqual(['processing', 'awaiting_collection'])
    await svc.markShipped(o.id, 'fulfillment', { courier: 'Fan Courier', trackingNumber: 'AWB1' })
    expect(await at()).toBe('expediate')
  })

  it('a business order awaiting the team is shown apart and is not workable; an unpaid transfer is not shown at all', async () => {
    const b2b = await place([{ productId: 'balance-wave', quantity: 25 }], 'cod', 'f-2')
    const transfer = await place([{ productId: 'brainlink-pro', quantity: 1 }], 'transfer', 'f-3')
    const { byQueue, awaiting } = await portalOrders(db)
    expect(awaiting.map((o) => o.id)).toEqual([b2b.id])
    expect(Object.values(byQueue).flat().map((o) => o.id)).not.toContain(b2b.id)
    expect(Object.values(byQueue).flat().map((o) => o.id)).not.toContain(transfer.id)
    expect((await svc.markProcessing(b2b.id, 'fulfillment')).changed).toBe(false)
    await svc.confirmByTeam(b2b.id, 'admin', 'admin')
    expect(queueOf((await orders.byId(db, b2b.id))!)).toBe('noi')
  })

  it('a reported problem puts the order in "probleme" (and keeps it in its queue); clearing removes it', async () => {
    const o = await place([{ productId: 'brainlink-pro', quantity: 1 }], 'cod', 'f-4')
    expect((await svc.reportIssue(o.id, 'fulfillment', 'depozit:x', 'Adresa incompletă')).changed).toBe(true)
    let q = await portalOrders(db)
    expect(q.byQueue.probleme.map((x) => x.id)).toEqual([o.id])
    expect(q.byQueue.noi.map((x) => x.id)).toEqual([o.id])
    expect((await svc.reportIssue(o.id, 'fulfillment', 'depozit:x', null)).changed).toBe(true)
    q = await portalOrders(db)
    expect(q.byQueue.probleme).toEqual([])
  })
})
