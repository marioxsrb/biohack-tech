import { NextResponse, type NextRequest } from 'next/server'
import { AD_CONSENT_VERSION, accountEmail, ownsOrder } from '@/server/account'
import { getDb } from '@/server/db'
import { isVideoType, MAX_VIDEO_BYTES, videoStorage } from '@/server/integrations/video-storage'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { recordVideoReview, startVideoUpload } from '@/server/rewards'

export const runtime = 'nodejs'

/**
 * The review video upload, for the address in the signed link and its own delivered order only:
 *   { step: 'start', t, orderId, contentType, sizeBytes }   → a one-path upload URL (the browser sends the file there)
 *   { step: 'done', t, orderId, key, contentType, sizeBytes, rating?, adConsent }   → the review is received
 * Nothing about the video passes through this server; nothing is public.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`review:${clientIp(req.headers)}`, 20, 60 * 60_000)) return NextResponse.json({ ok: false, error: 'RATE_LIMIT' }, { status: 429 })
  let body: Record<string, unknown>
  try {
    const raw = await req.text()
    if (raw.length > 4000) throw new Error('too large')
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
  }
  const email = accountEmail(typeof body.t === 'string' ? body.t : null)
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const db = await getDb()
  if (!email || !(await ownsOrder(db, email, orderId))) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
  const storage = videoStorage()
  try {
    if (body.step === 'start') {
      const r = await startVideoUpload(db, storage, { orderId, contentType: String(body.contentType ?? ''), sizeBytes: Number(body.sizeBytes) })
      return r.ok ? NextResponse.json({ ok: true, uploadUrl: r.uploadUrl, key: r.key }) : NextResponse.json({ ok: false, error: r.problem }, { status: 422 })
    }
    if (body.step === 'done') {
      // Only a file that really arrived, of a video type and within the size limit, is recorded (never a reward for
      // an upload that did not happen).
      const file = await storage.stat(String(body.key ?? ''))
      if (!file || file.size <= 0 || file.size > MAX_VIDEO_BYTES || !isVideoType(file.contentType.split(';')[0])) return NextResponse.json({ ok: false, error: 'NOT_UPLOADED' }, { status: 422 })
      const rating = body.rating == null ? null : Number(body.rating)
      const r = await db.tx((t) =>
        recordVideoReview(t, { orderId, key: String(body.key ?? ''), contentType: String(body.contentType ?? ''), sizeBytes: file.size, rating, adConsent: body.adConsent === true, adConsentVersion: AD_CONSENT_VERSION }, storage),
      )
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: 'NOT_ACCEPTED' }, { status: 422 })
    }
  } catch (e) {
    log.error('review.upload_failed', { error: errText(e) })
    return NextResponse.json({ ok: false, error: 'SERVER' }, { status: 500 })
  }
  return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 })
}
