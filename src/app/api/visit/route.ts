import { NextResponse, type NextRequest } from 'next/server'
import { funnelForHost } from '@/lib/lead'
import { getDb } from '@/server/db'
import { countVisit } from '@/server/leads'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const PAGES = new Set(['home', 'calm', 'focus', 'amber', 'products', 'checkout'])

/**
 * Anonymous page counts per funnel and day, for comparing the two funnels in /admin. No cookie, no id, no IP
 * stored: one counter goes up. Not a visitor count (a person loading two pages counts twice).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`visit:${clientIp(req.headers)}`, 60, 10 * 60_000)) return new NextResponse(null, { status: 204 })
  const page = (await req.text().catch(() => '')).slice(0, 20)
  if (!PAGES.has(page)) return new NextResponse(null, { status: 204 })
  try {
    await countVisit(await getDb(), funnelForHost(req.headers.get('host')), page)
  } catch {}
  return new NextResponse(null, { status: 204 })
}
