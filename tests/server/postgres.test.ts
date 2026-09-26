/**
 * The same guarantees on a real PostgreSQL server with a connection pool (several
 * connections racing), which PGlite cannot show. Runs only when TEST_DATABASE_URL is set:
 *   createdb biohack_test && TEST_DATABASE_URL=postgres://localhost/biohack_test npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))

const url = process.env.TEST_DATABASE_URL
const { TEST_ENV, person, lines } = await import('./helpers')
const { resetConfig } = await import('@/server/config')
const { migrate, postgres, setDb } = await import('@/server/db')
const svc = await import('@/server/orders/service')
const { jobs } = await import('@/server/jobs/outbox')

describe.skipIf(!url)('on real PostgreSQL', () => {
  let db: Awaited<ReturnType<typeof postgres>>
  beforeAll(async () => {
    for (const [k, v] of Object.entries(TEST_ENV)) vi.stubEnv(k, v)
    resetConfig()
    db = await postgres(url!)
    await db.exec('drop table if exists jobs, webhook_events, order_events, order_items, orders, schema_migrations cascade; drop sequence if exists order_seq')
    await migrate(db)
    await Promise.all([migrate(db), migrate(db)]) // concurrent boots
    setDb(db)
  })
  afterAll(async () => {
    setDb(undefined)
    await db?.close()
  })

  it('ten simultaneous submits of one attempt create one order', async () => {
    const cart = lines([{ productId: 'brainlink-pro', quantity: 1 }])
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.placeOrder({ lines: cart, form: person, attemptId: 'race-attempt' })))
    expect(new Set(results.map((r) => r.order.id)).size).toBe(1)
    expect(results.filter((r) => r.created)).toHaveLength(1)
  })

  it('ten simultaneous payment confirmations change the order once and queue one invoice', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: person, attemptId: 'race-pay' })
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })))
    expect(results.filter((r) => r.changed)).toHaveLength(1)
    const list = await jobs.forOrder(db, order.id)
    expect(list.filter((j) => j.kind === 'fgo.invoice')).toHaveLength(1)
  })

  it('two workers never claim the same job', async () => {
    const [a, b] = await Promise.all([jobs.claim(db, 50), jobs.claim(db, 50)])
    const ids = [...a, ...b].map((j) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('order numbers stay unique under load', async () => {
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: `load-${i}` })))
    const nums = res.map((r) => r.order.orderNumber)
    expect(new Set(nums).size).toBe(20)
  })
})
