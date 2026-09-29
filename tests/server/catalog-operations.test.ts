/**
 * The real catalog (no price mocks): four products (Brain Flow priced per configuration), and checkout,
 * FGO, GoHighLevel and email all carry the same names, variants and prices.
 */
import { beforeEach, describe, expect, it } from 'vitest'

const { freshDb, person, lines } = await import('./helpers')
const { products, isPurchasable, unitPrice, getProduct, resolveLine } = await import('@/content/catalog')
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

describe('the four-product catalog', () => {
  it('sells NEUROS Calm, Focus, Amber and Brain Flow; Brain Flow "from" its lowest configuration', () => {
    expect(products.map((p) => [p.id, p.slug, p.name, p.price])).toEqual([
      ['balance-wave', 'calm', 'NEUROS Calm', 638000],
      ['brainlink-pro', 'focus', 'NEUROS Focus', 249000],
      ['ochelari-biohack', 'amber', 'NEUROS Amber', 31500],
      ['brain-flow', 'brain-flow', 'Brain Flow', 1290000],
    ])
    expect(products.every(isPurchasable)).toBe(true)
    expect(Object.keys(PRICES_RON).sort()).toEqual(products.map((p) => p.id).sort())
    // Every product has its page content, its CRM tag and (when it has variants) stable ids.
    for (const p of products) {
      expect(productContent[p.id]).toBeDefined()
      expect(PRODUCT_TAG[p.id]).toMatch(/^bt-cumparat-/)
      expect(new Set(p.variants?.map((v) => v.id)).size).toBe(p.variants?.length ?? 0)
    }
  })

  it('Brain Flow: three configurations, each with its zone count and its own canonical price', () => {
    const bf = getProduct('brain-flow')!
    expect(bf.variablePrice).toBe(true)
    expect(bf.variants!.map((v) => [v.id, v.zones, unitPrice(bf, v)])).toEqual([
      ['1-zona', 1, 1290000],
      ['4-zone', 4, 1490000],
      ['13-zone', 13, 1390000],
    ])
    // A configuration is required; an unknown one does not exist.
    expect(resolveLine('brain-flow')).toBeNull()
    expect(resolveLine('brain-flow', '7-zone')).toBeNull()
    expect(unitPrice(bf)).toBeNull()
    // The copy makes no health promise and uses no dash punctuation.
    const text = JSON.stringify(productContent['brain-flow'])
    expect(text).not.toMatch(/[—–]|vindec|trateaz[aă] |depresi|anxiet|garantat/i)
  })

  it('the server prices every Brain Flow line from the catalog, whatever the browser sends', () => {
    const r = resolveOrderLines([
      { productId: 'brain-flow', variantId: '13-zone', quantity: 1, unitAmount: 100, price: 1 },
      { productId: 'brain-flow', variantId: '1-zona', quantity: 2 },
    ])
    // Three Brain Flow units also unlock the 20% promotion (every configuration counts).
    expect(r).toMatchObject({ ok: true, subtotal: 1390000 + 2 * 1290000, discount: 794000, total: 3176000 })
    expect(resolveOrderLines([{ productId: 'brain-flow', quantity: 1 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
    expect(resolveOrderLines([{ productId: 'brain-flow', variantId: '4-zone', quantity: 11 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
    expect(resolveOrderLines([{ productId: 'brain-flow', variantId: '4-zone', quantity: -1 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
  })

  it('a Brain Flow order carries its configuration into the order, FGO, GHL (tag + products) and email', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brain-flow', variantId: '4-zone', quantity: 1 }]), form: person, attemptId: 'catalog-bf' })
    expect(order.totalMinor).toBe(1490000)
    expect(order.items.map((i) => [i.productId, i.variantId, i.productName, i.variantName, i.sku, i.unitPriceMinor])).toEqual([
      ['brain-flow', '4-zone', 'Brain Flow', '4 zone', 'brain-flow/4-zone', 1490000],
    ])
    const c = getConfig()
    expect(invoicePayload(c.fgo!, order).Continut.map((l) => [l.Denumire, l.CodArticol, l.NrProduse, l.PretTotal])).toEqual([['Brain Flow (4 zone)', 'brain-flow/4-zone', 1, 14900]])
    const fields = contactPayload(c.ghl!, order, { orders: 1, valueMinor: order.totalMinor }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, c.siteUrl).customFields
    expect(fields.find((f) => f.key === 'contact.bt_last_order_products')!.fieldValue).toBe('1 x Brain Flow (4 zone)')
    expect(tagsFor({ ...order, paymentStatus: 'paid' })).toEqual(['bt-client', 'bt-cumparat-brain-flow'])
    const mail = renderEmail('order_confirmed', { ...order, paymentStatus: 'paid' }, { siteUrl: c.siteUrl, bank: c.bank })
    for (const s of ['Brain Flow', '4 zone', '14.900 lei']) expect(mail.text).toContain(s)
  })

  it('carries the same lines into the order, the FGO invoice, the GHL contact and the confirmation email', async () => {
    const { order } = await svc.placeOrder({
      lines: lines([{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2 }]),
      form: person,
      attemptId: 'catalog-1',
    })
    expect(order.totalMinor).toBe(638000 + 249000 + 2 * 31500)
    expect(order.items.map((i) => [i.productName, i.variantName, i.quantity, i.unitPriceMinor])).toEqual([
      ['NEUROS Calm', null, 1, 638000],
      ['NEUROS Focus', null, 1, 249000],
      ['NEUROS Amber', 'Unisex pătrat · Maro', 2, 31500],
    ])
    const c = getConfig()
    expect(invoicePayload(c.fgo!, order).Continut.map((l) => [l.Denumire, l.NrProduse, l.PretTotal])).toEqual([
      ['NEUROS Calm', 1, 6380],
      ['NEUROS Focus', 1, 2490],
      ['NEUROS Amber (Unisex pătrat · Maro)', 2, 630],
    ])
    const products = contactPayload(c.ghl!, order, { orders: 1, valueMinor: order.totalMinor }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, c.siteUrl).customFields.find((f) => f.key === 'contact.bt_last_order_products')!
    expect(products.fieldValue).toBe('1 x NEUROS Calm, 1 x NEUROS Focus, 2 x NEUROS Amber (Unisex pătrat · Maro)')
    const mail = renderEmail('order_confirmed', order, { siteUrl: c.siteUrl, bank: c.bank })
    for (const s of ['NEUROS Calm', 'NEUROS Focus', 'NEUROS Amber', '6.380 lei', '2.490 lei', '630 lei', '9.500 lei', order.orderNumber, 'Plata a fost confirmată']) expect(mail.text).toContain(s)
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
