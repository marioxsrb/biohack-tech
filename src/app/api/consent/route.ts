import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_POLICY_VERSION } from '@/lib/consent/cookies'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIONS = new Set(['accept_all', 'reject_all', 'custom'])

/**
 * Logs a cookie choice as proof of consent: the browser's random id, the categories, the policy version,
 * the action and the page path. The IP is used only for rate limiting, in memory, and is never stored.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`consent:${clientIp(req.headers)}`, 30, 10 * 60_000)) return NextResponse.json({ ok: false }, { status: 429 })
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (
    !b ||
    typeof b.id !== 'string' ||
    !UUID.test(b.id) ||
    b.version !== COOKIE_POLICY_VERSION ||
    typeof b.analytics !== 'boolean' ||
    typeof b.marketing !== 'boolean' ||
    typeof b.action !== 'string' ||
    !ACTIONS.has(b.action)
  ) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const page = typeof b.page === 'string' && b.page.startsWith('/') ? b.page.split('?')[0].slice(0, 120) : null
  try {
    const db = await getDb()
    await db.query('insert into cookie_consents (consent_id, policy_version, analytics, marketing, action, page) values ($1,$2,$3,$4,$5,$6)', [
      b.id,
      b.version,
      b.analytics,
      b.marketing,
      b.action,
      page,
    ])
  } catch (e) {
    log.warn('consent.log_failed', { error: errText(e) })
    return NextResponse.json({ ok: false }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
