import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { sanitizeAttribution } from '@/lib/attribution'
import { metaBrowser } from '@/lib/meta'
import { deliveryCountry, normalizeOrder, validateOrder } from '@/lib/checkout'
import { cardOnly, type Currency } from '@/lib/currency'
import { siteForHost } from '@/lib/sites'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { getConfig, paymentMethods } from '@/server/config'
import { StripeError, stripe } from '@/server/integrations/stripe'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { cookieFrom, VISITOR_COOKIE } from '@/lib/lead'
import { getDb } from '@/server/db'
import { linkOrder } from '@/server/leads'
import { customerName } from '@/server/orders/model'
import { attachPaymentIntent, placeOrder, PromoError, setStripeCustomer } from '@/server/orders/service'
import { normalizeCode, promoMessage } from '@/server/promo'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { ensureStoreSettings } from '@/server/store-settings'

export const runtime = 'nodejs'

type ErrorCode = 'BAD_REQUEST' | 'RATE_LIMIT' | 'EMPTY' | 'BAD_LINE' | 'INVALID' | 'UNAVAILABLE' | 'PAYMENT_PROVIDER' | 'SERVER' | 'PROMO'
type Locale = 'ro' | 'en'

/** One error shape: a code for the client, a human sentence for the customer, in the customer's language. */
const fail = (status: number, error: ErrorCode, message: string, extra?: object) => NextResponse.json({ error, message, ...extra }, { status })

/** What the customer reads for each error, in both languages (the English site gets English, not a generic line). */
const MESSAGES = {
  ro: {
    RATE_LIMIT: 'Prea multe încercări într-un timp scurt. Încearcă din nou în câteva minute.',
    BAD_REQUEST: 'Cererea nu este validă. Reîncarcă pagina și încearcă din nou.',
    EMPTY: 'Coșul este gol.',
    BAD_LINE: 'Un produs din coș nu mai este disponibil sau s-a schimbat între timp. Reîncarcă pagina și verifică din nou coșul.',
    UNAVAILABLE: `Comenzile online nu sunt active încă. Scrie-ne la ${site.email} sau sună la ${site.phone}.`,
    INVALID: 'Verifică câmpurile marcate în formular.',
    CANCELLED: 'Plata pentru această încercare a fost anulată. Reîncarcă pagina și plasează comanda din nou.',
    SERVER: (ref: string) => `Comanda nu a putut fi înregistrată. Nu s-a efectuat nicio plată. Încearcă din nou; dacă problema continuă, scrie-ne la ${site.email} (cod ${ref}).`,
    PAYMENT_PROVIDER: (ref: string) => `Plata cu cardul nu a putut fi pornită. Nu s-a efectuat nicio plată. Încearcă din nou în câteva minute (cod ${ref}).`,
  },
  en: {
    RATE_LIMIT: 'Too many attempts in a short time. Please try again in a few minutes.',
    BAD_REQUEST: 'The request is not valid. Reload the page and try again.',
    EMPTY: 'Your cart is empty.',
    BAD_LINE: 'A product in your cart is no longer available or has changed. Reload the page and check your cart again.',
    UNAVAILABLE: `Online orders are not open yet. Write to us at ${site.email} or call ${site.phone}.`,
    INVALID: 'Please check the fields marked in the form.',
    CANCELLED: 'The payment for this attempt was cancelled. Reload the page and place the order again.',
    SERVER: (ref: string) => `Your order could not be recorded. No payment was taken. Please try again; if it keeps happening, write to us at ${site.email} (code ${ref}).`,
    PAYMENT_PROVIDER: (ref: string) => `The card payment could not be started. No payment was taken. Please try again in a few minutes (code ${ref}).`,
  },
} as const

/** The checkout page's language: the body says it; before the body is read, the page it came from. */
const localeFrom = (req: NextRequest, body?: Record<string, unknown>): Locale =>
  body?.locale === 'en' || body?.locale === 'ro' ? body.locale : /^\/en(\/|$)/.test(new URL(req.headers.get('referer') ?? 'http://x/').pathname) ? 'en' : 'ro'

/**
 * Places an order. The browser sends product ids, variant ids, quantities and the form.
 * Prices, names and totals are resolved here, the order is written to our database, and:
 *   card     → a Stripe PaymentIntent for exactly the order total; the browser confirms it
 *              with Stripe, and the order becomes paid only when Stripe says so;
 *   transfer → the order waits for payment; the bank details are on the order page;
 *   cod      → cash on delivery: confirmed at once, no Stripe call at all; the courier collects the total.
 *              Offered only while config/payments.ts allows it for this total.
 * The same attempt submitted twice returns the same order.
 */
export async function POST(req: NextRequest) {
  // Prices and stock as the admin set them (server/store-settings.ts), before anything is priced.
  await ensureStoreSettings()
  if (!rateLimit(`checkout:${clientIp(req.headers)}`, 12, 10 * 60_000)) {
    return fail(429, 'RATE_LIMIT', MESSAGES[localeFrom(req)].RATE_LIMIT)
  }
  let body: Record<string, unknown>
  try {
    // A real request is a few kilobytes; anything far larger is refused before parsing.
    const raw = await req.text()
    if (raw.length > 64_000) throw new Error('too large')
    body = JSON.parse(raw)
  } catch {
    return fail(400, 'BAD_REQUEST', MESSAGES[localeFrom(req)].BAD_REQUEST)
  }
  const locale = localeFrom(req, body)
  const m = MESSAGES[locale]

  const resolved = resolveOrderLines(body.lines)
  if (!resolved.ok) {
    return resolved.reason === 'EMPTY'
      ? fail(400, 'EMPTY', m.EMPTY)
      : fail(409, 'BAD_LINE', m.BAD_LINE)
  }

  const form = normalizeOrder(body.order)
  // Romanian pages pay in lei; English pages in euro (default) or dollar. Outside Romania or in euro/dollar the
  // card is the only method (cash on delivery and bank transfer are for lei orders delivered in Romania).
  const currency: Currency = locale === 'ro' ? 'RON' : body.currency === 'USD' ? 'USD' : 'EUR'
  const configured = paymentMethods()
  const available = cardOnly(currency, deliveryCountry(form)) ? { card: configured.card, transfer: false, cod: false } : configured
  if (!available.card && !available.transfer && !available.cod) return fail(503, 'UNAVAILABLE', m.UNAVAILABLE)
  const errors = validateOrder(form, body.acceptedTerms === true, available, locale)
  if (Object.keys(errors).length) return fail(422, 'INVALID', m.INVALID, { fields: errors })
  const promoCode = normalizeCode(body.promoCode) || undefined

  const attemptId = typeof body.attemptId === 'string' && /^[\w-]{8,64}$/.test(body.attemptId) ? body.attemptId : crypto.randomUUID()

  let order
  try {
    // Campaign data is optional and never trusted as sent: unknown landings, hosts and keys are dropped.
    const siteHost = new URL(site.url).host
    const sanitized = sanitizeAttribution(body.attribution, siteHost)
    // Cookies and the request, never the body's copy: this is what the Conversions API matches to the pixel.
    const browser = metaBrowser(req.headers, { fbclid: sanitized?.fbclid, siteHost })
    const attribution = { ...(sanitized ?? {}), ...(browser && { meta: browser }) }
    let created: boolean
    ;({ order, created } = await placeOrder({ lines: resolved.lines, form, attemptId, attribution, promoCode, currency, locale, site: siteForHost(req.headers.get('host')) }))
    // This browser's leads now point to the order.
    const visitor = cookieFrom(req.headers.get('cookie'), VISITOR_COOKIE)
    if (created && visitor && /^[0-9a-f-]{36}$/.test(visitor)) {
      const placed = order
      await (await getDb()).tx((t) => linkOrder(t, visitor, placed)).catch((e) => log.error('lead.link_failed', { orderId: placed.id, error: errText(e) }))
    }
  } catch (e) {
    // A promo code that cannot be used (expired, used up, not for these products...): said next to the code field.
    if (e instanceof PromoError) {
      const message = promoMessage(e.problem, locale, e.rule)
      return fail(422, 'PROMO', message, { fields: { promoCode: message } })
    }
    // The customer gets a calm sentence and a short reference; the cause (database, schema...) stays in
    // the server log under the same reference. No personal data in either.
    const ref = crypto.randomUUID().slice(0, 8)
    log.error('checkout.order_failed', { ref, stage: 'order', error: errText(e) })
    return fail(500, 'SERVER', m.SERVER(ref), { ref })
  }
  kickJobs()

  if (order.paymentMethod === 'bank_transfer') {
    return NextResponse.json({ method: 'transfer', orderNumber: order.orderNumber, token: order.publicToken })
  }
  // Cash on delivery never reaches Stripe: no customer, no PaymentIntent.
  if (order.paymentMethod === 'cash_on_delivery') {
    return NextResponse.json({ method: 'cod', orderNumber: order.orderNumber, token: order.publicToken })
  }

  if (order.paymentStatus === 'paid') return NextResponse.json({ method: 'card', paid: true, orderNumber: order.orderNumber, token: order.publicToken })

  const c = getConfig()
  try {
    // A Stripe customer per card order lets the card be offered again right after payment
    // (post-purchase offer, on-session only). Stripe keeps the card; we keep only ids.
    let customerId = order.stripeCustomerId
    if (!customerId && !order.stripePaymentIntentId) {
      customerId = (await stripe.createCustomer(c.stripe!, { id: order.id, orderNumber: order.orderNumber, email: order.email, name: customerName(order.customer) })).id
      await setStripeCustomer(order.id, customerId)
    }
    const pi = order.stripePaymentIntentId
      ? await stripe.retrievePaymentIntent(c.stripe!, order.stripePaymentIntentId)
      : await stripe.createPaymentIntent(c.stripe!, order, customerId ?? undefined)
    if (!order.stripePaymentIntentId) await attachPaymentIntent(order.id, pi.id)
    // Never hand out a PaymentIntent that does not belong to this order exactly.
    if (pi.amount !== order.totalMinor || pi.currency !== order.currency.toLowerCase() || pi.metadata?.order_id !== order.id) throw new Error('payment intent does not match the order')
    // Already paid, or being processed: show the order instead of offering a second payment.
    if (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture') {
      return NextResponse.json({ method: 'card', submitted: true, orderNumber: order.orderNumber, token: order.publicToken })
    }
    if (pi.status === 'canceled') {
      return fail(409, 'BAD_LINE', m.CANCELLED)
    }
    return NextResponse.json({ method: 'card', orderNumber: order.orderNumber, token: order.publicToken, clientSecret: pi.client_secret })
  } catch (e) {
    const ref = crypto.randomUUID().slice(0, 8)
    log.error('checkout.stripe_failed', { ref, stage: 'payment_intent', orderId: order.id, orderNumber: order.orderNumber, error: errText(e), status: e instanceof StripeError ? e.status : undefined })
    return fail(502, 'PAYMENT_PROVIDER', m.PAYMENT_PROVIDER(ref), { ref })
  }
}
