import { NextResponse, type NextRequest } from 'next/server'

import { WELCOME_GIFTS } from '@/config/promotions'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { drawGift } from '@/server/welcome'

export const runtime = 'nodejs'

/**
 * Opens one of the popup's three boxes: the server draws the gift, so the browser cannot choose it. Answers with the
 * gift and the box id the email form sends back. The IP is used only for rate limiting, in memory.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`welcome-gift:${clientIp(req.headers)}`, 6, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  try {
    const db = await getDb()
    const { id, gift } = await db.tx((t) => drawGift(t))
    return NextResponse.json({ ok: true, id, gift, title: WELCOME_GIFTS[gift].title, badge: WELCOME_GIFTS[gift].badge, detail: WELCOME_GIFTS[gift].detail })
  } catch (e) {
    log.error('welcome.gift_failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER' }, { status: 500 })
  }
}
