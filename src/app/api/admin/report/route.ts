import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminSession } from '@/lib/admin-auth'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { rateLimit } from '@/server/rate-limit'
import { buildReport, period, reportMarkdown } from '@/server/report'

export const runtime = 'nodejs'

/** The bearer token an AI assistant uses (ADMIN_API_TOKEN, at least 32 characters); without it only a signed-in admin. */
function tokenOk(header: string | null, query: string | null) {
  const expected = process.env.ADMIN_API_TOKEN ?? ''
  // The header is preferred; ?token= is for assistants that can only open a link (it may end up in their logs).
  const given = header?.startsWith('Bearer ') ? header.slice(7).trim() : (query ?? '').trim()
  if (expected.length < 32 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The business report (server/report.ts) for an AI assistant or a script:
 *   GET /api/admin/report                    yesterday (Bucharest), JSON
 *   GET /api/admin/report?perioada=azi|7|30|YYYY-MM-DD
 *   GET /api/admin/report?format=md          the same as text (Romanian), ready to summarise
 * Authorization: Bearer <ADMIN_API_TOKEN> (or ?token=<ADMIN_API_TOKEN>), or the admin session cookie. Read-only.
 */
export async function GET(req: NextRequest) {
  const allowed = tokenOk(req.headers.get('authorization'), req.nextUrl.searchParams.get('token')) || (await checkAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) === 'ok'
  if (!allowed) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  if (!rateLimit('admin-report', 120, 60_000)) return NextResponse.json({ error: 'rate limit' }, { status: 429 })
  const sp = req.nextUrl.searchParams
  try {
    const r = await buildReport(await getDb(), period(sp.get('perioada') ?? sp.get('period') ?? undefined))
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
    if (sp.get('format') === 'md' || sp.get('format') === 'text')
      return new NextResponse(reportMarkdown(r), { headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' } })
    return NextResponse.json(r, { headers })
  } catch (e) {
    log.error('admin.report_failed', { error: errText(e) })
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
