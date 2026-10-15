/**
 * Order help in the website assistant. An order number alone never opens anything: the customer gives the order
 * number and the order's email, a 6-digit code goes to that email, and only the right code (within 10 minutes,
 * 5 tries) proves the order is theirs. The answer to a code request is the same whether or not the pair matched,
 * so the assistant cannot be used to learn which orders or addresses exist.
 *
 * After the code, the assistant holds a short-lived signed reference to that one order (30 minutes): the server
 * reads it back from the conversation and checks the signature on every turn; nothing else proves ownership.
 * Codes are stored as an HMAC only. Cancelling needs a second signed token, made only for an order that may be
 * cancelled and confirmed by the customer's own click (never by the model).
 */
import 'server-only'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { formatLei } from '@/lib/money'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { emailShell, esc } from '@/server/integrations/email/shell'
import { deliver } from '@/server/integrations/email/transport'
import { log, errText } from '@/server/log'
import { PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { ORDER_NUMBER_RE } from '@/server/orders/number'
import { orders } from '@/server/orders/repository'

export const CODE_TTL_MS = 10 * 60_000
export const CODE_MAX_ATTEMPTS = 5
export const CODES_PER_ORDER_HOUR = 3
export const REF_TTL_MS = 30 * 60_000
export const CANCEL_TTL_MS = 10 * 60_000

/** The signing key: ASSISTANT_SECRET, or one derived from another server secret. Null: order help is off. */
export function assistantSecret(): string | null {
  const own = process.env.ASSISTANT_SECRET
  if (own && own.length >= 16) return own
  const other = process.env.CRON_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD
  return other && other.length >= 10 ? `assistant:${other}` : null
}

const mac = (secret: string, s: string) => createHmac('sha256', secret).update(s).digest('base64url')
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** A signed, expiring token for one purpose and one order: `<purpose>.<orderId>.<expiry>.<mac>`. */
export function signToken(purpose: 'ref' | 'cancel', orderId: string, ttlMs: number, secret = assistantSecret(), now = Date.now()): string | null {
  if (!secret) return null
  const body = `${purpose}.${orderId}.${Math.floor((now + ttlMs) / 1000)}`
  return `${body}.${mac(secret, body)}`
}

/** The order id inside a valid, unexpired token of that purpose; null for anything else. */
export function readToken(purpose: 'ref' | 'cancel', token: unknown, secret = assistantSecret(), now = Date.now()): string | null {
  if (!secret || typeof token !== 'string' || token.length > 200) return null
  const m = /^(ref|cancel)\.([0-9a-f-]{36})\.(\d{9,11})\.([\w-]{43})$/.exec(token)
  if (!m || m[1] !== purpose) return null
  if (Number(m[3]) * 1000 < now) return null
  return same(mac(secret, `${m[1]}.${m[2]}.${m[3]}`), m[4]) ? m[2] : null
}

export const normalizeOrderNumber = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase().replace(/\s+/g, '') : '')
const normalizeEmail = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '')

/**
 * Sends a code when the number and the email belong to the same order (and the order has not had too many codes
 * this hour). The caller tells the customer the same thing either way.
 */
export async function requestOrderCode(q: Queryable, c: Config, x: { orderNumber: unknown; email: unknown }): Promise<'sent' | 'no_match' | 'limited' | 'off' | 'failed'> {
  const secret = assistantSecret()
  if (!secret) return 'off'
  const number = normalizeOrderNumber(x.orderNumber)
  const email = normalizeEmail(x.email)
  if (!ORDER_NUMBER_RE.test(number) || !email.includes('@')) return 'no_match'
  const o = await orders.byNumber(q, number)
  if (!o || o.email.toLowerCase() !== email) return 'no_match'
  const { rows } = await q.query<{ n: string }>(`select count(*) as n from order_otps where order_id = $1 and created_at > now() - interval '1 hour'`, [o.id])
  if (Number(rows[0]?.n ?? 0) >= CODES_PER_ORDER_HOUR) return 'limited'
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const id = randomUUID()
  await q.query('insert into order_otps (id, order_id, code_hash, expires_at) values ($1, $2, $3, $4)', [id, o.id, mac(secret, `${o.id}:${code}`), new Date(Date.now() + CODE_TTL_MS)])
  try {
    const mail = renderCodeEmail(o, code, c.siteUrl)
    await deliver(c, { ...mail, to: o.email, name: `order-code-${id}` })
    return 'sent'
  } catch (e) {
    log.error('assistant.code_email_failed', { orderNumber: o.orderNumber, error: errText(e) })
    return 'failed'
  }
}

/** Checks a code against the order's newest unused code. Wrong tries count; the 5th wrong one ends that code. */
export async function verifyOrderCode(q: Queryable, x: { orderNumber: unknown; code: unknown }): Promise<{ ok: true; order: Order } | { ok: false; reason: 'invalid' | 'expired' | 'too_many' | 'off' }> {
  const secret = assistantSecret()
  if (!secret) return { ok: false, reason: 'off' }
  const number = normalizeOrderNumber(x.orderNumber)
  const code = typeof x.code === 'string' ? x.code.replace(/\D/g, '') : ''
  if (!ORDER_NUMBER_RE.test(number) || code.length !== 6) return { ok: false, reason: 'invalid' }
  const o = await orders.byNumber(q, number)
  if (!o) return { ok: false, reason: 'invalid' }
  const { rows } = await q.query<{ id: string; code_hash: string; expires_at: string; attempts: number }>(
    'select id, code_hash, expires_at, attempts from order_otps where order_id = $1 and used_at is null order by created_at desc limit 1',
    [o.id],
  )
  const otp = rows[0]
  if (!otp) return { ok: false, reason: 'invalid' }
  if (otp.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, reason: 'too_many' }
  if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (!same(mac(secret, `${o.id}:${code}`), otp.code_hash)) {
    await q.query('update order_otps set attempts = attempts + 1 where id = $1', [otp.id])
    return { ok: false, reason: otp.attempts + 1 >= CODE_MAX_ATTEMPTS ? 'too_many' : 'invalid' }
  }
  await q.query('update order_otps set used_at = now() where id = $1', [otp.id])
  return { ok: true, order: o }
}

function renderCodeEmail(o: Order, code: string, siteUrl: string) {
  const subject = `Codul tău pentru comanda ${o.orderNumber}: ${code}`
  const text = [
    `Bună${o.customer.firstName ? `, ${o.customer.firstName}` : ''}!`,
    '',
    `Codul pentru a vedea comanda ${o.orderNumber} în asistentul de pe site este: ${code}`,
    '',
    'Codul este valabil 10 minute. Dacă nu tu l-ai cerut, ignoră acest email: fără cod, nimeni nu vede comanda.',
  ].join('\n')
  const content = `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#27343a">Bună${o.customer.firstName ? `, ${esc(o.customer.firstName)}` : ''}!</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#27343a">Codul pentru a vedea comanda <b>${esc(o.orderNumber)}</b> în asistentul de pe site este:</p>
<p style="margin:0 0 18px;font-size:30px;font-weight:800;letter-spacing:6px;color:#0b1316">${esc(code)}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#5b6a70">Codul este valabil 10 minute. Dacă nu tu l-ai cerut, ignoră acest email: fără cod, nimeni nu vede comanda.</p>`
  return { subject, text, html: emailShell({ subject, content, siteUrl }) }
}

/** How each state reads to the customer. */
const STATUS_TEXT: Record<Order['status'], string> = {
  pending: 'înregistrată, așteaptă plata',
  abandoned: 'plata cu cardul nu a fost finalizată',
  confirmed: 'confirmată, urmează pregătirea coletului',
  processing: 'coletul este în pregătire',
  shipped: 'expediată',
  delivered: 'livrată',
  cancelled: 'anulată',
}
const PAYMENT_TEXT: Record<Order['paymentStatus'], string> = {
  pending: 'plata cu cardul este în curs',
  awaiting_transfer: 'așteptăm transferul bancar',
  awaiting_collection: 'plătești curierului la livrare',
  failed: 'plata cu cardul nu a reușit',
  cancelled: 'plata cu cardul a fost anulată',
  paid: 'plătită',
  partially_refunded: 'rambursată parțial',
  refunded: 'rambursată',
}

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'long', year: 'numeric' }).format(d) : null)

/**
 * Whether the assistant itself may cancel: an order not yet prepared, not paid and without an invoice (cash on
 * delivery or a bank transfer still awaited). Anything else (paid by card, already preparing or shipped, invoiced)
 * goes to a person as a cancellation request, because money or a parcel is already moving.
 */
export function selfCancellable(o: Order): { ok: true } | { ok: false; why: string } {
  if (o.status === 'cancelled') return { ok: false, why: 'Comanda este deja anulată.' }
  if (o.status === 'shipped' || o.status === 'delivered') return { ok: false, why: 'Coletul a plecat deja; anularea sau refuzul se discută cu echipa.' }
  if (o.status === 'processing') return { ok: false, why: 'Coletul este deja în pregătire; echipa verifică dacă se mai poate opri.' }
  if (o.kind !== 'checkout') return { ok: false, why: 'Produsul adăugat după plată se anulează prin echipă.' }
  if (o.fgoInvoiceNumber) return { ok: false, why: 'Factura a fost deja emisă; anularea se face de echipă.' }
  const unpaid = (o.paymentMethod === 'cash_on_delivery' && o.paymentStatus === 'awaiting_collection') || (o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'awaiting_transfer')
  if (!unpaid) return { ok: false, why: o.paymentMethod === 'card' ? 'Comanda a fost plătită cu cardul; anularea și rambursarea se fac de echipă.' : 'Plata a fost deja înregistrată; anularea se face de echipă.' }
  if (o.status !== 'confirmed' && o.status !== 'pending') return { ok: false, why: 'Comanda nu mai poate fi anulată din asistent.' }
  return { ok: true }
}

/** What the customer may see about their own verified order: no address, phone or email. */
export function orderView(o: Order) {
  return {
    orderNumber: o.orderNumber,
    placedOn: day(o.createdAt),
    status: STATUS_TEXT[o.status],
    payment: `${PAYMENT_METHOD_LABEL[o.paymentMethod]}: ${PAYMENT_TEXT[o.paymentStatus]}`,
    items: o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`),
    total: formatLei(o.totalMinor),
    ...(o.promoCode && { promoCode: o.promoCode }),
    ...(o.courier && { courier: o.courier }),
    ...(o.trackingNumber && { awb: o.trackingNumber }),
    ...(o.trackingUrl && { trackingUrl: o.trackingUrl }),
    ...(o.shippedAt && { shippedOn: day(o.shippedAt) }),
    ...(o.deliveredAt && { deliveredOn: day(o.deliveredAt) }),
    ...(o.cancelledAt && { cancelledOn: day(o.cancelledAt) }),
    ...(o.returnStatus && { returnStatus: o.returnStatus === 'requested' ? 'retur cerut' : 'retur primit' }),
    canCancelHere: selfCancellable(o).ok,
  }
}
