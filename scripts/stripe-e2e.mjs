// Stripe TEST-mode end-to-end check of card payments, against a running server and its PostgreSQL.
//
//   1. stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded \
//        --forward-to localhost:3000/api/webhooks/stripe        (its whsec_ in STRIPE_WEBHOOK_SECRET)
//   2. the app running with DATABASE_URL (PostgreSQL), Stripe TEST keys and STRIPE_WEBHOOK_SECRET
//   3. E2E_BASE_URL=http://localhost:3000 DATABASE_URL=... node scripts/stripe-e2e.mjs
//
// The paid scenario never requests the order page: payment must be confirmed by the webhook alone.
// Refuses to run with a live key. Uses Stripe's official test payment methods.
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!/^(sk|rk)_test_/.test(KEY)) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a TEST key.')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (the check reads the order state from PostgreSQL).')
  process.exit(1)
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
const stripe = async (path, body) => {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${KEY}`, ...(body && { 'Content-Type': 'application/x-www-form-urlencoded' }) },
    body: body ? new URLSearchParams(body) : undefined,
  })
  return res.json()
}

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const form = {
  buyerType: 'pf', firstName: 'Test', lastName: 'E2E', email: 'e2e@example.com', phone: '0722123456',
  address: 'Str. Test 1', city: 'Cluj-Napoca', county: 'Cluj', postalCode: '400001', sameAddress: true, notes: '', marketingConsent: false,
}
let ip = 0
async function place({ paymentMethod = 'card', attemptId = randomUUID() } = {}) {
  const res = await fetch(`${BASE}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ip}` },
    body: JSON.stringify({ lines: [{ productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 }], order: { ...form, paymentMethod }, acceptedTerms: true, attemptId }),
  })
  return { status: res.status, body: await res.json() }
}
const piOf = (clientSecret) => clientSecret.split('_secret_')[0]
const row = async (orderNumber) => (await db.query('select id, status, payment_status, paid_at, stripe_payment_intent_id from orders where order_number = $1', [orderNumber])).rows[0]
async function waitFor(orderNumber, ok, ms = 45_000) {
  const start = Date.now()
  for (;;) {
    const r = await row(orderNumber)
    if ((r && ok(r)) || Date.now() - start > ms) return r
    await sleep(750)
  }
}
// The order link moves its token into a cookie and redirects to /comanda (src/lib/private-links.ts): follow it like a browser.
async function orderPage(token) {
  const first = await fetch(`${BASE}/comanda/${token}`, { redirect: 'manual' })
  const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const to = first.headers.get('location')
  return to ? (await fetch(new URL(to, BASE), { headers: { cookie } })).text() : first.text()
}
const events = async (id) => (await db.query('select type from order_events where order_id = $1 order by id', [id])).rows.map((r) => r.type)

try {
  // 1. Paid, browser closed right after paying.
  const a = await place()
  check('card order → PaymentIntent client secret', a.status === 200 && !!a.body.clientSecret, a.body.orderNumber)
  check('order number is BHT-YYYYMMDD-XXXX', /^BHT-\d{8}-\d{4,}$/.test(a.body.orderNumber ?? ''))
  const piA = await stripe(`/payment_intents/${piOf(a.body.clientSecret)}`)
  check('PaymentIntent: order total, RON, card only, order metadata', piA.amount === 31500 && piA.currency === 'ron' && JSON.stringify(piA.payment_method_types) === '["card"]' && piA.metadata?.order_number === a.body.orderNumber)
  const paid = await stripe(`/payment_intents/${piA.id}/confirm`, { payment_method: 'pm_card_visa' })
  check('Stripe confirms the test card', paid.status === 'succeeded')
  // No request to /comanda/<token>: the customer is gone.
  const ra = await waitFor(a.body.orderNumber, (r) => r.payment_status === 'paid')
  check('BROWSER CLOSED: webhook alone → paid + confirmed', ra?.payment_status === 'paid' && ra?.status === 'confirmed' && !!ra?.paid_at)
  check('payment.confirmed recorded once', (await events(ra.id)).filter((t) => t === 'payment.confirmed').length === 1)

  // 2. The order page afterwards shows the server state.
  const page = await orderPage(a.body.token)
  check('order page shows the paid order', page.includes(a.body.orderNumber) && !page.includes('Se verifică plata'))

  // 3. Double submit of the same attempt.
  const attempt = randomUUID()
  const [d1, d2] = await Promise.all([place({ attemptId: attempt }), place({ attemptId: attempt })])
  check('double submit → one order, one PaymentIntent', d1.body.orderNumber === d2.body.orderNumber && piOf(d1.body.clientSecret) === piOf(d2.body.clientSecret))

  // 4. Declined, then retry on the same PaymentIntent.
  const b = await place()
  const piB = piOf(b.body.clientSecret)
  const declined = await stripe(`/payment_intents/${piB}/confirm`, { payment_method: 'pm_card_visa_chargeDeclined' })
  check('Stripe declines the test card', declined.error?.code === 'card_declined')
  const rb = await waitFor(b.body.orderNumber, (r) => r.payment_status === 'failed')
  check('declined → payment failed, order still open', rb?.payment_status === 'failed' && rb?.status === 'pending')
  await stripe(`/payment_intents/${piB}/confirm`, { payment_method: 'pm_card_visa' })
  const rb2 = await waitFor(b.body.orderNumber, (r) => r.payment_status === 'paid')
  check('retry after decline → paid + confirmed', rb2?.payment_status === 'paid' && rb2?.status === 'confirmed')

  // 5. 3-D Secure required: never paid without authentication.
  const c = await place()
  const auth = await stripe(`/payment_intents/${piOf(c.body.clientSecret)}/confirm`, { payment_method: 'pm_card_authenticationRequired', return_url: `${BASE}/comanda/${c.body.token}` })
  check('3DS card → requires_action at Stripe', auth.status === 'requires_action')
  await sleep(3000)
  check('3DS order stays unpaid', (await row(c.body.orderNumber))?.payment_status === 'pending')

  // 6. Cancelled PaymentIntent.
  const e = await place()
  await stripe(`/payment_intents/${piOf(e.body.clientSecret)}/cancel`, {})
  const re = await waitFor(e.body.orderNumber, (r) => r.payment_status === 'cancelled')
  check('cancelled PaymentIntent → payment cancelled, order closed', re?.payment_status === 'cancelled' && re?.status === 'cancelled')

  // 7. Paid attempt resubmitted: no second payment form.
  const replay = await fetch(`${BASE}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.1.1' },
    body: JSON.stringify({ lines: [{ productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 }], order: { ...form, paymentMethod: 'card' }, acceptedTerms: true, attemptId: attempt }),
  }).then((r) => r.json())
  check('unpaid attempt resubmitted → same order, payment form again', replay.orderNumber === d1.body.orderNumber && !!replay.clientSecret)

  // 8. Webhook signatures.
  const bad = await fetch(`${BASE}/api/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00' }, body: '{}' })
  check('invalid webhook signature → 400', bad.status === 400)
  const stored = (await db.query("select outcome, count(*)::int as n from webhook_events group by outcome order by outcome")).rows
  check('webhook outcomes stored', stored.length > 0, stored.map((r) => `${r.outcome}:${r.n}`).join(' '))

  // 9. Bank transfer (when configured on the server).
  const t = await place({ paymentMethod: 'transfer' })
  if (t.status === 200) {
    const rt = await row(t.body.orderNumber)
    check('bank transfer → awaiting transfer, not paid', rt.payment_status === 'awaiting_transfer' && rt.status === 'pending' && !rt.paid_at)
    const tp = await orderPage(t.body.token)
    check('transfer page shows IBAN and the order number', tp.includes('IBAN') && tp.includes(t.body.orderNumber))
  } else {
    console.log(`SKIP  bank transfer (${t.status}: ${t.body.message ?? ''})`)
  }
} catch (err) {
  check('unexpected error', false, err instanceof Error ? err.message.slice(0, 200) : String(err))
} finally {
  await db.end()
}
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
