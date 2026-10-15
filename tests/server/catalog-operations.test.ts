/**
 * The real catalog (no price mocks): three products (NEUROS Flow discontinued), and checkout,
 * FGO, GoHighLevel and email all carry the same names, variants and prices.
 */
import { beforeEach, describe, expect, it } from 'vitest'

const { freshDb, person, lines } = await import('./helpers')
const { products, isPurchasable, getProduct, resolveLine, isDiscontinued, DISCONTINUED_PRODUCTS } = await import('@/content/catalog')
const { orders } = await import('@/server/orders/repository')
const { PRICES_RON } = await import('@/config/prices')
const { getConfig } = await import('@/server/config')
const svc = await import('@/server/orders/service')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { contactPayload, tagsFor, PRODUCT_TAG } = await import('@/server/integrations/ghl')
const { resolveOrderLines } = await import('@/lib/orders/resolve')
const { productContent } = await import('@/content/product-content')
const { renderEmail } = await import('@/server/integrations/email/templates')

beforeEach(async () => {
  await freshDb()
})

describe('the three-product catalog (NEUROS Flow discontinued 13.10.2026)', () => {
  it('sells only NEUROS Calm, Focus and Amber, each with its page content and CRM tag', () => {
    expect(products.map((p) => [p.id, p.slug, p.name, p.price])).toEqual([
      ['balance-wave', 'calm', 'NEUROS Calm', 638000],
      ['brainlink-pro', 'focus', 'NEUROS Focus', 180000],
      ['ochelari-biohack', 'amber', 'NEUROS Amber', 31500],
    ])
    expect(products.every(isPurchasable)).toBe(true)
    expect(Object.keys(PRICES_RON).sort()).toEqual(products.map((p) => p.id).sort())
    for (const p of products) {
      expect(productContent[p.id]).toBeDefined()
      expect(PRODUCT_TAG[p.id]).toMatch(/^bt-cumparat-/)
      expect(new Set(p.variants?.map((v) => v.id)).size).toBe(p.variants?.length ?? 0)
    }
  })

  it('NEUROS Flow is not in the catalog: no product, no price, no content, no line; only its name is kept as discontinued', () => {
    expect(getProduct('brain-flow')).toBeUndefined()
    expect(getProduct('brain-flow', 'en')).toBeUndefined()
    for (const v of [undefined, '1-zona', '4-zone', '13-zone']) expect(resolveLine('brain-flow', v)).toBeNull()
    expect((productContent as Record<string, unknown>)['brain-flow']).toBeUndefined()
    expect(isDiscontinued('brain-flow')).toBe(true)
    expect(DISCONTINUED_PRODUCTS['brain-flow'].name).toBe('NEUROS Flow')
  })

  it('the server refuses every NEUROS Flow line, whatever the browser sends, also next to a valid product', () => {
    for (const raw of [
      [{ productId: 'brain-flow', variantId: '13-zone', quantity: 1, unitAmount: 100, price: 1 }],
      [{ productId: 'brain-flow', quantity: 1 }],
      [{ productId: 'balance-wave', quantity: 1 }, { productId: 'brain-flow', variantId: '4-zone', quantity: 1 }],
    ])
      expect(resolveOrderLines(raw)).toEqual({ ok: false, reason: 'BAD_LINE' })
  })

  it('an order placed with NEUROS Flow before the discontinuation still reads, invoices, syncs and emails from its own lines', async () => {
    const db = await freshDb()
    const { order: placed } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: person, attemptId: 'catalog-historic' })
    // The line as it was stored when NEUROS Flow was still sold.
    await db.query(
      "update order_items set product_id = 'brain-flow', variant_id = '4-zone', product_name = 'NEUROS Flow', variant_name = '4 zone', sku = 'brain-flow/4-zone', unit_price_minor = 1490000, line_total_minor = 1490000 where order_id = $1",
      [placed.id],
    )
    await db.query('update orders set subtotal_minor = 1490000, total_minor = 1490000 where id = $1', [placed.id])
    const order = (await orders.byId(db, placed.id))!
    expect(order.items.map((i) => [i.productId, i.variantId, i.productName, i.variantName, i.unitPriceMinor])).toEqual([['brain-flow', '4-zone', 'NEUROS Flow', '4 zone', 1490000]])
    const c = getConfig()
    expect(invoicePayload(c.fgo!, order).Continut.map((l) => [l.Denumire, l.CodArticol, l.NrProduse, l.PretTotal])).toEqual([['NEUROS Flow (4 zone)', 'brain-flow/4-zone', 1, 14900]])
    const fields = contactPayload(c.ghl!, order, { orders: 1, valueMinor: order.totalMinor }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, c.siteUrl).customFields
    expect(fields.find((f) => f.key === 'bt_last_order_products')!.field_value).toBe('1 x NEUROS Flow (4 zone)')
    expect(tagsFor({ ...order, paymentStatus: 'paid' })).toEqual(['bt-client', 'bt-cumparat-brain-flow'])
    for (const t of ['order_confirmed', 'refund_issued'] as const) {
      const mail = renderEmail(t, { ...order, paymentStatus: 'paid', refundedMinor: 1490000 }, { siteUrl: c.siteUrl, bank: c.bank })
      expect(mail.text).toContain(t === 'order_confirmed' ? '1 x NEUROS Flow (4 zone): 14.900 lei' : '14.900 lei')
    }
    // A late Stripe confirmation and then a refund of the old order are still recorded normally.
    expect((await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: 1490000, currency: 'ron' })).order?.paymentStatus).toBe('paid')
    expect((await svc.recordRefund(order.id, 'stripe.webhook', 1490000)).order?.paymentStatus).toBe('refunded')
  })

  it('carries the same lines into the order, the FGO invoice, the GHL contact and the confirmation email', async () => {
    const { order } = await svc.placeOrder({
      lines: lines([{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 2 }, { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2 }]),
      form: person,
      attemptId: 'catalog-1',
    })
    // 2 Focus: 10% off the two Focus (36.000 bani); the single Calm and Amber stay at full price.
    expect(order.totalMinor).toBe(638000 + 2 * 180000 - 36000 + 2 * 31500)
    expect(order.items.map((i) => [i.productName, i.variantName, i.quantity, i.unitPriceMinor])).toEqual([
      ['NEUROS Calm', null, 1, 638000],
      ['NEUROS Focus', null, 2, 180000],
      ['NEUROS Amber', 'Unisex pătrat · Maro', 2, 31500],
    ])
    const c = getConfig()
    expect(invoicePayload(c.fgo!, order).Continut.map((l) => [l.Denumire, l.NrProduse, l.PretTotal])).toEqual([
      ['NEUROS Calm', 1, 6380],
      ['NEUROS Focus, 10% la 2 bucăți: -360.00 lei', 2, 3240],
      ['NEUROS Amber (Unisex pătrat · Maro)', 2, 630],
    ])
    const products = contactPayload(c.ghl!, order, { orders: 1, valueMinor: order.totalMinor }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, c.siteUrl).customFields.find((f) => f.key === 'bt_last_order_products')!
    expect(products.field_value).toBe('1 x NEUROS Calm, 2 x NEUROS Focus, 2 x NEUROS Amber (Unisex pătrat · Maro)')
    const mail = renderEmail('order_confirmed', order, { siteUrl: c.siteUrl, bank: c.bank })
    for (const s of ['NEUROS Calm', 'NEUROS Focus', 'NEUROS Amber', '6.380 lei', '3.600 lei', '630 lei', '10% la 2 bucăți NEUROS Focus', '10.250 lei', order.orderNumber, 'Plata a fost confirmată']) expect(mail.text).toContain(s)
  })

  it('the bank-transfer email has beneficiary, IBAN, bank, exact amount and the order number as reference', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'catalog-2' })
    const c = getConfig()
    const mail = renderEmail('transfer_instructions', order, { siteUrl: c.siteUrl, bank: c.bank })
    for (const s of ['Beneficiar: Exemplu SRL', 'IBAN: RO49 AAAA 1B31 0075 9384 0000', 'Banca: Banca Exemplu', 'Suma: 315 lei', `Detalii plată: Comanda ${order.orderNumber}`, 'Pregătim coletul imediat ce suma ajunge în cont']) {
      expect(mail.text).toContain(s)
    }
  })
})
