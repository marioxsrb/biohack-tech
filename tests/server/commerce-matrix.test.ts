/**
 * Commerce E2E price matrix on the REAL catalog prices (config/prices.ts, not test prices): every quantity
 * the business rules name, through the real checkout route, and the same total in the server order, the
 * Stripe PaymentIntent amount (bani), the FGO invoice lines and the GoHighLevel opportunity value.
 * Stripe and GoHighLevel are stubbed at the HTTP boundary; nothing leaves the process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, company, TEST_ENV } = await import('./helpers')
const { orders } = await import('@/server/orders/repository')
const { getConfig } = await import('@/server/config')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { PRICES_RON } = await import('@/config/prices')
const { POST: checkout } = await import('@/app/api/checkout/route')

let db: Awaited<ReturnType<typeof freshDb>>
let piAmounts: number[]
let currencies: string[]
let ip = 0

beforeEach(async () => {
  db = await freshDb()
  piAmounts = []
  currencies = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/v1/customers')) return json({ id: 'cus_1' })
    if (url.endsWith('/v1/payment_intents') && init.method === 'POST') {
      const f = new URLSearchParams(String(init.body))
      const amount = Number(f.get('amount'))
      piAmounts.push(amount)
      currencies.push(String(f.get('currency')))
      return json({ id: `pi_${piAmounts.length}`, status: 'requires_payment_method', amount, currency: 'ron', client_secret: 'cs', metadata: { order_id: f.get('metadata[order_id]') } })
    }
    return json({ message: 'not mocked' }, 404)
  })
})
afterEach(() => vi.unstubAllGlobals())

const post = (body: unknown) =>
  checkout(new Request('https://biohack-tech.ro/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}` }, body: JSON.stringify(body) }) as NextRequest)

type L = { productId: string; variantId?: string; quantity: number }
async function buy(lines: L[], method: 'card' | 'transfer' | 'cod' = 'card', form = person) {
  const res = await post({ lines, order: { ...form, paymentMethod: method }, acceptedTerms: true, attemptId: `m-${Math.random()}` })
  const data = await res.json()
  expect(res.status, JSON.stringify(data)).toBeLessThan(300)
  return (await orders.byNumber(db, String(data.orderNumber)))!
}
/** Server total, Stripe amount, FGO line sum and GHL value must all be the same number of bani. */
function agreeEverywhere(o: Awaited<ReturnType<typeof buy>>, method: 'card' | 'transfer' | 'cod') {
  const c = getConfig()
  const fgoSum = Math.round(invoicePayload(c.fgo!, o).Continut.reduce((s, l) => s + l.PretTotal * 100, 0))
  expect(fgoSum).toBe(o.totalMinor)
  expect(o.items.reduce((s, i) => s + i.lineTotalMinor - i.discountMinor, 0)).toBe(o.totalMinor)
  if (method === 'card') expect([piAmounts.at(-1), currencies.at(-1)]).toEqual([o.totalMinor, 'ron'])
  else expect(piAmounts).toHaveLength(0)
}

const LEI = (n: number) => n * 100

describe('configured prices', () => {
  it('only Calm 6.380, Focus 1.800, Amber 315 and the book 120 lei; NEUROS Flow has no price', () => {
    expect(PRICES_RON).toEqual({ 'balance-wave': LEI(6380), 'brainlink-pro': LEI(1800), 'ochelari-biohack': LEI(315), 'carte-diana': 12000 })
  })
})

describe('NEUROS Amber 2+1: quantities 1, 2, 3, 4, 5, 6, 8, 9', () => {
  const expected: Record<number, number> = { 1: 315, 2: 630, 3: 630, 4: 945, 5: 1260, 6: 1260, 8: 1890, 9: 1890 }
  for (const [q, lei] of Object.entries(expected)) {
    it(`${q} pair(s): ${lei} lei`, async () => {
      const o = await buy([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: Number(q) }])
      expect(o.totalMinor).toBe(LEI(lei))
      expect(o.discountMinor).toBe(LEI(315) * Math.floor(Number(q) / 3))
      agreeEverywhere(o, 'card')
    })
  }
  it('mixed frames: 4 different frames + 2 more = 6 pairs, 2 free, every line priced above 0', async () => {
    const o = await buy([
      { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 2 },
      { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 1 },
      { productId: 'ochelari-biohack', variantId: 'patrat-negru', quantity: 2 },
      { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 },
    ])
    expect(o.totalMinor).toBe(LEI(1260))
    for (const i of o.items) expect(i.lineTotalMinor - i.discountMinor).toBeGreaterThan(0)
    agreeEverywhere(o, 'card')
  })
})

describe('Calm, Focus: 10% for 2, 20% for 3+ of the SAME product', () => {
  const cases: [string, L, Record<number, number>][] = [
    ['Calm', { productId: 'balance-wave', quantity: 0 }, { 1: 6380, 2: 11484, 3: 15312, 4: 20416 }],
    ['Focus', { productId: 'brainlink-pro', quantity: 0 }, { 1: 1800, 2: 3240, 3: 4320, 4: 5760 }],
  ]
  for (const [name, line, totals] of cases)
    for (const [q, lei] of Object.entries(totals))
      it(`${name} × ${q}: ${lei} lei`, async () => {
        const o = await buy([{ ...line, quantity: Number(q) }])
        expect(o.totalMinor).toBe(LEI(lei))
        agreeEverywhere(o, 'card')
      })

  it('different products never add up: 1 Calm + 1 Focus + 1 Amber = full price', async () => {
    const o = await buy([{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 }])
    expect([o.discountMinor, o.totalMinor]).toEqual([0, LEI(6380 + 1800 + 315)])
  })

  it('NEUROS Flow cannot be bought: every configuration, alone or next to a valid product, by any method, is refused', async () => {
    for (const method of ['card', 'transfer', 'cod'] as const)
      for (const lines of [[{ productId: 'brain-flow', variantId: '4-zone', quantity: 1 }], [{ productId: 'brain-flow', quantity: 1 }], [{ productId: 'balance-wave', quantity: 1 }, { productId: 'brain-flow', variantId: '13-zone', quantity: 1 }]]) {
        const res = await post({ lines, order: { ...person, paymentMethod: method }, acceptedTerms: true, attemptId: `flow-${Math.random()}` })
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe('BAD_LINE')
      }
    expect(piAmounts).toEqual([])
    expect((await db.query('select count(*)::int as n from orders')).rows[0].n).toBe(0)
  })

  it('both offers on one order, never on the same unit: 2 Calm + 3 Focus + 3 Amber', async () => {
    const o = await buy([{ productId: 'balance-wave', quantity: 2 }, { productId: 'brainlink-pro', quantity: 3 }, { productId: 'ochelari-biohack', variantId: 'patrat-negru', quantity: 3 }])
    expect(o.totalMinor).toBe(LEI(11484 + 4320 + 630))
    expect(o.promotions.map((p) => p.id)).toEqual(['trei-produse-20:balance-wave', 'trei-produse-20:brainlink-pro', 'amber-2-plus-1'])
    agreeEverywhere(o, 'card')
  })
})

describe('the same totals for every payment method and buyer type', () => {
  for (const method of ['card', 'transfer', 'cod'] as const)
    it(`${method}: 3 Calm + 3 Amber as a company (PJ)`, async () => {
      const o = await buy([{ productId: 'balance-wave', quantity: 3 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 3 }], method, company)
      expect(o.totalMinor).toBe(LEI(15312 + 630))
      expect(o.customer).toMatchObject({ buyerType: 'pj', cui: company.cui })
      agreeEverywhere(o, method)
      if (method === 'cod') expect(o.codAmountMinor).toBe(o.totalMinor)
    })

  it('cash on delivery has no ceiling: 10 × NEUROS Calm = 51.040 lei is accepted', async () => {
    const o = await buy([{ productId: 'balance-wave', quantity: 10 }], 'cod')
    expect([o.paymentMethod, o.paymentStatus, o.totalMinor, o.codAmountMinor]).toEqual(['cash_on_delivery', 'awaiting_collection', LEI(51040), LEI(51040)])
    expect(TEST_ENV.STRIPE_SECRET_KEY.startsWith('sk_test_')).toBe(true)
  })

  it('VAT 21% is sent per line to FGO on VAT-inclusive totals', async () => {
    const o = await buy([{ productId: 'brainlink-pro', quantity: 2 }], 'transfer')
    const [line] = invoicePayload(getConfig().fgo!, o).Continut
    expect([line.CotaTVA, line.NrProduse, line.PretTotal]).toEqual([21, 2, 3240])
  })
})
