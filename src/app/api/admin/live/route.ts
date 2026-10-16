import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { salesFeed } from '@/server/admin/sales-feed'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /api/admin/live?after=<cursor>: the orders placed since the cursor, for the KA-CHING in /admin
 * (server/admin/sales-feed.ts). Only for a signed-in admin (the session cookie, or Basic Auth for scripts); one
 * browser tab polls it every few seconds.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-live:${clientIp(req.headers)}`, 60, 60_000)) return json({ error: 'rate limit' }, 429)
  if ((await checkAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))) !== 'ok') return json({ error: 'unauthorized' }, 401)
  const raw = req.nextUrl.searchParams.get('after')
  const after = raw && /^\d{1,15}$/.test(raw) ? Number(raw) : null
  try {
    return json(await salesFeed(await getDb(), after))
  } catch (e) {
    log.error('admin.live_error', { error: errText(e) })
    return json({ error: 'server error' }, 500)
  }
}
