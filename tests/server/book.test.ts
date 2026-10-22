/**
 * Diana L. Palotaș's book, end to end on an embedded PostgreSQL (PGlite): release gating, the delivery rule (once per
 * order, never discounted), the totals every system reads, and the PDF: granted only by Stripe's verified webhook, a
 * confirmed transfer or a COD delivery, revoked by a cancellation or a refund, delivered through signed, expiring links
 * checked again on every download, emailed once per reason. NEUROS (the PDF's only source), FGO and Stripe are answered
 * by an in-memory fake: no network, no real payment, invoice or email (file transport).
 */
import { createHmac } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, lines: resolve } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { signPayload } = await import('@/server/integrations/stripe')
const { invoicePayload, fgoLineTotal } = await import('@/server/integrations/fgo')
const { getConfig } = await import('@/server/config')
const { ensureStoreSettings } = await import('@/server/store-settings')
const catalog = await import('@/content/catalog')
const { resolveOrderLines } = await import('@/lib/orders/resolve')
const { shippingFor } = await import('@/lib/shipping')
const { convertUnit } = await import('@/lib/currency')
const { entitlements } = await import('@/server/digital/entitlements')
const { createLink, readLink } = await import('@/server/digital/links')
const { digitalAccess } = await import('@/server/digital/rules')
const delivery = await import('@/server/digital/delivery')
const { sourceHeaders } = await import('@/server/digital/source')
const { buyerStage, digitalTags, INTEREST_TAG, PRODUCT_TAG, BUYER_STAGES } = await import('@/server/integrations/ghl')
const { agentKnowledge } = await import('@/server/calling/agent')
const { cartTotal } = await import('@/server/calling/offer')
const { assistantTools } = await import('@/server/assistant/tools')
const { assistantStableInstructions } = await import('@/server/assistant/prompt')
const { promoCodes } = await import('@/server/promo')
const { POST: webhook } = await import('@/app/api/webhooks/stripe/route')
const { GET: download } = await import('@/app/api/carte/descarca/route')

const SOURCE_URL = 'https://neuros.test/api/carte/partener/pdf'
const SOURCE_SECRET = 's'.repeat(40)
const LINK_SECRET = 'l'.repeat(40)
/** A stand-in for the PDF: the real book never enters the tests. */
const FAKE_PDF = new TextEncoder().encode('%PDF-1.7 test stand-in')
const mailDir = mkdtempSync(path.join(tmpdir(), 'bt-book-'))

const ENV = {
  APP_ENV: 'staging',
  NEXT_PUBLIC_SITE_URL: 'https://test.biohack-tech.ro',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  BANK_BENEFICIARY: 'Exemplu SRL',
  BANK_NAME: 'Banca Exemplu',
  BANK_IBAN: 'RO49AAAA1B31007593840000',
  FGO_COD_UNIC: '2864518',
  FGO_PRIVATE_KEY: '1234567890',
  FGO_SERIE: 'BT',
  FGO_VAT_RATE: '21',
  EMAIL_TRANSPORT: 'file',
  EMAIL_FILE_DIR: mailDir,
  ADMIN_PASSWORD: 'a-long-test-password',
  NEUROS_BOOK_PDF_URL: SOURCE_URL,
  NEUROS_BOOK_PDF_SECRET: SOURCE_SECRET,
  DIGITAL_LINK_SECRET: LINK_SECRET,
  BOOK_SALES_ENABLED: 'true',
}

type Db = Awaited<ReturnType<typeof freshDb>>
let db: Db
let seq = 0
let sourceCalls: { headers: Headers }[]
let sourceDown = false

/** NEUROS checks the signature exactly like its partner route; FGO says yes; Stripe must not be called. */
function fakeApis() {
  sourceCalls = []
  vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input)
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url === SOURCE_URL) {
      const h = new Headers(init.headers)
      sourceCalls.push({ headers: h })
      if (sourceDown) return json({ error: 'down' }, 503)
      const expected = createHmac('sha256', SOURCE_SECRET).update(`biohacktech\n${h.get('x-neuros-timestamp')}\n${h.get('x-neuros-reference')}\nGET\n/api/carte/partener/pdf`).digest('hex')
      if (h.get('x-neuros-partner') !== 'biohacktech' || h.get('x-neuros-signature') !== expected) return json({ error: 'unauthorized' }, 401)
      return new Response(FAKE_PDF, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(FAKE_PDF.length) } })
    }
    if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++seq), Link: 'https://fgo/f.pdf' } })
    if (url.includes('stripe.com')) return json({ error: { message: 'Stripe must not be called' } }, 500)
    return json({ error: `unexpected ${url}` }, 500)
  })
}

beforeEach(async () => {
  db = await freshDb(ENV)
  await ensureStoreSettings(0)
  fakeApis()
  sourceDown = false
})
afterEach(() => vi.unstubAllGlobals())

const BOOK = 'carte-diana'
const ip = () => `10.0.${++seq % 250}.${seq % 200}`
const place = async (raw: { productId: string; variantId?: string; quantity: number }[], method: 'card' | 'transfer' | 'cod' = 'card', extra: Partial<Parameters<typeof svc.placeOrder>[0]> = {}) => {
  const { order } = await svc.placeOrder({ lines: resolve(raw), form: { ...person, paymentMethod: method }, attemptId: `book-${++seq}`, ...extra })
  if (method === 'card') await svc.attachPaymentIntent(order.id, `pi_book_${seq}`)
  return (await orders.byId(db, order.id))!
}
const event = (type: string, o: { id: string; totalMinor: number; stripePaymentIntentId: string | null }, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ id: `evt_${++seq}`, type, livemode: false, data: { object: { id: o.stripePaymentIntentId, amount: o.totalMinor, amount_received: o.totalMinor, currency: 'ron', metadata: { order_id: o.id }, ...extra } } })
const stripeSays = async (body: string) => {
  const res = await webhook(new Request('https://test/api/webhooks/stripe', { method: 'POST', body, headers: { 'stripe-signature': signPayload(body, 'whsec_test') } }) as NextRequest)
  return res.status
}
const fetchPdf = (url: string, from = ip()) => download(new NextRequest(url, { headers: { 'x-forwarded-for': from } }))
const digitalJobs = async (orderId: string) => (await db.query<{ dedupe_key: string; status: string }>("select dedupe_key, status from jobs where kind = 'digital.email' and order_id = $1 order by id", [orderId])).rows
/** Runs the outbox on this test's database (a run kicked by an earlier test may still be finishing on its own). */
const drain = async () => {
  await runDueJobs(50)
  await runDueJobs(50)
}
const events = async (orderId: string) => (await entitlements.events(db, orderId)).map((e) => e.type).reverse()

describe('release: the book is sold only while its PDF can be delivered', () => {
  it('without the NEUROS source and link secret it is not listed, found or accepted', async () => {
    db = await freshDb({ ...ENV, NEUROS_BOOK_PDF_URL: '', NEUROS_BOOK_PDF_SECRET: '', DIGITAL_LINK_SECRET: '' })
    await ensureStoreSettings(0)
    expect(getConfig().digital).toBeNull()
    expect(catalog.getProduct(BOOK)).toBeUndefined()
    expect(catalog.products.map((p) => p.id)).not.toContain(BOOK)
    expect(resolveOrderLines([{ productId: BOOK, quantity: 1 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
    // Its page exists for static generation and answers 404 until then.
    expect(catalog.allSlugs()).toContain('cartea-dianei')
  })

  it('delivery configured but sales not switched on: hidden, while links and downloads still work for testing', async () => {
    db = await freshDb({ ...ENV, BOOK_SALES_ENABLED: '' })
    await ensureStoreSettings(0)
    expect(getConfig().digital).not.toBeNull()
    expect(catalog.getProduct(BOOK)).toBeUndefined()
    expect(resolveOrderLines([{ productId: BOOK, quantity: 1 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
  })

  it('a weak secret or a plain-http source keeps it out (no weaker setup is accepted)', async () => {
    db = await freshDb({ ...ENV, DIGITAL_LINK_SECRET: 'short' })
    await ensureStoreSettings(0)
    expect(getConfig().digital).toBeNull()
    db = await freshDb({ ...ENV, NEUROS_BOOK_PDF_URL: 'http://neuros.ro/api/carte/partener/pdf' })
    await ensureStoreSettings(0)
    expect(getConfig().digital).toBeNull()
    expect(catalog.getProduct(BOOK)).toBeUndefined()
  })

  it('released: fourth, after NEUROS Calm, Focus and Amber, at 120 lei, in both languages', () => {
    expect(catalog.products.map((p) => p.id)).toEqual(['balance-wave', 'brainlink-pro', 'ochelari-biohack', BOOK])
    const ro = catalog.getProduct(BOOK)!
    const en = catalog.getProduct(BOOK, 'en')!
    expect([ro.price, ro.author, ro.model, ro.slug]).toEqual([12000, 'Diana L. Palotaș', 'Știu. Vreau. DE CE NU POT?', 'cartea-dianei'])
    expect(en.kind).toMatch(/in Romanian/)
    expect(catalog.isPurchasable(ro)).toBe(true)
  })
})

describe('delivery: free without the book, 10 lei + VAT once per order with it', () => {
  it.each([
    ['no book', [{ productId: 'balance-wave' }], 0],
    ['1 book', [{ productId: BOOK, quantity: 1 }], 1210],
    ['3 books', [{ productId: BOOK, quantity: 3 }], 1210],
    ['book + NEUROS Calm', [{ productId: BOOK }, { productId: 'balance-wave' }], 1210],
    ['10 products + 1 book', [{ productId: 'balance-wave', quantity: 4 }, { productId: 'brainlink-pro', quantity: 3 }, { productId: 'ochelari-biohack', quantity: 3 }, { productId: BOOK, quantity: 1 }], 1210],
  ])('%s', (_, l, fee) => {
    expect(shippingFor(l)).toBe(fee)
  })

  it('in euro or dollars it is converted like a price (BNR rate, whole units)', () => {
    expect(shippingFor([{ productId: BOOK }], 'EUR')).toBe(convertUnit(1210, 'EUR'))
    expect(shippingFor([{ productId: BOOK }], 'USD')).toBe(convertUnit(1210, 'USD'))
  })
})

describe('orders with the book: one canonical total for Stripe, transfer, COD, FGO, the CRM and the emails', () => {
  it('book only: 120 + 12,10 = 132,10 lei, VAT included', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    expect([o.subtotalMinor, o.discountMinor, o.shippingMinor, o.totalMinor]).toEqual([12000, 0, 1210, 13210])
  })

  it('3 books: no quantity discount, no 2+1, delivery once', async () => {
    const o = await place([{ productId: BOOK, quantity: 3 }])
    expect([o.subtotalMinor, o.discountMinor, o.shippingMinor, o.totalMinor]).toEqual([36000, 0, 1210, 37210])
    expect(o.promotions).toEqual([])
  })

  it('book + 3 NEUROS Calm: Calm keeps its 20%, the book none, delivery once', async () => {
    const o = await place([{ productId: 'balance-wave', quantity: 3 }, { productId: BOOK, quantity: 1 }])
    const calm = o.items.find((i) => i.productId === 'balance-wave')!
    const book = o.items.find((i) => i.productId === BOOK)!
    expect(calm.discountMinor).toBe(Math.round(638000 * 3 * 0.2))
    expect(book.discountMinor).toBe(0)
    expect(o.shippingMinor).toBe(1210)
    expect(o.totalMinor).toBe(o.subtotalMinor - o.discountMinor + 1210)
  })

  it('a valid promo code lowers the book, never the delivery', async () => {
    await promoCodes.create(db, { code: 'CARTE10', kind: 'percent', value: 10, products: null, minOrderMinor: 0, maxUses: null, oncePerEmail: false, startsAt: null, endsAt: null, note: '' })
    const o = await place([{ productId: BOOK, quantity: 1 }], 'card', { promoCode: 'CARTE10' })
    expect(o.discountMinor).toBe(1200)
    expect([o.shippingMinor, o.totalMinor]).toEqual([1210, 12000 - 1200 + 1210])
  })

  it('cash on delivery collects the total with the delivery; the invoice has its own transport line', async () => {
    const o = await place([{ productId: BOOK, quantity: 2 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }], 'cod')
    expect(o.codAmountMinor).toBe(o.totalMinor)
    const inv = invoicePayload(getConfig().fgo!, o)
    const transport = inv.Continut.find((l) => l.CodArticol === 'transport')
    expect(transport).toMatchObject({ NrProduse: 1, PretTotal: 12.1 })
    expect(Math.round(inv.Continut.reduce((s, l) => s + fgoLineTotal(l), 0) * 100)).toBe(o.totalMinor)
  })

  it('an order without the book stays exactly as before: free delivery, no transport line', async () => {
    const o = await place([{ productId: 'brainlink-pro', quantity: 1 }])
    expect([o.shippingMinor, o.totalMinor]).toEqual([0, o.subtotalMinor])
    expect(invoicePayload(getConfig().fgo!, o).Continut.some((l) => l.CodArticol === 'transport')).toBe(false)
  })

  it('the international store (euro, card) charges the converted fee once', async () => {
    const o = await place([{ productId: BOOK, quantity: 2 }], 'card', { currency: 'EUR', locale: 'en', site: 'net' })
    expect(o.currency).toBe('EUR')
    expect(o.shippingMinor).toBe(convertUnit(1210, 'EUR'))
    expect(o.totalMinor).toBe(2 * convertUnit(12000, 'EUR') + convertUnit(1210, 'EUR'))
  })
})

describe('card: the PDF only after Stripe\'s verified webhook', () => {
  it('before the webhook the page waits (no access from a redirect or a URL); after it, the download is ready', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    expect(await delivery.pageDigital(db, o)).toEqual({ state: 'confirming' })
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    expect(await stripeSays(event('payment_intent.succeeded', o))).toBe(200)
    const paid = (await orders.byId(db, o.id))!
    const e = await entitlements.byOrder(db, o.id)
    expect(e).toMatchObject({ status: 'active', grantedBy: 'payment.confirmed' })
    const page = await delivery.pageDigital(db, paid)
    expect(page?.state).toBe('ready')
    expect((await digitalJobs(o.id)).map((j) => j.dedupe_key)).toEqual([`digital.email:${o.id}:auto`])
  })

  it('a failed card payment grants nothing', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    expect(await stripeSays(event('payment_intent.payment_failed', o, { last_payment_error: { message: 'declined' } }))).toBe(200)
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    expect(digitalAccess((await orders.byId(db, o.id))!)).toEqual({ ok: false, reason: 'not_paid' })
  })

  it('a redelivered or repeated webhook grants once and queues one email', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    const body = event('payment_intent.succeeded', o)
    await stripeSays(body)
    await stripeSays(body)
    await stripeSays(event('payment_intent.succeeded', o))
    await svc.confirmPayment(o.id, 'stripe.reconcile', { amountMinor: o.totalMinor, currency: 'ron' })
    expect((await db.query('select 1 from digital_entitlements where order_id = $1', [o.id])).rows).toHaveLength(1)
    expect(await digitalJobs(o.id)).toHaveLength(1)
    expect((await events(o.id)).filter((t) => t === 'granted')).toHaveLength(1)
  })

  it('the email goes out once, personalised, with a 7-day link; a retry of the same job sends nothing more', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    await stripeSays(event('payment_intent.succeeded', o))
    await drain()
    const e = (await entitlements.byOrder(db, o.id))!
    expect([e.emailStatus, e.emailsSent]).toEqual(['sent', 1])
    const file = readdirSync(mailDir).find((f) => f.startsWith(`${o.orderNumber}-carte-pdf-auto`) && f.endsWith('.txt'))!
    const mail = readFileSync(path.join(mailDir, file), 'utf8')
    expect(mail).toContain('Subject: Cartea ta digitală BiohackTech este pregătită')
    expect(mail).toContain('Bună, Ana!')
    expect(mail).toContain('Plata pentru comanda ta a fost confirmată.')
    expect(mail).toContain('«Știu. Vreau. DE CE NU POT?»')
    expect(mail).toContain('Cartea fizică va fi livrată separat.')
    expect(mail).toMatch(/Descarcă PDF: https:\/\/test\.biohack-tech\.ro\/api\/carte\/descarca\?t=/)
    // The same automatic email cannot be queued again (dedupe), and nothing is pending.
    expect(await jobs.enqueue(db, delivery.autoEmailJob(o.id))).toBe(false)
    await drain()
    expect((await entitlements.byOrder(db, o.id))!.emailsSent).toBe(1)
  })
})

describe('bank transfer and cash on delivery', () => {
  it('transfer: nothing before the payment is confirmed in Admin; then access and the email', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }], 'transfer')
    expect(await delivery.pageDigital(db, o)).toEqual({ state: 'after_transfer' })
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    expect((await delivery.adminSendDigital(o.id, 'admin:test', true)).ok).toBe(false)
    await svc.confirmPayment(o.id, 'admin')
    expect((await entitlements.byOrder(db, o.id))?.status).toBe('active')
    await drain()
    expect((await entitlements.byOrder(db, o.id))?.emailStatus).toBe('sent')
  })

  it('COD: nothing when placed, nothing when shipped; access and the email when DELIVERED', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }, { productId: 'brainlink-pro', quantity: 1 }], 'cod')
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    expect(await delivery.pageDigital(db, o)).toEqual({ state: 'after_delivery' })
    await svc.markShipped(o.id, 'admin', { courier: 'FAN Courier', trackingNumber: 'AWB1' })
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    await svc.markDelivered(o.id, 'admin')
    const e = await entitlements.byOrder(db, o.id)
    expect(e).toMatchObject({ status: 'active', grantedBy: 'order.delivered' })
    expect(await digitalJobs(o.id)).toHaveLength(1)
  })

  it('COD refused at the door (cancelled after shipping): never any access', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }], 'cod')
    await svc.markShipped(o.id, 'admin', { courier: 'FAN Courier', trackingNumber: 'AWB2' })
    await svc.cancelOrder(o.id, 'admin', 'refuzat la livrare')
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
    const r = await delivery.adminSendDigital(o.id, 'admin:test', true)
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/anulată/) })
    expect(await events(o.id)).toContain('email.manual_refused')
  })

  it('a cancelled transfer order never gets access', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }], 'transfer')
    await svc.cancelOrder(o.id, 'admin', 'clientul a renunțat')
    expect(digitalAccess((await orders.byId(db, o.id))!)).toEqual({ ok: false, reason: 'cancelled' })
    expect(await entitlements.byOrder(db, o.id)).toBeNull()
  })
})

describe('secure download', () => {
  const paidCard = async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    await stripeSays(event('payment_intent.succeeded', o))
    return (await orders.byId(db, o.id))!
  }

  it('an authorized link streams NEUROS\'s original (signed request), never cached, and is audited', async () => {
    const o = await paidCard()
    const page = (await delivery.pageDigital(db, o)) as { state: 'ready'; url: string }
    const res = await fetchPdf(page.url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="Stiu-Vreau-De-Ce-Nu-Pot-Diana-L-Palotas\.pdf"$/)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FAKE_PDF)
    expect(sourceCalls[0].headers.get('x-neuros-reference')).toBe(o.orderNumber)
    expect((await entitlements.byOrder(db, o.id))!.downloads).toBe(1)
    expect(await events(o.id)).toContain('download.ok')
  })

  it('refuses guessed, tampered, expired and foreign links', async () => {
    const o = await paidCard()
    const e = (await entitlements.byOrder(db, o.id))!
    const good = createLink(LINK_SECRET, { entitlementId: e.id, version: e.linkVersion, channel: 'e' }).token
    const base = 'https://test.biohack-tech.ro/api/carte/descarca?t='
    expect((await fetchPdf(`${base}${good.slice(0, -2)}xx`)).status).toBe(403)
    expect((await fetchPdf(`${base}${encodeURIComponent(createLink('x'.repeat(40), { entitlementId: e.id, version: 1, channel: 'e' }).token)}`)).status).toBe(403)
    expect((await fetchPdf(`${base}${e.id}`)).status).toBe(403)
    const old = createLink(LINK_SECRET, { entitlementId: e.id, version: e.linkVersion, channel: 'p', now: Date.now() - 31 * 60_000 }).token
    expect((await fetchPdf(`${base}${encodeURIComponent(old)}`)).status).toBe(410)
    expect(readLink(LINK_SECRET, old)).toEqual({ ok: false, reason: 'expired' })
    expect(sourceCalls).toHaveLength(0)
  })

  it('a full refund revokes access: links already given stop working', async () => {
    const o = await paidCard()
    const page = (await delivery.pageDigital(db, o)) as { state: 'ready'; url: string }
    await svc.recordRefund(o.id, 'stripe.webhook', o.totalMinor)
    expect((await entitlements.byOrder(db, o.id))?.status).toBe('revoked')
    expect((await fetchPdf(page.url)).status).toBe(403)
    expect(await delivery.pageDigital(db, (await orders.byId(db, o.id))!)).toEqual({ state: 'closed' })
    expect(sourceCalls).toHaveLength(0)
  })

  it('a person\'s revocation kills every link; restoring issues new ones', async () => {
    const o = await paidCard()
    const before = ((await delivery.pageDigital(db, o)) as { url: string }).url
    expect((await delivery.adminSetAccess(o.id, 'admin:test', 'revoke', 'link distribuit public')).ok).toBe(true)
    expect((await fetchPdf(before)).status).toBe(403)
    expect((await delivery.adminSetAccess(o.id, 'admin:test', 'restore', 'verificat')).ok).toBe(true)
    expect((await fetchPdf(before)).status).toBe(403) // the old version stays dead
    const fresh = ((await delivery.pageDigital(db, (await orders.byId(db, o.id))!)) as { url: string }).url
    expect((await fetchPdf(fresh)).status).toBe(200)
  })

  it('limits downloads per hour (sharing a link does not scale)', async () => {
    const o = await paidCard()
    const url = ((await delivery.pageDigital(db, o)) as { url: string }).url
    for (let i = 0; i < 8; i++) expect((await fetchPdf(url)).status).toBe(200)
    expect((await fetchPdf(url)).status).toBe(429)
    expect(await events(o.id)).toContain('download.denied')
  })

  it('NEUROS unavailable: a calm 503, nothing counted, the failure audited', async () => {
    const o = await paidCard()
    sourceDown = true
    const res = await fetchPdf(((await delivery.pageDigital(db, o)) as { url: string }).url)
    expect(res.status).toBe(503)
    expect((await entitlements.byOrder(db, o.id))!.downloads).toBe(0)
    expect(await events(o.id)).toContain('download.failed')
  })

  it('signs every request to NEUROS with the shared secret, a timestamp and the order number', () => {
    const h = sourceHeaders({ url: SOURCE_URL, secret: SOURCE_SECRET }, 'BHT-20261016-0001', 1_760_000_000_000)
    expect(h['X-Neuros-Timestamp']).toBe('1760000000')
    expect(h['X-Neuros-Signature']).toBe(createHmac('sha256', SOURCE_SECRET).update('biohacktech\n1760000000\nBHT-20261016-0001\nGET\n/api/carte/partener/pdf').digest('hex'))
  })
})

describe('admin: manual sending, links and audit', () => {
  it('resending needs a confirmation within 10 minutes; each send is a job and an audit row', async () => {
    const o = await place([{ productId: BOOK, quantity: 1 }])
    await stripeSays(event('payment_intent.succeeded', o))
    await drain()
    const again = await delivery.adminSendDigital(o.id, 'admin:test', false)
    expect(again).toEqual({ ok: false, message: expect.stringMatching(/Confirm retrimiterea/) })
    expect((await delivery.adminSendDigital(o.id, 'admin:test', true)).ok).toBe(true)
    // A second click while that send is on its way is refused.
    expect((await delivery.adminSendDigital(o.id, 'admin:test', true)).message).toMatch(/în curs/)
    await drain()
    expect((await entitlements.byOrder(db, o.id))!.emailsSent).toBe(2)
    expect(await events(o.id)).toEqual(expect.arrayContaining(['email.manual_requested', 'email.sent']))
    const audit = (await db.query<{ action: string }>("select action from admin_audit where action like 'digital.%'")).rows.map((r) => r.action)
    expect(audit).toContain('digital.email_resend')
  })

  it('a copied link is audited and refused for an unpaid order', async () => {
    const unpaid = await place([{ productId: BOOK, quantity: 1 }], 'transfer')
    expect((await delivery.adminCopyLink(unpaid.id, 'admin:test')).ok).toBe(false)
    await svc.confirmPayment(unpaid.id, 'admin')
    const r = await delivery.adminCopyLink(unpaid.id, 'admin:test')
    expect(r.ok && r.url).toMatch(/\/api\/carte\/descarca\?t=/)
    expect(await events(unpaid.id)).toContain('link.copied')
  })

  it('the admin list shows every order with the book and why delivery is blocked', async () => {
    const card = await place([{ productId: BOOK, quantity: 1 }])
    await stripeSays(event('payment_intent.succeeded', card))
    const cod = await place([{ productId: BOOK, quantity: 1 }], 'cod')
    await place([{ productId: 'brainlink-pro', quantity: 1 }], 'transfer')
    const list = await delivery.bookOrders(db)
    expect(list.map((x) => x.order.id).sort()).toEqual([card.id, cod.id].sort())
    const codRow = list.find((x) => x.order.id === cod.id)!
    expect(delivery.blockFor(codRow.order, codRow.entitlement)?.text).toMatch(/Livrată/)
  })
})

describe('CRM, assistant, AI caller and the iOS app', () => {
  it('GHL: the book has its own customers column, product and interest tags, and PDF tags', () => {
    expect(buyerStage([BOOK])).toBe('Cartea Diana Palotaș')
    expect(buyerStage([BOOK, BOOK])).toBe('Cartea Diana Palotaș')
    expect(buyerStage([BOOK, 'balance-wave'])).toBe(BUYER_STAGES.multi)
    expect([PRODUCT_TAG[BOOK], INTEREST_TAG[BOOK]]).toEqual(['bt-cumparat-carte', 'bt-interes-carte'])
    expect(digitalTags({ status: 'active', emailsSent: 1, downloads: 2 }).add).toEqual(['bt-carte-pdf-acces', 'bt-carte-pdf-trimis', 'bt-carte-pdf-descarcat'])
    expect(digitalTags({ status: 'revoked', emailsSent: 1, downloads: 0 }).remove).toEqual(['bt-carte-pdf-acces'])
  })

  it('the shared knowledge (chat + calls) knows the book, its delivery and the PDF rules', () => {
    const k = agentKnowledge('https://biohack-tech.ro')
    for (const s of ['Știu. Vreau. DE CE NU POT?', 'Diana L. Palotaș', '120 lei', '12,10 lei', 'Ramburs (plata la livrare): după ce coletul este livrat', 'Transfer bancar: după ce echipa confirmă', 'linkurile expiră', 'EEG și QEEG pe înțelesul tuturor'])
      expect(k).toContain(s)
    const prompt = assistantStableInstructions({ locale: 'ro', page: '/', siteUrl: 'https://test.biohack-tech.ro' })
    expect(prompt).toMatch(/Nu trimiți niciodată în chat fișierul, un link de descărcare/)
  })

  it('the assistant\'s tools show the book and price its cart with the delivery', async () => {
    const tools = assistantTools({ db, config: getConfig(), locale: 'ro', currency: 'RON', cart: [{ productId: BOOK, quantity: 2 }], verified: new Map(), onQueued: () => {} })
    const opts = { toolCallId: 't', messages: [], context: {} } as never
    const shown = (await tools.show_products.execute!({ productIds: [BOOK] }, opts)) as { products: { id: string; price?: string }[] }
    expect(shown.products[0]).toMatchObject({ id: BOOK, price: '120 lei' })
    const cart = (await tools.cart_summary.execute!({}, opts)) as { total: string; shipping: string }
    expect(cart.total).toBe('252,10 lei')
    expect(cart.shipping).toMatch(/^12,10 lei/)
  })

  it('the caller\'s cart total includes the delivery for a cart with the book', () => {
    expect(cartTotal({ productId: null, variantId: null, cart: [{ productId: BOOK, quantity: 1 }] } as never)).toBe(13210)
  })

  it('iOS API: an order with the book says where its PDF stands (read-only, additive)', async () => {
    const route = await import('@/app/api/app/v1/[[...path]]/route')
    const call = async (method: 'GET' | 'POST', p: string, body?: unknown, token?: string) => {
      const res = await route[method](new NextRequest(`https://biohack-tech.ro/api/app/v1/${p}`, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token && { authorization: `Bearer ${token}` }) }, ...(body ? { body: JSON.stringify(body) } : {}) }), { params: Promise.resolve({ path: p.split('/') }) })
      return (await res.json()) as Record<string, unknown>
    }
    const token = (await call('POST', 'auth/login', { username: 'admin', password: process.env.ADMIN_PASSWORD })).token as string
    const o = await place([{ productId: BOOK, quantity: 1 }], 'cod')
    const before = (await call('GET', `orders/${o.id}`, undefined, token)) as { shipping: number; total: number; digital: { status: string } }
    expect([before.shipping, before.total, before.digital.status]).toEqual([12.1, 132.1, 'waiting'])
    await svc.markShipped(o.id, 'admin', { courier: 'FAN Courier', trackingNumber: 'AWB3' })
    await svc.markDelivered(o.id, 'admin')
    const after = (await call('GET', `orders/${o.id}`, undefined, token)) as { digital: { status: string } }
    expect(after.digital.status).toBe('active')
    const plain = await place([{ productId: 'brainlink-pro', quantity: 1 }], 'cod')
    expect(((await call('GET', `orders/${plain.id}`, undefined, token)) as { digital: unknown }).digital).toBeNull()
  })
})
