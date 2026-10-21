/**
 * The workflow engine in dry run, and the rewards, on the real order flow (PGlite, Stripe stubbed):
 *   - WORKFLOWS_MODE off (the default): nothing is enrolled, nothing is recorded;
 *   - an abandoned card checkout enrolls Abandoned Cart once; a FAILED payment is kept apart;
 *   - Post-Purchase: one sequence per contact, a second order within it joins it (no email twice);
 *   - the dry run records what would go, stops on purchase and on unsubscribe, keeps the weekly limit, never issues;
 *   - Review Video: one per order, approval earns one reward whatever the rating, the gift claimed once;
 *   - Referral: a friend's first order with 10%, never self-referral, rewarded after delivery + return window;
 *   - VIP: once, from valid purchases (refunds out).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const { orders } = await import('@/server/orders/repository')
const svc = await import('@/server/orders/service')
const wf = await import('@/server/workflows/engine')
const rewards = await import('@/server/rewards')
const referrals = await import('@/server/referrals')
const { marketing } = await import('@/server/marketing/consent')
const { videoStorage } = await import('@/server/integrations/video-storage')
const { welcomeSignup } = await import('@/server/welcome')
const { popupProduct } = await import('@/server/popup-vouchers')

const BASE = Object.fromEntries(Object.entries(TEST_ENV).filter(([k]) => !k.startsWith('GHL_')))
let db: Awaited<ReturnType<typeof freshDb>>
let seq = 0

beforeEach(async () => {
  db = await freshDb({ ...BASE, EMAIL_TRANSPORT: 'smtp', WORKFLOWS_MODE: 'dry_run' })
})
afterEach(() => vi.unstubAllGlobals())

type Raw = { productId: string; variantId?: string; quantity: number }
const CALM: Raw = { productId: 'balance-wave', quantity: 1 }
const AMBER: Raw = { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }
const place = async (raw: Raw[], method: 'card' | 'transfer' | 'cod' = 'cod', extra: Partial<typeof person> = {}, promoCode?: string) => {
  const { order } = await svc.placeOrder({ lines: lines(raw), form: { ...person, ...extra, paymentMethod: method }, attemptId: `wf-${++seq}`, promoCode })
  return order
}
const delivered = async (raw: Raw[], extra: Partial<typeof person> = {}, promoCode?: string) => {
  const o = await place(raw, 'cod', extra, promoCode)
  await svc.markShipped(o.id, 'admin', { courier: 'Sameday', trackingNumber: `AWB${seq}` })
  await svc.markDelivered(o.id, 'admin')
  await svc.confirmPayment(o.id, 'admin', { amountMinor: o.totalMinor, currency: 'RON', reference: 'BORD-1' })
  return (await orders.byId(db, o.id))!
}
type E = { workflow: string; ref: string; status: string; step: number; stop_reason: string | null; data: { products?: string[]; orders?: string[] } }
const enrollments = async () => (await db.query('select workflow, ref, status, step, stop_reason, data from workflow_enrollments order by started_at')).rows as E[]
const sends = async () => (await db.query('select workflow, template, status, reason from email_sends order by id')).rows

describe('mode', () => {
  it('off by default: an abandoned checkout and a delivery enroll nothing, the tick does nothing', async () => {
    db = await freshDb({ ...BASE, EMAIL_TRANSPORT: 'smtp' })
    const o = await place([CALM], 'card')
    await svc.markAbandonedIfUnpaid(o.id)
    await delivered([AMBER])
    expect(await enrollments()).toEqual([])
    expect(await wf.workflowTick(db)).toEqual([])
    expect(wf.workflowsMode({ WORKFLOWS_MODE: 'live' })).toBe('off')
  })
})

describe('Abandoned Cart vs failed payment', () => {
  it('an unpaid card checkout enrolls Abandoned Cart once, with its products', async () => {
    const o = await place([CALM, AMBER], 'card')
    await svc.markAbandonedIfUnpaid(o.id)
    await svc.markAbandonedIfUnpaid(o.id)
    const e = await enrollments()
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ workflow: 'abandoned-cart', ref: o.id, status: 'active' })
    expect(e[0].data.products).toEqual(['balance-wave', 'ochelari-biohack'])
  })
  it('a checkout whose card payment FAILED is not an abandoned cart: kept apart, nothing planned', async () => {
    const o = await place([CALM], 'card')
    await svc.attachPaymentIntent(o.id, 'pi_f')
    await svc.recordPaymentFailure(o.id, 'stripe.webhook', 'card_declined', 'pi_f')
    await svc.markAbandonedIfUnpaid(o.id)
    expect(await enrollments()).toEqual([expect.objectContaining({ workflow: 'payment-failed', status: 'paused', stop_reason: 'copy_pending' })])
    expect(await wf.workflowTick(db, { now: new Date(Date.now() + 2 * 3_600_000) })).toEqual([])
  })
  it('dry run: the 1-hour email is recorded; a purchase stops the rest; nothing is issued', async () => {
    await marketing.grant(db, { email: person.email, source: 'checkout' })
    const o = await place([CALM], 'card')
    await svc.markAbandonedIfUnpaid(o.id)
    const t0 = Date.now()
    await wf.workflowTick(db, { now: new Date(t0 + 61 * 60_000) })
    expect(await sends()).toEqual([{ workflow: 'abandoned-cart', template: 'abandoned-cart-01', status: 'dry_run', reason: null }])
    await place([CALM], 'transfer')
    await wf.workflowTick(db, { now: new Date(t0 + 21 * 3_600_000) })
    expect((await enrollments())[0]).toMatchObject({ status: 'stopped', stop_reason: 'purchased' })
    expect((await db.query('select count(*)::int n from vouchers')).rows[0].n).toBe(0)
  })
  it('without marketing consent (or after an unsubscribe) nothing is planned', async () => {
    const o = await place([CALM], 'card')
    await svc.markAbandonedIfUnpaid(o.id)
    await wf.workflowTick(db, { now: new Date(Date.now() + 2 * 3_600_000) })
    expect((await enrollments())[0]).toMatchObject({ status: 'stopped', stop_reason: 'no_consent' })
    expect(await sends()).toEqual([])
  })
})

describe('Post-Purchase', () => {
  it('one sequence per contact: a second order delivered within it joins it, its products added', async () => {
    const a = await delivered([CALM])
    await delivered([AMBER])
    const e = await enrollments()
    expect(e.filter((x) => x.workflow === 'post-purchase')).toHaveLength(1)
    expect(e[0].ref).toBe(a.id)
    expect(e[0].data.products).toEqual(['balance-wave', 'ochelari-biohack'])
    expect(e[0].data.orders).toHaveLength(2)
  })
  it('the guides go without marketing consent; the 4 emails at 0/3/7/14 days, never twice', async () => {
    await delivered([CALM])
    const t0 = Date.now()
    for (const days of [0, 3, 7, 14, 15]) await wf.workflowTick(db, { now: new Date(t0 + days * 86_400_000 + 60_000) })
    expect((await sends()).map((s) => [s.template, s.status])).toEqual([
      ['post-purchase-01', 'dry_run'],
      ['post-purchase-02', 'dry_run'],
      ['post-purchase-03', 'dry_run'],
    ])
    // The 4th (cross-sell) is promotional: without consent the sequence stops there.
    expect((await enrollments())[0]).toMatchObject({ status: 'stopped', stop_reason: 'no_consent' })
  })
})

describe('the weekly limit across workflows (Welcome and Educație in parallel)', () => {
  it('at most 3 promotional emails in 7 days per contact; the rest wait', async () => {
    await marketing.grant(db, { email: person.email, source: 'popup' })
    const t0 = new Date()
    await wf.enroll(db, { email: person.email, workflow: 'welcome', ref: 'w', startAt: t0 })
    await wf.enroll(db, { email: person.email, workflow: 'educatie', ref: 'e', startAt: t0 })
    for (let day = 0; day <= 7; day++) await wf.workflowTick(db, { now: new Date(t0.getTime() + day * 86_400_000 + 60_000) })
    const recorded = (await db.query(`select created_at from email_sends where status = 'dry_run' order by created_at`)).rows.map((r) => new Date(r.created_at as string).getTime())
    for (let i = 3; i < recorded.length; i++) expect(recorded[i] - recorded[i - 3]).toBeGreaterThanOrEqual(7 * 86_400_000 - 120_000)
    expect(recorded.length).toBeGreaterThanOrEqual(3)
  })
  it('Win-back and Nudge never together', async () => {
    expect((await wf.enroll(db, { email: person.email, workflow: 'win-back', ref: 'wb' })).ok).toBe(true)
    expect(await wf.enroll(db, { email: person.email, workflow: 'nudge', ref: 'n' })).toEqual({ ok: false, reason: 'exclusive' })
  })
})

describe('Review Video', () => {
  const storage = () => {
    vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(String(url).includes('/upload/sign/') ? { url: '/object/upload/sign/rv/x?token=t' } : { signedURL: '/object/sign/rv/x?token=d' }), { status: 200 }))
    return videoStorage({ VIDEO_STORAGE_URL: 'https://proj.supabase.co', VIDEO_STORAGE_KEY: 'k', VIDEO_STORAGE_BUCKET: 'rv' })
  }
  it('off without storage; only after delivery; one per order; approval → one reward whatever the rating; gift claimed once', async () => {
    expect(videoStorage({}).kind).toBe('none')
    const pending = await place([CALM], 'transfer')
    expect(await rewards.startVideoUpload(db, storage(), { orderId: pending.id, contentType: 'video/mp4', sizeBytes: 1000 })).toEqual({ ok: false, problem: 'not_delivered' })
    const o = await delivered([CALM])
    expect((await rewards.startVideoUpload(db, storage(), { orderId: o.id, contentType: 'image/png', sizeBytes: 1000 })).ok).toBe(false)
    const up = await rewards.startVideoUpload(db, storage(), { orderId: o.id, contentType: 'video/mp4', sizeBytes: 5_000_000 })
    if (!up.ok) throw new Error(up.problem)
    expect(up.uploadUrl).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/upload\/sign\//)
    const rec = await rewards.recordVideoReview(db, { orderId: o.id, key: up.key, contentType: 'video/mp4', sizeBytes: 5_000_000, rating: 2, adConsent: false })
    if (!rec.ok) throw new Error('not recorded')
    expect((await rewards.startVideoUpload(db, storage(), { orderId: o.id, contentType: 'video/mp4', sizeBytes: 10 })).ok).toBe(false)
    const approved = await rewards.reviewVideo(db, rec.id, 'approved', 'admin')
    expect(approved.reward).toMatchObject({ source: 'review', sourceRef: o.id, status: 'available' })
    expect((await rewards.reviewVideo(db, rec.id, 'approved', 'admin')).changed).toBe(false)
    expect(await rewards.claimReward(db, approved.reward!.id, { kind: 'voucher', productId: 'balance-wave' })).toEqual({ ok: false, problem: 'gift_only' })
    expect(await rewards.claimReward(db, approved.reward!.id, { kind: 'gift', productId: 'balance-wave' })).toEqual({ ok: false, problem: 'not_gift_product' })
    const claimed = await rewards.claimReward(db, approved.reward!.id, { kind: 'gift', productId: 'carte-diana' })
    const again = await rewards.claimReward(db, approved.reward!.id, { kind: 'gift', productId: 'ochelari-biohack' })
    expect(claimed.ok && again.ok && claimed.voucher.id === again.voucher.id).toBe(true)
    expect((await db.query("select count(*)::int n from vouchers where kind = 'gift'")).rows[0].n).toBe(1)
    // The advertising consent is separate and can change; the review stays approved.
    await rewards.setAdConsent(db, o.id, true)
    expect((await db.query('select ad_consent, status from video_reviews')).rows[0]).toEqual({ ad_consent: true, status: 'approved' })
  })
})

describe('Referral', () => {
  it('a friend’s first order gets 10%; self-referral and returning customers are refused; rewarded after the return window', async () => {
    const referrer = 'ion@exemplu.ro'
    await delivered([AMBER], { email: referrer, phone: '0733111222', address: 'Str. Ion 1' })
    const code = await referrals.referralCodeFor(db, referrer)
    expect(await referrals.referralCodeFor(db, referrer)).toBe(code)
    // Self: the referrer's own address or phone.
    await expect(place([CALM], 'cod', { email: referrer, phone: '0733111222' }, code)).rejects.toThrow(/promo code/)
    await expect(place([CALM], 'cod', { email: 'alt@exemplu.ro', phone: '0733111222' }, code)).rejects.toThrow(/promo code/)
    // A friend's first order: 10% of the full price.
    const friend = await place([CALM], 'cod', { email: 'prieten@exemplu.ro', phone: '0744000111', address: 'Str. Prieten 2' }, code)
    expect(friend.discountMinor).toBe(63800)
    // The same friend again: not a first order.
    await expect(place([CALM], 'cod', { email: 'prieten@exemplu.ro', phone: '0744000111' }, code)).rejects.toThrow(/promo code/)
    await svc.markShipped(friend.id, 'admin', { courier: 'Sameday', trackingNumber: 'AWBF' })
    await svc.markDelivered(friend.id, 'admin')
    await svc.confirmPayment(friend.id, 'admin', { amountMinor: friend.totalMinor, currency: 'RON', reference: 'BORD-2' })
    expect(await rewards.settleRewards(db)).toEqual({ qualified: 0, granted: 0 })
    expect(await rewards.settleRewards(db, new Date(Date.now() + 15 * 86_400_000))).toEqual({ qualified: 1, granted: 1 })
    expect(await rewards.settleRewards(db, new Date(Date.now() + 16 * 86_400_000))).toEqual({ qualified: 0, granted: 0 })
    const [r] = await rewards.rewardsFor(db, referrer)
    expect(r).toMatchObject({ source: 'referral', status: 'available' })
    const claimed = await rewards.claimReward(db, r.id, { kind: 'voucher', productId: 'balance-wave' })
    expect(claimed.ok && claimed.voucher.amountMinor).toBe(64000)
  })
  it('the same shipping address as the referrer: the friend keeps the 10%, the referrer gets no reward', async () => {
    await delivered([AMBER], { email: 'ion@exemplu.ro', phone: '0733111222', address: 'Str. Ion 1' })
    const code = await referrals.referralCodeFor(db, 'ion@exemplu.ro')
    const f = await place([CALM], 'cod', { email: 'sotia@exemplu.ro', phone: '0744000222', address: 'str. ion 1' }, code)
    expect(f.discountMinor).toBe(63800)
    expect((await db.query('select status, reason from referral_attributions')).rows[0]).toEqual({ status: 'rejected', reason: 'same_address' })
  })
})

describe('VIP', () => {
  it('once, from valid purchases: a refund takes its amount out; reaching it again changes nothing', async () => {
    const a = await delivered([CALM], { email: 'vip@exemplu.ro' })
    expect(await rewards.validPurchases(db, 'vip@exemplu.ro')).toBe(a.totalMinor)
    expect((await rewards.checkVip(db, 'vip@exemplu.ro')).vip).toBe(true)
    expect(await rewards.checkVip(db, 'vip@exemplu.ro')).toMatchObject({ vip: true, new: false })
    expect((await db.query("select count(*)::int n from rewards where source = 'vip'")).rows[0].n).toBe(1)
    const b = await delivered([AMBER], { email: 'aproape@exemplu.ro' })
    await svc.recordRefund(b.id, 'admin', b.totalMinor)
    expect(await rewards.validPurchases(db, 'aproape@exemplu.ro')).toBe(0)
    expect((await rewards.checkVip(db, 'aproape@exemplu.ro')).vip).toBe(false)
  })
})

describe('landing popups: fixed voucher instead of 10% (prepared, off)', () => {
  const welcomeJobs = async () => (await db.query("select count(*)::int n from jobs where kind = 'email.welcome'")).rows[0].n
  it('which popup: the landing host or the product page; the main site has none', () => {
    expect(popupProduct(null, 'amber')?.product).toBe('ochelari-biohack')
    expect(popupProduct('/products/calm', null)?.workflow).toBe('landing-calm')
    expect(popupProduct('/', null)).toBeNull()
  })
  it('off (default): the 10% email as today, no voucher', async () => {
    await db.tx((t) => welcomeSignup(t, 'a@exemplu.ro', '/products/calm', 'ro', 'ro', undefined, 'calm'))
    expect(await welcomeJobs()).toBe(1)
    expect((await db.query('select count(*)::int n from vouchers')).rows[0].n).toBe(0)
  })
  it('POPUP_VOUCHERS=on alone (no sub-account to send the voucher email): still the 10% email', async () => {
    vi.stubEnv('POPUP_VOUCHERS', 'on')
    await db.tx((t) => welcomeSignup(t, 'z@exemplu.ro', '/products/calm', 'ro', 'ro', undefined, 'calm'))
    expect(await welcomeJobs()).toBe(1)
    expect((await db.query('select count(*)::int n from vouchers')).rows[0].n).toBe(0)
  })
  it('on: the product voucher and its landing sequence instead; a contact who bought the product gets the 10% email', async () => {
    vi.stubEnv('POPUP_VOUCHERS', 'on')
    vi.stubEnv('GHL_WF_TOKEN', 'pit-sub')
    vi.stubEnv('GHL_WF_LOCATION_ID', 'loc-sub')
    await db.tx((t) => welcomeSignup(t, 'b@exemplu.ro', '/', 'ro', 'ro', undefined, 'focus'))
    expect(await welcomeJobs()).toBe(0)
    expect((await db.query("select product_id, amount_minor, source from vouchers")).rows).toEqual([{ product_id: 'brainlink-pro', amount_minor: 32500, source: 'landing-focus' }])
    expect((await enrollments()).map((e) => e.workflow)).toEqual(['landing-focus'])
    await delivered([CALM], { email: 'c@exemplu.ro' })
    await db.tx((t) => welcomeSignup(t, 'c@exemplu.ro', '/products/calm', 'ro', 'ro', undefined, null))
    expect(await welcomeJobs()).toBe(1)
  })
})
