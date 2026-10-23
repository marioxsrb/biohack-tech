import { NextResponse, type NextRequest } from 'next/server'
import { normalizeContact, validateContact } from '@/lib/lead'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { welcomeSignup } from '@/server/welcome'
import { siteForHost } from '@/lib/sites'
import { landingForHost } from '@/lib/landing-hosts'

export const runtime = 'nodejs'

/** The website's popup (main site and landings): the code by email (10%, or the gift of the box the visitor opened). */
export async function POST(req: NextRequest) {
  if (!rateLimit(`welcome:${clientIp(req.headers)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Prea multe încercări. Încearcă mai târziu.' }, { status: 429 })
  const raw = await req.text()
  if (raw.length > 2_000) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  // A filled hidden field is a bot: answered like a success, nothing recorded.
  if (typeof body.website === 'string' && body.website) return NextResponse.json({ ok: true })
  const { email } = normalizeContact({ email: typeof body.email === 'string' ? body.email : '' })
  if (validateContact({ name: '', email, phone: '' }, ['email']).email) return NextResponse.json({ error: 'INVALID', message: 'Verifică adresa de email.' }, { status: 422 })
  try {
    const db = await getDb()
    const giftId = typeof body.gift === 'string' ? body.gift : undefined
    const r = await db.tx((t) => welcomeSignup(t, email, typeof body.page === 'string' ? body.page : null, body.locale === 'en' ? 'en' : 'ro', siteForHost(req.headers.get('host')), giftId, landingForHost(req.headers.get('host'))))
    kickJobs()
    log.info('welcome.signup', { created: r.created })
    // An address that already got the code: told so, nothing is sent again.
    return NextResponse.json({ ok: true, already: !r.created, voucher: 'voucher' in r && r.voucher === true })
  } catch (e) {
    log.error('welcome.failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Nu am putut trimite codul. Încearcă din nou.' }, { status: 500 })
  }
}
