/**
 * Promo codes on the real catalog prices: stacking after the automatic promotions (business decision 14.10.2026),
 * percent and fixed, products and minimum order, dates, usage limit (also under concurrency), once per email, a
 * cancelled order freeing its use, the same total in the order, Stripe, the FGO lines, and the checkout's errors
 * in the visitor's language. Stripe is stubbed at the HTTP boundary; PGlite database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const { orders } = await import('@/server/orders/repository')
const { getConfig } = await import('@/server/config')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { priceLines } = await import('@/lib/promotions')
const { promoCodes } = await import('@/server/promo')
const svc = await import('@/server/orders/service')
const { POST: checkout } = await import('@/app/api/checkout/route')
const { POST: preview } = await import('@/app/api/promo/route')

const BASE = Object.fromEntries(Object.entries(TEST_ENV).filter(([k]) => !k.startsWith('GHL_')))

let db: Awaited<ReturnType<typeof freshDb>>
let piAmounts: number[]
let ip = 0

beforeEach(async () => {
  db = await freshDb({ ...BASE, EMAIL_TRANSPORT: 'smtp' })
  piAmounts = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/v1/customers')) return json({ id: 'cus_1' })
    if (url.endsWith('/v1/payment_intents') && init.method === 'POST') {
      const f = new URLSearchParams(String(init.body))
      const amount = Number(f.get('amount'))
      piAmounts.push(amount)
      return json({ id: `pi_${piAmounts.length}`, status: 'requires_payment_method', amount, currency: 'ron', client_secret: 'cs', metadata: { order_id: f.get('metadata[order_id]') } })
    }
    return json({ message: 'not mocked' }, 404)
  })
})
afterEach(() => vi.unstubAllGlobals())

const req = (url: string, body: unknown, referer?: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.11.0.${++ip}`, ...(referer && { referer }) }, body: JSON.stringify(body) }) as NextRequest
type L = { productId: string; variantId?: string; quantity: number }
const CALM = (quantity: number): L => ({ productId: 'balance-wave', quantity })
const FOCUS = (quantity: number): L => ({ productId: 'brainlink-pro', quantity })
const AMBER = (quantity: number): L => ({ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity })

async function buy(lines: L[], promoCode?: string, opts: { method?: 'card' | 'transfer' | 'cod'; email?: string; locale?: string; referer?: string } = {}) {
  const res = await checkout(
    req('https://biohack-tech.ro/api/checkout', { lines, order: { ...person, email: opts.email ?? person.email, paymentMethod: opts.method ?? 'cod' }, acceptedTerms: true, attemptId: `p-${Math.random()}`, promoCode, ...(opts.locale && { locale: opts.locale }) }, opts.referer),
  )
  return { status: res.status, data: await res.json() }
}
const order = async (n: string) => (await orders.byNumber(db, n))!
const code = (c: Partial<Parameters<typeof promoCodes.create>[1]> & { code: string }) =>
  promoCodes.create(db, { kind: 'percent', value: 10, products: null, minOrderMinor: 0, startsAt: null, endsAt: null, maxUses: null, oncePerEmail: false, note: null, ...c })

describe('pricing (pure)', () => {
  const lines = (l: [string, number, number][]) => l.map(([productId, quantity, unitAmount], i) => ({ key: String(i), productId, quantity, unitAmount }))

  it('adds to the automatic promotion: 3 × Calm 20% + code 10% = 30% of the full price', () => {
    const p = priceLines(lines([['balance-wave', 3, 638000]]), undefined, { code: 'X10', kind: 'percent', value: 10, products: null, minOrderMinor: 0 })
    expect(p.promotions.map((x) => [x.id, x.amountMinor])).toEqual([
      ['trei-produse-20:balance-wave', 382800],
      ['cod:X10', 191400],
    ])
    expect(p.totalMinor).toBe(1914000 - 574200)
    expect(p.lineCodeDiscounts['0']).toBe(191400)
  })

  it('the launch emails: 1 piece 10%, 2 of the same 20%, 3+ 30%', () => {
    const rule = { code: 'NEUROS10', kind: 'percent' as const, value: 10, products: null, minOrderMinor: 0 }
    for (const [q, pct] of [[1, 10], [2, 20], [3, 30], [4, 30]] as const) {
      const p = priceLines(lines([['brainlink-pro', q, 180000]]), undefined, rule)
      expect(p.discountMinor, `${q} × Focus`).toBe((180000 * q * pct) / 100)
    }
    // Amber: 3 pairs for the price of 2, plus 10% of the full price.
    const amber = priceLines(lines([['ochelari-biohack', 3, 31500]]), undefined, rule)
    expect(amber.discountMinor).toBe(31500 + 9450)
  })

  it('fixed amount: never more than what is left; split over eligible lines only', () => {
    const p = priceLines(lines([['balance-wave', 1, 638000], ['brainlink-pro', 1, 180000]]), undefined, { code: 'F', kind: 'fixed', value: 200000, products: ['brainlink-pro'], minOrderMinor: 0 })
    expect(p.code).toEqual({ code: 'F', amountMinor: 180000 })
    expect(p.lineCodeDiscounts).toEqual({ '1': 180000 })
    expect(p.totalMinor).toBe(638000)
  })

  it('minimum order (after automatic promotions) and products not in the cart: no discount, the reason is given', () => {
    const rule = { code: 'M', kind: 'percent' as const, value: 10, products: null, minOrderMinor: 200000 }
    expect(priceLines(lines([['brainlink-pro', 1, 180000]]), undefined, rule).code).toEqual({ code: 'M', amountMinor: 0, problem: 'min_order' })
    expect(priceLines(lines([['brainlink-pro', 1, 180000]]), undefined, { ...rule, minOrderMinor: 0, products: ['balance-wave'] }).code?.problem).toBe('no_products')
  })
})

describe('orders with a code', () => {
  it('one total everywhere: order, items, FGO lines (with the code named), Stripe amount', async () => {
    await code({ code: 'VARA10' })
    const { status, data } = await buy([CALM(3), AMBER(3)], 'vara10', { method: 'card' })
    expect(status).toBe(200)
    const o = await order(data.orderNumber)
    expect(o.promoCode).toBe('VARA10')
    expect(o.promotions.find((p) => p.id === 'cod:VARA10')).toBeTruthy()
    expect(o.items.reduce((s, i) => s + i.lineTotalMinor - i.discountMinor, 0)).toBe(o.totalMinor)
    const lines = invoicePayload(getConfig().fgo!, o).Continut
    expect(Math.round(lines.reduce((s, l) => s + l.PretTotal * 100, 0))).toBe(o.totalMinor)
    expect(lines[0].Denumire).toMatch(/20% la 3 bucăți: -\d+\.\d{2} lei, cod VARA10: -\d+\.\d{2} lei/)
    expect(piAmounts.at(-1)).toBe(o.totalMinor)
  })

  it('works for every payment method; without a code nothing changes', async () => {
    await code({ code: 'TOATE', kind: 'fixed', value: 5000 })
    for (const method of ['card', 'transfer', 'cod'] as const) {
      const { data } = await buy([FOCUS(1)], 'TOATE', { method })
      expect((await order(data.orderNumber)).totalMinor).toBe(180000 - 5000)
    }
    const { data } = await buy([FOCUS(1)])
    const plain = await order(data.orderNumber)
    expect([plain.totalMinor, plain.promoCode]).toEqual([180000, null])
  })

  it('refused codes: unknown, inactive, not started, expired, wrong products, under the minimum', async () => {
    await code({ code: 'OPRIT' })
    await promoCodes.setActive(db, 'OPRIT', false)
    await code({ code: 'VIITOR', startsAt: new Date(Date.now() + 86_400_000) })
    await code({ code: 'VECHI', endsAt: new Date(Date.now() - 1000) })
    await code({ code: 'DOARCALM', products: ['balance-wave'] })
    await code({ code: 'MIN2000', minOrderMinor: 200000 })
    const msg = async (c: string, lines: L[] = [FOCUS(1)]) => {
      const r = await buy(lines, c)
      expect(r.status).toBe(422)
      expect(r.data.error).toBe('PROMO')
      return r.data.fields.promoCode as string
    }
    expect(await msg('NUEXISTA')).toMatch(/nu există/)
    expect(await msg('OPRIT')).toMatch(/nu mai este activ/)
    expect(await msg('VIITOR')).toMatch(/nu este încă activ/)
    expect(await msg('VECHI')).toMatch(/a expirat/)
    expect(await msg('DOARCALM')).toMatch(/doar NEUROS Calm/)
    expect(await msg('MIN2000')).toMatch(/2\.000 lei/)
    expect(await db.query('select 1 from orders')).toMatchObject({ rows: [] })
  })

  it('usage limit: the last use goes to one order only, even at the same moment', async () => {
    await code({ code: 'PRIMII2', maxUses: 2 })
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => buy([FOCUS(1)], 'PRIMII2', { email: `client${i}@exemplu.ro` })))
    expect(results.filter((r) => r.status === 200)).toHaveLength(2)
    expect(results.filter((r) => r.status === 422).every((r) => /numărul maxim/.test(r.data.message))).toBe(true)
  })

  it('once per email; a cancelled order frees its use', async () => {
    await code({ code: 'UNA', oncePerEmail: true })
    const first = await buy([FOCUS(1)], 'UNA')
    expect(first.status).toBe(200)
    expect((await buy([FOCUS(1)], 'UNA')).data.message).toMatch(/Ai folosit deja/)
    expect((await buy([FOCUS(1)], 'UNA', { email: 'altcineva@exemplu.ro' })).status).toBe(200)
    await svc.cancelOrder((await order(first.data.orderNumber)).id, 'admin', 'test')
    expect((await buy([FOCUS(1)], 'UNA')).status).toBe(200)
  })

  it('the admin list counts standing uses and the discount given', async () => {
    await code({ code: 'NUMARA', kind: 'fixed', value: 1000 })
    await buy([FOCUS(1)], 'NUMARA')
    await buy([FOCUS(1)], 'NUMARA', { email: 'b@exemplu.ro' })
    const c = (await promoCodes.list(db)).find((x) => x.code === 'NUMARA')!
    expect([c.uses, c.discountMinor, c.revenueMinor]).toEqual([2, 2000, 2 * (180000 - 1000)])
  })
})

describe('preview (/api/promo)', () => {
  it('returns the rule for the current cart, or the reason in the checkout language', async () => {
    await code({ code: 'ARATA', products: ['balance-wave'] })
    const ok = await preview(req('https://biohack-tech.ro/api/promo', { code: 'arata', lines: [CALM(1)] }))
    expect(await ok.json()).toMatchObject({ ok: true, rule: { code: 'ARATA', kind: 'percent', value: 10 }, discountMinor: 63800 })
    const en = await preview(req('https://biohack-tech.ro/api/promo', { code: 'ARATA', lines: [FOCUS(1)], locale: 'en' }))
    expect(en.status).toBe(422)
    expect((await en.json()).message).toMatch(/does not apply to the products in your cart \(only NEUROS Calm\)/)
  })
})

describe('checkout errors in the visitor language', () => {
  it('the English checkout gets English messages and English field errors; the Romanian one Romanian', async () => {
    const bad = { lines: [FOCUS(1)], order: { ...person, email: 'nu-e-email', paymentMethod: 'cod' }, acceptedTerms: false, attemptId: 'x-12345678' }
    const en = await (await checkout(req('https://biohack-tech.ro/api/checkout', { ...bad, locale: 'en' }))).json()
    expect(en.message).toBe('Please check the fields marked in the form.')
    expect(en.fields.acceptedTerms).toBe('Tick the box to accept the terms and place your order.')
    const ro = await (await checkout(req('https://biohack-tech.ro/api/checkout', bad))).json()
    expect(ro.message).toBe('Verifică câmpurile marcate în formular.')
    expect((await (await checkout(req('https://biohack-tech.ro/api/checkout', { lines: [] }, 'https://biohack-tech.ro/en/checkout'))).json()).message).toBe('Your cart is empty.')
    // English pages pay in euro or dollars, by card only.
    expect((await buy([FOCUS(1)], 'NUEXISTA', { locale: 'en', method: 'card' })).data.message).toMatch(/does not exist/)
    expect((await buy([FOCUS(1)], undefined, { locale: 'en', method: 'cod' })).data.fields.paymentMethod).toBeTruthy()
  })
})
