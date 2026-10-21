/**
 * Referral (referral-01, infrastructure only, 21.10.2026): after a positive review a customer gets one personal link;
 * a friend who places a FIRST order through it gets REFERRAL_FRIEND_PERCENT off (the code in the checkout's field,
 * brought by the link); the order is attributed to the referrer once. The referrer's reward (a standard voucher or a
 * gift, server/rewards.ts) waits until the friend's order is delivered and the return window has passed.
 *
 * Refused: the referrer's own address or phone (self-referral); a friend who already has an order that stands.
 * The same shipping address as the referrer's orders is accepted for the friend's discount but never rewarded.
 */
import 'server-only'
import { randomInt, randomUUID } from 'node:crypto'
import { REFERRAL_FRIEND_PERCENT, RETURN_WINDOW_DAYS } from '@/config/vouchers'
import type { PromoCodeRule } from '@/lib/promotions'
import type { Queryable } from '@/server/db'
import { phoneKey } from '@/server/risk'
import { normalizeEmail } from '@/server/vouchers'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const REFERRAL_CODE_RE = /^BTR[A-Z0-9]{7}$/

/** The customer's own referral code (one per address, created once). */
export async function referralCodeFor(q: Queryable, email: string): Promise<string> {
  const e = normalizeEmail(email)
  const found = await q.query('select code from referral_codes where email = $1', [e])
  if (found.rows[0]) return found.rows[0].code as string
  for (let i = 0; i < 5; i++) {
    let code = 'BTR'
    for (let j = 0; j < 7; j++) code += ALPHABET[randomInt(ALPHABET.length)]
    const { rows } = await q.query('insert into referral_codes (code, email) values ($1, $2) on conflict do nothing returning code', [code, e])
    if (rows[0]) return code
    const raced = await q.query('select code from referral_codes where email = $1', [e])
    if (raced.rows[0]) return raced.rows[0].code as string
  }
  throw new Error('referral code collision')
}

export const referralRule = (code: string): PromoCodeRule => ({ code, kind: 'percent', value: REFERRAL_FRIEND_PERCENT, products: null, minOrderMinor: 0, label: `Recomandare ${code}` })

/** Orders that stand: not cancelled, not an unpaid or failed card attempt, not refunded. */
const STANDING = `status not in ('cancelled','abandoned') and payment_status not in ('failed','cancelled','refunded')`

const addressKey = (a: { address?: string; city?: string } | null | undefined) =>
  a ? `${a.address ?? ''}|${a.city ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9|]/g, '') : ''

export type ReferralProblem = 'inactive' | 'already_used'

/**
 * Whether this friend may use this referral code. The email (and phone) are known only in the order; the checkout's
 * preview checks what it has. Self-referral and a returning customer are refused with the codes' usual messages.
 */
export async function checkReferral(q: Queryable, code: string, friend: { email?: string; phone?: string }): Promise<{ ok: true; referrer: string } | { ok: false; problem: ReferralProblem } | null> {
  const { rows } = await q.query('select email from referral_codes where code = $1', [code])
  if (!rows[0]) return null
  const referrer = rows[0].email as string
  const email = friend.email ? normalizeEmail(friend.email) : ''
  const phone = phoneKey(friend.phone) ?? ''
  if (email && email === referrer) return { ok: false, problem: 'inactive' }
  if (phone) {
    const own = await q.query(`select 1 from orders where lower(email) = $1 and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 9) = $2 limit 1`, [referrer, phone])
    if (own.rows.length) return { ok: false, problem: 'inactive' }
  }
  if (email || phone) {
    // A first order only: the friend has no order that stands, by address or by phone.
    const before = await q.query(
      `select 1 from orders where ${STANDING} and (($1 <> '' and lower(email) = $1) or ($2 <> '' and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 9) = $2)) limit 1`,
      [email, phone],
    )
    if (before.rows.length) return { ok: false, problem: 'already_used' }
  }
  return { ok: true, referrer }
}

/** Inside the friend's order transaction: the order is attributed to the referrer (once per order). */
export async function attributeReferral(q: Queryable, r: { code: string; referrer: string; orderId: string; friendEmail: string; shippingAddress: { address?: string; city?: string } }) {
  const theirs = await q.query(`select shipping_address from orders where lower(email) = $1`, [r.referrer])
  const same = theirs.rows.some((x) => addressKey(x.shipping_address as { address?: string; city?: string }) === addressKey(r.shippingAddress))
  await q.query(
    `insert into referral_attributions (id, code, referrer_email, friend_email, order_id, status, reason) values ($1, $2, $3, $4, $5, $6, $7) on conflict (order_id) do nothing`,
    [randomUUID(), r.code, r.referrer, normalizeEmail(r.friendEmail), r.orderId, same ? 'rejected' : 'pending', same ? 'same_address' : null],
  )
}

/**
 * Pending attributions whose order was delivered and kept past the return window become qualified; one whose order
 * did not stand (cancelled, refunded, returned) is rejected. Returns the newly qualified ones (for the rewards).
 */
export async function settleReferrals(q: Queryable, now = new Date()) {
  const cutoff = new Date(now.getTime() - RETURN_WINDOW_DAYS * 86_400_000)
  await q.query(
    `update referral_attributions a set status = 'rejected', reason = 'order_not_kept'
     from orders o where o.id = a.order_id and a.status = 'pending'
       and (o.status = 'cancelled' or o.payment_status in ('refunded','cancelled','failed') or o.return_status is not null)`,
  )
  const { rows } = await q.query(
    `update referral_attributions a set status = 'qualified', qualifies_at = $1
     from orders o where o.id = a.order_id and a.status = 'pending' and o.status = 'delivered' and o.delivered_at <= $2
       and o.payment_status in ('paid','partially_refunded') and o.return_status is null
     returning a.id, a.referrer_email`,
    [now, cutoff],
  )
  return rows.map((r) => ({ id: r.id as string, referrer: r.referrer_email as string }))
}
