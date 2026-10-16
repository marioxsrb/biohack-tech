/**
 * The book's PDF under real concurrency (a PostgreSQL server and a connection pool, which PGlite cannot show): racing
 * webhooks, racing deliveries and racing admin clicks grant once and queue one email. Runs only with TEST_DATABASE_URL:
 *   createdb biohack_test && TEST_DATABASE_URL=postgres://localhost/biohack_test npx vitest run tests/server/book-postgres.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const url = process.env.TEST_DATABASE_URL
const { TEST_ENV, person, lines } = await import('./helpers')
const { resetConfig } = await import('@/server/config')
const { migrate, postgres, setDb } = await import('@/server/db')
const { ensureStoreSettings } = await import('@/server/store-settings')
const svc = await import('@/server/orders/service')
const { adminSendDigital } = await import('@/server/digital/delivery')

const ENV = {
  ...TEST_ENV,
  EMAIL_TRANSPORT: 'file',
  NEUROS_BOOK_PDF_URL: 'https://neuros.test/api/carte/partener/pdf',
  NEUROS_BOOK_PDF_SECRET: 's'.repeat(40),
  DIGITAL_LINK_SECRET: 'l'.repeat(40),
}

describe.skipIf(!url)('the book on real PostgreSQL', () => {
  let db: Awaited<ReturnType<typeof postgres>>
  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
    resetConfig()
    db = await postgres(url!)
    await db.exec('drop schema public cascade; create schema public')
    await migrate(db)
    setDb(db)
    await ensureStoreSettings(0)
  })
  afterAll(async () => {
    setDb(undefined)
    await db?.close()
  })

  const count = async (sql: string, id: string) => Number((await db.query<{ n: string }>(sql, [id])).rows[0].n)
  const grants = (id: string) => count('select count(*) as n from digital_entitlements where order_id = $1', id)
  const emailJobs = (id: string) => count("select count(*) as n from jobs where kind = 'digital.email' and order_id = $1", id)

  it('ten simultaneous payment confirmations of a book order: one entitlement, one automatic email', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'carte-diana', quantity: 1 }]), form: person, attemptId: 'pg-book-card' })
    await svc.attachPaymentIntent(order.id, 'pi_pg_book')
    const r = await Promise.all(Array.from({ length: 10 }, () => svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: order.totalMinor, currency: 'ron', paymentIntentId: 'pi_pg_book' })))
    expect(r.filter((x) => x.changed)).toHaveLength(1)
    expect(await grants(order.id)).toBe(1)
    expect(await emailJobs(order.id)).toBe(1)
  })

  it('five simultaneous "delivered" clicks on a cash-on-delivery order: one entitlement', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'carte-diana', quantity: 2 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'pg-book-cod' })
    await svc.markShipped(order.id, 'admin', { courier: 'FAN Courier', trackingNumber: 'AWB-PG' })
    await Promise.all(Array.from({ length: 5 }, () => svc.markDelivered(order.id, 'admin')))
    expect(await grants(order.id)).toBe(1)
    expect(await emailJobs(order.id)).toBe(1)
  })

  it('five simultaneous manual sends: the first is queued, the others are refused while it is on its way', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'carte-diana', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'pg-book-transfer' })
    await svc.confirmPayment(order.id, 'admin')
    await db.query("update jobs set status = 'done' where kind = 'digital.email' and order_id = $1", [order.id])
    const r = await Promise.all(Array.from({ length: 5 }, () => adminSendDigital(order.id, 'admin:test', true)))
    expect(r.filter((x) => x.ok)).toHaveLength(1)
    expect(await count("select count(*) as n from jobs where kind = 'digital.email' and order_id = $1 and dedupe_key like '%:manual:%'", order.id)).toBe(1)
  })
})
