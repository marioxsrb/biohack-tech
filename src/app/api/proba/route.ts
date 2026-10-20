import { NextResponse, type NextRequest } from 'next/server'

import { site } from '@/config/site'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { MAX_PHOTO_BYTES, isJpeg, savePhoto } from '@/server/try-on-photos'

export const runtime = 'nodejs'

/**
 * Saves a NEUROS Amber try-on photo the visitor chose to share and answers with its link (/proba/<id>). The body is
 * the JPEG itself. The IP is used only for rate limiting, in memory, and is never stored.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`proba:${clientIp(req.headers)}`, 15, 60 * 60_000)) return NextResponse.json({ ok: false }, { status: 429 })
  const bytes = new Uint8Array(await req.arrayBuffer().catch(() => new ArrayBuffer(0)))
  if (!isJpeg(bytes) || bytes.length > MAX_PHOTO_BYTES) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    const id = await savePhoto(bytes)
    return NextResponse.json({ ok: true, url: `${site.url}/proba/${id}` })
  } catch (e) {
    log.warn('proba.save_failed', { error: errText(e) })
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
