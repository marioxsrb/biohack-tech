import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { tbiDecryptJson } from '@/lib/tbi/cryptor'
import { parseStatusUpdate } from '@/lib/tbi/client'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { applyStatusUpdate } from '@/server/tbi-applications'

export const runtime = 'nodejs'

const MAX_BODY = 20_000

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** The encrypted `data` from a JSON body ({"data": "..."}) or a form body (data=...). */
function readData(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { data?: unknown }
      return typeof j.data === 'string' ? j.data : null
    } catch {
      return null
    }
  }
  return new URLSearchParams(t).get('data')
}

/**
 * POST /api/tbi/status?s=<TBI_STATUS_WEBHOOK_SECRET>: TBI Fusion Pay's status updates (the statusURL sent with
 * RegisterApplication). The body's `data` is decrypted with TBI_ENCRYPTION_KEY; command update_status moves the
 * request's card in the "Rate TBI" pipeline (server/tbi-applications.ts). Answers 200 once the update is read,
 * also for an order we do not know (logged), so TBI does not retry forever.
 */
export async function POST(req: NextRequest) {
  const t = getConfig().tbi
  if (!t || !t.webhookSecret) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  const s = req.nextUrl.searchParams.get('s') ?? ''
  if (!sameSecret(s, t.webhookSecret)) {
    log.warn('tbi.status_bad_secret')
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 })
  const data = readData(raw)
  if (!data) return NextResponse.json({ ok: false, error: 'missing_data' }, { status: 400 })
  let update
  try {
    update = parseStatusUpdate(tbiDecryptJson(data, t.encryptionKey))
  } catch (e) {
    log.warn('tbi.status_decrypt_failed', { error: errText(e) })
    return NextResponse.json({ ok: false, error: 'decrypt' }, { status: 400 })
  }
  if (update.command && update.command !== 'update_status') {
    log.info('tbi.status_other_command', { command: update.command, orderId: update.orderId })
    return NextResponse.json({ ok: true })
  }
  if (!update.orderId) return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 })
  try {
    const r = await applyStatusUpdate(getConfig(), await getDb(), update)
    log.info('tbi.status', { orderId: update.orderId, status: update.status, known: r.known, moved: r.moved })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // GHL or the database did not answer: TBI may send the update again.
    log.error('tbi.status_failed', { orderId: update.orderId, error: errText(e) })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
