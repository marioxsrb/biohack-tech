/**
 * Cash on delivery (ramburs) end to end, on an embedded PostgreSQL (PGlite), with Stripe, FGO and
 * GoHighLevel answered by an in-memory fake (no network, no real invoice, payment or message):
 * checkout route → order → CRM and email → shipment with the invoice → delivery → recorded collection.
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES, stageFor, contactPayload, tagsFor, resetStageCache } = await import('@/server/integrations/ghl')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { renderEmail } = await import('@/server/integrations/email/templates')
const { shipmentFor } = await import('@/server/fulfillment/courier')
const { getConfig } = await import('@/server/config')
const { canCancel, canFulfil } = await import('@/server/orders/state')
const { isConfirmedPurchase } = await import('@/lib/segments')
const { POST: checkout } = await import('@/app/api/checkout/route')

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
let stages: string[]
let db: Awaited<ReturnType<typeof freshDb>>
let seq = 0

function fakeApis() {
  calls = []
  let invoiceNo = 500
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('stripe.com')) return json({ error: { message: 'Stripe must not be called for cash on delivery' } }, 500)
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo), Link: 'https://fgo/f.pdf' } })
    if (url.includes('/factura/stornare')) return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo) } })
    if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
    if (url.includes('/tags')) return json({ tags: body?.tags })
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: stages.map((n, i) => ({ id: `stage-${n}`, name: n, i })) }] })
    if (url.includes('/opportunities/search')) return json({ opportunities: [] })
    if (url.endsWith('/opportunities/') && init.method === 'POST') return json({ opportunity: { id: 'opp-1' } }, 201)
    if (url.includes('/opportunities/') && init.method === 'PUT') return json({ opportunity: {} })
    if (url.includes('/conversations/messages')) return json({ messageId: 'm1', emailMessageId: 'e1' })
    return json({ message: 'not mocked' }, 404)
  })
}

const place = async (body: Record<string, unknown>) => {
  const res = await checkout(new Request('https://test/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++seq}` },
    body: JSON.stringify({ acceptedTerms: true, attemptId: `cod-attempt-${++seq}`, ...body }),
  }) as NextRequest)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}
const codOrder = async (raw: unknown[] = [{ productId: 'brainlink-pro', quantity: 1 }]) => {
  const r = await place({ lines: raw, order: { ...person, paymentMethod: 'cod' } })
  expect(r.status).toBe(200)
  return (await orders.byNumber(db, String(r.body.orderNumber)))!
}
const jobKinds = async (orderId: string) =>
  (await db.query<{ kind: string; payload: { template?: string } }>('select kind, payload from jobs where order_id = $1 order by id', [orderId])).rows.map((r) => (r.payload?.template ? `${r.kind}:${r.payload.template}` : r.kind))
const eventsOf = async (orderId: string) => (await db.query<{ type: string; data: Record<string, unknown> }>('select type, data from order_events where order_id = $1 order by id', [orderId])).rows
/** Runs queued jobs until none is due (the checkout route may already have started a run). */
const drain = async () => {
  for (let i = 0; i < 10; i++) if (!(await runDueJobs())) return
}
const ship = (id: string) => svc.markShipped(id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB123' })
const fieldsOf = (c: Call) => Object.fromEntries((c.body!.customFields as { key: string; fieldValue: string }[]).map((x) => [x.key, x.fieldValue]))

beforeEach(async () => {
  db = await freshDb()
  stages = Object.values(STAGES)
  resetStageCache()
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

describe('cash on delivery: placing the order', () => {
  it('is confirmed at once, unpaid, with the amount to collect, and never touches Stripe', async () => {
    const r = await place({ lines: [{ productId: 'brainlink-pro', quantity: 1 }], order: { ...person, paymentMethod: 'cod' } })
    expect(r).toMatchObject({ status: 200, body: { method: 'cod' } })
    expect(r.body).not.toHaveProperty('clientSecret')
    const o = (await orders.byNumber(db, String(r.body.orderNumber)))!
    expect(o).toMatchObject({ paymentMethod: 'cash_on_delivery', paymentStatus: 'awaiting_collection', status: 'confirmed', invoiceStatus: 'none', codAmountMinor: 79000, totalMinor: 79000, paidAt: null, stripePaymentIntentId: null, stripeCustomerId: null })
    // CRM and the confirmation email; no Stripe reconciliation, no abandonment check, no invoice yet.
    expect(await jobKinds(o.id)).toEqual(['ghl.sync', 'email.send:cod_confirmed'])
    await drain()
    expect(calls.some((c) => c.url.includes('stripe.com'))).toBe(false)
    expect(calls.some((c) => c.url.includes('/factura/'))).toBe(false)
  })

  it('the same attempt twice is one order', async () => {
    const body = { lines: [{ productId: 'brainlink-pro', quantity: 1 }], order: { ...person, paymentMethod: 'cod' }, attemptId: 'same-cod-attempt' }
    const a = await place(body)
    const b = await place(body)
    expect(a.body.orderNumber).toBe(b.body.orderNumber)
    expect((await db.query('select 1 from orders')).rows).toHaveLength(1)
  })

  it('keeps the bundle promotions exactly: 10% for 2, 20% for 3, Amber 2+1, and collects the discounted total', async () => {
    const two = await codOrder([{ productId: 'brainlink-pro', quantity: 2 }])
    expect([two.subtotalMinor, two.discountMinor, two.totalMinor, two.codAmountMinor]).toEqual([158000, 15800, 142200, 142200])
    const three = await codOrder([{ productId: 'brainlink-pro', quantity: 1 }, { productId: 'balance-wave', quantity: 3 }])
    // 20% on the three Calm only (382.800 bani); the Focus stays at full price.
    expect([three.subtotalMinor, three.discountMinor, three.totalMinor]).toEqual([1993000, 382800, 1610200])
    expect(three.codAmountMinor).toBe(three.totalMinor)
    const amber = await codOrder([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 2 }, { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 }])
    expect([amber.subtotalMinor, amber.discountMinor, amber.totalMinor, amber.codAmountMinor]).toEqual([59850, 19950, 39900, 39900])
  })

  it('closes an earlier abandoned card attempt of the same customer', async () => {
    const { order: card } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'card-first' })
    await svc.markAbandonedIfUnpaid(card.id)
    expect((await orders.byId(db, card.id))!.status).toBe('abandoned')
    await codOrder()
    expect((await orders.byId(db, card.id))!).toMatchObject({ status: 'cancelled', cancelReason: 'înlocuită de o comandă plătită' })
  })

  it('has no order-value ceiling: every product, up to the largest possible cart, can be paid on delivery', async () => {
    // Business decision (13 Oct 2026): no maximum for cash on delivery. A ceiling must not come back
    // through configuration either, so the old variable is set here and must change nothing.
    vi.stubEnv('NEXT_PUBLIC_COD_MAX_LEI', '100')
    try {
      for (const raw of [
        [{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }],
        [{ productId: 'brainlink-pro', quantity: 1 }],
        [{ productId: 'balance-wave', quantity: 10 }],
        [
          { productId: 'balance-wave', quantity: 10 },
          { productId: 'brainlink-pro', quantity: 10 },
          ...['cat-eye-negru', 'cat-eye-bej', 'patrat-negru', 'patrat-maro'].map((variantId) => ({ productId: 'ochelari-biohack', variantId, quantity: 10 })),
        ],
      ]) {
        const o = await codOrder(raw)
        expect(o).toMatchObject({ paymentMethod: 'cash_on_delivery', paymentStatus: 'awaiting_collection', status: 'confirmed', stripePaymentIntentId: null })
        expect(o.codAmountMinor).toBe(o.totalMinor)
      }
      const largest = (await db.query<{ total_minor: number }>("select max(total_minor)::int as total_minor from orders")).rows[0].total_minor
      expect(largest).toBeGreaterThan(6_000_000) // over 60.000 lei, still cash on delivery
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('keeps no ceiling setting anywhere in the code', () => {
    for (const f of ['src/config/payments.ts', 'src/app/api/checkout/route.ts', 'src/app/[lang]/(checkout)/checkout/CheckoutView.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/COD_MAX|maxTotalMinor|codAllowedFor/)
    }
  })
})

describe('cash on delivery: CRM, email, invoice, fulfillment', () => {
  it('GoHighLevel gets the method, the uncollected status and the "Ramburs, de pregătit" stage, still open', async () => {
    const o = await codOrder()
    await drain()
    const upsert = calls.find((c) => c.url.includes('/contacts/upsert'))!
    expect(fieldsOf(upsert)['contact.bt_last_payment_method']).toBe('Ramburs (plata la livrare)')
    expect(fieldsOf(upsert)['contact.bt_last_payment_status']).toBe('ramburs, de încasat la livrare')
    const opp = calls.find((c) => c.url.endsWith('/opportunities/') && c.method === 'POST')!
    expect(opp.body).toMatchObject({ pipelineStageId: `stage-${STAGES.codToPrepare}`, status: 'open', monetaryValue: 790 })
    expect(tagsFor(o)).toEqual([]) // a parcel can still be refused: no "client" tag before the collection
  })

  it('until the stage exists in GHL, the order waits in "În pregătire", never in a paid stage', async () => {
    stages = Object.values(STAGES).filter((s) => s !== STAGES.codToPrepare)
    await codOrder()
    await drain()
    const opp = calls.find((c) => c.url.endsWith('/opportunities/') && c.method === 'POST')!
    expect(opp.body).toMatchObject({ pipelineStageId: `stage-${STAGES.processing}`, status: 'open' })
    // The confirmation email still went out (it waits on the CRM sync with the GHL transport).
    expect(calls.some((c) => c.url.includes('/conversations/messages'))).toBe(true)
  })

  it('the confirmation email says what to pay the courier, and nothing now', async () => {
    const o = await codOrder([{ productId: 'brainlink-pro', quantity: 2 }])
    const mail = renderEmail('cod_confirmed', o, { siteUrl: 'https://test', bank: null })
    expect(mail.text).toContain('De plătit la livrare: 1.422 lei')
    expect(mail.text).toContain('Plătești curierului când primești coletul. Nu plătești nimic acum.')
    expect(mail.text).toContain('Plată: Ramburs (plata la livrare)')
    expect(mail.text).toContain('10% la 2 bucăți NEUROS Focus: -158 lei')
  })

  it('ships before any money: invoice issued with the parcel (unpaid), amount to collect kept for the courier', async () => {
    const o = await codOrder()
    expect(canFulfil(o)).toBe(true)
    expect(shipmentFor(o)).toMatchObject({ reference: o.orderNumber, recipient: 'Ana Popescu', phone: '0722123456', cashOnDeliveryMinor: 79000, declaredValueMinor: 79000, contents: '1 x NEUROS Focus' })
    expect((await svc.markProcessing(o.id, 'admin')).changed).toBe(true)
    const shipped = (await ship(o.id)).order!
    expect(shipped).toMatchObject({ status: 'shipped', paymentStatus: 'awaiting_collection', invoiceStatus: 'pending', paidAt: null })
    expect((await eventsOf(o.id)).find((e) => e.type === 'order.shipped')!.data).toMatchObject({ codAmount: 79000, trackingNumber: 'AWB123' })
    await drain()
    const after = (await orders.byId(db, o.id))!
    expect(after).toMatchObject({ invoiceStatus: 'issued', fgoInvoiceNumber: '501', paymentStatus: 'awaiting_collection' })
    const inv = calls.find((c) => c.url.includes('/factura/emitere'))!.body!
    expect(inv.Text).toBe(`Comanda ${o.orderNumber}. Plata ramburs, la livrare.`)
    // Nothing in the request registers a collection: FGO keeps the invoice unpaid.
    expect(Object.keys(inv).sort()).toEqual(['Client', 'CodUnic', 'Continut', 'Hash', 'IdExtern', 'PlatformaUrl', 'Serie', 'Text', 'TipFactura', 'Valuta', 'VerificareDuplicat'])
    const shippedMail = renderEmail('order_shipped', after, { siteUrl: 'https://test', bank: null })
    expect(shippedMail.text).toContain('De plătit curierului: 790 lei')
  })

  it('delivery alone never makes it paid', async () => {
    const o = await codOrder()
    await ship(o.id)
    const delivered = (await svc.markDelivered(o.id, 'admin')).order!
    expect(delivered).toMatchObject({ status: 'delivered', paymentStatus: 'awaiting_collection', paidAt: null })
    expect(stageFor(delivered)).toEqual({ stage: 'delivered', status: 'open' })
    expect(isConfirmedPurchase(delivered)).toBe(false)
  })

  it('the collection is recorded only by a person, after shipping, with the exact amount and a settlement reference', async () => {
    const o = await codOrder()
    expect((await svc.confirmPayment(o.id, 'admin', { amountMinor: 79000, currency: 'RON', reference: 'BRD-1' })).reason).toBe('collection_before_delivery_confirmed')
    await ship(o.id)
    expect((await svc.confirmPayment(o.id, 'stripe.webhook', { amountMinor: 79000, currency: 'ron' })).reason).toBe('collection_confirmed_by_admin_only')
    expect((await svc.confirmPayment(o.id, 'admin')).reason).toBe('collection_reference_required')
    expect((await svc.confirmPayment(o.id, 'admin', { amountMinor: 79000, currency: 'RON', reference: ' ' })).reason).toBe('collection_reference_required')
    expect((await svc.confirmPayment(o.id, 'admin', { amountMinor: 70000, currency: 'RON', reference: 'BRD-77' })).reason).toBe('amount_mismatch')
    expect((await orders.byId(db, o.id))!.paymentStatus).toBe('awaiting_collection')

    await drain()
    const sent = calls.filter((c) => c.url.includes('/conversations/messages')).length
    const r = await svc.confirmPayment(o.id, 'admin', { amountMinor: 79000, currency: 'RON', reference: 'Borderou FAN 4471' })
    expect(r.changed).toBe(true)
    expect(r.order).toMatchObject({ paymentStatus: 'paid', status: 'shipped', codReference: 'Borderou FAN 4471', invoiceStatus: 'issued' })
    expect(r.order!.paidAt).toBeTruthy()
    expect((await eventsOf(o.id)).find((e) => e.type === 'payment.confirmed')!.data).toMatchObject({ amount: 79000, collection: true, reference: 'Borderou FAN 4471' })
    await drain()
    // One invoice in total (issued at shipment), and no "payment received" email for money handed to the courier.
    expect(calls.filter((c) => c.url.includes('/factura/emitere'))).toHaveLength(1)
    expect(calls.filter((c) => c.url.includes('/conversations/messages')).length).toBe(sent)
    expect(stageFor(r.order!)).toEqual({ stage: 'shipped', status: 'won' })
    expect(tagsFor(r.order!)).toContain('bt-client')
    // Twice is harmless.
    expect((await svc.confirmPayment(o.id, 'admin', { amountMinor: 79000, currency: 'RON', reference: 'again' })).reason).toBe('already_paid')
  })

  it('FGO_COD_INVOICE=on_collection: no invoice at shipment, one when the collection is recorded', async () => {
    db = await freshDb({ ...TEST_ENV, FGO_COD_INVOICE: 'on_collection' })
    const o = await codOrder()
    expect((await ship(o.id)).order!.invoiceStatus).toBe('none')
    await drain()
    expect(calls.some((c) => c.url.includes('/factura/'))).toBe(false)
    const paid = (await svc.confirmPayment(o.id, 'admin', { amountMinor: 79000, currency: 'RON', reference: 'OP 12' })).order!
    expect(paid.invoiceStatus).toBe('pending')
    await drain()
    expect(calls.filter((c) => c.url.includes('/factura/emitere'))).toHaveLength(1)
  })

  it('FGO not configured: the invoice is left to a person', async () => {
    const noFgo = Object.fromEntries(Object.entries(TEST_ENV).filter(([k]) => !k.startsWith('FGO_')))
    db = await freshDb(noFgo)
    expect(getConfig().fgo).toBeNull()
    const o = await codOrder()
    expect((await ship(o.id)).order!.invoiceStatus).toBe('manual')
  })

  it('a parcel refused at the door can be cancelled after shipping; a shipped card order cannot', async () => {
    const o = await codOrder()
    await ship(o.id)
    expect(canCancel((await orders.byId(db, o.id))!)).toBe(true)
    const c = await svc.cancelOrder(o.id, 'admin', 'colet refuzat la livrare')
    expect(c.order).toMatchObject({ status: 'cancelled', paymentStatus: 'awaiting_collection' })
    expect(await jobKinds(o.id)).toContain('email.send:order_cancelled')

    const { order: card } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'card-shipped' })
    await db.query("update orders set payment_status = 'paid', status = 'shipped' where id = $1", [card.id])
    expect((await svc.cancelOrder(card.id, 'admin', 'x')).reason).toBe('status_shipped')
  })

  it('a parcel refused before its invoice went out gets no invoice at all', async () => {
    const o = await codOrder()
    await drain()
    await ship(o.id) // queues the invoice for the parcel
    await svc.cancelOrder(o.id, 'admin', 'colet refuzat la livrare')
    await drain()
    expect(calls.some((c) => c.url.includes('/factura/'))).toBe(false)
    expect((await orders.byId(db, o.id))!).toMatchObject({ status: 'cancelled', invoiceStatus: 'none', fgoInvoiceNumber: null })
    expect((await orders.followUps(db)).orders).toEqual([])
  })

  it('a refused parcel whose invoice was issued is listed for a credit note (FGO_AUTO_STORNO off: a person decides)', async () => {
    const o = await codOrder()
    await ship(o.id)
    await drain()
    expect((await orders.byId(db, o.id))!.fgoInvoiceNumber).toBeTruthy()
    await svc.cancelOrder(o.id, 'admin', 'colet refuzat la livrare')
    await drain()
    expect(calls.some((c) => c.url.includes('/factura/stornare'))).toBe(false)
    expect((await orders.followUps(db)).orders).toEqual([expect.objectContaining({ id: o.id, storno: true, refund: false })])
  })

  it('with FGO_AUTO_STORNO=true the issued invoice of a refused parcel is credited once, and leaves the list', async () => {
    db = await freshDb({ ...TEST_ENV, FGO_AUTO_STORNO: 'true' })
    const o = await codOrder()
    await ship(o.id)
    await drain()
    await svc.cancelOrder(o.id, 'admin', 'colet refuzat la livrare')
    await drain()
    await drain()
    expect(calls.filter((c) => c.url.includes('/factura/stornare'))).toHaveLength(1)
    expect((await orders.byId(db, o.id))!.fgoStornoNumber).toMatch(/^BT /)
    expect((await orders.followUps(db)).orders).toEqual([])
  })

  it('a delivered order can be withdrawn from before the courier settles', async () => {
    const o = await codOrder()
    await ship(o.id)
    expect((await svc.markReturnRequested(o.id, 'admin')).reason).toBe('payment_awaiting_collection')
    await svc.markDelivered(o.id, 'admin')
    expect((await svc.markReturnRequested(o.id, 'admin')).changed).toBe(true)
  })

  it('the contact payload and the invoice name the method correctly for every method', async () => {
    const c = getConfig()
    const cod = await codOrder()
    const { order: transfer } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'm-transfer' })
    const { order: card } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'm-card' })
    const method = (o: typeof cod) => Object.fromEntries(contactPayload(c.ghl!, o, { orders: 1, valueMinor: 0 }, { consent: false, recoveryUrl: '', unsubscribeUrl: '' }, 'https://t').customFields.map((x) => [x.key, x.fieldValue]))['contact.bt_last_payment_method']
    expect([method(cod), method(transfer), method(card)]).toEqual(['Ramburs (plata la livrare)', 'Transfer bancar', 'Card'])
    expect(invoicePayload(c.fgo!, card).Text).toBe(`Comanda ${card.orderNumber}`)
  })
})

describe('card and bank transfer are unchanged', () => {
  it('transfer: waits for the transfer, instructions email, no invoice before payment', async () => {
    const r = await place({ lines: [{ productId: 'brainlink-pro', quantity: 1 }], order: { ...person, paymentMethod: 'transfer' } })
    expect(r.body.method).toBe('transfer')
    const o = (await orders.byNumber(db, String(r.body.orderNumber)))!
    expect(o).toMatchObject({ paymentMethod: 'bank_transfer', paymentStatus: 'awaiting_transfer', status: 'pending', codAmountMinor: null })
    expect(await jobKinds(o.id)).toEqual(['ghl.sync', 'email.send:transfer_instructions'])
    expect(canFulfil(o)).toBe(false)
    expect((await ship(o.id)).reason).toBe('status_pending')
  })

  it('card: a PaymentIntent for exactly the total, reconcile and abandonment checks as before', async () => {
    const created: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
      const url = String(input)
      const form = Object.fromEntries(new URLSearchParams(String(init.body ?? '')))
      if (url.endsWith('/v1/customers')) return new Response(JSON.stringify({ id: 'cus_1' }))
      if (url.endsWith('/v1/payment_intents')) {
        created.push(form)
        return new Response(JSON.stringify({ id: 'pi_1', amount: Number(form.amount), currency: 'ron', status: 'requires_payment_method', client_secret: 'pi_1_secret', metadata: { order_id: form['metadata[order_id]'] } }))
      }
      return new Response('{}', { status: 404 })
    })
    const r = await place({ lines: [{ productId: 'brainlink-pro', quantity: 2 }], order: person })
    expect(r).toMatchObject({ status: 200, body: { method: 'card', clientSecret: 'pi_1_secret' } })
    expect(created[0].amount).toBe('142200')
    const o = (await orders.byNumber(db, String(r.body.orderNumber)))!
    expect(o).toMatchObject({ paymentMethod: 'card', paymentStatus: 'pending', status: 'pending', stripePaymentIntentId: 'pi_1' })
    expect(await jobKinds(o.id)).toEqual(['stripe.reconcile', 'order.abandon_check'])
  })
})
