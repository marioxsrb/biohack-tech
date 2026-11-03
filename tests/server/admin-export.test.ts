/**
 * /api/admin/export: the orders an admin ticks, or a period, as a CSV for Excel/Google Sheets (one row per order,
 * ";" columns, decimal comma, BOM); only for a signed-in admin. The database is PGlite; no real order or email.
 */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { GET } = await import('@/app/api/admin/export/route')
const { createAdminSession, ADMIN_COOKIE } = await import('@/lib/admin-auth')

let ip = 0
beforeEach(async () => {
  await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
})

const place = async (attemptId: string, form: Record<string, unknown> = {}) =>
  (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 2 }]), form: { ...person, paymentMethod: 'cod', ...form }, attemptId } as never)).order
const get = async (query: string, cookie?: string) => {
  const res = await GET(new NextRequest(`https://biohack-tech.ro/api/admin/export${query}`, { headers: { 'x-forwarded-for': `10.9.0.${++ip}`, ...(cookie ? { cookie } : {}) } }))
  const bytes = new Uint8Array(await res.arrayBuffer())
  return { status: res.status, bytes, body: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes), headers: res.headers }
}
const rows = (csv: string) => csv.replace(/^﻿/, '').trim().split('\r\n').map((r) => r.split(';'))

it('only a signed-in admin gets the file', async () => {
  await place('a-1')
  expect((await get('')).status).toBe(401)
  expect((await get('', `${ADMIN_COOKIE}=forged.123.abc`)).status).toBe(401)
})

it('exports the ticked orders only, one row each, ready for Excel', async () => {
  const a = await place('t-1')
  const b = await place('t-2', { notes: '=HYPERLINK("x")' })
  await place('t-3')
  const cookie = `${ADMIN_COOKIE}=${await createAdminSession('admin')}`
  const res = await get(`?ids=${a.id}&ids=${b.id}&ids=not-a-uuid`, cookie)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/csv')
  expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="comenzi-\d{4}-\d{2}-\d{2}\.csv"/)
  expect(res.body.startsWith('﻿')).toBe(true)
  const r = rows(res.body)
  expect(r[0].slice(0, 3)).toEqual(['Comanda', 'Data', 'Site'])
  expect(r.slice(1).map((x) => x[0]).sort()).toEqual([a.orderNumber, b.orderNumber].sort())
  const total = r[0].indexOf('Total')
  const row = r.find((x) => x[0] === a.orderNumber)!
  expect(row[total]).toBe((a.totalMinor / 100).toFixed(2).replace('.', ','))
  expect(row[r[0].indexOf('Bucăți')]).toBe('2')
  expect(row[r[0].indexOf('Email')]).toBe(person.email)
  // A note that looks like a formula stays text.
  expect(res.body).toContain(`"'=HYPERLINK(""x"")"`)
})

it('exports a period (Bucharest days) and refuses a malformed date', async () => {
  const a = await place('p-1')
  const cookie = `${ADMIN_COOKIE}=${await createAdminSession('admin')}`
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' })
  const r = rows((await get(`?de=${today}&pana=${today}`, cookie)).body)
  expect(r.slice(1).map((x) => x[0])).toEqual([a.orderNumber])
  expect(rows((await get('?de=2020-01-01&pana=2020-01-31', cookie)).body)).toHaveLength(1) // headers only
  expect((await get('?de=ieri', cookie)).status).toBe(400)
})
