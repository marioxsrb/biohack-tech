/**
 * The real catalog (no price mocks): exactly three products, and checkout, FGO, GoHighLevel and email
 * all carry the same names and prices.
 */
import { beforeEach, describe, expect, it } from 'vitest'

const { freshDb, person, lines } = await import('./helpers')
const { products, isPurchasable } = await import('@/content/catalog')
const { PRICES_RON } = await import('@/config/prices')
const { getConfig } = await import('@/server/config')
const svc = await import('@/server/orders/service')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { contactPayload } = await import('@/server/integrations/ghl')
const { renderEmail } = await import('@/server/integrations/email/templates')

beforeEach(async () => {
  await freshDb()
})

describe('the three-product catalog', () => {
  it('sells exactly NEUROS Calm, Focus and Amber at the approved prices; no Brain Flow', () => {
    expect(products.map((p) => [p.id, p.name, p.price])).toEqual([
      ['balance-wave', 'NEUROS Calm', 638000],
      ['brainlink-pro', 'NEUROS Focus', 249000],
      ['ochelari-biohack', 'NEUROS Amber', 31500],
    ])
    expect(products.every(isPurchasable)).toBe(true)
    expect(Object.keys(PRICES_RON)).toHaveLength(3)
    expect(JSON.stringify(products).toLowerCase()).not.toContain('brain flow')
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
