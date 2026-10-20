/**
 * The admin's store settings (prices, stock, switches) and the full admin API with keys: who may do what, prices
 * that orders really charge, stock that blocks orders, validation and the admin log. PGlite.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const { applyCatalogOverrides, getProduct } = await import('@/content/catalog')
const { resolveOrderLines } = await import('@/lib/orders/resolve')
const { adminKeys } = await import('@/server/admin-keys')
const { saveStoreSettings, readStoreSettings, DEFAULT_SETTINGS } = await import('@/server/store-settings')
const svc = await import('@/server/orders/service')
const route = await import('@/app/api/admin/v1/[[...path]]/route')

afterEach(() => applyCatalogOverrides({}))

const call = (method: 'GET' | 'POST' | 'PATCH', path: string, token?: string, body?: unknown) =>
  route[method](new NextRequest(`https://biohack-tech.ro/api/admin/v1/${path}`, { method, headers: { ...(token && { authorization: `Bearer ${token}` }), 'content-type': 'application/json' }, ...(body !== undefined && { body: JSON.stringify(body) }) }), {
    params: Promise.resolve({ path: path ? path.split('?')[0].split('/') : [] }),
  })

describe('store settings', () => {
  it('a new price is what the site shows and what an order charges; empty goes back to the code price', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    expect((await saveStoreSettings(db, { ...DEFAULT_SETTINGS, prices: { 'brainlink-pro': 69000 } }, 'test')).ok).toBe(true)
    expect(getProduct('brainlink-pro')!.price).toBe(69000)
    const r = resolveOrderLines([{ productId: 'brainlink-pro', quantity: 1 }])
    expect(r.ok && r.lines[0].unitAmount).toBe(69000)
    const { order } = await svc.placeOrder({ lines: (r as unknown as { lines: never }).lines, form: { ...person, paymentMethod: 'cod' }, attemptId: 'price-1' })
    expect(order.totalMinor).toBe(69000)
    await saveStoreSettings(db, DEFAULT_SETTINGS, 'test')
    expect(getProduct('brainlink-pro')!.price).toBe(333700)
    expect((await db.query("select count(*)::int as n from admin_audit where action = 'settings.update'")).rows[0].n).toBe(2)
  })

  it('out of stock: shown, never sold (the line is refused); absurd prices are refused', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    await saveStoreSettings(db, { ...DEFAULT_SETTINGS, soldOut: ['ochelari-biohack'] }, 'test')
    expect(getProduct('ochelari-biohack')!.soldOut).toBe(true)
    expect(resolveOrderLines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
    const bad = await saveStoreSettings(db, { ...DEFAULT_SETTINGS, prices: { 'balance-wave': 5 } }, 'test')
    expect(bad.ok).toBe(false)
    expect((await readStoreSettings(db)).prices).toEqual({})
  })
})

describe('admin API keys and /api/admin/v1', () => {
  it('no key, a wrong or revoked key: 401; a read key: GET only; a full key: everything', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    const full = await adminKeys.create(db, 'Grok', 'full')
    const read = await adminKeys.create(db, 'Raport', 'read')
    expect((await call('GET', 'orders')).status).toBe(401)
    expect((await call('GET', 'orders', 'bt_live_abcdefgh_wrong-wrong-wrong-wrong-wrong-wrong-wrong-wrong')).status).toBe(401)
    expect((await call('GET', '', read.token)).status).toBe(200)
    expect((await call('GET', 'settings', read.token)).status).toBe(200)
    expect((await call('PATCH', 'settings', read.token, { welcomePopup: false })).status).toBe(403)
    const patched = await call('PATCH', 'settings', full.token, { prices: { 'brainlink-pro': 75000 }, callsPaused: true })
    expect(patched.status).toBe(200)
    expect(await readStoreSettings(db)).toMatchObject({ prices: { 'brainlink-pro': 75000 }, callsPaused: true })
    expect((await call('PATCH', 'settings', full.token, { prices: { 'brainlink-pro': 1 } })).status).toBe(422)
    expect((await call('PATCH', 'settings', full.token, { prices: { 'brainlink-pro': null } })).status).toBe(200)
    expect((await readStoreSettings(db)).prices).toEqual({})
    await adminKeys.revoke(db, full.id)
    expect((await call('GET', 'orders', full.token)).status).toBe(401)
    const { rows } = await db.query<{ actor: string }>("select actor from admin_audit where action = 'settings.update'")
    expect(rows.every((r) => r.actor === 'api:Grok')).toBe(true)
  })

  it('orders: list, details and actions with the same confirmations as the admin pages', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    const { token } = await adminKeys.create(db, 'Ops', 'full')
    const r = resolveOrderLines([{ productId: 'brainlink-pro', quantity: 1 }])
    const { order } = await svc.placeOrder({ lines: (r as unknown as { lines: never }).lines, form: { ...person, paymentMethod: 'cod' }, attemptId: 'api-1' })
    const list = await (await call('GET', 'orders?limit=10', token)).json()
    expect(list.map((o: { id: string }) => o.id)).toContain(order.id)
    expect((await call('POST', `orders/${order.id}/cancel`, token, { reason: 'test' })).status).toBe(422) // no confirm
    expect((await call('POST', `orders/${order.id}/shipped`, token, {})).status).toBe(422)
    const shipped = await (await call('POST', `orders/${order.id}/shipped`, token, { courier: 'Sameday', trackingNumber: 'AWB123' })).json()
    expect(shipped).toMatchObject({ ok: true, changed: true, order: { status: 'shipped' } })
    const detail = await (await call('GET', `orders/${order.id}`, token)).json()
    expect(detail.events.length).toBeGreaterThan(0)
    expect((await call('POST', 'codes', token, { code: 'API15', kind: 'percent', value: 15 })).status).toBe(200)
    expect((await call('PATCH', 'codes/API15', token, { active: false })).status).toBe(200)
    expect((await (await call('GET', 'codes', token)).json()).find((c: { code: string }) => c.code === 'API15').active).toBe(false)
  })
})
