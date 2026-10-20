import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))

const { freshDb, person, company, lines } = await import('./helpers')
const { getConfig } = await import('@/server/config')
const { fgoCounty, fgoHash, invoicePayload } = await import('@/server/integrations/fgo')
const { contactPayload, stageFor, tagsFor } = await import('@/server/integrations/ghl')
const { renderEmail } = await import('@/server/integrations/email/templates')
const { placeOrder, confirmPayment } = await import('@/server/orders/service')

beforeEach(async () => {
  await freshDb()
})

describe('FGO mapping', () => {
  it('computes the hash exactly like the FGO spec example', () => {
    expect(fgoHash('2864518', '1234567890', 'Ionescu Popescu')).toBe('8C3A7726804C121C6933F7D68494B439463996E2')
  })
  it('strips diacritics from counties to match FGO nomenclature', () => {
    expect(fgoCounty('București')).toBe('Bucuresti')
    expect(fgoCounty('Bistrița-Năsăud')).toBe('Bistrita-Nasaud')
    expect(fgoCounty('Timiș')).toBe('Timis')
  })
  it('invoices a person with VAT-inclusive line totals and the order number as external id', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2 }]), form: person, attemptId: 'a-fgo-1' })
    const p = invoicePayload(getConfig().fgo!, order)
    expect(p.IdExtern).toBe(order.orderNumber)
    expect(p.VerificareDuplicat).toBe(true)
    expect(p.Valuta).toBe('RON')
    expect(p.Client).toMatchObject({ Denumire: 'Ana Popescu', Tip: 'PF', Tara: 'RO', Judet: 'Cluj', Localitate: 'Cluj-Napoca' })
    expect(p.Client).not.toHaveProperty('CodUnic')
    expect(p.Continut).toEqual([
      { Denumire: 'NEUROS Calm', CodArticol: 'balance-wave', UM: 'BUC', NrProduse: 1, CotaTVA: 21, PretTotal: 6380 },
      { Denumire: 'NEUROS Amber (Unisex pătrat · Maro · Galbene)', CodArticol: 'ochelari-biohack/patrat-maro', UM: 'BUC', NrProduse: 2, CotaTVA: 21, PretTotal: 399 },
    ])
    expect(p.Hash).toBe(fgoHash('2864518', '1234567890', 'Ana Popescu'))
  })
  it('invoices a company on its name and CUI', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: company, attemptId: 'a-fgo-2' })
    const p = invoicePayload(getConfig().fgo!, order)
    expect(p.Client).toMatchObject({ Denumire: 'Exemplu SRL', Tip: 'PJ', CodUnic: 'RO14399840', NrRegCom: 'J12/345/2020' })
    expect(p.Hash).toBe(fgoHash('2864518', '1234567890', 'Exemplu SRL'))
  })
})

describe('GoHighLevel mapping', () => {
  it('maps order and payment state to exactly one pipeline stage', () => {
    expect(stageFor({ status: 'pending', paymentStatus: 'awaiting_transfer' }).stage).toBe('awaitingTransfer')
    expect(stageFor({ status: 'abandoned', paymentStatus: 'pending' })).toEqual({ stage: 'abandoned', status: 'abandoned' })
    expect(stageFor({ status: 'confirmed', paymentStatus: 'paid' })).toEqual({ stage: 'paid', status: 'won' })
    expect(stageFor({ status: 'shipped', paymentStatus: 'paid' }).stage).toBe('shipped')
    expect(stageFor({ status: 'delivered', paymentStatus: 'paid' }).stage).toBe('delivered')
    expect(stageFor({ status: 'cancelled', paymentStatus: 'awaiting_transfer' })).toEqual({ stage: 'cancelled', status: 'lost' })
    expect(stageFor({ status: 'delivered', paymentStatus: 'refunded' }).stage).toBe('refunded')
  })
  it('tags only paying customers, per product', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'a-ghl-1' })
    expect(tagsFor(order)).toEqual([])
    const paid = (await confirmPayment(order.id, 'admin')).order!
    expect(tagsFor(paid)).toEqual(['bt-client', 'bt-cumparat-focus', 'bt-cumparat-amber'])
  })
  it('builds the contact with last-order fields', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 2 }]), form: company, attemptId: 'a-ghl-2' })
    const c = contactPayload(getConfig().ghl!, order, { orders: 3, valueMinor: 1234500 }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, 'https://test.biohack-tech.ro')
    expect(c).toMatchObject({ locationId: 'loc1', firstName: 'Ana', lastName: 'Popescu', email: 'ana@exemplu.ro', companyName: 'Exemplu SRL', country: 'RO' })
    const f = Object.fromEntries(c.customFields.map((x) => [x.key, x.field_value]))
    expect(f['bt_last_order_number']).toBe(order.orderNumber)
    expect(f['bt_last_order_value']).toBe('1422.00') // 2 × 790 lei, −10% for 2 products
    expect(f['bt_last_order_products']).toBe('2 x NEUROS Focus')
    expect(f['bt_customer_type']).toBe('Persoană juridică')
    expect(f['bt_lifetime_value']).toBe('12345.00')
    expect(f['bt_last_order_url']).toBe(`https://test.biohack-tech.ro/comanda/${order.publicToken}`)
    expect([f['bt_marketing_consent'], f['bt_recovery_url'], f['bt_unsubscribe_url']]).toEqual(['Nu', '', ''])
  })
})

describe('transactional emails', () => {
  it('render every template with real data and no placeholders or em dashes', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'a-mail-1' })
    const ctx = { siteUrl: 'https://test.biohack-tech.ro', bank: getConfig().bank }
    for (const t of ['order_confirmed', 'transfer_instructions', 'payment_received', 'invoice_issued', 'order_shipped', 'order_cancelled', 'refund_issued'] as const) {
      const m = renderEmail(t, { ...order, courier: 'Curier', trackingNumber: 'AWB1', fgoInvoiceSeries: 'BT', fgoInvoiceNumber: '7', fgoInvoiceLink: 'https://fgo/f.pdf' }, ctx)
      expect(m.subject).toContain(order.orderNumber)
      for (const s of [m.html, m.text]) {
        expect(s).not.toMatch(/undefined|null|NaN|\{\{|—/)
        expect(s).toContain(order.orderNumber)
      }
    }
    const bank = renderEmail('transfer_instructions', order, ctx)
    expect(bank.text).toContain('RO49 AAAA 1B31 0075 9384 0000')
    expect(bank.text).toContain('199,50 lei')
    expect(bank.html).toContain(`/comanda/${order.publicToken}`)
    // The proof of payment goes to WhatsApp, with the order number and amount already written.
    const proof = `https://wa.me/40765874571?text=${encodeURIComponent(`Bună! Am plătit comanda ${order.orderNumber} (199,50 lei) prin transfer bancar. Atașez dovada plății:`)}`
    expect(bank.html).toContain(proof.replace(/&/g, '&amp;'))
    expect(bank.text).toContain(proof)
    expect(renderEmail('transfer_reminder', order, ctx).html).toContain('wa.me/40765874571')
    expect(renderEmail('order_confirmed', order, ctx).html).not.toContain('wa.me/40765874571')
  })

  it('the cancellation email says exactly where the money stands', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'a-mail-2' })
    const ctx = { siteUrl: 'https://test.biohack-tech.ro', bank: getConfig().bank }
    const say = (paymentStatus: typeof order.paymentStatus) => renderEmail('order_cancelled', { ...order, status: 'cancelled', paymentStatus }, ctx).text
    expect(say('awaiting_transfer')).toContain('Nu ai nimic de plătit')
    expect(say('awaiting_collection')).toContain('Nu ai nimic de plătit')
    expect(say('paid')).toContain('îți este returnată')
    expect(say('refunded')).toContain('ți-a fost returnată')
    expect(say('refunded')).not.toContain('nimic de plătit')
  })

  it('every email gives the support contact once, not twice', async () => {
    const { order } = await placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'a-mail-3' })
    const ctx = { siteUrl: 'https://test.biohack-tech.ro', bank: getConfig().bank }
    for (const t of ['order_confirmed', 'transfer_instructions', 'payment_received', 'invoice_issued', 'order_shipped', 'order_cancelled', 'refund_issued', 'return_received'] as const) {
      const text = renderEmail(t, { ...order, refundedMinor: order.totalMinor, fgoInvoiceSeries: 'BT', fgoInvoiceNumber: '7' }, ctx).text
      expect(text.match(/Ai o întrebare\?/g), t).toHaveLength(1)
      expect(text, t).not.toContain('Pentru orice întrebare')
    }
  })
})
