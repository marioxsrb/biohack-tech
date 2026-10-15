import { isIntlHost } from '@/lib/sites'
import { NextResponse, type NextRequest } from 'next/server'
import { funnelForHost, isGatedHost } from '@/lib/lead'
import { landingForHost } from '@/lib/landing-hosts'
import { getDb } from '@/server/db'
import { countVisit } from '@/server/leads'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const PAGES = new Set(['home', 'calm', 'focus', 'amber', 'products', 'checkout'])
/** utm_source / utm_campaign as short slugs; anything else counts as no campaign. */
const slug = (v: unknown) => (typeof v === 'string' && /^[\w.-]{1,40}$/.test(v) ? v.toLowerCase() : '')

/**
 * Anonymous page counts per funnel, day, page and campaign, for the admin stats. No cookie, no id, no IP
 * stored: counters go up. `session` is true on the first page of a browser session (the browser remembers
 * that locally), so sessions are deduplicated without identifying anyone. Accepts the old plain-text body.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`visit:${clientIp(req.headers)}`, 60, 10 * 60_000)) return new NextResponse(null, { status: 204 })
  const raw = (await req.text().catch(() => '')).slice(0, 400)
  let body: { page?: unknown; session?: unknown; source?: unknown; campaign?: unknown } = { page: raw }
  if (raw.startsWith('{')) {
    try {
      body = JSON.parse(raw)
    } catch {
      return new NextResponse(null, { status: 204 })
    }
  }
  const page = typeof body.page === 'string' ? body.page : ''
  if (!PAGES.has(page)) return new NextResponse(null, { status: 204 })
  try {
    const host = req.headers.get('host')
    // Which site: a landing's own hostname (calm., focus., amber.), acces, or the main store.
    const site = landingForHost(host) ?? (isGatedHost(host) ? 'acces' : isIntlHost(host) ? 'net' : 'main')
    await countVisit(await getDb(), funnelForHost(host), page, { session: body.session === true, source: slug(body.source), campaign: slug(body.campaign), site })
  } catch {}
  return new NextResponse(null, { status: 204 })
}
