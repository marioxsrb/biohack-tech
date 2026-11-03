import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { ordersCsv } from '@/server/admin/orders-export'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { isQueue, orders } from '@/server/orders/repository'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const LIMIT = 5000

/**
 * GET /api/admin/export: orders as a CSV file for Excel or Google Sheets (server/admin/orders-export.ts).
 *   ?ids=<id>&ids=<id>…     the orders ticked in /admin/comenzi
 *   ?de=YYYY-MM-DD&pana=…   a period (Bucharest days, both included), optionally with the page's q= and coada=
 * Newest first, at most 5000 orders. Only for a signed-in admin (the session cookie, or Basic Auth for scripts).
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`admin-export:${clientIp(req.headers)}`, 30, 60_000)) return NextResponse.json({ error: 'rate limit' }, { status: 429 })
  if ((await checkAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))) !== 'ok')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const sp = req.nextUrl.searchParams
  const ids = sp.getAll('ids').filter(Boolean)
  const from = sp.get('de') ?? ''
  const to = sp.get('pana') ?? ''
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) return NextResponse.json({ error: 'dată invalidă' }, { status: 400 })
  const queue = sp.get('coada') ?? ''
  const search = (sp.get('q') ?? '').trim().slice(0, 80)
  try {
    const list = await orders.list(await getDb(), {
      limit: LIMIT,
      ids: ids.length ? ids.slice(0, LIMIT) : undefined,
      from: from || undefined,
      to: to || undefined,
      search: ids.length ? undefined : search || undefined,
      queue: !ids.length && isQueue(queue) ? queue : undefined,
    })
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' })
    const name = from || to ? `comenzi-${from || 'inceput'}_${to || today}.csv` : `comenzi-${today}.csv`
    return new NextResponse(ordersCsv(list), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (e) {
    log.error('admin.export_failed', { error: errText(e) })
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
