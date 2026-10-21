/**
 * Personal vouchers and gifts: „Ți-am adăugat X lei în contul tău Biohack Tech.” (21.10.2026)
 *
 * A voucher belongs to one contact (the email it was issued to), one product, has a fixed value in bani (or, for a
 * gift, makes one unit of the product free) and an expiry. The customer uses it once, by its code, in the checkout's
 * existing code field (or through a link that brings the code). The server checks it inside the order's transaction
 * with the row locked, so the same voucher can never go to two orders, and only the address it was issued to can use it.
 *
 * Life cycle (every step is in voucher_events):
 *   issued    by a workflow or a person; an ACTIVE voucher for the same contact and product is reused instead
 *             (never a duplicate), and the same (source, source_ref) never issues twice;
 *   used      reserved by the order that applied it, in the order's own transaction;
 *   released  back to active when that order does not stand: cancelled, an unpaid card attempt closed or abandoned,
 *             or fully refunded. Past its expiry it becomes expired instead;
 *   expired   by the hourly expiry (or found expired when used);
 *   revoked   by a person, with a reason.
 * A late card payment of an order whose voucher was released takes it back if it is still free; if another order
 * used it meanwhile, both keep their price and the conflict is recorded for a person (voucher.conflict).
 */
import 'server-only'
import { randomInt, randomUUID } from 'node:crypto'
import { getProduct } from '@/content/catalog'
import { AMBER_PAIR_DISCOUNT, VOUCHER_VALIDITY_DAYS, VOUCHER_VALUE, isGiftProduct, isVoucherProduct, type VoucherSource } from '@/config/vouchers'
import type { PromoCodeRule } from '@/lib/promotions'
import type { Queryable, Row } from '@/server/db'
import { log } from '@/server/log'
import type { Order } from '@/server/orders/model'

export type VoucherStatus = 'active' | 'used' | 'expired' | 'revoked'
export type VoucherKind = 'value' | 'gift'

export type Voucher = {
  id: string
  code: string
  email: string
  kind: VoucherKind
  productId: string
  amountMinor: number | null
  perPaidUnit: boolean
  maxUnits: number | null
  source: string
  sourceRef: string | null
  status: VoucherStatus
  issuedAt: Date
  expiresAt: Date
  orderId: string | null
  usedAt: Date | null
  revokedAt: Date | null
  revokeReason: string | null
  issuedBy: string
}

const date = (v: unknown) => (v ? new Date(v as string) : null)
const toVoucher = (r: Row): Voucher => ({
  id: r.id as string,
  code: r.code as string,
  email: r.email as string,
  kind: r.kind as VoucherKind,
  productId: r.product_id as string,
  amountMinor: r.amount_minor == null ? null : Number(r.amount_minor),
  perPaidUnit: !!r.per_paid_unit,
  maxUnits: r.max_units == null ? null : Number(r.max_units),
  source: r.source as string,
  sourceRef: (r.source_ref as string) ?? null,
  status: r.status as VoucherStatus,
  issuedAt: new Date(r.issued_at as string),
  expiresAt: new Date(r.expires_at as string),
  orderId: (r.order_id as string) ?? null,
  usedAt: date(r.used_at),
  revokedAt: date(r.revoked_at),
  revokeReason: (r.revoke_reason as string) ?? null,
  issuedBy: r.issued_by as string,
})

export const normalizeEmail = (e: string) => e.trim().toLowerCase()

/** No 0/O, 1/I/L: a code read from an email and typed by hand. Upper case letters and digits only (the checkout's field). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PREFIX: Record<string, string> = { 'balance-wave': 'C', 'brainlink-pro': 'F', 'ochelari-biohack': 'A', 'carte-diana': 'K' }

/** BT + V (value) or G (gift) + the product's letter + 8 random characters: BTVC7K2Q9XMP. */
export function newVoucherCode(kind: VoucherKind, productId: string) {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `BT${kind === 'gift' ? 'G' : 'V'}${PREFIX[productId] ?? 'X'}${s}`
}

/** What the voucher is called on the order, the invoice line and in the admin. */
export function voucherLabel(v: Pick<Voucher, 'kind' | 'productId'>) {
  const name = getProduct(v.productId)?.name ?? v.productId
  return v.kind === 'gift' ? `Cadou ${name}` : `Voucher ${name}`
}

/** The pricing rule of a voucher (lib/promotions.ts): its value on its product only, once per order. */
export function voucherRule(v: Voucher): PromoCodeRule {
  const base = { code: v.code, products: [v.productId], minOrderMinor: 0, label: voucherLabel(v) }
  if (v.kind === 'gift') return { ...base, kind: 'fixed', value: 0, freeUnits: 1 }
  return { ...base, kind: 'fixed', value: v.amountMinor ?? 0, ...(v.perPaidUnit && { perPaidUnit: { maxUnits: v.maxUnits } }) }
}

async function event(q: Queryable, voucherId: string, type: string, actor: string, data: Record<string, unknown> = {}, orderId?: string | null) {
  await q.query('insert into voucher_events (voucher_id, type, order_id, actor, data) values ($1, $2, $3, $4, $5)', [voucherId, type, orderId ?? null, actor, JSON.stringify(data)])
}

/** Orders that stand (the same rule as the promo codes): not cancelled, not an unpaid or failed card attempt. */
const STANDING = `o.status not in ('cancelled','abandoned') and o.payment_status not in ('failed','cancelled','refunded')`

export type IssueInput = {
  email: string
  productId: string
  source: VoucherSource
  /** What this voucher is for (the abandoned checkout, the review, the VIP...): the same reference issues once. */
  sourceRef?: string | null
  kind?: VoucherKind
  /** Defaults to the source's validity (config/vouchers.ts). */
  validDays?: number
  actor?: string
  now?: Date
}

export type IssueRefusal = 'invalid_email' | 'not_voucher_product' | 'not_gift_product' | 'already_bought' | 'already_used'
export type IssueResult = { ok: true; voucher: Voucher; reused: boolean } | { ok: false; reason: IssueRefusal }

/**
 * Whether this contact may get a value voucher for this product now: not after buying the product (an order that
 * stands) and not after using a voucher for it. A gift has its own eligibility (the reward that grants it).
 */
export async function voucherEligibility(q: Queryable, email: string, productId: string): Promise<{ ok: true } | { ok: false; reason: 'already_bought' | 'already_used' }> {
  const e = normalizeEmail(email)
  const bought = await q.query(`select 1 from orders o join order_items i on i.order_id = o.id where lower(o.email) = $1 and i.product_id = $2 and ${STANDING} and o.payment_status in ('paid','partially_refunded','awaiting_collection','awaiting_transfer') limit 1`, [e, productId])
  if (bought.rows.length) return { ok: false, reason: 'already_bought' }
  const used = await q.query(`select 1 from vouchers v join orders o on o.id = v.order_id where v.email = $1 and v.product_id = $2 and v.kind = 'value' and v.status = 'used' and ${STANDING} limit 1`, [e, productId])
  if (used.rows.length) return { ok: false, reason: 'already_used' }
  return { ok: true }
}

/** Issues a voucher, or returns the contact's active one for the same product (never two active at once). */
export async function issueVoucher(q: Queryable, i: IssueInput): Promise<IssueResult> {
  const email = normalizeEmail(i.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'invalid_email' }
  const kind = i.kind ?? 'value'
  if (kind === 'value' && !isVoucherProduct(i.productId)) return { ok: false, reason: 'not_voucher_product' }
  if (kind === 'gift' && !isGiftProduct(i.productId)) return { ok: false, reason: 'not_gift_product' }
  const actor = i.actor ?? 'system'
  const now = i.now ?? new Date()
  // A reward (review, referral, VIP) is earned: issued on its own, whatever the contact bought or already holds.
  const reward = REWARD_SOURCES.has(i.source)
  // The same reason issues once: a repeated trigger finds what it issued the first time.
  if (i.sourceRef) {
    const { rows } = await q.query('select * from vouchers where source = $1 and source_ref = $2', [i.source, i.sourceRef])
    if (rows[0]) return { ok: true, voucher: toVoucher(rows[0]), reused: true }
  }
  const active = reward ? null : await activeFor(q, email, i.productId, kind, now)
  if (active) {
    await event(q, active.id, 'reused', actor, { source: i.source, sourceRef: i.sourceRef ?? null })
    return { ok: true, voucher: active, reused: true }
  }
  if (kind === 'value' && !reward) {
    const eligible = await voucherEligibility(q, email, i.productId)
    if (!eligible.ok) return eligible
  }
  const amber = i.productId === AMBER_PAIR_DISCOUNT.productId && kind === 'value'
  const days = i.validDays ?? VOUCHER_VALIDITY_DAYS[i.source]
  const expires = new Date(now.getTime() + days * 86_400_000)
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomUUID()
    const { rows } = await q.query(
      `insert into vouchers (id, code, email, kind, product_id, amount_minor, per_paid_unit, max_units, source, source_ref, issued_at, expires_at, issued_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict do nothing returning *`,
      [id, newVoucherCode(kind, i.productId), email, kind, i.productId, kind === 'value' ? VOUCHER_VALUE[i.productId as keyof typeof VOUCHER_VALUE] : null, amber, amber ? AMBER_PAIR_DISCOUNT.maxPairs : null, i.source, i.sourceRef ?? null, now, expires, actor],
    )
    if (rows[0]) {
      const v = toVoucher(rows[0])
      await event(q, v.id, 'issued', actor, { source: i.source, sourceRef: i.sourceRef ?? null, amountMinor: v.amountMinor, expiresAt: v.expiresAt.toISOString() })
      return { ok: true, voucher: v, reused: false }
    }
    // A concurrent issue won the one active slot (or the reference): return what it issued.
    const raced = (i.sourceRef && (await q.query('select * from vouchers where source = $1 and source_ref = $2', [i.source, i.sourceRef])).rows[0]) || null
    if (raced) return { ok: true, voucher: toVoucher(raced), reused: true }
    const other = reward ? null : await activeFor(q, email, i.productId, kind, now)
    if (other) return { ok: true, voucher: other, reused: true }
    // Otherwise the random code collided: try another.
  }
  throw new Error('voucher code collision')
}

export const REWARD_SOURCES = new Set<string>(['review', 'referral', 'vip'])

/** The contact's active marketing voucher for this product (rewards are never merged with one). */
async function activeFor(q: Queryable, email: string, productId: string, kind: VoucherKind, now: Date) {
  const { rows } = await q.query(`select * from vouchers where email = $1 and product_id = $2 and kind = $3 and status = 'active' and source not in ('review','referral','vip')`, [email, productId, kind])
  if (!rows[0]) return null
  const v = toVoucher(rows[0])
  if (v.expiresAt <= now) {
    await expire(q, v)
    return null
  }
  return v
}

async function expire(q: Queryable, v: Voucher) {
  const { rows } = await q.query(`update vouchers set status = 'expired' where id = $1 and status = 'active' returning id`, [v.id])
  if (rows.length) await event(q, v.id, 'expired', 'system', { expiresAt: v.expiresAt.toISOString() })
}

export const VOUCHER_CODE_RE = /^BT[VG][A-Z][A-Z0-9]{8}$/

export async function voucherByCode(q: Queryable, code: string, lock = false) {
  const { rows } = await q.query(`select * from vouchers where code = $1 ${lock ? 'for update' : ''}`, [code])
  return rows[0] ? toVoucher(rows[0]) : null
}

export async function voucherById(q: Queryable, id: string, lock = false) {
  const { rows } = await q.query(`select * from vouchers where id = $1 ${lock ? 'for update' : ''}`, [id])
  return rows[0] ? toVoucher(rows[0]) : null
}

/** The problems a customer can meet with a voucher, named like the promo codes' (server/promo.ts), so the checkout's messages fit. */
export type VoucherProblem = 'unknown' | 'inactive' | 'expired' | 'already_used' | 'other_email'

/**
 * Whether this voucher may be used now by this address. Vouchers are in lei: an order in another currency (the
 * international site) cannot use one. `lock`: inside the order's transaction.
 */
export async function checkVoucher(q: Queryable, code: string, opts: { email?: string; currency?: string; lock?: boolean; now?: Date } = {}): Promise<{ ok: true; voucher: Voucher } | { ok: false; problem: VoucherProblem } | null> {
  const v = await voucherByCode(q, code, opts.lock)
  if (!v) return null
  const now = opts.now ?? new Date()
  if (v.status === 'revoked') return { ok: false, problem: 'inactive' }
  if (v.status === 'used') return { ok: false, problem: 'already_used' }
  if (v.status === 'expired') return { ok: false, problem: 'expired' }
  // Past its expiry: refused (the expiry job marks it; a refused order rolls its own writes back).
  if (v.expiresAt <= now) return { ok: false, problem: 'expired' }
  if (opts.currency && opts.currency !== 'RON') return { ok: false, problem: 'inactive' }
  // Personal: only the address it was issued to (checked again in the order, where the address is final).
  const email = normalizeEmail(opts.email ?? '')
  if (email && email !== v.email) return { ok: false, problem: 'other_email' }
  return { ok: true, voucher: v }
}

/** Inside the order's transaction, after the order row exists: the voucher is this order's. */
export async function reserveVoucher(q: Queryable, v: Voucher, orderId: string, discountMinor: number, actor = 'checkout') {
  const { rows } = await q.query(`update vouchers set status = 'used', order_id = $2, used_at = now() where id = $1 and status = 'active' returning id`, [v.id, orderId])
  if (!rows.length) throw new Error('voucher no longer active')
  await q.query('update orders set voucher_id = $2 where id = $1', [orderId, v.id])
  await event(q, v.id, 'used', actor, { discountMinor }, orderId)
}

/** The order events that take a voucher back (the order does not stand any more), and the ones that keep it. */
const RELEASE_ON = new Set(['order.cancelled', 'order.abandoned', 'order.superseded', 'payment.cancelled'])

/**
 * Keeps a voucher in step with its order, in the order's transaction (orders/service.ts transition()):
 *   released: the order stops standing (cancelled, abandoned, its card payment cancelled, fully refunded);
 *   taken back: a released voucher whose order is paid after all (a late card payment), when still free.
 */
export async function syncVoucher(q: Queryable, o: Order, ev: string, now = new Date()): Promise<'released' | 'expired' | 'retaken' | 'conflict' | null> {
  if (!o.voucherId) return null
  const v = await voucherById(q, o.voucherId, true)
  if (!v) return null
  const fullRefund = ev === 'payment.refunded' && o.paymentStatus === 'refunded'
  if ((RELEASE_ON.has(ev) || fullRefund) && v.status === 'used' && v.orderId === o.id) {
    const past = v.expiresAt <= now
    await q.query(`update vouchers set status = $2, order_id = null, used_at = null where id = $1`, [v.id, past ? 'expired' : 'active'])
    await event(q, v.id, past ? 'expired' : 'released', 'system', { via: ev }, o.id)
    return past ? 'expired' : 'released'
  }
  if ((ev === 'payment.confirmed' || ev === 'payment.after_cancel') && v.orderId !== o.id) {
    if (v.status === 'active') {
      await q.query(`update vouchers set status = 'used', order_id = $2, used_at = now() where id = $1`, [v.id, o.id])
      await event(q, v.id, 'used', 'system', { via: ev, late: true }, o.id)
      return 'retaken'
    }
    // Paid with a discount whose voucher another order (or the expiry) took meanwhile: both keep their price.
    log.error('voucher.conflict', { voucherId: v.id, orderId: o.id, orderNumber: o.orderNumber, status: v.status, otherOrder: v.orderId })
    await event(q, v.id, 'conflict', 'system', { via: ev, paidOrder: o.id, holder: v.orderId, status: v.status }, o.id)
    return 'conflict'
  }
  return null
}

/** Active vouchers past their expiry become expired (the hourly job). */
export async function expireVouchers(q: Queryable, now = new Date()) {
  const { rows } = await q.query(`update vouchers set status = 'expired' where status = 'active' and expires_at <= $1 returning id, expires_at`, [now])
  for (const r of rows) await event(q, r.id as string, 'expired', 'system', { expiresAt: new Date(r.expires_at as string).toISOString() })
  return rows.length
}

/** A person withdraws a voucher that has not been used (an error, a fraud): it can no longer be used or reused. */
export async function revokeVoucher(q: Queryable, id: string, actor: string, reason: string) {
  const { rows } = await q.query(`update vouchers set status = 'revoked', revoked_at = now(), revoke_reason = $2 where id = $1 and status in ('active','expired') returning id`, [id, reason.slice(0, 300)])
  if (rows.length) await event(q, id, 'revoked', actor, { reason: reason.slice(0, 300) })
  return rows.length > 0
}

/** A person gives an expired or revoked voucher back (until `expiresAt`), when the contact has no other active one for it. */
export async function restoreVoucher(q: Queryable, id: string, actor: string, expiresAt: Date) {
  const v = await voucherById(q, id, true)
  if (!v || (v.status !== 'expired' && v.status !== 'revoked') || expiresAt <= new Date()) return false
  if (!REWARD_SOURCES.has(v.source) && (await activeFor(q, v.email, v.productId, v.kind, new Date()))) return false
  await q.query(`update vouchers set status = 'active', expires_at = $2, revoked_at = null, revoke_reason = null where id = $1`, [id, expiresAt])
  await event(q, id, 'restored', actor, { expiresAt: expiresAt.toISOString(), from: v.status })
  return true
}

/** A contact's vouchers, newest first (the "contul tău Biohack Tech" view, the admin, the CRM fields). */
export async function vouchersFor(q: Queryable, email: string) {
  const { rows } = await q.query('select * from vouchers where email = $1 order by issued_at desc', [normalizeEmail(email)])
  return rows.map(toVoucher)
}

export async function voucherHistory(q: Queryable, id: string) {
  const { rows } = await q.query('select type, order_id, actor, data, created_at from voucher_events where voucher_id = $1 order by id', [id])
  return rows.map((r) => ({ type: r.type as string, orderId: (r.order_id as string) ?? null, actor: r.actor as string, data: (r.data ?? {}) as Record<string, unknown>, createdAt: new Date(r.created_at as string) }))
}

/** For /admin: every voucher with its order number, newest first. */
export async function listVouchers(q: Queryable, filter: { status?: VoucherStatus; source?: string; email?: string } = {}, limit = 300) {
  const where: string[] = []
  const args: unknown[] = []
  if (filter.status) where.push(`v.status = $${args.push(filter.status)}`)
  if (filter.source) where.push(`v.source = $${args.push(filter.source)}`)
  if (filter.email) where.push(`v.email = $${args.push(normalizeEmail(filter.email))}`)
  const { rows } = await q.query(
    `select v.*, o.order_number from vouchers v left join orders o on o.id = v.order_id ${where.length ? `where ${where.join(' and ')}` : ''} order by v.issued_at desc limit $${args.push(limit)}`,
    args,
  )
  return rows.map((r) => ({ ...toVoucher(r), orderNumber: (r.order_number as string) ?? null }))
}
