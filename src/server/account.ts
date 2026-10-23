/**
 * "Contul tău Biohack Tech" without passwords: a signed link per email address (sent in the customer's own emails),
 * valid ACCOUNT_LINK_DAYS. It opens that address's vouchers, rewards and review-video uploads, and nothing else; every
 * voucher, reward and order shown or used is checked again against the address in the link. Changing the address in
 * the browser changes nothing: the address is inside the signature.
 *
 * Secret: ACCOUNT_LINK_SECRET, or ADMIN_SESSION_SECRET (already set in production). Without one, links are off.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Queryable } from '@/server/db'
import { normalizeEmail } from '@/server/vouchers'

export const ACCOUNT_LINK_DAYS = 30

export { AD_CONSENT_TEXT, AD_CONSENT_VERSION } from '@/config/review'

const secret = () => process.env.ACCOUNT_LINK_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim() || ''
const sign = (payload: string, key: string) => createHmac('sha256', `account:${key}`).update(payload).digest('base64url')

/** A link token for this address: base64url(email).expiry.signature. Null when no secret is configured. */
export function accountToken(email: string, now = new Date(), days = ACCOUNT_LINK_DAYS): string | null {
  const key = secret()
  if (!key) return null
  const payload = `${Buffer.from(normalizeEmail(email)).toString('base64url')}.${Math.floor(now.getTime() / 1000) + days * 86_400}`
  return `${payload}.${sign(payload, key)}`
}

/** The address a token opens, or null (unknown, altered, expired, or links off). */
export function accountEmail(token: string | null | undefined, now = new Date()): string | null {
  const key = secret()
  if (!key || !token || token.length > 600) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [e, exp, sig] = parts
  const expected = sign(`${e}.${exp}`, key)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now.getTime()) return null
  try {
    const email = Buffer.from(e, 'base64url').toString('utf8')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  } catch {
    return null
  }
}

/** The address's delivered orders that can still get a review video (one per order), newest first. */
export async function reviewableOrders(q: Queryable, email: string) {
  const { rows } = await q.query(
    `select o.id, o.order_number, o.delivered_at, r.status as review_status, r.ad_consent, r.ad_consent_withdrawn_at, r.file_deleted_at,
            (select string_agg(i.product_name, ', ' order by i.position) from order_items i where i.order_id = o.id) as products
     from orders o left join video_reviews r on r.order_id = o.id
     where lower(o.email) = $1 and o.kind = 'checkout' and o.status = 'delivered' and o.payment_status in ('paid','partially_refunded') and o.return_status is null
     order by o.delivered_at desc limit 20`,
    [normalizeEmail(email)],
  )
  return rows.map((r) => ({
    id: r.id as string,
    orderNumber: r.order_number as string,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at as string) : null,
    products: (r.products as string) ?? '',
    reviewStatus: (r.review_status as string | null) ?? null,
    adConsent: r.ad_consent === true,
    consentWithdrawn: !!r.ad_consent_withdrawn_at,
    fileDeleted: !!r.file_deleted_at,
  }))
}

/** Whether this order belongs to this address (the review upload checks it). */
export async function ownsOrder(q: Queryable, email: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return false
  const { rows } = await q.query('select 1 from orders where id = $1 and lower(email) = $2', [orderId, normalizeEmail(email)])
  return rows.length > 0
}
