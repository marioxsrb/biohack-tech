import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { sanitizeAttribution } from '@/lib/attribution'
import { normalizeOrder, validateOrder } from '@/lib/checkout'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { getConfig, paymentMethods } from '@/server/config'
import { StripeError, stripe } from '@/server/integrations/stripe'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { customerName } from '@/server/orders/model'
import { attachPaymentIntent, placeOrder, setStripeCustomer } from '@/server/orders/service'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

type ErrorCode = 'BAD_REQUEST' | 'RATE_LIMIT' | 'EMPTY' | 'BAD_LINE' | 'INVALID' | 'UNAVAILABLE' | 'PAYMENT_PROVIDER' | 'SERVER'

/** One error shape: a code for the client, a human sentence for the customer. */
const fail = (status: number, error: ErrorCode, message: string, extra?: object) => NextResponse.json({ error, message, ...extra }, { status })
const contact = `Scrie-ne la ${site.email} sau sună la ${site.phone}.`

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
  if (!rateLimit(`checkout:${clientIp(req.headers)}`, 12, 10 * 60_000)) {
    return fail(429, 'RATE_LIMIT', 'Prea multe încercări într-un timp scurt. Încearcă din nou în câteva minute.')
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'BAD_REQUEST', 'Cererea nu este validă. Reîncarcă pagina și încearcă din nou.')
  }

  const resolved = resolveOrderLines(body.lines)
  if (!resolved.ok) {
    return resolved.reason === 'EMPTY'
      ? fail(400, 'EMPTY', 'Coșul este gol.')
      : fail(409, 'BAD_LINE', 'Un produs din coș nu mai este disponibil sau s-a schimbat între timp. Reîncarcă pagina și verifică din nou coșul.')
  }

  const available = paymentMethods()
  if (!available.card && !available.transfer && !available.cod) return fail(503, 'UNAVAILABLE', `Comenzile online nu sunt active încă. ${contact}`)

  const form = normalizeOrder(body.order)
  const errors = validateOrder(form, body.acceptedTerms === true, available)
  if (Object.keys(errors).length) return fail(422, 'INVALID', 'Verifică câmpurile marcate în formular.', { fields: errors })

  const attemptId = typeof body.attemptId === 'string' && /^[\w-]{8,64}$/.test(body.attemptId) ? body.attemptId : crypto.randomUUID()

  let order
  try {
    // Campaign data is optional and never trusted as sent: unknown landings, hosts and keys are dropped.
    const attribution = sanitizeAttribution(body.attribution, new URL(site.url).host)
    ;({ order } = await placeOrder({ lines: resolved.lines, form, attemptId, attribution }))
  } catch (e) {
    // The customer gets a calm sentence and a short reference; the cause (database, schema...) stays in
    // the server log under the same reference. No personal data in either.
    const ref = crypto.randomUUID().slice(0, 8)
    log.error('checkout.order_failed', { ref, stage: 'order', error: errText(e) })
    return fail(500, 'SERVER', `Comanda nu a putut fi înregistrată. Nu s-a efectuat nicio plată. Încearcă din nou; dacă problema continuă, scrie-ne la ${site.email} (cod ${ref}).`, { ref })
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
    if (pi.amount !== order.totalMinor || pi.currency !== 'ron' || pi.metadata?.order_id !== order.id) throw new Error('payment intent does not match the order')
    // Already paid, or being processed: show the order instead of offering a second payment.
    if (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture') {
      return NextResponse.json({ method: 'card', submitted: true, orderNumber: order.orderNumber, token: order.publicToken })
    }
    if (pi.status === 'canceled') {
      return fail(409, 'BAD_LINE', 'Plata pentru această încercare a fost anulată. Reîncarcă pagina și plasează comanda din nou.')
    }
    return NextResponse.json({ method: 'card', orderNumber: order.orderNumber, token: order.publicToken, clientSecret: pi.client_secret })
  } catch (e) {
    const ref = crypto.randomUUID().slice(0, 8)
    log.error('checkout.stripe_failed', { ref, stage: 'payment_intent', orderId: order.id, orderNumber: order.orderNumber, error: errText(e), status: e instanceof StripeError ? e.status : undefined })
    return fail(502, 'PAYMENT_PROVIDER', `Plata cu cardul nu a putut fi pornită. Nu s-a efectuat nicio plată. Încearcă din nou în câteva minute (cod ${ref}).`, { ref })
  }
}
