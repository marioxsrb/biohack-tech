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
const { captureLead, CART_INTEREST } = await import('@/server/leads')

describe.skipIf(!url)('on real PostgreSQL', () => {
  let db: Awaited<ReturnType<typeof postgres>>
  beforeAll(async () => {
    for (const [k, v] of Object.entries(TEST_ENV)) vi.stubEnv(k, v)
    resetConfig()
    db = await postgres(url!)
    await db.exec('drop schema public cascade; create schema public')
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

  it('a promo code limited to 3 uses: ten simultaneous orders, three get it', async () => {
    const { promoCodes } = await import('@/server/promo')
    await promoCodes.create(db, { code: 'RACE3', kind: 'percent', value: 10, products: null, minOrderMinor: 0, startsAt: null, endsAt: null, maxUses: 3, oncePerEmail: false, note: null })
    const cart = lines([{ productId: 'brainlink-pro', quantity: 1 }])
    const res = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => svc.placeOrder({ lines: cart, form: { ...person, email: `race${i}@exemplu.ro` }, attemptId: `promo-race-${i}`, promoCode: 'RACE3' })))
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect(res.filter((r) => r.status === 'rejected' && r.reason instanceof svc.PromoError && r.reason.problem === 'used_up')).toHaveLength(7)
    expect((await promoCodes.uses(db, 'RACE3')).total).toBe(3)
  })

  it('the caller’s code BIOHACK10 (once per address): five simultaneous orders of one address use it once', async () => {
    const { promoCodes } = await import('@/server/promo')
    const cart = lines([{ productId: 'brainlink-pro', quantity: 1 }])
    const res = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => svc.placeOrder({ lines: cart, form: { ...person, email: 'oferta@exemplu.ro' }, attemptId: `offer-race-${i}`, promoCode: 'BIOHACK10' })))
    expect(res.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect((await promoCodes.uses(db, 'BIOHACK10', 'oferta@exemplu.ro')).byEmail).toBe(1)
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

  it('ten simultaneous submits of the same lead form give one lead and one set of follow-up jobs', async () => {
    vi.stubEnv('ABANDONED_CHECKOUT_ENABLED', 'true')
    resetConfig()
    const visitorId = crypto.randomUUID()
    const input = { visitorId, funnel: 'gated_price' as const, stage: 'lead' as const, productId: 'balance-wave', contact: { name: 'Ana Popescu', email: 'race@exemplu.ro', phone: '0722123456' }, marketingConsent: true }
    const res = await Promise.all(Array.from({ length: 10 }, () => db.tx((t) => captureLead(t, input))))
    expect(new Set(res.map((r) => r.lead.id)).size).toBe(1)
    expect(res.filter((r) => r.created)).toHaveLength(1)
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from jobs where payload->>'leadId' = $1 and kind = 'lead.recovery'`, [res[0].lead.id])
    expect(rows[0].n).toBe(2)
    // A checkout lead next to it, with a different interest key.
    await db.tx((t) => captureLead(t, { ...input, stage: 'checkout_started', productId: CART_INTEREST, cart: [{ productId: 'balance-wave', quantity: 1 }] }))
    expect((await db.query<{ n: number }>('select count(*)::int as n from leads where visitor_id = $1', [visitorId])).rows[0].n).toBe(2)
  })

  it('lead tables are closed to the public Supabase roles (row level security on, no policies)', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(`select relname, relrowsecurity from pg_class where relname in ('leads', 'funnel_visits') order by relname`)
    expect(rows).toEqual([
      { relname: 'funnel_visits', relrowsecurity: true },
      { relname: 'leads', relrowsecurity: true },
    ])
    expect((await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where tablename in ('leads', 'funnel_visits')`)).rows[0].n).toBe(0)
  })
})

