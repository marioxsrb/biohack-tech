/**
 * The review video against a REAL Supabase Storage bucket (staging only; skipped unless VIDEO_IT_URL, VIDEO_IT_KEY and
 * VIDEO_IT_BUCKET are set, and refused on the production project). Synthetic files and a synthetic order (PGlite):
 * a valid upload, a wrong type, the size limit, access without the key, an expired link, replacing a rejected video
 * (the old file deleted) and the admin preview link (audited).
 *
 *   VIDEO_IT_URL=https://<staging>.supabase.co VIDEO_IT_KEY=… VIDEO_IT_BUCKET=… [VIDEO_IT_SMALL_BUCKET=<1 MB bucket>] npx vitest run tests/server/video-storage-live.test.ts
 */
import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 120_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const URL_ = process.env.VIDEO_IT_URL ?? ''
const KEY = process.env.VIDEO_IT_KEY ?? ''
const BUCKET = process.env.VIDEO_IT_BUCKET ?? ''
const SMALL = process.env.VIDEO_IT_SMALL_BUCKET ?? ''
const live = !!(URL_ && KEY && BUCKET) && !URL_.includes('whboehkartnchujhewhg')

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')

/** A tiny synthetic MP4 header (ftyp box) padded to `size` bytes: never a customer's video. */
const fakeMp4 = (size = 4096) => {
  const b = new Uint8Array(size)
  b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
  return b
}
const put = (url: string, body: Uint8Array, type: string) => fetch(url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: new Blob([body as BlobPart]) })

describe.skipIf(!live)('review video on the staging storage', () => {
  it('upload, wrong type, size, no key, expired link, replacement with deletion, admin preview', async () => {
    const db = await freshDb({ ...TEST_ENV, ADMIN_SESSION_SECRET: 'x'.repeat(40), VIDEO_STORAGE_URL: URL_, VIDEO_STORAGE_KEY: KEY, VIDEO_STORAGE_BUCKET: BUCKET })
    const svc = await import('@/server/orders/service')
    const account = await import('@/server/account')
    const rewards = await import('@/server/rewards')
    const { videoStorage } = await import('@/server/integrations/video-storage')
    const { POST: review } = await import('@/app/api/cont/review/route')
    const { GET: adminVideo } = await import('@/app/api/admin/review-video/[id]/route')
    const storage = videoStorage()
    const call = (body: Record<string, unknown>) => review(new NextRequest('https://biohack-tech.ro/api/cont/review', { method: 'POST', body: JSON.stringify(body) }))

    const email = `test+video-${Date.now()}@biohack-tech.ro`
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, email, paymentMethod: 'cod' }, attemptId: `video-${Date.now()}` })
    await svc.markShipped(order.id, 'admin', { courier: 'Sameday', trackingNumber: 'TEST1' })
    await svc.markDelivered(order.id, 'admin')
    await svc.confirmPayment(order.id, 'admin', { amountMinor: order.totalMinor, currency: 'RON', reference: 'TEST' })
    const t = account.accountToken(email)!

    // Refused before any upload: a wrong type, a file over 300 MB, another address.
    expect((await (await call({ step: 'start', t, orderId: order.id, contentType: 'text/plain', sizeBytes: 100 })).json()).error).toBe('bad_type')
    expect((await (await call({ step: 'start', t, orderId: order.id, contentType: 'video/mp4', sizeBytes: 300 * 1024 * 1024 + 1 })).json()).error).toBe('too_large')
    expect((await call({ step: 'start', t: account.accountToken('altcineva@biohack-tech.ro'), orderId: order.id, contentType: 'video/mp4', sizeBytes: 100 })).status).toBe(404)

    // A valid upload, straight to the storage with the one-path signed URL.
    const first = await (await call({ step: 'start', t, orderId: order.id, contentType: 'video/mp4', sizeBytes: 4096 })).json()
    expect(first.ok).toBe(true)
    // The bucket itself refuses a non-video file, even through a valid signed URL.
    const wrong = await put(first.uploadUrl, new TextEncoder().encode('not a video'), 'text/plain')
    expect(wrong.ok).toBe(false)
    expect((await put(first.uploadUrl, fakeMp4(), 'video/mp4')).ok).toBe(true)
    expect(await storage.stat(first.key)).toMatchObject({ size: 4096, contentType: 'video/mp4' })
    expect((await call({ step: 'done', t, orderId: order.id, key: first.key, contentType: 'video/mp4', sizeBytes: 4096, rating: 5, adConsent: false })).status).toBe(200)

    // Without the key: neither a public URL nor a plain request reads it.
    expect((await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${first.key}`)).ok).toBe(false)
    expect((await fetch(`${URL_}/storage/v1/object/${BUCKET}/${first.key}`)).ok).toBe(false)
    expect((await fetch(`${URL_}/storage/v1/object/authenticated/${BUCKET}/${first.key}`)).ok).toBe(false)

    // An expired signed link reads nothing.
    const short = await storage.downloadUrl(first.key, 1)
    await new Promise((r) => setTimeout(r, 2500))
    expect((await fetch(short!)).ok).toBe(false)

    // The admin preview: refused without the admin login; with it, a 10-minute link to the file, audited.
    const id = (await db.query<{ id: string }>('select id from video_reviews where order_id = $1', [order.id])).rows[0].id
    expect((await adminVideo(new NextRequest(`https://biohack-tech.ro/api/admin/review-video/${id}`), { params: Promise.resolve({ id }) })).status).toBe(401)
    const basic = `Basic ${Buffer.from(`admin:${TEST_ENV.ADMIN_PASSWORD}`).toString('base64')}`
    const preview = await adminVideo(new NextRequest(`https://biohack-tech.ro/api/admin/review-video/${id}`, { headers: { authorization: basic } }), { params: Promise.resolve({ id }) })
    expect(preview.status).toBe(303)
    const file = await fetch(preview.headers.get('location')!)
    expect(file.ok).toBe(true)
    expect((await file.arrayBuffer()).byteLength).toBe(4096)
    expect((await db.query("select count(*)::int as n from admin_audit where action = 'video_review.viewed'")).rows[0].n).toBe(1)

    // Rejected, then replaced: the new file is kept, the old one deleted.
    await rewards.reviewVideo(db, id, 'rejected', 'admin', 'test')
    const second = await (await call({ step: 'start', t, orderId: order.id, contentType: 'video/webm', sizeBytes: 2048 })).json()
    expect((await put(second.uploadUrl, fakeMp4(2048), 'video/webm')).ok).toBe(true)
    expect((await call({ step: 'done', t, orderId: order.id, key: second.key, contentType: 'video/webm', sizeBytes: 2048, adConsent: true })).status).toBe(200)
    expect(await storage.stat(first.key)).toBeNull()
    expect(await storage.stat(second.key)).toMatchObject({ size: 2048 })

    // The size limit is enforced by the storage too (a 1 MB bucket stands in for 300 MB: same mechanism).
    if (SMALL) {
      const small = videoStorage({ VIDEO_STORAGE_URL: URL_, VIDEO_STORAGE_KEY: KEY, VIDEO_STORAGE_BUCKET: SMALL })
      const up = await small.uploadUrl(`limit/${Date.now()}.mp4`)
      expect((await put(up!.url, fakeMp4(2 * 1024 * 1024), 'video/mp4')).ok).toBe(false)
    }

    await storage.remove(second.key)
    expect(await storage.stat(second.key)).toBeNull()
  })
})
