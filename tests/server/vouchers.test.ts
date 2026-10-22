/**
 * Personal vouchers and gifts end to end (server/vouchers.ts, server/codes.ts, orders/service.ts): issued once per
 * contact and product, reused instead of duplicated, used through the checkout's code field by its own address only,
 * one order at a time (also under concurrency), released when the order stops standing and taken back by a late
 * payment, expired, revoked; the same totals in the order, the FGO lines and Stripe; gifts at 0 lei with delivery paid.
 * Stripe is stubbed at the HTTP boundary; PGlite database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const { freshDb, person, TEST_ENV } = await import('./helpers')
const { orders } = await import('@/server/orders/repository')
const { getConfig } = await import('@/server/config')
const { invoicePayload, fgoLineTotal } = await import('@/server/integrations/fgo')
const v = await import('@/server/vouchers')
const svc = await import('@/server/orders/service')
const { POST: checkout } = await import('@/app/api/checkout/route')
const { POST: preview } = await import('@/app/api/promo/route')

const BASE = Object.fromEntries(Object.entries(TEST_ENV).filter(([k]) => !k.startsWith('GHL_')))

let db: Awaited<ReturnType<typeof freshDb>>
let piAmounts: number[]
let ip = 0

beforeEach(async () => {
  db = await freshDb({ ...BASE, EMAIL_TRANSPORT: 'smtp', BOOK_SALES_ENABLED: 'true' })
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

const req = (url: string, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.12.0.${++ip}` }, body: JSON.stringify(body) }) as NextRequest
type L = { productId: string; variantId?: string; quantity: number }
const CALM = (quantity: number): L => ({ productId: 'balance-wave', quantity })
const FOCUS = (quantity: number): L => ({ productId: 'brainlink-pro', quantity })
const AMBER = (quantity: number, variantId = 'cat-eye-negru'): L => ({ productId: 'ochelari-biohack', variantId, quantity })

async function buy(lines: L[], promoCode?: string, opts: { method?: 'card' | 'transfer' | 'cod'; email?: string; phone?: string; address?: string; locale?: string } = {}) {
  const res = await checkout(
    req('https://biohack-tech.ro/api/checkout', {
      lines,
      order: { ...person, email: opts.email ?? person.email, phone: opts.phone ?? person.phone, address: opts.address ?? person.address, paymentMethod: opts.method ?? 'cod' },
      acceptedTerms: true,
      attemptId: `v-${Math.random()}`,
      promoCode,
      ...(opts.locale && { locale: opts.locale }),
    }),
  )
  return { status: res.status, data: await res.json() }
}
const order = async (n: string) => (await orders.byNumber(db, n))!
const issue = async (productId: string, opts: Partial<Parameters<typeof v.issueVoucher>[1]> = {}) => {
  const r = await v.issueVoucher(db, { email: person.email, productId, source: 'landing-calm', ...opts })
  if (!r.ok) throw new Error(r.reason)
  return r.voucher
}
const history = async (id: string) => (await v.voucherHistory(db, id)).map((e) => e.type)

describe('issuing', () => {
  it('Calm 640, Focus 325, Amber 30 lei, with the source validity; the code is upper case letters and digits', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    const calm = await issue('balance-wave', { now })
    const focus = await issue('brainlink-pro', { source: 'landing-focus', now })
    const amber = await issue('ochelari-biohack', { source: 'landing-amber', now })
    expect([calm.amountMinor, focus.amountMinor, amber.amountMinor]).toEqual([64000, 32500, 3000])
    expect([amber.perPaidUnit, amber.maxUnits]).toEqual([true, null])
    expect(calm.expiresAt.getTime() - now.getTime()).toBe(30 * 86_400_000)
    for (const x of [calm, focus, amber]) expect(x.code).toMatch(/^BTV[CFA][A-Z0-9]{8}$/)
    expect(await history(calm.id)).toEqual(['issued'])
  })

  it('never two active vouchers for the same contact and product: the active one is reused (also concurrently)', async () => {
    const all = await Promise.all(Array.from({ length: 6 }, () => v.issueVoucher(db, { email: ' Ana@Exemplu.ro ', productId: 'balance-wave', source: 'landing-calm' })))
    const ids = new Set(all.map((r) => (r.ok ? r.voucher.id : r.reason)))
    expect(ids.size).toBe(1)
    expect((await db.query("select count(*)::int n from vouchers")).rows[0].n).toBe(1)
  })

  it('the same reason issues once (source + reference), even after the first one was used', async () => {
    const a = await issue('balance-wave', { source: 'abandoned-cart', sourceRef: 'checkout-1' })
    await db.query("update vouchers set status = 'used' where id = $1", [a.id])
    const b = await v.issueVoucher(db, { email: person.email, productId: 'balance-wave', source: 'abandoned-cart', sourceRef: 'checkout-1' })
    expect(b.ok && b.voucher.id).toBe(a.id)
  })

  it('not after buying the product, and not after using a voucher for it; the book has no voucher', async () => {
    await buy([FOCUS(1)])
    expect(await v.issueVoucher(db, { email: person.email, productId: 'brainlink-pro', source: 'landing-focus' })).toEqual({ ok: false, reason: 'already_bought' })
    const calm = await issue('balance-wave')
    expect((await buy([CALM(1)], calm.code, { method: 'transfer' })).status).toBe(200)
    await db.query("delete from order_items where product_id = 'balance-wave'") // only the voucher's use is left to say it
    expect(await v.issueVoucher(db, { email: person.email, productId: 'balance-wave', source: 'win-back' })).toEqual({ ok: false, reason: 'already_used' })
    expect(await v.issueVoucher(db, { email: person.email, productId: 'carte-diana', source: 'landing-calm' })).toEqual({ ok: false, reason: 'not_voucher_product' })
  })
})

describe('using a voucher in the checkout', () => {
  it('Calm 640 lei: one total in the order, the items, FGO (named) and Stripe', async () => {
    const calm = await issue('balance-wave')
    const { status, data } = await buy([CALM(1)], calm.code.toLowerCase(), { method: 'card' })
    expect(status).toBe(200)
    const o = await order(data.orderNumber)
    expect(o.totalMinor).toBe(638000 - 64000)
    expect(o.voucherId).toBe(calm.id)
    expect(o.promoCode).toBe(calm.code)
    expect(o.items.reduce((s, i) => s + i.lineTotalMinor - i.discountMinor, 0)).toBe(o.totalMinor)
    const lines = invoicePayload(getConfig().fgo!, o).Continut
    expect(Math.round(lines.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(o.totalMinor)
    expect(piAmounts.at(-1)).toBe(o.totalMinor)
    const used = (await v.voucherById(db, calm.id))!
    expect([used.status, used.orderId]).toEqual(['used', o.id])
    expect(await history(calm.id)).toEqual(['issued', 'used'])
  })

  it('NEUROS Amber 2+1 + 30 lei per paid pair: 3 pairs = 570 lei, the free pair without the 30 lei', async () => {
    const amber = await issue('ochelari-biohack', { source: 'landing-amber' })
    const { data } = await buy([AMBER(2), AMBER(1, 'patrat-maro')], amber.code, { method: 'card' })
    const o = await order(data.orderNumber)
    expect(o.totalMinor).toBe(57000)
    expect(o.promotions.map((p) => [p.id, p.amountMinor])).toEqual([
      ['amber-2-plus-1', 31500],
      [`cod:${amber.code}`, 6000],
    ])
    expect(piAmounts.at(-1)).toBe(57000)
    const lines = invoicePayload(getConfig().fgo!, o).Continut
    expect(Math.round(lines.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(57000)
  })

  it.each([
    [4, 3 * 31500 - 3 * 3000],
    [6, 4 * 31500 - 4 * 3000],
    [7, 5 * 31500 - 5 * 3000],
  ])('NEUROS Amber %i pairs with the voucher: one free per complete group of 3, 30 lei on every paid pair (no cap)', async (q, total) => {
    const amber = await issue('ochelari-biohack', { source: 'landing-amber' })
    const { data } = await buy([AMBER(q - 1), AMBER(1, 'subtire-negru')], amber.code, { method: 'card' })
    const o = await order(data.orderNumber)
    expect(o.totalMinor).toBe(total)
    expect(piAmounts.at(-1)).toBe(total)
    expect(Math.round(invoicePayload(getConfig().fgo!, o).Continut.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(total)
  })

  it('personal: another address cannot use it, in the order nor in the preview', async () => {
    const calm = await issue('balance-wave')
    const other = await buy([CALM(1)], calm.code, { email: 'altcineva@exemplu.ro' })
    expect(other.status).toBe(422)
    expect(other.data.fields.promoCode).toMatch(/Codul este personal/)
    const p = await preview(req('https://biohack-tech.ro/api/promo', { code: calm.code, lines: [CALM(1)], email: 'altcineva@exemplu.ro' }))
    expect(p.status).toBe(422)
    expect((await v.voucherById(db, calm.id))!.status).toBe('active')
  })

  it('only on its product: a Calm voucher on a Focus cart is refused; in a mixed cart it lowers the Calm line only', async () => {
    const calm = await issue('balance-wave')
    expect((await buy([FOCUS(1)], calm.code)).data.fields.promoCode).toMatch(/doar NEUROS Calm/)
    const { data } = await buy([CALM(1), FOCUS(1), AMBER(3)], calm.code)
    const o = await order(data.orderNumber)
    expect(o.items.map((i) => [i.productId, i.codeDiscountMinor])).toEqual([
      ['balance-wave', 64000],
      ['brainlink-pro', 0],
      ['ochelari-biohack', 0],
    ])
    expect(o.totalMinor).toBe(638000 - 64000 + 322500 + 2 * 31500)
  })

  it('one order at a time: the same voucher placed by five orders at once goes to one', async () => {
    const calm = await issue('balance-wave')
    const results = await Promise.all(Array.from({ length: 5 }, () => buy([CALM(1)], calm.code)))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 422).every((r) => /Ai folosit deja/.test(r.data.fields.promoCode))).toBe(true)
  })

  it('in lei only: the international checkout refuses it', async () => {
    const calm = await issue('balance-wave')
    const r = await buy([CALM(1)], calm.code, { locale: 'en', method: 'card' })
    expect(r.status).toBe(422)
    expect((await v.voucherById(db, calm.id))!.status).toBe('active')
  })

  it('an expired voucher is refused (the expiry job marks it)', async () => {
    const calm = await issue('balance-wave', { now: new Date(Date.now() - 31 * 86_400_000) })
    expect((await buy([CALM(1)], calm.code)).data.fields.promoCode).toMatch(/a expirat/)
    expect(await v.expireVouchers(db)).toBe(1)
    expect((await v.voucherById(db, calm.id))!.status).toBe('expired')
  })
})

describe('the voucher follows its order', () => {
  it('a cancelled order gives it back; it can be used again', async () => {
    const calm = await issue('balance-wave')
    const first = await order((await buy([CALM(1)], calm.code)).data.orderNumber)
    await svc.cancelOrder(first.id, 'admin', 'test')
    expect((await v.voucherById(db, calm.id))!.status).toBe('active')
    expect((await buy([CALM(1)], calm.code)).status).toBe(200)
    expect(await history(calm.id)).toEqual(['issued', 'used', 'released', 'used'])
  })

  it('an abandoned card attempt gives it back; paid late, the order takes it back when still free', async () => {
    const calm = await issue('balance-wave')
    const o = await order((await buy([CALM(1)], calm.code, { method: 'card' })).data.orderNumber)
    await svc.attachPaymentIntent(o.id, 'pi_1')
    await svc.markAbandonedIfUnpaid(o.id)
    expect((await v.voucherById(db, calm.id))!.status).toBe('active')
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: o.totalMinor, currency: 'RON', paymentIntentId: 'pi_1' })
    const back = (await v.voucherById(db, calm.id))!
    expect([back.status, back.orderId]).toEqual(['used', o.id])
  })

  it('paid late after another order used it: both keep their price, the conflict is recorded', async () => {
    const calm = await issue('balance-wave')
    const a = await order((await buy([CALM(1)], calm.code, { method: 'card' })).data.orderNumber)
    await svc.attachPaymentIntent(a.id, 'pi_1')
    await svc.markAbandonedIfUnpaid(a.id)
    const b = await order((await buy([CALM(1)], calm.code, { method: 'transfer' })).data.orderNumber)
    await svc.confirmPayment(a.id, 'stripe.webhook', { amountMinor: a.totalMinor, currency: 'RON', paymentIntentId: 'pi_1' })
    const now = (await v.voucherById(db, calm.id))!
    expect(now.orderId).toBe(b.id)
    expect(await history(calm.id)).toContain('conflict')
    expect((await orders.events(db, a.id)).map((e) => e.type)).toContain('voucher.conflict')
  })

  it('paid after the order was cancelled (to refund): the voucher stays free for the customer', async () => {
    const calm = await issue('balance-wave')
    const o = await order((await buy([CALM(1)], calm.code, { method: 'card' })).data.orderNumber)
    await svc.attachPaymentIntent(o.id, 'pi_1')
    await svc.cancelOrder(o.id, 'admin', 'test')
    await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: o.totalMinor, currency: 'RON', paymentIntentId: 'pi_1' })
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('paid')
    expect((await v.voucherById(db, calm.id))!.status).toBe('active')
  })

  it('a full refund gives it back; a partial one keeps it used; past its expiry it becomes expired', async () => {
    const calm = await issue('balance-wave')
    const o = await order((await buy([CALM(1)], calm.code, { method: 'transfer' })).data.orderNumber)
    await svc.confirmPayment(o.id, 'admin')
    await svc.recordRefund(o.id, 'admin', 1000)
    expect((await v.voucherById(db, calm.id))!.status).toBe('used')
    await db.query('update vouchers set expires_at = now() - interval \'1 minute\' where id = $1', [calm.id])
    await svc.recordRefund(o.id, 'admin', o.totalMinor)
    expect((await v.voucherById(db, calm.id))!.status).toBe('expired')
  })
})

describe('expiry, revocation, restore', () => {
  it('the expiry job, a revoked voucher refused, a person can restore it', async () => {
    const a = await issue('balance-wave', { now: new Date(Date.now() - 31 * 86_400_000) })
    const b = await issue('brainlink-pro', { source: 'landing-focus' })
    expect(await v.expireVouchers(db)).toBe(1)
    expect((await v.voucherById(db, a.id))!.status).toBe('expired')
    expect(await v.revokeVoucher(db, b.id, 'admin', 'eroare')).toBe(true)
    expect((await buy([FOCUS(1)], b.code)).data.fields.promoCode).toMatch(/nu mai este activ/)
    expect(await v.restoreVoucher(db, b.id, 'admin', new Date(Date.now() + 86_400_000))).toBe(true)
    expect((await buy([FOCUS(1)], b.code)).status).toBe(200)
    expect(await history(b.id)).toEqual(['issued', 'revoked', 'restored', 'used'])
  })
})

describe('gifts (rewards): the product at 0 lei, the delivery paid', () => {
  it('a gift paid by card: the line at 0 lei, the delivery charged once; FGO and Stripe add up; once only', async () => {
    // (The book as a gift is priced the same way: tests/vouchers-engine.test.ts; its sale needs the PDF delivery set up.)
    const g = await v.issueVoucher(db, { email: person.email, productId: 'ochelari-biohack', kind: 'gift', source: 'review', sourceRef: 'order-1' })
    if (!g.ok) throw new Error(g.reason)
    expect(g.voucher.code).toMatch(/^BTGA/)
    const { status, data } = await buy([AMBER(1)], g.voucher.code, { method: 'card' })
    expect(status, JSON.stringify(data)).toBe(200)
    const o = await order(data.orderNumber)
    expect(o.items[0].lineTotalMinor - o.items[0].discountMinor).toBe(0)
    expect([o.shippingMinor, o.totalMinor]).toEqual([2500, 2500])
    expect(piAmounts.at(-1)).toBe(2500)
    const lines = invoicePayload(getConfig().fgo!, o).Continut
    expect(Math.round(lines.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(2500)
    expect(lines[0].Denumire).toMatch(/Cadou NEUROS Amber/)
    // If FGO / e-Factura refuse zero-value lines (FGO_GIFT_LINES=discount): full price + its own negative gift line.
    const alt = invoicePayload({ ...getConfig().fgo!, giftLines: 'discount' }, o).Continut
    expect(alt.map((l) => [l.CodArticol, fgoLineTotal(l)])).toEqual([[o.items[0].sku, 315], ['cadou', -315], ['transport', 25]])
    // FGO API v7.1: a negative article = positive unit price, negative quantity, classic direction (no PretTotal).
    expect(alt[1]).toMatchObject({ NrProduse: -1, PretUnitar: 315 })
    expect(alt[1]).not.toHaveProperty('PretTotal')
    expect(Math.round(alt.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(o.totalMinor)
    expect((await buy([AMBER(1)], g.voucher.code)).data.fields.promoCode).toMatch(/Ai folosit deja/)
  })

  it.each([
    ['gift + NEUROS Calm', [AMBER(1), CALM(1)], 638000 + 2500],
    ['gift + another Amber pair (paid at full price)', [AMBER(2)], 31500 + 2500],
    ['gift + a PJ buyer', [AMBER(1)], 2500],
  ] as const)('the invoice of a mixed gift order adds up, VAT per line, delivery once (%s)', async (label, cart, total) => {
    const g = await v.issueVoucher(db, { email: person.email, productId: 'ochelari-biohack', kind: 'gift', source: 'review', sourceRef: `mix-${label}` })
    if (!g.ok) throw new Error(g.reason)
    const pj = label.includes('PJ')
    const res = await checkout(req('https://biohack-tech.ro/api/checkout', { lines: cart, order: { ...person, ...(pj && { buyerType: 'pj', company: 'Exemplu SRL', cui: 'RO14399840', regCom: 'J12/345/2020' }), paymentMethod: 'transfer' }, acceptedTerms: true, attemptId: `mix-${Math.random()}`, promoCode: g.voucher.code }))
    const o = await order((await res.json()).orderNumber)
    expect(o.totalMinor).toBe(total)
    for (const giftLines of ['zero', 'discount'] as const) {
      const inv = invoicePayload({ ...getConfig().fgo!, giftLines }, o)
      expect(Math.round(inv.Continut.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(total)
      expect(inv.Continut.filter((l) => l.CodArticol === 'transport')).toEqual([expect.objectContaining({ PretTotal: 25, NrProduse: 1 })])
      expect(inv.Continut.every((l) => l.CotaTVA === getConfig().fgo!.vatRate)).toBe(true)
      if (pj) expect(inv.Client).toMatchObject({ Tip: 'PJ', CodUnic: 'RO14399840' })
    }
  })

  it('gift + the book in one order: 25 lei delivery in total (never 25 plus the book fee), the same in Stripe, FGO, the email and the order', async () => {
    // The book is on sale only with its digital delivery set up (test values).
    db = await freshDb({ ...BASE, EMAIL_TRANSPORT: 'smtp', BOOK_SALES_ENABLED: 'true', NEUROS_BOOK_PDF_URL: 'https://neuros.ro/api/carte/partener/pdf', NEUROS_BOOK_PDF_SECRET: 'test-book-secret-0123456789abcdef', DIGITAL_LINK_SECRET: 'test-link-secret-0123456789abcdef' })
    await (await import('@/server/store-settings')).ensureStoreSettings(0)
    const g = await v.issueVoucher(db, { email: person.email, productId: 'ochelari-biohack', kind: 'gift', source: 'review', sourceRef: 'gift-book' })
    if (!g.ok) throw new Error(g.reason)
    const { status, data } = await buy([AMBER(1), { productId: 'carte-diana', quantity: 1 }], g.voucher.code, { method: 'card' })
    expect(status, JSON.stringify(data)).toBe(200)
    const o = await order(data.orderNumber)
    const book = o.items.find((i) => i.productId === 'carte-diana')!
    expect(o.shippingMinor).toBe(2500)
    expect(o.totalMinor).toBe(book.lineTotalMinor - book.discountMinor + 2500)
    expect(piAmounts.at(-1)).toBe(o.totalMinor)
    for (const giftLines of ['zero', 'discount'] as const) {
      const inv = invoicePayload({ ...getConfig().fgo!, giftLines }, o).Continut
      expect(inv.filter((l) => l.CodArticol === 'transport')).toEqual([expect.objectContaining({ PretTotal: 25, NrProduse: 1 })])
      expect(Math.round(inv.reduce((s, l) => s + fgoLineTotal(l) * 100, 0))).toBe(o.totalMinor)
    }
    const { renderEmail } = await import('@/server/integrations/email/templates')
    const mail = renderEmail('order_confirmed', { ...o, paymentStatus: 'paid' }, { siteUrl: 'https://biohack-tech.ro', bank: null })
    expect(mail.text).toMatch(/^Livrare: 25 lei$/m)
    expect(mail.text).not.toMatch(/12,10/)
  })

  it('a gift Amber pair: free, and an Amber order (normally delivered free) pays the gift delivery', async () => {
    const g = await v.issueVoucher(db, { email: person.email, productId: 'ochelari-biohack', kind: 'gift', source: 'vip', sourceRef: person.email })
    if (!g.ok) throw new Error(g.reason)
    const o = await order((await buy([AMBER(1)], g.voucher.code)).data.orderNumber)
    expect([o.subtotalMinor - o.discountMinor, o.shippingMinor, o.totalMinor]).toEqual([0, 2500, 2500])
    expect(o.codAmountMinor).toBe(2500)
  })

  it('a reward voucher is its own: it never replaces the marketing voucher the contact already holds', async () => {
    const marketing = await issue('balance-wave')
    const reward = await v.issueVoucher(db, { email: person.email, productId: 'balance-wave', source: 'referral', sourceRef: 'att-1' })
    expect(reward.ok && reward.voucher.id).not.toBe(marketing.id)
  })
})
