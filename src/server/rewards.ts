/**
 * Rewards of the Review Video, Referral and VIP workflows (infrastructure, 21.10.2026; nothing is granted by itself):
 *
 *   Review Video (post-purchase-03)  one video per order, after delivery. A person approves or rejects it; an approved
 *                                    review earns ONE reward per order, whatever its rating (never conditioned on a
 *                                    positive review): a gift (NEUROS Amber or the book) at 0 lei, delivery paid.
 *                                    Using the video in advertising needs its own consent, recorded separately.
 *   Referral (referral-01)           a friend's first order delivered and kept past the return window earns the
 *                                    referrer one reward per attributed order (server/referrals.ts).
 *   VIP (vip-01)                     valid purchases adding up to VIP_THRESHOLD_RON: once per contact.
 * Referral and VIP rewards are a standard voucher (Calm 640, Focus 325, Amber 30 lei) or a gift, as the customer
 * chooses. A reward becomes a voucher or a gift code (server/vouchers.ts) only when claimed, once.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { GIFT_PRODUCTS, VIP_THRESHOLD_RON, isGiftProduct, isVoucherProduct } from '@/config/vouchers'
import type { Queryable, Row } from '@/server/db'
import { settleReferrals } from '@/server/referrals'
import { issueVoucher, normalizeEmail, voucherById, type Voucher } from '@/server/vouchers'
import { isVideoType, MAX_VIDEO_BYTES, type VideoStorage } from '@/server/integrations/video-storage'

export type RewardSource = 'review' | 'referral' | 'vip'
export type RewardStatus = 'pending' | 'available' | 'claimed' | 'revoked'
export type Reward = { id: string; email: string; source: RewardSource; sourceRef: string; status: RewardStatus; choice: 'voucher' | 'gift' | null; productId: string | null; voucherId: string | null; availableAt: Date | null; createdAt: Date }

const toReward = (r: Row): Reward => ({
  id: r.id as string,
  email: r.email as string,
  source: r.source as RewardSource,
  sourceRef: r.source_ref as string,
  status: r.status as RewardStatus,
  choice: (r.choice as Reward['choice']) ?? null,
  productId: (r.product_id as string) ?? null,
  voucherId: (r.voucher_id as string) ?? null,
  availableAt: r.available_at ? new Date(r.available_at as string) : null,
  createdAt: new Date(r.created_at as string),
})

/** One reward per source and reference (an order, an attribution, a contact): a second call returns the first. */
export async function grantReward(q: Queryable, r: { email: string; source: RewardSource; sourceRef: string; note?: string; now?: Date }): Promise<{ reward: Reward; created: boolean }> {
  const { rows } = await q.query(
    `insert into rewards (id, email, source, source_ref, status, available_at, note) values ($1, $2, $3, $4, 'available', $5, $6)
     on conflict (source, source_ref) do nothing returning *`,
    [randomUUID(), normalizeEmail(r.email), r.source, r.sourceRef, r.now ?? new Date(), r.note ?? null],
  )
  if (rows[0]) return { reward: toReward(rows[0]), created: true }
  const found = await q.query('select * from rewards where source = $1 and source_ref = $2', [r.source, r.sourceRef])
  return { reward: toReward(found.rows[0]), created: false }
}

export type ClaimProblem = 'not_found' | 'not_available' | 'gift_only' | 'not_gift_product' | 'not_voucher_product'

/**
 * The customer's choice turns the reward into its code, once: a review reward is a gift; a referral or VIP reward
 * a standard voucher or a gift. Claiming again returns the same code.
 */
export async function claimReward(q: Queryable, id: string, choice: { kind: 'voucher' | 'gift'; productId: string }, actor = 'customer'): Promise<{ ok: true; voucher: Voucher } | { ok: false; problem: ClaimProblem }> {
  const { rows } = await q.query('select * from rewards where id = $1 for update', [id])
  if (!rows[0]) return { ok: false, problem: 'not_found' }
  const r = toReward(rows[0])
  if (r.status === 'claimed' && r.voucherId) {
    const v = await voucherById(q, r.voucherId)
    if (v) return { ok: true, voucher: v }
  }
  if (r.status !== 'available') return { ok: false, problem: 'not_available' }
  if (r.source === 'review' && choice.kind !== 'gift') return { ok: false, problem: 'gift_only' }
  if (choice.kind === 'gift' && !isGiftProduct(choice.productId)) return { ok: false, problem: 'not_gift_product' }
  if (choice.kind === 'voucher' && !isVoucherProduct(choice.productId)) return { ok: false, problem: 'not_voucher_product' }
  const issued = await issueVoucher(q, { email: r.email, productId: choice.productId, kind: choice.kind === 'gift' ? 'gift' : 'value', source: r.source, sourceRef: r.id, actor })
  if (!issued.ok) return { ok: false, problem: 'not_available' }
  await q.query(`update rewards set status = 'claimed', choice = $2, product_id = $3, voucher_id = $4, updated_at = now() where id = $1`, [r.id, choice.kind, choice.productId, issued.voucher.id])
  return { ok: true, voucher: issued.voucher }
}

export async function revokeReward(q: Queryable, id: string, note: string) {
  const { rows } = await q.query(`update rewards set status = 'revoked', note = $2, updated_at = now() where id = $1 and status in ('pending','available') returning id`, [id, note.slice(0, 300)])
  return rows.length > 0
}

export async function rewardsFor(q: Queryable, email: string) {
  const { rows } = await q.query('select * from rewards where email = $1 order by created_at desc', [normalizeEmail(email)])
  return rows.map(toReward)
}

export async function listRewards(q: Queryable, limit = 300) {
  const { rows } = await q.query('select r.*, v.code, v.status as voucher_status from rewards r left join vouchers v on v.id = r.voucher_id order by r.created_at desc limit $1', [limit])
  return rows.map((r) => ({ ...toReward(r), code: (r.code as string) ?? null, voucherStatus: (r.voucher_status as string) ?? null }))
}

// ---------------------------------------------------------------- Review Video

export type VideoReviewStatus = 'received' | 'in_review' | 'approved' | 'rejected'
export type VideoProblem = 'not_found' | 'not_delivered' | 'already_sent' | 'bad_type' | 'too_large' | 'storage_off'

/** The order a review is for: delivered (the request goes out 7 days after delivery). */
async function reviewableOrder(q: Queryable, orderId: string) {
  const { rows } = await q.query(`select id, email, status, delivered_at from orders where id = $1`, [orderId])
  return rows[0] ?? null
}

/**
 * Starts an upload: one video per order. A rejected one may be replaced; a received, reviewed or approved one not.
 * Returns where the browser sends the file (straight to the storage).
 */
export async function startVideoUpload(q: Queryable, storage: VideoStorage, i: { orderId: string; contentType: string; sizeBytes: number }): Promise<{ ok: true; uploadUrl: string; key: string } | { ok: false; problem: VideoProblem }> {
  if (storage.kind === 'none') return { ok: false, problem: 'storage_off' }
  if (!isVideoType(i.contentType)) return { ok: false, problem: 'bad_type' }
  if (!(i.sizeBytes > 0) || i.sizeBytes > MAX_VIDEO_BYTES) return { ok: false, problem: 'too_large' }
  const o = await reviewableOrder(q, i.orderId)
  if (!o) return { ok: false, problem: 'not_found' }
  if (o.status !== 'delivered') return { ok: false, problem: 'not_delivered' }
  const prior = await q.query('select status from video_reviews where order_id = $1', [i.orderId])
  if (prior.rows[0] && prior.rows[0].status !== 'rejected') return { ok: false, problem: 'already_sent' }
  const ext = i.contentType === 'video/quicktime' ? 'mov' : i.contentType === 'video/webm' ? 'webm' : 'mp4'
  const key = `${i.orderId}/${randomUUID()}.${ext}`
  const signed = await storage.uploadUrl(key)
  if (!signed) return { ok: false, problem: 'storage_off' }
  return { ok: true, uploadUrl: signed.url, key }
}

/**
 * The upload finished: the review is received (status 'received'), with the consents the customer gave. A rejected
 * video that is replaced is deleted from the storage (never two files for one order).
 */
export async function recordVideoReview(q: Queryable, i: { orderId: string; key: string; contentType: string; sizeBytes: number; rating?: number | null; adConsent: boolean; adConsentVersion?: string }, storage?: VideoStorage) {
  const o = await reviewableOrder(q, i.orderId)
  if (!o || o.status !== 'delivered' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm)$/i.test(i.key) || !i.key.startsWith(`${i.orderId}/`)) return { ok: false as const }
  const prior = await q.query<{ storage_key: string | null; status: string }>('select storage_key, status from video_reviews where order_id = $1', [i.orderId])
  const rating = i.rating != null && Number.isInteger(i.rating) && i.rating >= 1 && i.rating <= 5 ? i.rating : null
  const { rows } = await q.query(
    `insert into video_reviews (id, order_id, email, status, storage_key, content_type, size_bytes, rating, ad_consent, ad_consent_at, ad_consent_version)
     values ($1, $2, $3, 'received', $4, $5, $6, $7, $8, case when $8 then now() else null end, $9)
     on conflict (order_id) do update set status = 'received', storage_key = excluded.storage_key, content_type = excluded.content_type, size_bytes = excluded.size_bytes,
       rating = excluded.rating, ad_consent = excluded.ad_consent, ad_consent_at = excluded.ad_consent_at, ad_consent_version = excluded.ad_consent_version,
       submitted_at = now(), reviewed_at = null, reviewed_by = null, reject_reason = null
     where video_reviews.status = 'rejected'
     returning id`,
    [randomUUID(), i.orderId, normalizeEmail(o.email as string), i.key, i.contentType, i.sizeBytes, rating, i.adConsent, i.adConsent ? (i.adConsentVersion ?? 'v1') : null],
  )
  if (rows[0] && storage && prior.rows[0]?.storage_key && prior.rows[0].storage_key !== i.key) await storage.remove(prior.rows[0].storage_key).catch(() => false)
  return rows[0] ? { ok: true as const, id: rows[0].id as string } : { ok: false as const }
}

/**
 * A person moves a review: in_review, approved (the reward becomes available: once per order, whatever the rating),
 * or rejected (with a reason; the customer may send another). An approved review is final.
 */
export async function reviewVideo(q: Queryable, id: string, to: 'in_review' | 'approved' | 'rejected', actor: string, reason?: string) {
  const { rows } = await q.query('select * from video_reviews where id = $1 for update', [id])
  const r = rows[0]
  if (!r || r.status === 'approved' || r.status === to) return { changed: false, reward: null }
  // A reward only for an order that still stands (not cancelled, not refunded or returned since the video came in).
  if (to === 'approved') {
    const o = await q.query(`select 1 from orders where id = $1 and status <> 'cancelled' and payment_status in ('paid','partially_refunded') and return_status is null`, [r.order_id])
    if (!o.rows.length) return { changed: false, reward: null, reason: 'order_not_standing' as const }
  }
  await q.query('update video_reviews set status = $2, reviewed_at = now(), reviewed_by = $3, reject_reason = $4 where id = $1', [id, to, actor, to === 'rejected' ? (reason ?? '').slice(0, 300) : null])
  const reward = to === 'approved' ? (await grantReward(q, { email: r.email as string, source: 'review', sourceRef: r.order_id as string })).reward : null
  return { changed: true, reward }
}

/** The customer withdraws (or gives) the consent for advertising use, at any time; the review itself stays. */
export async function setAdConsent(q: Queryable, orderId: string, consent: boolean, version = 'v1') {
  await q.query('update video_reviews set ad_consent = $2, ad_consent_at = now(), ad_consent_version = $3 where order_id = $1', [orderId, consent, consent ? version : null])
}

export async function listVideoReviews(q: Queryable, limit = 200) {
  const { rows } = await q.query(`select r.*, o.order_number from video_reviews r join orders o on o.id = r.order_id order by r.submitted_at desc limit $1`, [limit])
  return rows
}

// ---------------------------------------------------------------- VIP

/**
 * The contact's valid purchases in lei: orders paid (or collected), less what was refunded; cancelled and fully
 * refunded orders never count. Euro and dollar orders count at the rate they were paid at.
 */
export async function validPurchases(q: Queryable, email: string): Promise<number> {
  const { rows } = await q.query(
    `select coalesce(sum(round((total_minor - refunded_minor) * fx_rate)), 0)::bigint as total from orders
     where lower(email) = $1 and status <> 'cancelled' and payment_status in ('paid', 'partially_refunded')`,
    [normalizeEmail(email)],
  )
  return Number(rows[0]?.total ?? 0)
}

/** Reaching the threshold makes the contact VIP once (a reward to choose); later purchases change nothing. */
export async function checkVip(q: Queryable, email: string, now = new Date()) {
  const total = await validPurchases(q, email)
  if (total < VIP_THRESHOLD_RON) return { vip: false as const, total }
  const e = normalizeEmail(email)
  const { rows } = await q.query('insert into vip_members (email, reached_at, total_minor) values ($1, $2, $3) on conflict (email) do nothing returning email', [e, now, total])
  if (!rows.length) return { vip: true as const, total, new: false }
  const { reward } = await grantReward(q, { email: e, source: 'vip', sourceRef: e, now })
  await q.query('update vip_members set reward_id = $2 where email = $1', [e, reward.id])
  return { vip: true as const, total, new: true, reward }
}

// ---------------------------------------------------------------- the daily settlement

/** Referrals that qualified become the referrer's rewards (once per attributed order). */
export async function settleRewards(q: Queryable, now = new Date()) {
  const qualified = await settleReferrals(q, now)
  let granted = 0
  for (const a of qualified) {
    const { created } = await grantReward(q, { email: a.referrer, source: 'referral', sourceRef: a.id, now })
    await q.query(`update referral_attributions set status = 'rewarded' where id = $1`, [a.id])
    if (created) granted++
  }
  return { qualified: qualified.length, granted }
}

export const REVIEW_GIFTS = GIFT_PRODUCTS
