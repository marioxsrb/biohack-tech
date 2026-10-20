/**
 * The international store (biohack-tech.net, English pages): euro and dollar prices from the lei prices at the BNR
 * rate (whole units), card only outside lei/Romania, every country, English emails, no AI calls, reports in lei.
 * Embedded PostgreSQL (PGlite), emails to files, Stripe stubbed; no real payment.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000, 'brainlink-pro': 180000 } }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))
vi.setConfig({ testTimeout: 20_000 })

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { renderEmail } = await import('@/server/integrations/email/templates')
const { getConfig } = await import('@/server/config')
const { convertUnit, formatMoney, setRates, cardOnly, ruleIn } = await import('@/lib/currency')
const { isIntlHost } = await import('@/lib/sites')
const { normalizeOrder, validateOrder } = await import('@/lib/checkout')
const { captureLead } = await import('@/server/leads')
const { buildReport, period } = await import('@/server/report')
const { invoicePayload } = await import('@/server/integrations/fgo')
const { parseBnr, parseEcb } = await import('@/server/fx')
const { POST: checkout } = await import('@/app/api/checkout/route')

const RATES = { EUR: 5.0, USD: 4.5, date: '2026-10-15' }
let db: Awaited<ReturnType<typeof freshDb>>
let mailDir: string
beforeEach(async () => {
  mailDir = mkdtempSync(path.join(tmpdir(), 'intl-mail-'))
  db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'file', EMAIL_FILE_DIR: mailDir, NOTIFY_EMAIL: 'orders@biohack-tech.ro', GHL_PRIVATE_TOKEN: '', ABANDONED_CHECKOUT_ENABLED: 'true', RECOVERY_EMAIL_ENABLED: 'true', AI_CALLING_ENABLED: 'true' })
  setRates(RATES)
})
afterEach(() => vi.unstubAllGlobals())

const de = { ...person, country: 'DE', shipCountry: 'DE', county: 'Bayern', postalCode: '80331', city: 'München', address: 'Marienplatz 1', phone: '+49 151 2345678' }

describe('money', () => {
  it('converts per unit to whole euros and dollars, and formats with the sign', () => {
    expect(convertUnit(638000, 'EUR')).toBe(127600) // 6.380 lei / 5.0 = €1,276
    expect(convertUnit(31500, 'USD')).toBe(7000) // 315 / 4.5 = $70
    expect(convertUnit(638000, 'RON')).toBe(638000)
    expect(formatMoney(127600, 'EUR')).toBe('€1,276')
    expect(formatMoney(7050, 'USD')).toBe('$70.50')
    expect(formatMoney(638000, 'RON')).toBe('6.380 lei')
    expect(ruleIn({ kind: 'fixed', value: 5000, minOrderMinor: 100000 }, 'EUR')).toEqual({ kind: 'fixed', value: 1000, minOrderMinor: 20000 })
  })

  it('reads BNR and ECB rates', () => {
    expect(parseBnr('<Cube date="2026-10-15"><Rate currency="EUR">5.3370</Rate><Rate currency="HUF" multiplier="100">1.2</Rate><Rate currency="USD">4.7571</Rate></Cube>')).toEqual({ EUR: 5.337, USD: 4.7571, date: '2026-10-15' })
    expect(parseEcb("<Cube time='2026-10-15'><Cube currency='USD' rate='1.1208'/><Cube currency='RON' rate='5.3337'/></Cube>")).toEqual({ EUR: 5.3337, USD: 4.7588, date: '2026-10-15' })
  })

  it('card only for euro, dollar or a parcel abroad', () => {
    expect(cardOnly('RON', 'RO')).toBe(false)
    expect(cardOnly('EUR', 'RO')).toBe(true)
    expect(cardOnly('RON', 'DE')).toBe(true)
  })
})

describe('international hosts and routing', () => {
  it('knows the .net hosts', () => {
    expect(isIntlHost('www.biohack-tech.net', false)).toBe(true)
    expect(isIntlHost('biohack-tech.net:443', false)).toBe(true)
    expect(isIntlHost('biohack-tech.ro', false)).toBe(false)
    expect(isIntlHost('biohack-tech.net.evil.com', false)).toBe(false)
  })

  it('opens biohack-tech.net in English unless Romanian was chosen; .ro stays Romanian', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://biohack-tech.ro')
    const { proxy } = await import('@/proxy')
    const net = await proxy(new NextRequest('https://www.biohack-tech.net/products/calm?x=1', { headers: { host: 'www.biohack-tech.net' } }))
    expect(net.status).toBe(307)
    expect(net.headers.get('location')).toBe('https://www.biohack-tech.net/en/products/calm?x=1')
    const ro = await proxy(new NextRequest('https://www.biohack-tech.net/products/calm', { headers: { host: 'www.biohack-tech.net', cookie: 'bt_lang=ro' } }))
    expect(ro.status).toBe(200)
    const en = await proxy(new NextRequest('https://www.biohack-tech.net/en/cart', { headers: { host: 'www.biohack-tech.net' } }))
    expect(en.status).toBe(200)
    const main = await proxy(new NextRequest('https://biohack-tech.ro/products/calm', { headers: { host: 'biohack-tech.ro' } }))
    expect(main.status).toBe(200)
  })
})

describe('the checkout form abroad', () => {
  it('accepts any country: county and 6-digit postcode only for Romania, VAT number for foreign companies', () => {
    const f = normalizeOrder(de)
    expect(f.country).toBe('DE')
    expect(validateOrder(f, true, { card: true }, 'en')).toEqual({})
    expect(validateOrder(normalizeOrder({ ...de, county: '' }), true, { card: true }, 'en')).toEqual({})
    expect(normalizeOrder({ ...de, country: 'XX' }).country).toBe('RO') // unknown codes fall back to Romania…
    expect(validateOrder(normalizeOrder({ ...person, postalCode: '80331' }), true, { card: true }, 'en').postalCode).toBeTruthy() // …where the rules apply
    const pj = normalizeOrder({ ...de, buyerType: 'pj', company: 'Beispiel GmbH', cui: 'DE123456789' })
    expect(validateOrder(pj, true, { card: true }, 'en')).toEqual({})
  })
})

describe('orders in euro and dollars', () => {
  it('prices in whole euros per unit, promotions in euros, with the rate, language and site stored', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 2 }]), form: { ...de, paymentMethod: 'card' }, attemptId: 'eur-1', currency: 'EUR', locale: 'en', site: 'net' })
    expect(order.currency).toBe('EUR')
    expect(order.fxRate).toBe(5)
    expect([order.locale, order.site]).toEqual(['en', 'net'])
    expect(order.items[0].unitPriceMinor).toBe(127600)
    expect(order.subtotalMinor).toBe(255200)
    expect(order.totalMinor).toBe(255200 - 25520) // 10% for 2
    expect(order.shippingAddress.country).toBe('DE')
    // FGO gets the currency, the rate and the country.
    const inv = invoicePayload(getConfig().fgo!, order)
    expect(inv).toMatchObject({ Valuta: 'EUR', Curs: 5, Client: { Tara: 'DE', Judet: 'Bayern' } })
  })

  it('the checkout: English pays in euro (or dollars), card only; Romanian keeps lei and cash on delivery', async () => {
    const calls: { url: string; body: string }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? '') })
      const body = new URLSearchParams(String(init?.body ?? ''))
      if (String(url).includes('/customers')) return new Response(JSON.stringify({ id: 'cus_1' }), { status: 200 })
      return new Response(JSON.stringify({ id: 'pi_1', status: 'requires_payment_method', amount: Number(body.get('amount')), amount_received: 0, currency: body.get('currency'), client_secret: 'cs', metadata: { order_id: body.get('metadata[order_id]') } }), { status: 200 })
    }))
    const req = (b: Record<string, unknown>, host = 'www.biohack-tech.net') => new NextRequest('https://www.biohack-tech.net/api/checkout', { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': `10.1.1.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(b) })
    const base = { lines: [{ productId: 'brainlink-pro', quantity: 1 }], acceptedTerms: true }
    const cod = await checkout(req({ ...base, order: { ...de, paymentMethod: 'cod' }, locale: 'en', currency: 'EUR', attemptId: 'a-cod-1234' }) as never)
    expect(cod.status).toBe(422)
    const usd = await checkout(req({ ...base, order: { ...de, paymentMethod: 'card' }, locale: 'en', currency: 'USD', attemptId: 'a-usd-1234' }) as never)
    const data = await usd.json()
    expect(usd.status).toBe(200)
    const o = (await orders.byNumber(db, data.orderNumber))!
    expect([o.currency, o.totalMinor, o.site, o.locale]).toEqual(['USD', 40000, 'net', 'en']) // 1.800 lei / 4.5 = $400
    const pi = calls.find((c) => c.url.includes('/payment_intents'))!
    expect(new URLSearchParams(pi.body).get('currency')).toBe('usd')
    expect(new URLSearchParams(pi.body).get('amount')).toBe('40000')
    // Romanian page in Romania: lei, cash on delivery allowed.
    const ro = await checkout(req({ ...base, order: { ...person, paymentMethod: 'cod' }, attemptId: 'a-ro-12345' }, 'biohack-tech.ro') as never)
    expect(ro.status).toBe(200)
    const roOrder = (await orders.byNumber(db, (await ro.json()).orderNumber))!
    expect([roOrder.currency, roOrder.totalMinor, roOrder.site]).toEqual(['RON', 180000, 'ro'])
  })

  it('emails an English order in English, with euro amounts and the .net order link', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...de, paymentMethod: 'card' }, attemptId: 'eur-mail', currency: 'EUR', locale: 'en', site: 'net' })
    const mail = renderEmail('order_confirmed', order, { siteUrl: 'https://biohack-tech.ro', bank: null })
    expect(mail.subject).toBe(`Your Biohack Tech order #${order.orderNumber}`)
    expect(mail.text).toContain('€360')
    expect(mail.text).toContain(`https://www.biohack-tech.net/en/comanda/${order.publicToken}`)
    expect(mail.text).toContain('Germany')
    expect(mail.text).not.toMatch(/ lei|Mulțumim/)
    expect(mail.html).toContain('The Biohack Tech team')
    const ro = renderEmail('cod_confirmed', (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'ro-mail' })).order, { siteUrl: 'https://biohack-tech.ro', bank: null })
    expect(ro.text).toContain('1.800 lei')
    expect(ro.text).toContain('https://biohack-tech.ro/comanda/')
  })

  it('reports count euro orders in lei at their own rate', async () => {
    await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 'r-ro' })
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...de, paymentMethod: 'card' }, attemptId: 'r-eur', currency: 'EUR', locale: 'en', site: 'net' })
    await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: order.totalMinor, currency: 'eur' })
    const r = await buildReport(db, period('azi'))
    const net = r.sites.find((s) => s.site === 'net')!
    expect(net.orders).toBe(1)
    expect(r.totals.revenueLei).toBe(1800 + 1800) // €360 × 5 = 1.800 lei, plus the lei order
  })
})

describe('abandoned carts on biohack-tech.net', () => {
  it('never schedules an AI call and records the email-only consent in English', async () => {
    await db.tx((t) =>
      captureLead(t, {
        visitorId: '11111111-1111-1111-1111-111111111111',
        stage: 'checkout_started',
        productId: 'cart',
        contact: { name: 'Anna Schmidt', email: 'anna@example.de', phone: '0722123456' },
        marketingConsent: true,
        callConsent: true,
        cart: [{ productId: 'balance-wave', quantity: 1 }],
        landingHost: 'www.biohack-tech.net',
        page: '/checkout',
        locale: 'en',
        site: 'net',
      }),
    )
    const all = (await db.query<{ kind: string }>('select kind from jobs')).rows.map((r) => r.kind)
    expect(all).not.toContain('call.attempt')
    expect(all).toContain('lead.recovery')
    const consent = (await db.query<{ text_version: string; consent_text: string }>('select text_version, consent_text from marketing_consent_events where email = $1', ['anna@example.de'])).rows[0]
    expect(consent.text_version).toBe('email-en-2026-10-16')
    expect(consent.consent_text).not.toMatch(/AI/)
    expect((await db.query('select count(*)::int as n from call_consent_events')).rows[0].n).toBe(0)
  })

  it('sends the recovery email in English from biohack-tech.net', async () => {
    const { lead } = await db.tx((t) =>
      captureLead(t, {
        visitorId: '22222222-2222-2222-2222-222222222222',
        stage: 'checkout_started',
        productId: 'cart',
        contact: { name: 'Anna Schmidt', email: 'anna2@example.de', phone: '' },
        marketingConsent: true,
        cart: [{ productId: 'balance-wave', quantity: 1 }],
        landingHost: 'www.biohack-tech.net',
        locale: 'en',
        site: 'net',
      }),
    )
    await db.query(`update leads set last_activity_at = now() - interval '3 hours' where id = $1`, [lead.id])
    await db.query(`update jobs set run_at = now() where kind = 'lead.recovery' and payload->>'step' = '1'`)
    await runDueJobs()
    const file = readdirSync(mailDir).find((n) => n.startsWith(`lead-recovery-${lead.id}`) && n.endsWith('.txt'))
    expect(file).toBeTruthy()
    const txt = readFileSync(path.join(mailDir, file!), 'utf8')
    expect(txt).toMatch(/Subject: Your cart is waiting for you/)
    expect(txt).toContain('https://www.biohack-tech.net/api/lead/resume?t=')
    expect(txt).toContain('Complete my order')
    expect(txt).toMatch(/1 × NEUROS Calm: €[\d,]+/)
    expect(await jobs.problems(db)).toEqual([])
  })
})

describe('the chat on the English pages', () => {
  it('shows prices in the visitor currency and says card only', async () => {
    vi.stubEnv('ASSISTANT_MODEL', 'mock')
    const { assistantTurn } = await import('@/server/assistant/chat')
    const { scriptedModel } = await import('@/server/assistant/mock-model')
    const { assistantInstructions } = await import('@/server/assistant/prompt')
    const res = await assistantTurn({
      db,
      config: getConfig(),
      context: { locale: 'en', currency: 'USD', intl: true, page: '/en', siteUrl: 'https://www.biohack-tech.net' },
      messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'Ce produs mi se potrivește?' }] }],
      cart: [],
      model: scriptedModel(),
    })
    const text = await res.text()
    expect(text).toContain('$1,418') // 6.380 lei / 4.5
    expect(text).not.toContain('6.380 lei')
    const prompt = assistantInstructions({ locale: 'en', currency: 'EUR', page: '/en', siteUrl: 'https://www.biohack-tech.net' })
    expect(prompt).toContain('doar card online prin Stripe, în EUR')
    expect(prompt).toContain('€1,276')
  })
})

describe('English legal pages', () => {
  it('has every legal page in English, same slugs and anchors', async () => {
    const { legalPages, getLegalPage } = await import('@/content/legal')
    for (const p of legalPages) {
      const en = getLegalPage(p.slug, 'en')!
      expect(en.slug).toBe(p.slug)
      expect(en.title).not.toBe(p.title)
      expect(en.sections.map((s) => s.id).filter(Boolean)).toEqual(p.sections.map((s) => s.id).filter(Boolean))
      expect(JSON.stringify(en)).not.toMatch(/ zile|Livrare gratuită|în cel mult/)
    }
  })
})
