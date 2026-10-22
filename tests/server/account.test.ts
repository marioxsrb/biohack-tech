/**
 * The customer's account by signed link (server/account.ts): the address is inside the signature, links expire, a
 * voucher or a reward of another address is never shown or used; the review upload only for the customer's own
 * delivered order; the reward chosen once. PGlite; the storage stubbed at the HTTP boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`redirect:${u}`) } }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const account = await import('@/server/account')
const v = await import('@/server/vouchers')
const rewards = await import('@/server/rewards')
const { GET: use } = await import('@/app/api/cont/folosire/route')
const { POST: review } = await import('@/app/api/cont/review/route')
const { chooseRewardAction } = await import('@/app/[lang]/(site)/cont/[token]/actions')

let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb({ ...TEST_ENV, ADMIN_SESSION_SECRET: 'x'.repeat(40), VIDEO_STORAGE_URL: 'https://proj.supabase.co', VIDEO_STORAGE_KEY: 'k', VIDEO_STORAGE_BUCKET: 'rv' })
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(String(url).includes('/upload/sign/') ? { url: '/object/upload/sign/rv/x?token=t' } : {}), { status: 200 }))
})
afterEach(() => vi.unstubAllGlobals())

const delivered = async (email: string) => {
  const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, email, paymentMethod: 'cod' }, attemptId: `acc-${email}-${Math.random()}` })
  await svc.markShipped(order.id, 'admin', { courier: 'Sameday', trackingNumber: 'A1' })
  await svc.markDelivered(order.id, 'admin')
  await svc.confirmPayment(order.id, 'admin', { amountMinor: order.totalMinor, currency: 'RON', reference: 'BORD-1' })
  return order
}

describe('signed links', () => {
  it('open only their own address; altered, expired or unsigned tokens open nothing', () => {
    const t = account.accountToken('Ana@Exemplu.ro')!
    expect(account.accountEmail(t)).toBe('ana@exemplu.ro')
    const [e, exp, sig] = t.split('.')
    const other = Buffer.from('ion@exemplu.ro').toString('base64url')
    expect(account.accountEmail(`${other}.${exp}.${sig}`)).toBeNull()
    expect(account.accountEmail(`${e}.${Number(exp) + 1}.${sig}`)).toBeNull()
    expect(account.accountEmail(account.accountToken('ana@exemplu.ro', new Date(Date.now() - 31 * 86_400_000)))).toBeNull()
    expect(account.accountEmail('nimic')).toBeNull()
  })
})

describe('using a voucher from the account', () => {
  it('own active voucher: the code cookie and the product page; another address’s voucher: nothing', async () => {
    const mine = await v.issueVoucher(db, { email: 'ana@exemplu.ro', productId: 'balance-wave', source: 'admin' })
    const theirs = await v.issueVoucher(db, { email: 'ion@exemplu.ro', productId: 'brainlink-pro', source: 'admin' })
    if (!mine.ok || !theirs.ok) throw new Error('issue')
    const t = account.accountToken('ana@exemplu.ro')!
    const ok = await use(new NextRequest(`https://biohack-tech.ro/api/cont/folosire?t=${t}&cod=${mine.voucher.code}`))
    expect(ok.headers.get('location')).toBe('https://biohack-tech.ro/products/calm')
    expect(ok.headers.get('set-cookie')).toContain(`bt_promo=${mine.voucher.code}`)
    const no = await use(new NextRequest(`https://biohack-tech.ro/api/cont/folosire?t=${t}&cod=${theirs.voucher.code}`))
    expect(no.headers.get('location')).toBe('https://biohack-tech.ro/')
    expect(no.headers.get('set-cookie')).toBeNull()
  })
})

describe('the review upload', () => {
  const call = (body: Record<string, unknown>) => review(new NextRequest('https://biohack-tech.ro/api/cont/review', { method: 'POST', body: JSON.stringify(body) }))
  it('own delivered order only; one video; the advertising consent recorded separately with its version', async () => {
    const o = await delivered('ana@exemplu.ro')
    const t = account.accountToken('ana@exemplu.ro')!
    const other = account.accountToken('ion@exemplu.ro')!
    expect((await call({ step: 'start', t: other, orderId: o.id, contentType: 'video/mp4', sizeBytes: 1000 })).status).toBe(404)
    const start = await (await call({ step: 'start', t, orderId: o.id, contentType: 'video/mp4', sizeBytes: 1000 })).json()
    expect(start.uploadUrl).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/upload\/sign\//)
    expect((await call({ step: 'done', t, orderId: o.id, key: 'altceva/x.mp4', contentType: 'video/mp4', sizeBytes: 1000, adConsent: true })).status).toBe(422)
    expect((await call({ step: 'done', t, orderId: o.id, key: start.key, contentType: 'video/mp4', sizeBytes: 1000, rating: 3, adConsent: true })).status).toBe(200)
    expect((await db.query('select status, rating, ad_consent, ad_consent_version from video_reviews')).rows[0]).toEqual({ status: 'received', rating: 3, ad_consent: true, ad_consent_version: account.AD_CONSENT_VERSION })
    expect((await (await call({ step: 'start', t, orderId: o.id, contentType: 'video/mp4', sizeBytes: 1000 })).json()).error).toBe('already_sent')
  })
})

describe('choosing a reward', () => {
  it('only the address’s own reward; once', async () => {
    const o = await delivered('ana@exemplu.ro')
    const { reward } = await rewards.grantReward(db, { email: 'ana@exemplu.ro', source: 'review', sourceRef: o.id })
    const choose = async (token: string, choice: string) => {
      const f = new FormData()
      f.set('t', token)
      f.set('reward', reward.id)
      f.set('choice', choice)
      return chooseRewardAction(f).catch((e: Error) => e.message)
    }
    expect(await choose(account.accountToken('ion@exemplu.ro')!, 'gift:carte-diana')).toMatch(/r=eroare/)
    expect(await choose(account.accountToken('ana@exemplu.ro')!, 'gift:carte-diana')).toMatch(/r=ales/)
    await choose(account.accountToken('ana@exemplu.ro')!, 'gift:ochelari-biohack')
    expect((await db.query("select product_id from vouchers where kind = 'gift'")).rows).toEqual([{ product_id: 'carte-diana' }])
  })
})
