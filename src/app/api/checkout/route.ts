import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { normalizeOrder, validateOrder } from '@/lib/checkout'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { getConfig, paymentMethods } from '@/server/config'
import { StripeError, stripe } from '@/server/integrations/stripe'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { attachPaymentIntent, placeOrder } from '@/server/orders/service'
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
 *   transfer → the order waits for payment; the bank details are on the order page.
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
      : fail(409, 'BAD_LINE', 'Un produs din coș s-a schimbat între timp. Reîncarcă pagina și verifică din nou coșul.')
  }

  const available = paymentMethods()
  if (!available.card && !available.transfer) return fail(503, 'UNAVAILABLE', `Comenzile online nu sunt active încă. ${contact}`)

  const form = normalizeOrder(body.order)
  const errors = validateOrder(form, body.acceptedTerms === true, available)
  if (Object.keys(errors).length) return fail(422, 'INVALID', 'Verifică câmpurile marcate în formular.', { fields: errors })

  const attemptId = typeof body.attemptId === 'string' && /^[\w-]{8,64}$/.test(body.attemptId) ? body.attemptId : crypto.randomUUID()

  let order
  try {
    ;({ order } = await placeOrder({ lines: resolved.lines, form, attemptId }))
  } catch (e) {
    log.error('checkout.order_failed', { error: errText(e) })
    return fail(500, 'SERVER', `Nu am putut înregistra comanda. Nu ți s-a retras nimic. Încearcă din nou sau ${contact.charAt(0).toLowerCase()}${contact.slice(1)}`)
  }
  kickJobs()

  if (order.paymentMethod === 'bank_transfer') {
    return NextResponse.json({ method: 'transfer', orderNumber: order.orderNumber, token: order.publicToken })
  }

  if (order.paymentStatus === 'paid') return NextResponse.json({ method: 'card', paid: true, orderNumber: order.orderNumber, token: order.publicToken })

  const c = getConfig()
  try {
    const pi = order.stripePaymentIntentId
      ? await stripe.retrievePaymentIntent(c.stripe!, order.stripePaymentIntentId)
      : await stripe.createPaymentIntent(c.stripe!, order)
    if (!order.stripePaymentIntentId) await attachPaymentIntent(order.id, pi.id)
    if (pi.amount !== order.totalMinor) throw new Error('payment intent amount differs from order total')
    return NextResponse.json({ method: 'card', orderNumber: order.orderNumber, token: order.publicToken, clientSecret: pi.client_secret })
  } catch (e) {
    log.error('checkout.stripe_failed', { orderId: order.id, orderNumber: order.orderNumber, error: errText(e), status: e instanceof StripeError ? e.status : undefined })
    return fail(502, 'PAYMENT_PROVIDER', 'Nu am putut porni plata cu cardul. Nu ți s-a retras nimic. Încearcă din nou în câteva minute.')
  }
}
